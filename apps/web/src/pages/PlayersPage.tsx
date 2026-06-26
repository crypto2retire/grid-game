import { useState, useEffect } from 'react';
import { Users, Search, Coins, AlertCircle, Filter } from 'lucide-react';
import { getSportLabel, useGameStore } from '../store/gameStore';
import PlayerCard, { type PlayerCardData } from '../components/player/PlayerCard';

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
  const { activeSportId } = useGameStore();
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
  const [buySuccess, setBuySuccess] = useState<string | null>(null);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchPlayers();
    fetchWallet();
    fetchMyTeams();
  }, [position, rarity, minOverall, page, activeSportId]);

  const fetchPlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (position) params.append('position', position);
      if (rarity) params.append('rarity', rarity);
      if (minOverall) params.append('minOverall', minOverall);
      params.append('page', String(page));
      params.append('limit', '20');
      params.append('sportId', activeSportId);

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
      const res = await fetch('/api/economy/wallet', { headers: { Authorization: `Bearer ${token}` } });
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
        setMyTeams(teams.filter((team: any) => (team.sportId || 'american-football') === activeSportId));
        const sportTeams = teams.filter((team: any) => (team.sportId || 'american-football') === activeSportId);
        if (sportTeams.length > 0 && !selectedTeam) {
          setSelectedTeam(sportTeams[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const buyPlayer = async (playerId: string) => {
    if (!selectedTeam) {
      setBuyError('Create a team first to hire players');
      return;
    }
    setBuying(playerId);
    setBuyError(null);
    setBuySuccess(null);
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
        setBuySuccess('Player hired successfully!');
        fetchWallet();
        setTimeout(() => setBuySuccess(null), 3000);
      } else {
        setBuyError(data.message || 'Failed to hire player');
      }
    } catch (err) {
      console.error('Failed to buy player:', err);
      setBuyError('Network error. Please try again.');
    } finally {
      setBuying(null);
    }
  };

  const filteredPlayers = search
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  // Sort by position order, then by overall descending
  const positionOrder = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'];
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const posA = positionOrder.indexOf(a.position);
    const posB = positionOrder.indexOf(b.position);
    if (posA !== posB) return posA - posB;
    return b.overall - a.overall;
  });

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
          <h1 className="text-3xl font-bold text-white">Players</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scout and hire talent for your {getSportLabel(activeSportId)} team
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-yellow-400">
            <Coins className="w-4 h-4 inline mr-1" />
            {myWallet.cash.toLocaleString()} CASH
          </div>
        </div>
      </div>

      {/* Alerts */}
      {buyError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {buyError}
        </div>
      )}
      {buySuccess && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          {buySuccess}
        </div>
      )}

      {/* Search & Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters ? 'bg-accent/10 border-accent/30 text-accent' : 'border-border text-muted-foreground hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Position</label>
              <select
                value={position}
                onChange={(e) => { setPosition(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">All Positions</option>
                <option value="QB">Quarterback</option>
                <option value="RB">Running Back</option>
                <option value="WR">Wide Receiver</option>
                <option value="TE">Tight End</option>
                <option value="OL">Offensive Line</option>
                <option value="DL">Defensive Line</option>
                <option value="LB">Linebacker</option>
                <option value="CB">Cornerback</option>
                <option value="S">Safety</option>
                <option value="K">Kicker</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Rarity</label>
              <select
                value={rarity}
                onChange={(e) => { setRarity(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">All Rarities</option>
                <option value="COMMON">Common</option>
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="ELITE">Elite</option>
                <option value="LEGEND">Legend</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Min Overall</label>
              <select
                value={minOverall}
                onChange={(e) => { setMinOverall(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Any Rating</option>
                <option value="30">30+</option>
                <option value="40">40+</option>
                <option value="50">50+</option>
                <option value="60">60+</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Team Selector for Buying */}
      {myTeams.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Hire to:</span>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="px-3 py-1.5 bg-secondary border border-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {myTeams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Player Grid */}
      {sortedPlayers.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-white font-medium mb-1">No players found</p>
          <p className="text-muted-foreground text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPlayers.map((player) => {
            const cardData: PlayerCardData = {
              id: player.id,
              name: player.name,
              position: player.position,
              overall: player.overall,
              age: player.age,
              nationality: player.nationality,
              rarity: player.rarity,
              pace: player.pace,
              shooting: player.shooting,
              passing: player.passing,
              dribbling: player.dribbling,
              defending: player.defending,
              physical: player.physical,
              currentPrice: player.currentPrice,
              demandMultiplier: player.demandMultiplier,
            };
            return (
              <PlayerCard
                key={player.id}
                player={cardData}
                showBuyButton
                onBuy={() => buyPlayer(player.id)}
                buying={buying === player.id}
                canAfford={myWallet.cash >= player.currentPrice}
              />
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-secondary border border-border rounded-lg text-white disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-secondary border border-border rounded-lg text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
