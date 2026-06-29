import { useState, useEffect } from 'react';
import { Tag, X, HandCoins, Coins, AlertCircle, Store, Package, ShoppingBag } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

// ─── Types ───
interface Item {
  id: string;
  name: string;
  slot: string;
  rarity: string;
  tier: number;
  statBoosts: Record<string, number>;
  durability: number;
  marketPriceCash: number;
  marketPriceGrid: number;
  lastMarketplacePrice: number | null;
  isAvailable: boolean;
}

interface ItemListing {
  id: string;
  price: number;
  status: string;
  createdAt: string;
  seller: { id: string; username: string };
  playerItem: {
    id: string;
    item: Item;
    player: { id: string; name: string; position: string; overall: number };
    durability: number;
  };
}

interface PlayerListing {
  id: string;
  price: number;
  status: string;
  player: {
    id: string;
    name: string;
    position: string;
    overall: number;
    rarity: string;
  };
  seller: { id: string; username: string };
}

export default function MarketplacePage() {
  const { activeSportId, teams } = useGameStore();
  const [channel, setChannel] = useState<'market' | 'marketplace' | 'players'>('market');

  // ─── Market (Game Store) ───
  const [marketItems, setMarketItems] = useState<Item[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [buyingItem, setBuyingItem] = useState<string | null>(null);
  const [selectedPlayerForItem, setSelectedPlayerForItem] = useState<any>(null);

  // ─── Item Marketplace (P2P) ───
  const [itemListings, setItemListings] = useState<ItemListing[]>([]);
  const [myItemListings, setMyItemListings] = useState<ItemListing[]>([]);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [listingItemId, setListingItemId] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [buyingItemListing, setBuyingItemListing] = useState<string | null>(null);

  // ─── Player Marketplace (existing) ───
  const [playerListings, setPlayerListings] = useState<PlayerListing[]>([]);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [buyingPlayer, setBuyingPlayer] = useState<string | null>(null);

  // ─── Shared ───
  const [myWallet, setMyWallet] = useState({ cash: 0, gridTokens: 0 });
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showListItem, setShowListItem] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchMarketItems();
    fetchItemListings();
    fetchMyItemListings();
    fetchMyItems();
    fetchPlayerListings();
    fetchWallet();
  }, [activeSportId]);

  const fetchWallet = async () => {
    try {
      const res = await fetch('/api/economy/wallet', { headers });
      if (res.ok) {
        const data = await res.json();
        setMyWallet(data.data || { cash: 0, gridTokens: 0 });
      }
    } catch (err) { console.error('Wallet error:', err); }
  };

  // ─── Market API ───
  const fetchMarketItems = async () => {
    try {
      const res = await fetch('/api/market/items', { headers });
      if (res.ok) {
        const data = await res.json();
        setMarketItems(data.data || []);
      }
    } catch (err) { console.error('Market items error:', err); }
    finally { setMarketLoading(false); }
  };

  const buyFromMarket = async (itemId: string, currency: 'CASH' | 'GRID') => {
    if (!selectedPlayerForItem) {
      setActionError('Select a player to receive the item');
      return;
    }
    setBuyingItem(itemId);
    setActionError(null);
    try {
      const res = await fetch('/api/market/buy', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, playerId: selectedPlayerForItem.id, currency }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`Purchased ${data.data.playerItem.item.name}!`);
        fetchWallet();
        fetchMyItems();
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        setActionError(data.message || 'Purchase failed');
      }
    } catch (err) { setActionError('Network error'); }
    finally { setBuyingItem(null); }
  };

  // ─── Item Marketplace API ───
  const fetchItemListings = async () => {
    try {
      const res = await fetch('/api/marketplace-items', { headers });
      if (res.ok) {
        const data = await res.json();
        setItemListings(data.data || []);
      }
    } catch (err) { console.error('Item listings error:', err); }
  };

  const fetchMyItemListings = async () => {
    try {
      const res = await fetch('/api/marketplace-items/my-listings', { headers });
      if (res.ok) {
        const data = await res.json();
        setMyItemListings(data.data || []);
      }
    } catch (err) { console.error('My item listings error:', err); }
  };

  const fetchMyItems = async () => {
    try {
      const res = await fetch('/api/teams/mine', { headers });
      if (res.ok) {
        const data = await res.json();
        const items = data.data?.flatMap((team: any) =>
          team.teamPlayers?.flatMap((tp: any) =>
            tp.player?.playerItems?.map((pi: any) => ({ ...pi, player: tp.player })) || []
          ) || []
        ) || [];
        setMyItems(items);
      }
    } catch (err) { console.error('My items error:', err); }
  };

  const listItemForSale = async () => {
    if (!listingItemId || !listingPrice) return;
    setActionError(null);
    try {
      const res = await fetch('/api/marketplace-items', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerItemId: listingItemId, price: parseInt(listingPrice) }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Item listed for sale!');
        setShowListItem(false);
        setListingItemId('');
        setListingPrice('');
        fetchMyItemListings();
        fetchItemListings();
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        setActionError(data.message || 'Failed to list item');
      }
    } catch (err) { setActionError('Network error'); }
  };

  const buyItemFromMarketplace = async (listingId: string) => {
    setBuyingItemListing(listingId);
    setActionError(null);
    try {
      const res = await fetch(`/api/marketplace-items/${listingId}/buy`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Item purchased from marketplace!');
        fetchWallet();
        fetchItemListings();
        fetchMyItems();
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        setActionError(data.message || 'Purchase failed');
      }
    } catch (err) { setActionError('Network error'); }
    finally { setBuyingItemListing(null); }
  };

  const cancelItemListing = async (listingId: string) => {
    try {
      const res = await fetch(`/api/marketplace-items/${listingId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setActionMsg('Listing cancelled');
        fetchMyItemListings();
        fetchItemListings();
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (err) { setActionError('Cancel failed'); }
  };

  // ─── Player Marketplace API ───
  const fetchPlayerListings = async () => {
    try {
      const res = await fetch(`/api/marketplace?limit=50&sportId=${activeSportId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPlayerListings((data.data || []).filter((l: any) => (l.sportId || l.player?.sportId || 'american-football') === activeSportId));
      }
    } catch (err) { console.error('Player listings error:', err); }
    finally { setPlayerLoading(false); }
  };

  const buyPlayer = async (listingId: string) => {
    setBuyingPlayer(listingId);
    setActionError(null);
    try {
      const res = await fetch(`/api/marketplace/${listingId}/buy`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Player purchased!');
        fetchPlayerListings();
        fetchWallet();
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        setActionError(data.message || 'Purchase failed');
      }
    } catch (err) { setActionError('Network error'); }
    finally { setBuyingPlayer(null); }
  };

  // ─── Helpers ───
  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      common: 'bg-gray-500/20 text-gray-400',
      rare: 'bg-blue-500/20 text-blue-400',
      epic: 'bg-purple-500/20 text-purple-400',
      legendary: 'bg-amber-500/20 text-amber-400',
      COMMON: 'bg-gray-500/20 text-gray-400',
      BRONZE: 'bg-amber-700/20 text-amber-600',
      SILVER: 'bg-gray-300/20 text-gray-300',
      GOLD: 'bg-amber-400/20 text-amber-400',
      ELITE: 'bg-purple-500/20 text-purple-400',
      LEGEND: 'bg-red-500/20 text-red-400',
    };
    return colors[rarity] || 'bg-gray-500/20 text-gray-400';
  };

  const slotIcon = (slot: string) => {
    const icons: Record<string, string> = {
      helmet: '🪖', pads: '🛡️', gloves: '🧤', shoes: '👟', accessory: '⭐',
    };
    return icons[slot] || '⚙️';
  };

  const allPlayers = teams
    .filter((t: any) => (t.sportId || 'american-football') === activeSportId)
    .flatMap((t: any) => t.teamPlayers?.map((tp: any) => tp.player) || []);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Marketplace</h2>
          <p className="text-sm text-muted-foreground">Buy equipment from the game or trade with other players</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Coins className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 font-bold">{myWallet.cash.toLocaleString()}</span>
          <span className="text-muted-foreground">CASH</span>
        </div>
      </div>

      {/* Messages */}
      {actionMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          {actionMsg}
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {actionError}
        </div>
      )}

      {/* Channel Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => setChannel('market')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            channel === 'market' ? 'bg-[#E94560] text-white' : 'text-muted-foreground hover:text-white'
          }`}
        >
          <Store className="w-4 h-4" /> Market
        </button>
        <button
          onClick={() => setChannel('marketplace')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            channel === 'marketplace' ? 'bg-[#E94560] text-white' : 'text-muted-foreground hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> Marketplace
        </button>
        <button
          onClick={() => setChannel('players')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            channel === 'players' ? 'bg-[#E94560] text-white' : 'text-muted-foreground hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" /> Players
        </button>
      </div>

      {/* ═══════════════════════════════════════════
          MARKET (Game Store)
      ═══════════════════════════════════════════ */}
      {channel === 'market' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Buy items directly from the game. Revenue goes to the treasury.
              {marketItems.some(i => i.lastMarketplacePrice && i.lastMarketplacePrice > i.marketPriceCash) && (
                <span className="text-amber-400 ml-2">⚠ Some items are cheaper in the marketplace</span>
              )}
            </p>
          </div>

          {/* Player selector */}
          <div className="glass-card p-3">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2 block">Select Player to Receive Item</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allPlayers.map((player: any) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayerForItem(player)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    selectedPlayerForItem?.id === player.id
                      ? 'bg-[#E94560]/20 border border-[#E94560]/40 text-white'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80'
                  }`}
                >
                  <span>{player.position}</span>
                  <span className="font-bold">{player.name}</span>
                  <span className="text-xs text-white/40">OVR {player.overall}</span>
                </button>
              ))}
            </div>
          </div>

          {marketLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading market...</div>
          ) : marketItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No items available in the market</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {marketItems.map((item) => (
                <div key={item.id} className="glass-card p-4 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{slotIcon(item.slot)}</span>
                      <div>
                        <div className="font-semibold text-white">{item.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{item.slot}</div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${getRarityColor(item.rarity)}`}>
                      {item.rarity}
                    </div>
                  </div>

                  {/* Stat boosts */}
                  <div className="space-y-1 mb-3">
                    {Object.entries(item.statBoosts).map(([stat, boost]) => (
                      <div key={stat} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground capitalize">{stat}</span>
                        <span className="text-emerald-400 font-bold">+{boost}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-white/40 mb-3">Durability: {item.durability}</div>

                  {/* Price section */}
                  <div className="mt-auto space-y-2">
                    {item.lastMarketplacePrice && item.lastMarketplacePrice > item.marketPriceCash && (
                      <div className="text-xs text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Marketplace selling for {item.lastMarketplacePrice.toLocaleString()} CASH
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-black text-yellow-400">
                        {item.marketPriceCash.toLocaleString()} CASH
                      </div>
                      {item.marketPriceGrid > 0 && (
                        <div className="text-sm font-bold text-purple-400">
                          {item.marketPriceGrid.toLocaleString()} GRID
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => buyFromMarket(item.id, 'CASH')}
                        disabled={buyingItem === item.id || !selectedPlayerForItem}
                        className="flex-1 px-3 py-2 bg-[#E94560] text-white rounded-lg text-sm font-medium hover:bg-[#E94560]/80 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <HandCoins className="w-4 h-4" />
                        {buyingItem === item.id ? 'Buying...' : 'Buy with CASH'}
                      </button>
                      {item.marketPriceGrid > 0 && (
                        <button
                          onClick={() => buyFromMarket(item.id, 'GRID')}
                          disabled={buyingItem === item.id || !selectedPlayerForItem}
                          className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 disabled:opacity-50"
                        >
                          GRID
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MARKETPLACE (P2P Items)
      ═══════════════════════════════════════════ */}
      {channel === 'marketplace' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Buy and sell items with other players. Prices are set by demand.
            </p>
            <button
              onClick={() => setShowListItem(true)}
              className="px-3 py-1.5 bg-[#E94560] text-white rounded-lg text-sm font-medium hover:bg-[#E94560]/80 flex items-center gap-1"
            >
              <Tag className="w-4 h-4" /> Sell Item
            </button>
          </div>

          {/* My listings */}
          {myItemListings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider">My Listings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myItemListings.filter(l => l.status === 'ACTIVE').map((listing) => (
                  <div key={listing.id} className="glass-card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{slotIcon(listing.playerItem.item.slot)}</span>
                      <div>
                        <div className="font-medium text-white">{listing.playerItem.item.name}</div>
                        <div className="text-xs text-muted-foreground">{listing.playerItem.item.slot} • {listing.playerItem.item.rarity}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-bold">{listing.price.toLocaleString()} CASH</span>
                      <button
                        onClick={() => cancelItemListing(listing.id)}
                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All listings */}
          <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider">Browse Listings</h3>
          {itemListings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No items listed for sale</p>
              <p className="text-sm mt-1">Be the first to list an item!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {itemListings.filter(l => l.status === 'ACTIVE').map((listing) => (
                <div key={listing.id} className="glass-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{slotIcon(listing.playerItem.item.slot)}</span>
                      <div>
                        <div className="font-semibold text-white">{listing.playerItem.item.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{listing.playerItem.item.slot}</div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${getRarityColor(listing.playerItem.item.rarity)}`}>
                      {listing.playerItem.item.rarity}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground mb-2">
                    Seller: <span className="text-white">{listing.seller.username}</span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {Object.entries(listing.playerItem.item.statBoosts).map(([stat, boost]) => (
                      <div key={stat} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground capitalize">{stat}</span>
                        <span className="text-emerald-400 font-bold">+{boost}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-white/40 mb-3">Durability: {listing.playerItem.durability}/{listing.playerItem.item.durability}</div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-lg font-black text-yellow-400">
                      {listing.price.toLocaleString()} CASH
                    </div>
                    <button
                      onClick={() => buyItemFromMarketplace(listing.id)}
                      disabled={buyingItemListing === listing.id}
                      className="px-4 py-2 bg-[#E94560] text-white rounded-lg text-sm font-medium hover:bg-[#E94560]/80 disabled:opacity-50 flex items-center gap-1"
                    >
                      <HandCoins className="w-4 h-4" />
                      {buyingItemListing === listing.id ? 'Buying...' : 'Buy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          PLAYERS (Existing Player Marketplace)
      ═══════════════════════════════════════════ */}
      {channel === 'players' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Buy players from other teams in the league.</p>

          {playerLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading players...</div>
          ) : playerListings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No players listed for sale</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {playerListings.filter(l => l.status === 'ACTIVE').map((listing) => (
                <div key={listing.id} className="glass-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-white">{listing.player.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {listing.player.position} • OVR {listing.player.overall}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${getRarityColor(listing.player.rarity)}`}>
                      {listing.player.rarity}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-lg font-black text-yellow-400">
                      {listing.price.toLocaleString()} CASH
                    </div>
                    <button
                      onClick={() => buyPlayer(listing.id)}
                      disabled={buyingPlayer === listing.id}
                      className="px-4 py-2 bg-[#E94560] text-white rounded-lg text-sm font-medium hover:bg-[#E94560]/80 disabled:opacity-50 flex items-center gap-1"
                    >
                      <HandCoins className="w-4 h-4" />
                      {buyingPlayer === listing.id ? 'Buying...' : 'Buy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sell Item Modal */}
      {showListItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="glass-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Sell Item</h3>
              <button onClick={() => setShowListItem(false)} className="p-2 hover:bg-secondary rounded-lg">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {myItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>You don't have any items to sell.</p>
                <p className="text-sm mt-1">Buy items from the market first.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Select Item</label>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-auto">
                    {myItems.filter((pi: any) => !pi.equipped).map((pi: any) => (
                      <button
                        key={pi.id}
                        onClick={() => setListingItemId(pi.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          listingItemId === pi.id
                            ? 'bg-[#E94560]/10 border-[#E94560]/30'
                            : 'bg-secondary border-border hover:bg-secondary/80'
                        }`}
                      >
                        <div className="text-left flex items-center gap-2">
                          <span className="text-xl">{slotIcon(pi.item.slot)}</span>
                          <div>
                            <div className="font-medium text-white">{pi.item.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {pi.item.slot} • {pi.item.rarity} • Durability {pi.durability}/{pi.item.durability}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {myItems.filter((pi: any) => !pi.equipped).length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">All your items are equipped. Unequip an item to sell it.</p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Listing Price (CASH)</label>
                  <input
                    type="number"
                    value={listingPrice}
                    onChange={(e) => setListingPrice(e.target.value)}
                    placeholder="Min 100"
                    min="100"
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]"
                  />
                </div>

                <button
                  onClick={listItemForSale}
                  disabled={!listingItemId || !listingPrice || parseInt(listingPrice) < 100}
                  className="w-full px-4 py-2 bg-[#E94560] text-white rounded-lg font-medium hover:bg-[#E94560]/90 disabled:opacity-50"
                >
                  List for Sale
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
