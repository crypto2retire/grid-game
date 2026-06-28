import { useState, useEffect } from 'react';
import { Tag, X, HandCoins, Check, Ban, Coins, AlertCircle, Store, Package } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

interface Listing {
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
  seller: {
    id: string;
    username: string;
  };
  offers: Offer[];
}

interface Offer {
  id: string;
  price: number;
  status: string;
  buyer: { id: string; username: string };
  createdAt: string;
}

export default function MarketplacePage() {
  const { activeSportId } = useGameStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [showSell, setShowSell] = useState(false);
  const [sellPrice, setSellPrice] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [myPlayers, setMyPlayers] = useState<any[]>([]);
  const [myWallet, setMyWallet] = useState({ cash: 0 });
  const [offerPrice, setOfferPrice] = useState('');
  const [offeringOn, setOfferingOn] = useState<string | null>(null);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [tab, setTab] = useState<'browse' | 'my-offers' | 'my-listings'>('browse');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchListings();
    fetchMyPlayers();
    fetchWallet();
    fetchMyOffers();
    fetchMyListings();
  }, [activeSportId]);

  const fetchListings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace?limit=50&sportId=${activeSportId}`,  {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setListings((data.data || []).filter((listing: any) => (listing.sportId || listing.player?.sportId || 'american-football') === activeSportId));
      }
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyPlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/teams/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const players = data.data?.filter((team: any) => (team.sportId || 'american-football') === activeSportId).flatMap((team: any) => team.teamPlayers?.map((tp: any) => tp.player) || []) || [];
        setMyPlayers(players);
      }
    } catch (err) {
      console.error('Failed to fetch my players:', err);
    }
  };

  const fetchWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/economy/wallet', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMyWallet(data.data || { cash: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  };

  const fetchMyOffers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/marketplace/my-offers', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMyOffers((data.data || []).filter((offer: any) => (offer.listing?.sportId || offer.listing?.player?.sportId || 'american-football') === activeSportId));
      }
    } catch (err) {
      console.error('Failed to fetch my offers:', err);
    }
  };

  const fetchMyListings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/marketplace/my-listings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMyListings((data.data || []).filter((listing: any) => (listing.sportId || listing.player?.sportId || 'american-football') === activeSportId));
      }
    } catch (err) {
      console.error('Failed to fetch my listings:', err);
    }
  };

  const buyListing = async (listingId: string) => {
    setBuying(listingId);
    setActionError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/${listingId}/buy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Purchase successful!');
        fetchListings();
        fetchWallet();
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        setActionError(data.message || 'Purchase failed');
      }
    } catch (err) {
      setActionError('Network error');
    } finally {
      setBuying(null);
    }
  };

  const makeOffer = async (listingId: string) => {
    if (!offerPrice) return;
    setOfferingOn(listingId);
    setActionError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/${listingId}/offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ price: parseInt(offerPrice) }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Offer sent!');
        setOfferPrice('');
        setOfferingOn(null);
        fetchMyOffers();
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        setActionError(data.message || 'Offer failed');
      }
    } catch (err) {
      setActionError('Network error');
    } finally {
      setOfferingOn(null);
    }
  };

  const acceptOffer = async (offerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/offers/${offerId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActionMsg('Offer accepted!');
        fetchMyListings();
        fetchWallet();
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (err) {
      setActionError('Failed to accept offer');
    }
  };

  const rejectOffer = async (offerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/offers/${offerId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActionMsg('Offer rejected');
        fetchMyListings();
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (err) {
      setActionError('Failed to reject offer');
    }
  };

  const cancelOffer = async (offerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/offers/${offerId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActionMsg('Offer cancelled');
        fetchMyOffers();
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (err) {
      setActionError('Failed to cancel offer');
    }
  };

  const createListing = async () => {
    if (!selectedPlayer || !sellPrice) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ playerId: selectedPlayer.id, price: parseInt(sellPrice) }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Player listed!');
        setShowSell(false);
        setSellPrice('');
        setSelectedPlayer(null);
        fetchMyListings();
        fetchMyPlayers();
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        setActionError(data.message || 'Listing failed');
      }
    } catch (err) {
      setActionError('Network error');
    }
  };

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      COMMON: 'text-gray-400',
      BRONZE: 'text-amber-600',
      SILVER: 'text-slate-300',
      GOLD: 'text-yellow-400',
      ELITE: 'text-purple-400',
      LEGEND: 'text-red-400',
    };
    return colors[rarity] || colors.COMMON;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buy, sell, and trade players with other managers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-yellow-400">
            <Coins className="w-4 h-4 inline mr-1" />
            {myWallet.cash.toLocaleString()} CASH
          </div>
          <button
            onClick={() => setShowSell(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors"
          >
            <Tag className="w-4 h-4" />
            Sell Player
          </button>
        </div>
      </div>

      {/* Alerts */}
      {actionError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {actionError}
        </div>
      )}
      {actionMsg && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          {actionMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        {[
          { id: 'browse' as const, label: 'Browse', icon: Store },
          { id: 'my-offers' as const, label: 'My Offers', icon: HandCoins },
          { id: 'my-listings' as const, label: 'My Listings', icon: Package },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
              tab === t.id
                ? 'text-accent border-b-2 border-accent'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Browse Tab */}
      {tab === 'browse' && (
        <div className="space-y-4">
          {listings.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No listings yet</p>
              <p className="text-muted-foreground text-sm">Be the first to list a player for sale</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
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

                  {/* Player Equipment Preview */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex -space-x-1">
                      {['helmet', 'pads', 'gloves', 'shoes', 'accessory'].map((slot, i) => (
                        <div
                          key={slot}
                          className={`w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-[8px] font-bold ${
                            i < 2 ? 'bg-amber-400/20 text-amber-400' :
                            i < 4 ? 'bg-blue-400/20 text-blue-400' :
                            'bg-purple-400/20 text-purple-400'
                          }`}
                          title={slot}
                        >
                          {slot[0].toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-white/30">+5 equipped</span>
                  </div>

                  <div className="text-sm text-muted-foreground mb-3">
                    Seller: {listing.seller.username}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="text-lg font-black text-yellow-400">
                      {listing.price.toLocaleString()} CASH
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => buyListing(listing.id)}
                        disabled={buying === listing.id}
                        className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
                      >
                        {buying === listing.id ? '...' : 'Buy'}
                      </button>
                      <button
                        onClick={() => setOfferingOn(offeringOn === listing.id ? null : listing.id)}
                        className="px-3 py-1.5 border border-border text-white rounded-lg text-sm hover:bg-secondary"
                      >
                        Offer
                      </button>
                    </div>
                  </div>

                  {offeringOn === listing.id && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="number"
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(e.target.value)}
                        placeholder="Your offer"
                        className="flex-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <button
                        onClick={() => makeOffer(listing.id)}
                        disabled={!offerPrice}
                        className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  )}

                  {listing.offers?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">{listing.offers.length} offer(s)</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Offers Tab */}
      {tab === 'my-offers' && (
        <div className="space-y-4">
          {myOffers.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <HandCoins className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No active offers</p>
              <p className="text-muted-foreground text-sm">Browse listings to make offers</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myOffers.map((offer: any) => (
                <div key={offer.id} className="glass-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-white">{offer.listing.player.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {offer.listing.player.position} • OVR {offer.listing.player.overall}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${getRarityColor(offer.listing.player.rarity)}`}>
                      {offer.listing.player.rarity}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex -space-x-1">
                      {['helmet', 'pads', 'gloves', 'shoes', 'accessory'].map((slot, i) => (
                        <div
                          key={slot}
                          className={`w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-[8px] font-bold ${
                            i < 2 ? 'bg-amber-400/20 text-amber-400' :
                            i < 4 ? 'bg-blue-400/20 text-blue-400' :
                            'bg-purple-400/20 text-purple-400'
                          }`}
                          title={slot}
                        >
                          {slot[0].toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-white/30">+5 equipped</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div>
                      <div className="text-xs text-muted-foreground">Your offer</div>
                      <div className="text-lg font-black text-yellow-400">{offer.price.toLocaleString()} CASH</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        offer.status === 'PENDING' ? 'bg-yellow-400/10 text-yellow-400' :
                        offer.status === 'ACCEPTED' ? 'bg-green-400/10 text-green-400' :
                        'bg-red-400/10 text-red-400'
                      }`}>
                        {offer.status}
                      </span>
                      {offer.status === 'PENDING' && (
                        <button
                          onClick={() => cancelOffer(offer.id)}
                          className="px-3 py-1.5 border border-red-400/30 text-red-400 rounded-lg text-sm hover:bg-red-400/10"
                        >
                          Cancel
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

      {/* My Listings Tab */}
      {tab === 'my-listings' && (
        <div className="space-y-4">
          {myListings.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No active listings</p>
              <p className="text-muted-foreground text-sm">List players from your roster to sell them</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myListings.map((listing: any) => (
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
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex -space-x-1">
                      {['helmet', 'pads', 'gloves', 'shoes', 'accessory'].map((slot, i) => (
                        <div
                          key={slot}
                          className={`w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-[8px] font-bold ${
                            i < 2 ? 'bg-amber-400/20 text-amber-400' :
                            i < 4 ? 'bg-blue-400/20 text-blue-400' :
                            'bg-purple-400/20 text-purple-400'
                          }`}
                          title={slot}
                        >
                          {slot[0].toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-white/30">+5 equipped</span>
                  </div>
                  <div className="text-lg font-black text-yellow-400 mb-3">
                    {listing.price.toLocaleString()} CASH
                  </div>
                  {listing.offers?.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">Offers received:</p>
                      {listing.offers.map((offer: any) => (
                        <div key={offer.id} className="flex items-center justify-between bg-secondary p-2 rounded-lg">
                          <div className="text-sm">
                            <span className="text-white font-medium">{offer.buyer.username}</span>
                            <span className="text-muted-foreground"> offered </span>
                            <span className="text-yellow-400 font-bold">{offer.price.toLocaleString()} CASH</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => acceptOffer(offer.id)}
                              className="p-1.5 bg-green-400/10 text-green-400 rounded hover:bg-green-400/20"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => rejectOffer(offer.id)}
                              className="p-1.5 bg-red-400/10 text-red-400 rounded hover:bg-red-400/20"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sell Modal */}
      {showSell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="glass-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Sell Player</h3>
              <button onClick={() => setShowSell(false)} className="p-2 hover:bg-secondary rounded-lg">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {myPlayers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">You don't have any players to sell.</p>
                <p className="text-sm text-muted-foreground mt-1">Hire players first, then list them here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Select Player</label>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-auto">
                    {myPlayers.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => setSelectedPlayer(player)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          selectedPlayer?.id === player.id
                            ? 'bg-accent/10 border-accent/30'
                            : 'bg-secondary border-border hover:bg-secondary/80'
                        }`}
                      >
                        <div className="text-left">
                          <div className="font-medium text-white">{player.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {player.position} • OVR {player.overall}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <div className="flex -space-x-1">
                              {['helmet','pads','gloves','shoes','accessory'].map((slot,i) => (
                                <div key={slot} className={`w-4 h-4 rounded-full border border-white/10 flex items-center justify-center text-[6px] font-bold ${i<2?'bg-amber-400/20 text-amber-400':i<4?'bg-blue-400/20 text-blue-400':'bg-purple-400/20 text-purple-400'}`}>{slot[0].toUpperCase()}</div>
                              ))}
                            </div>
                            <span className="text-[10px] text-white/30">+5 equipped</span>
                          </div>
                        </div>
                        <div className={`text-xs font-bold ${getRarityColor(player.rarity)}`}>
                          {player.rarity}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPlayer && (
                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <div className="text-xs text-white/40 mb-1">Estimated Player Value</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xl font-black text-yellow-400">
                          {(selectedPlayer.overall * 150 + 2500).toLocaleString()} CASH
                        </div>
                        <span className="text-xs text-emerald-400">+{(5 * 500).toLocaleString()} gear bonus</span>
                      </div>
                      <div className="text-xs text-white/30 mt-1">
                        Base: {(selectedPlayer.overall * 150).toLocaleString()} • Equipment: +{(5 * 500).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Listing Price (CASH)</label>
                      <input
                        type="number"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(e.target.value)}
                        placeholder="Min 100"
                        min="100"
                        className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={createListing}
                  disabled={!selectedPlayer || !sellPrice || parseInt(sellPrice) < 100}
                  className="w-full px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50"
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
