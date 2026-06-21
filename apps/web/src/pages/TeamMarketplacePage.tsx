import { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Coins,
  Zap,
  Loader2,
} from 'lucide-react';

interface MarketplaceListing {
  id: string;
  price: number;
  currency: string;
  foundationTaxPaid: number;
  burnAmount: number;
  sellerReceives: number;
  createdAt: string;
  seller: { id: string; username: string; displayName: string | null };
  team: {
    id: string;
    name: string;
    tier: string;
    sportId: string;
    wins: number;
    losses: number;
    points: number;
    teamPlayers: { player: { id: string; name: string; position: string; overall: number } }[];
    venue: { name: string; capacity: number; tier: string } | null;
  };
}

const TIER_COLORS: Record<string, string> = {
  STATE_COLLEGE: 'text-gray-400',
  MID_COLLEGE: 'text-blue-400',
  TOP_COLLEGE: 'text-purple-400',
  REGIONAL_PRO: 'text-orange-400',
  PRO_ENTRY: 'text-yellow-400',
  PRO_ELITE: 'text-red-400',
};

export default function TeamMarketplacePage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [wallet, setWallet] = useState({ gridTokens: 0, solBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchListings();
    fetchWallet();
  }, [filterTier]);

  const fetchListings = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = filterTier
        ? `/api/team-marketplace?tier=${filterTier}`
        : '/api/team-marketplace';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setListings(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/economy/wallet', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWallet(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleBuy = async (listing: MarketplaceListing) => {
    setBuying(listing.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/team-marketplace/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('success', data.message);
        await Promise.all([fetchWallet(), fetchListings()]);
      } else {
        showMessage('error', data.message || 'Purchase failed');
      }
    } catch (err) {
      showMessage('error', 'Network error during purchase');
    } finally {
      setBuying(null);
    }
  };

  const canAfford = (listing: MarketplaceListing) => {
    const balance = listing.currency === 'GRID' ? wallet.gridTokens : wallet.solBalance;
    return balance >= listing.price;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  const tiers = ['STATE_COLLEGE', 'MID_COLLEGE', 'TOP_COLLEGE', 'REGIONAL_PRO', 'PRO_ENTRY', 'PRO_ELITE'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Team Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buy teams from other players. Prices set by the community.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="glass-card px-4 py-2 flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-white">{wallet.gridTokens.toLocaleString()} GRID</span>
          </div>
          <div className="glass-card px-4 py-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-white">{wallet.solBalance.toLocaleString()} SOL</span>
          </div>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tier Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterTier('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterTier === '' ? 'bg-accent text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          All Tiers
        </button>
        {tiers.map((tier) => (
          <button
            key={tier}
            onClick={() => setFilterTier(tier)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterTier === tier ? 'bg-accent text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {tier.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Listings */}
      {listings.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {listings.map((listing) => {
            const avgOverall =
              listing.team.teamPlayers.length > 0
                ? Math.round(
                    listing.team.teamPlayers.reduce((sum, tp) => sum + tp.player.overall, 0) /
                      listing.team.teamPlayers.length
                  )
                : 0;

            return (
              <div
                key={listing.id}
                className="glass-card p-5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{listing.team.name}</h3>
                    <div className={`text-sm ${TIER_COLORS[listing.team.tier]}`}>
                      {listing.team.tier.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">
                      {listing.price.toLocaleString()} {listing.currency}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Seller: {listing.seller.displayName || listing.seller.username}
                    </div>
                  </div>
                </div>

                {/* Team Stats */}
                <div className="grid grid-cols-4 gap-2 mb-3 text-sm">
                  <div className="bg-secondary/50 p-2 rounded text-center">
                    <div className="text-muted-foreground">Record</div>
                    <div className="font-bold text-white">
                      {listing.team.wins}-{listing.team.losses}
                    </div>
                  </div>
                  <div className="bg-secondary/50 p-2 rounded text-center">
                    <div className="text-muted-foreground">Points</div>
                    <div className="font-bold text-white">{listing.team.points}</div>
                  </div>
                  <div className="bg-secondary/50 p-2 rounded text-center">
                    <div className="text-muted-foreground">Avg OVR</div>
                    <div className="font-bold text-white">{avgOverall}</div>
                  </div>
                  <div className="bg-secondary/50 p-2 rounded text-center">
                    <div className="text-muted-foreground">Players</div>
                    <div className="font-bold text-white">{listing.team.teamPlayers.length}</div>
                  </div>
                </div>

                {/* Stadium */}
                {listing.team.venue && (
                  <div className="text-xs text-muted-foreground mb-3">
                    Stadium: {listing.team.venue.name} ({listing.team.venue.capacity.toLocaleString()} cap)
                  </div>
                )}

                {/* Tax Breakdown */}
                <div className="bg-secondary/30 p-3 rounded-lg mb-3 text-xs">
                  <div className="text-muted-foreground mb-1">Fee Breakdown:</div>
                  <div className="flex justify-between">
                    <span className="text-red-400">Foundation Tax (15%): {listing.foundationTaxPaid.toLocaleString()}</span>
                    <span className="text-orange-400">Burn (5%): {listing.burnAmount.toLocaleString()}</span>
                  </div>
                  <div className="text-green-400 mt-1">
                    Seller receives: {listing.sellerReceives.toLocaleString()} {listing.currency}
                  </div>
                </div>

                {/* Buy Button */}
                <button
                  onClick={() => handleBuy(listing)}
                  disabled={buying === listing.id || !canAfford(listing)}
                  className="w-full btn-primary py-2 rounded-lg font-semibold disabled:opacity-30"
                >
                  {buying === listing.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : !canAfford(listing) ? (
                    'Insufficient Funds'
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Buy for {listing.price.toLocaleString()} {listing.currency}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-white font-medium mb-1">No teams for sale</p>
          <p className="text-muted-foreground text-sm">
            Check back later or browse the game catalog for new teams.
          </p>
        </div>
      )}
    </div>
  );
}
