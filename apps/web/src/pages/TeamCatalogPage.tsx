import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Lock,
  Check,
  Coins,
  Zap,
  Loader2,
  Shield,
  Users,
  Star,
  Building,
} from 'lucide-react';

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  tier: string;
  gridPrice: number;
  solPrice: number;
  playerCount: number;
  minOverall: number;
  maxOverall: number;
  stadiumTier: string;
  stadiumCapacity: number;
  requiresSeasons: number;
  requiresWinPct: number;
  soldCount: number;
  maxSupply: number | null;
}

interface Eligibility {
  currentTier: string | null;
  nextTier: string | null;
  eligibleTiers: string[];
  canAdvance: boolean;
  requirements?: {
    seasonsPlayed: { current: number; required: number };
    winPct: { current: number; required: number };
  };
}

const TIER_ICONS: Record<string, React.ReactNode> = {
  STATE_COLLEGE: <Shield className="w-5 h-5" />,
  MID_COLLEGE: <Star className="w-5 h-5" />,
  TOP_COLLEGE: <Trophy className="w-5 h-5" />,
  REGIONAL_PRO: <Users className="w-5 h-5" />,
  PRO_ENTRY: <Zap className="w-5 h-5" />,
  PRO_ELITE: <Building className="w-5 h-5" />,
};

const TIER_COLORS: Record<string, string> = {
  STATE_COLLEGE: 'text-gray-400',
  MID_COLLEGE: 'text-blue-400',
  TOP_COLLEGE: 'text-purple-400',
  REGIONAL_PRO: 'text-orange-400',
  PRO_ENTRY: 'text-yellow-400',
  PRO_ELITE: 'text-red-400',
};

const TIER_BG: Record<string, string> = {
  STATE_COLLEGE: 'bg-gray-400/10 border-gray-400/20',
  MID_COLLEGE: 'bg-blue-400/10 border-blue-400/20',
  TOP_COLLEGE: 'bg-purple-400/10 border-purple-400/20',
  REGIONAL_PRO: 'bg-orange-400/10 border-orange-400/20',
  PRO_ENTRY: 'bg-yellow-400/10 border-yellow-400/20',
  PRO_ELITE: 'bg-red-400/10 border-red-400/20',
};

export default function TeamCatalogPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [wallet, setWallet] = useState({ gridTokens: 0, solBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchCatalog();
    fetchEligibility();
    fetchWallet();
  }, []);

  const fetchCatalog = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/teams/catalog', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibility = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/teams/eligibility', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEligibility(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch eligibility:', err);
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

  const handleBuy = async (entry: CatalogEntry, currency: 'GRID' | 'SOL') => {
    setBuying(entry.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/teams/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ catalogId: entry.id, currency }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('success', data.message);
        await Promise.all([fetchWallet(), fetchEligibility(), fetchCatalog()]);
        // Navigate to team page after a short delay
        setTimeout(() => navigate('/team'), 1500);
      } else {
        showMessage('error', data.message || 'Purchase failed');
      }
    } catch (err) {
      showMessage('error', 'Network error during purchase');
    } finally {
      setBuying(null);
    }
  };

  const isEligible = (tier: string) => {
    return eligibility?.eligibleTiers.includes(tier) ?? false;
  };

  const canAfford = (entry: CatalogEntry, currency: 'GRID' | 'SOL') => {
    if (entry.tier === 'STATE_COLLEGE') return true;
    const price = currency === 'GRID' ? entry.gridPrice : entry.solPrice;
    const balance = currency === 'GRID' ? wallet.gridTokens : wallet.solBalance;
    return balance >= price;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  // Group by tier
  const grouped: Record<string, CatalogEntry[]> = {};
  catalog.forEach((entry) => {
    if (!grouped[entry.tier]) grouped[entry.tier] = [];
    grouped[entry.tier].push(entry);
  });

  const tierOrder = ['STATE_COLLEGE', 'MID_COLLEGE', 'TOP_COLLEGE', 'REGIONAL_PRO', 'PRO_ENTRY', 'PRO_ELITE'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Team Catalog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Buy teams from the game. Upgrade your program to reach the pro leagues.
        </p>
      </div>

      {/* Eligibility Banner */}
      {eligibility && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Current Tier</div>
              <div className={`font-bold text-lg ${TIER_COLORS[eligibility.currentTier || 'STATE_COLLEGE']}`}>
                {eligibility.currentTier?.replace('_', ' ') || 'No Team'}
              </div>
            </div>
            {eligibility.nextTier && (
              <div>
                <div className="text-sm text-muted-foreground">Next Tier</div>
                <div className={`font-bold text-lg ${TIER_COLORS[eligibility.nextTier]}`}>
                  {eligibility.nextTier.replace('_', ' ')}
                </div>
              </div>
            )}
            {eligibility.canAdvance ? (
              <div className="flex items-center gap-2 text-green-400">
                <Check className="w-5 h-5" />
                <span className="font-semibold">Eligible to advance</span>
              </div>
            ) : eligibility.nextTier ? (
              <div className="text-sm text-muted-foreground">
                Need {eligibility.requirements?.winPct.required} win% ({(eligibility.requirements?.winPct.current || 0).toFixed(2)} current) and{' '}
                {eligibility.requirements?.seasonsPlayed.required} seasons ({eligibility.requirements?.seasonsPlayed.current} current)
              </div>
            ) : (
              <div className="text-sm text-green-400 font-medium">Max tier reached</div>
            )}
          </div>
        </div>
      )}

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

      {/* Wallet Info */}
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

      {/* Catalog by Tier */}
      <div className="space-y-6">
        {tierOrder.map((tier) => {
          const entries = grouped[tier];
          if (!entries || entries.length === 0) return null;

          const tierEligible = isEligible(tier);
          const tierLocked = !tierEligible && tier !== 'STATE_COLLEGE';

          return (
            <div key={tier}>
              <h2 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${TIER_COLORS[tier]}`}>
                {TIER_ICONS[tier]}
                {tier.replace('_', ' ')}
                {tierLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entries.map((entry) => {
                  const eligible = tierEligible;
                  const affordGrid = canAfford(entry, 'GRID');
                  const affordSol = canAfford(entry, 'SOL');
                  const isFree = entry.tier === 'STATE_COLLEGE';

                  return (
                    <div
                      key={entry.id}
                      className={`glass-card p-5 border ${
                        eligible ? TIER_BG[tier] : 'border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-white">{entry.name}</h3>
                          <p className="text-sm text-muted-foreground">{entry.description}</p>
                        </div>
                        {isFree && (
                          <span className="bg-green-400/20 text-green-400 text-xs font-bold px-2 py-1 rounded">
                            FREE
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                        <div className="bg-secondary/50 p-2 rounded">
                          <div className="text-muted-foreground">Players</div>
                          <div className="font-bold text-white">{entry.playerCount}</div>
                        </div>
                        <div className="bg-secondary/50 p-2 rounded">
                          <div className="text-muted-foreground">OVR Range</div>
                          <div className="font-bold text-white">{entry.minOverall}-{entry.maxOverall}</div>
                        </div>
                        <div className="bg-secondary/50 p-2 rounded">
                          <div className="text-muted-foreground">Stadium</div>
                          <div className="font-bold text-white">{entry.stadiumCapacity.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Requirements */}
                      {(entry.requiresSeasons > 0 || entry.requiresWinPct > 0) && (
                        <div className="text-xs text-muted-foreground mb-3">
                          Requires: {entry.requiresSeasons > 0 && `${entry.requiresSeasons} seasons`}
                          {entry.requiresSeasons > 0 && entry.requiresWinPct > 0 && ' + '}
                          {entry.requiresWinPct > 0 && `${(entry.requiresWinPct * 100).toFixed(0)}% win rate`}
                        </div>
                      )}

                      {/* Supply */}
                      {entry.maxSupply && (
                        <div className="text-xs text-muted-foreground mb-3">
                          {entry.maxSupply - entry.soldCount} of {entry.maxSupply} remaining
                        </div>
                      )}

                      {/* Pricing & Actions */}
                      {!isFree && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className={`text-sm ${affordGrid ? 'text-white' : 'text-red-400'}`}>
                              <Coins className="w-3 h-3 inline mr-1" />
                              {entry.gridPrice.toLocaleString()} GRID
                            </div>
                            <div className={`text-sm ${affordSol ? 'text-white' : 'text-red-400'}`}>
                              <Zap className="w-3 h-3 inline mr-1" />
                              {entry.solPrice.toLocaleString()} SOL
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleBuy(entry, 'GRID')}
                              disabled={buying === entry.id || !eligible || !affordGrid}
                              className="btn-primary px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-30"
                            >
                              {buying === entry.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Coins className="w-3 h-3" /> GRID
                                </span>
                              )}
                            </button>
                            <button
                              onClick={() => handleBuy(entry, 'SOL')}
                              disabled={buying === entry.id || !eligible || !affordSol}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-30 transition-colors"
                            >
                              {buying === entry.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> SOL
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {isFree && eligible && (
                        <button
                          onClick={() => handleBuy(entry, 'GRID')}
                          disabled={buying === entry.id}
                          className="w-full btn-primary py-2 rounded-lg font-semibold text-sm disabled:opacity-30"
                        >
                          {buying === entry.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Claim Free Team'}
                        </button>
                      )}

                      {isFree && !eligible && (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          Already have a free team
                        </div>
                      )}

                      {!eligible && !isFree && (
                        <div className="text-xs text-red-400 text-center py-2 flex items-center justify-center gap-1">
                          <Lock className="w-3 h-3" /> Tier locked
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
