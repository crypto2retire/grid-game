import { useState, useEffect } from 'react';
import { Users, Search, Coins, TrendingUp, TrendingDown, Minus, ShoppingCart } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  position: string;
  nationality: string;
  age: number;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  rarity: string;
  teamPlayers: any[];
  currentPrice: number;
  demandMultiplier: number;
  lastSoldPrice: number | null;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [rarity, setRarity] = useState('');
  const [minOverall, setMinOverall] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [myWallet, setMyWallet] = useState({ cash: 0 });
  const [buying, setBuying] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  useEffect(() => {
    fetchPlayers();
    fetchWallet();
    fetchMyTeams();
  }, [position, rarity, minOverall, page]);

  const fetchPlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (position) params.append('position', position);
      if (rarity) params.append('rarity', rarity);
      if (minOverall) params.append('minOverall', minOverall);
      params.append('page', String(page));
      params.append('limit', '20');

      const res = await fetch(`/api/players?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.data?.players || []);
        setTotalPages(data.data?.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch players:', err);
    } finally {
      setLoading(false);
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

  const fetchMyTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/teams/mine', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const teams = data.data || [];
        setMyTeams(teams);
        if (teams.length > 0 && !selectedTeam) {
          setSelectedTeam(teams[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const buyPlayer = async (playerId: string) => {
    if (!selectedTeam) {
      setBuyError('Select a team first');
      return;
    }
    setBuying(playerId);
    setBuyError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/teams/${selectedTeam}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ playerId, isStarter: false }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchPlayers();
        fetchWallet();
        fetchMyTeams();
      } else {
        setBuyError(data.message || 'Purchase failed');
      }
    } catch (err) {
      console.error('Failed to buy player:', err);
      setBuyError('Network error');
    } finally {
      setBuying(null);
    }
  };

  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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

  const getRarityBg = (rarity: string) => {
    const colors: Record<string, string> = {
      COMMON: 'bg-gray-500/10',
      BRONZE: 'bg-amber-700/10',
      SILVER: 'bg-slate-300/10',
      GOLD: 'bg-yellow-400/10',
      ELITE: 'bg-purple-400/10',
      LEGEND: 'bg-red-400/10',
    };
    return colors[rarity] || colors.COMMON;
  };

  const getDemandIcon = (mult: number) => {
    if (mult > 1.3) return <TrendingUp className="w-3.5 h-3.5 text-rose-400" />;
    if (mult < 0.9) return <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />;
    return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  };

  const getDemandLabel = (mult: number) => {
    if (mult > 1.3) return 'High demand';
    if (mult < 0.9) return 'Low demand';
    return 'Normal demand';
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
          <h1 className="text-3xl font-bold text-white">Players</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prices are dynamic based on overall rating, rarity, and market demand.
          </p>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">
            <Users className="w-5 h-5 inline mr-2" />
            {players.length} available
          </div>
          <div className="text-sm text-yellow-400 mt-1">
            <Coins className="w-4 h-4 inline mr-1" />
            {myWallet.cash.toLocaleString()} CASH
          </div>
        </div>
      </div>

      {buyError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
          {buyError}
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All Positions</option>
            <option value="GK">Goalkeeper</option>
            <option value="DEF">Defender</option>
            <option value="MID">Midfielder</option>
            <option value="FWD">Forward</option>
          </select>
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className="px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All Rarities</option>
            <option value="COMMON">Common</option>
            <option value="BRONZE">Bronze</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="ELITE">Elite</option>
            <option value="LEGEND">Legend</option>
          </select>
          <select
            value={minOverall}
            onChange={(e) => setMinOverall(e.target.value)}
            className="px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Min Overall</option>
            <option value="60">60+</option>
            <option value="70">70+</option>
            <option value="80">80+</option>
            <option value="90">90+</option>
          </select>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Select team to buy for</option>
            {myTeams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredPlayers.map((player) => (
          <div
            key={player.id}
            className={`glass-card p-4 border-2 ${getRarityColor(player.rarity)} hover:bg-secondary/50 transition-colors`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`px-2 py-1 rounded text-xs font-bold ${getRarityBg(player.rarity)} ${getRarityColor(player.rarity).replace('border-', 'text-')}`}>
                {player.rarity}
              </div>
              <div className="text-2xl font-bold text-white">{player.overall}</div>
            </div>
            <h3 className="font-semibold text-white mb-1">{player.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {player.position} • {player.nationality} • Age {player.age}
            </p>

            {/* Price Section */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Current price</p>
                  <p className="text-lg font-black text-yellow-400">
                    {player.currentPrice.toLocaleString()} CASH
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    {getDemandIcon(player.demandMultiplier)}
                    <span className="text-xs text-slate-300">{getDemandLabel(player.demandMultiplier)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ×{player.demandMultiplier.toFixed(2)} multiplier
                  </p>
                </div>
              </div>
              {player.lastSoldPrice && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last sold: {player.lastSoldPrice.toLocaleString()} CASH
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center p-2 bg-secondary rounded">
                <div className="font-bold text-white">{player.pace}</div>
                <div className="text-muted-foreground">PAC</div>
              </div>
              <div className="text-center p-2 bg-secondary rounded">
                <div className="font-bold text-white">{player.shooting}</div>
                <div className="text-muted-foreground">SHO</div>
              </div>
              <div className="text-center p-2 bg-secondary rounded">
                <div className="font-bold text-white">{player.passing}</div>
                <div className="text-muted-foreground">PAS</div>
              </div>
              <div className="text-center p-2 bg-secondary rounded">
                <div className="font-bold text-white">{player.dribbling}</div>
                <div className="text-muted-foreground">DRI</div>
              </div>
              <div className="text-center p-2 bg-secondary rounded">
                <div className="font-bold text-white">{player.defending}</div>
                <div className="text-muted-foreground">DEF</div>
              </div>
              <div className="text-center p-2 bg-secondary rounded">
                <div className="font-bold text-white">{player.physical}</div>
                <div className="text-muted-foreground">PHY</div>
              </div>
            </div>

            {player.teamPlayers.length > 0 ? (
              <div className="mt-3 text-xs text-muted-foreground">
                Owned by {player.teamPlayers[0]?.team?.name || 'a team'}
              </div>
            ) : (
              <button
                onClick={() => buyPlayer(player.id)}
                disabled={buying === player.id || !selectedTeam || myWallet.cash < player.currentPrice}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" />
                {buying === player.id ? 'Buying...' : 'Buy for team'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-secondary rounded-lg text-white disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-secondary rounded-lg text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
