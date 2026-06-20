import { useState, useEffect } from 'react';
import { ShoppingCart, Tag, ChevronRight, X, HandCoins, MessageSquare, Check, Ban, Clock } from 'lucide-react';

interface Listing {
  id: string;
  price: number;
  status: string;
  player: {
    id: string;
    name: string;
    position: string;
    overall: number;
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
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

  useEffect(() => {
    fetchListings();
    fetchMyPlayers();
    fetchWallet();
    fetchMyOffers();
    fetchMyListings();
  }, []);

  const fetchListings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/marketplace?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setListings(data.data?.listings || []);
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
        const players = data.data?.flatMap((team: any) => team.teamPlayers?.map((tp: any) => tp.player) || []) || [];
        setMyPlayers(players);
      }
    } catch (err) {
      console.error('Failed to fetch my players:', err);
    }
  };

  const fetchWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } });
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
        setMyOffers(data.data || []);
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
        setMyListings(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch my listings:', err);
    }
  };

  const buyPlayer = async (listingId: string) => {
    setBuying(listingId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/${listingId}/buy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActionMsg('Purchase successful!');
        fetchListings();
        fetchMyPlayers();
        fetchWallet();
      } else {
        const err = await res.json();
        setActionMsg(err.message || 'Purchase failed');
      }
    } catch (err) {
      console.error('Failed to buy player:', err);
    } finally {
      setBuying(null);
      setTimeout(() => setActionMsg(null), 3000);
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
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          price: parseInt(sellPrice),
        }),
      });
      if (res.ok) {
        setShowSell(false);
        setSellPrice('');
        setSelectedPlayer(null);
        fetchListings();
        fetchMyListings();
      } else {
        const err = await res.json();
        setActionMsg(err.message || 'Failed to create listing');
      }
    } catch (err) {
      console.error('Failed to create listing:', err);
    }
  };

  const makeOffer = async (listingId: string) => {
    if (!offerPrice) return;
    setOfferingOn(listingId);
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
        fetchListings();
        fetchMyOffers();
      } else {
        setActionMsg(data.message || 'Offer failed');
      }
    } catch (err) {
      console.error('Failed to make offer:', err);
    } finally {
      setOfferingOn(null);
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const acceptOffer = async (offerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/offers/${offerId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Offer accepted!');
        fetchMyListings();
        fetchListings();
        fetchWallet();
      } else {
        setActionMsg(data.message || 'Accept failed');
      }
    } catch (err) {
      console.error('Failed to accept offer:', err);
    } finally {
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const rejectOffer = async (offerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/offers/${offerId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Offer rejected');
        fetchMyListings();
      } else {
        setActionMsg(data.message || 'Reject failed');
      }
    } catch (err) {
      console.error('Failed to reject offer:', err);
    } finally {
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const cancelOffer = async (offerId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/offers/${offerId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Offer cancelled');
        fetchMyOffers();
      } else {
        setActionMsg(data.message || 'Cancel failed');
      }
    } catch (err) {
      console.error('Failed to cancel offer:', err);
    } finally {
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      COMMON: 'border-gray-500',
      BRONZE: 'border-amber-700',
      SILVER: 'border-slate-300',
      GOLD: 'border-yellow-400',
      ELITE: 'border-purple-400',
      LEGEND: 'border-red-400',
    };
    return colors[rarity] || colors.COMMON;
  };

  const getOfferStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-300';
      case 'ACCEPTED': return 'text-emerald-300';
      case 'REJECTED': return 'text-rose-300';
      case 'CANCELLED': return 'text-slate-400';
      default: return 'text-slate-300';
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buy, sell, and make offers on players. Sellers set their own price.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-yellow-400">
            <ShoppingCart className="w-4 h-4 inline mr-1" />
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

      {actionMsg && (
        <div className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">
          {actionMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(['browse', 'my-offers', 'my-listings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t
                ? 'bg-accent/15 text-accent'
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            {t === 'browse' ? 'Browse' : t === 'my-offers' ? 'My Offers' : 'My Listings'}
          </button>
        ))}
      </div>

      {/* Browse Tab */}
      {tab === 'browse' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <div
              key={listing.id}
              className={`glass-card p-4 border-2 ${getRarityColor(listing.player.rarity)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="px-2 py-1 rounded text-xs font-bold bg-accent/10 text-accent">
                  {listing.player.rarity}
                </div>
                <div className="text-2xl font-bold text-white">{listing.player.overall}</div>
              </div>
              <h3 className="font-semibold text-white mb-1">{listing.player.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {listing.player.position} • Sold by {listing.seller.username}
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs mb-4">
                <div className="text-center p-1 bg-secondary rounded">
                  <div className="font-bold text-white">{listing.player.pace}</div>
                  <div className="text-muted-foreground">PAC</div>
                </div>
                <div className="text-center p-1 bg-secondary rounded">
                  <div className="font-bold text-white">{listing.player.shooting}</div>
                  <div className="text-muted-foreground">SHO</div>
                </div>
                <div className="text-center p-1 bg-secondary rounded">
                  <div className="font-bold text-white">{listing.player.passing}</div>
                  <div className="text-muted-foreground">PAS</div>
                </div>
              </div>

              {/* Price & Actions */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Asking price</p>
                    <p className="text-lg font-black text-yellow-400">
                      {listing.price.toLocaleString()} CASH
                    </p>
                  </div>
                </div>
                {listing.offers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {listing.offers.length} pending offer{listing.offers.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => buyPlayer(listing.id)}
                  disabled={buying === listing.id || myWallet.cash < listing.price}
                  className="flex-1 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {buying === listing.id ? 'Buying...' : 'Buy Now'}
                </button>
                <button
                  onClick={() => setOfferingOn(offeringOn === listing.id ? null : listing.id)}
                  className="px-3 py-2 border border-white/15 text-white rounded-lg text-sm hover:bg-white/10"
                >
                  <HandCoins className="w-4 h-4" />
                </button>
              </div>

              {/* Offer Input */}
              {offeringOn === listing.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder="Your offer..."
                    min="100"
                    className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    onClick={() => makeOffer(listing.id)}
                    disabled={offeringOn === listing.id && !offerPrice}
                    className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {listings.length === 0 && (
            <div className="col-span-full text-center py-12">
              <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No active listings</p>
              <p className="text-sm text-muted-foreground mt-2">Be the first to sell a player!</p>
            </div>
          )}
        </div>
      )}

      {/* My Offers Tab */}
      {tab === 'my-offers' && (
        <div className="space-y-3">
          {myOffers.map((offer) => (
            <div key={offer.id} className="glass-card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">
                  {offer.listing.player.name} • OVR {offer.listing.player.overall}
                </p>
                <p className="text-sm text-muted-foreground">
                  Offered {offer.price.toLocaleString()} CASH to {offer.listing.seller.username}
                </p>
                <p className={`text-xs font-bold mt-1 ${getOfferStatusColor(offer.status)}`}>
                  {offer.status}
                </p>
              </div>
              {offer.status === 'PENDING' && (
                <button
                  onClick={() => cancelOffer(offer.id)}
                  className="px-3 py-2 border border-rose-300/30 text-rose-300 rounded-lg text-sm hover:bg-rose-300/10"
                >
                  <Ban className="w-4 h-4 inline mr-1" /> Cancel
                </button>
              )}
            </div>
          ))}
          {myOffers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">You have not made any offers yet.</div>
          )}
        </div>
      )}

      {/* My Listings Tab */}
      {tab === 'my-listings' && (
        <div className="space-y-4">
          {myListings.map((listing) => (
            <div key={listing.id} className="glass-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">
                    {listing.player.name} • OVR {listing.player.overall}
                  </p>
                  <p className="text-sm text-yellow-400">
                    Listed at {listing.price.toLocaleString()} CASH
                  </p>
                  <p className={`text-xs font-bold mt-1 ${listing.status === 'ACTIVE' ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {listing.status}
                  </p>
                </div>
              </div>
              {listing.offers?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Offers</p>
                  {listing.offers.map((offer: Offer) => (
                    <div key={offer.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div>
                        <p className="text-sm text-white">
                          {offer.buyer.username} offered {offer.price.toLocaleString()} CASH
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(offer.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptOffer(offer.id)}
                          className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs hover:bg-emerald-400"
                        >
                          <Check className="w-3 h-3 inline mr-1" /> Accept
                        </button>
                        <button
                          onClick={() => rejectOffer(offer.id)}
                          className="px-3 py-1.5 border border-rose-300/30 text-rose-300 rounded-lg text-xs hover:bg-rose-300/10"
                        >
                          <Ban className="w-3 h-3 inline mr-1" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {listing.status === 'ACTIVE' && (!listing.offers || listing.offers.length === 0) && (
                <p className="text-sm text-muted-foreground">No offers yet.</p>
              )}
            </div>
          ))}
          {myListings.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">You have no active listings.</div>
          )}
        </div>
      )}

      {/* Sell Modal */}
      {showSell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="glass-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Sell Player</h3>
              <button
                onClick={() => setShowSell(false)}
                className="p-2 hover:bg-secondary rounded-lg"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            {!selectedPlayer ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <p className="text-sm text-muted-foreground mb-2">Select a player to sell:</p>
                {myPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayer(player)}
                    className="w-full text-left p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white">{player.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {player.position} • OVR {player.overall} • {player.rarity}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
                {myPlayers.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    You don't have any players to sell. Add players to your team first.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg">
                  <div className="font-medium text-white">{selectedPlayer.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedPlayer.position} • OVR {selectedPlayer.overall}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Your asking price (CASH)
                  </label>
                  <input
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    min="100"
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Enter price..."
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  A 5% marketplace fee will be deducted from the sale. Buyers can also make offers below your asking price.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={createListing}
                    disabled={!sellPrice || parseInt(sellPrice) < 100}
                    className="flex-1 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50"
                  >
                    List for Sale
                  </button>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="px-4 py-2 text-muted-foreground hover:text-white"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
