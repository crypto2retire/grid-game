import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { ShoppingCart, Tag, Check, X } from 'lucide-react';

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
}

export default function MarketplacePage() {
  const { user } = useAuthStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [showSell, setShowSell] = useState(false);
  const [sellPrice, setSellPrice] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [myPlayers, setMyPlayers] = useState<any[]>([]);

  useEffect(() => {
    fetchListings();
    fetchMyPlayers();
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

  const buyPlayer = async (listingId: string) => {
    setBuying(listingId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/marketplace/${listingId}/buy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchListings();
        fetchMyPlayers();
      } else {
        const err = await res.json();
        alert(err.message || 'Purchase failed');
      }
    } catch (err) {
      console.error('Failed to buy player:', err);
    } finally {
      setBuying(null);
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
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to create listing');
      }
    } catch (err) {
      console.error('Failed to create listing:', err);
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
        <h1 className="text-3xl font-bold text-white">Marketplace</h1>
        <button
          onClick={() => setShowSell(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors"
        >
          <Tag className="w-4 h-4" />
          Sell Player
        </button>
      </div>

      {/* Listings */}
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
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold text-yellow-400">
                {listing.price.toLocaleString()} CASH
              </div>
              <button
                onClick={() => buyPlayer(listing.id)}
                disabled={buying === listing.id}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {buying === listing.id ? 'Buying...' : 'Buy'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {listings.length === 0 && (
        <div className="text-center py-12">
          <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No active listings</p>
          <p className="text-sm text-muted-foreground mt-2">
            Be the first to sell a player!
          </p>
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
                    Price (CASH)
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
                  A 5% marketplace fee will be deducted from the sale.
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
