import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Plus, X, Star, Coins, ShoppingCart, AlertCircle } from 'lucide-react';

interface TeamPlayer {
  id: string;
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
  isStarter: boolean;
}

interface Team {
  id: string;
  name: string;
  formation: string;
  style: string;
  pressing: string;
  mentality: string;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  teamPlayers: TeamPlayer[];
}

interface AvailablePlayer {
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
  currentPrice: number;
  demandMultiplier: number;
  teamPlayers: { id: string }[];
}

export default function TeamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [myWallet, setMyWallet] = useState({ cash: 0 });
  const [addingPlayer, setAddingPlayer] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
    fetchWallet();
  }, []);

  useEffect(() => {
    if (id && teams.length > 0) {
      const team = teams.find(t => t.id === id);
      if (team) setSelectedTeam(team);
    } else if (teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0]);
    }
  }, [id, teams]);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/teams/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
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
        setMyWallet(data.data || { cash: 0 });
      } else {
        console.error('Wallet fetch failed:', res.status);
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreateError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newTeamName }),
      });
      const data = await res.json();
      if (res.ok) {
        setTeams([...teams, data.data]);
        setSelectedTeam(data.data);
        setShowCreate(false);
        setNewTeamName('');
      } else {
        setCreateError(data.message || `Failed to create team (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to create team:', err);
      setCreateError('Network error. Please try again.');
    }
  };

  const addPlayer = async (playerId: string, price: number) => {
    if (!selectedTeam) return;
    setAddingPlayer(playerId);
    setAddError(null);
    setAddSuccess(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/teams/${selectedTeam.id}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ playerId, isStarter: false }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddSuccess(`Player hired for ${price.toLocaleString()} CASH!`);
        fetchTeams();
        fetchWallet();
        setTimeout(() => {
          setShowPlayerSelect(false);
          setAddSuccess(null);
        }, 1500);
      } else {
        setAddError(data.message || 'Failed to hire player');
      }
    } catch (err) {
      console.error('Failed to add player:', err);
      setAddError('Network error. Please try again.');
    } finally {
      setAddingPlayer(null);
    }
  };

  const removePlayer = async (playerId: string) => {
    if (!selectedTeam) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/teams/${selectedTeam.id}/players/${playerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchTeams();
      }
    } catch (err) {
      console.error('Failed to remove player:', err);
    }
  };

  const fetchAvailablePlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/players?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out players already in any team
        const available = data.data?.players.filter((p: AvailablePlayer) => p.teamPlayers.length === 0) || [];
        setAvailablePlayers(available);
      }
    } catch (err) {
      console.error('Failed to fetch players:', err);
    }
  };

  const openPlayerSelect = () => {
    fetchAvailablePlayers();
    setShowPlayerSelect(true);
    setAddError(null);
    setAddSuccess(null);
  };

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      COMMON: 'text-gray-400 border-gray-500',
      BRONZE: 'text-amber-600 border-amber-700',
      SILVER: 'text-slate-300 border-slate-300',
      GOLD: 'text-yellow-400 border-yellow-400',
      ELITE: 'text-purple-400 border-purple-400',
      LEGEND: 'text-red-400 border-red-400',
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

  const topUpWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/economy/wallet/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 100000 }),
      });
      if (res.ok) {
        fetchWallet();
        setAddSuccess('Added 100,000 CASH for testing!');
        setTimeout(() => setAddSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Failed to top up:', err);
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
          <h1 className="text-3xl font-bold text-white">My Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build your squad. Players cost CASH to hire based on their skill level.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-yellow-400">
            <Coins className="w-4 h-4 inline mr-1" />
            {myWallet.cash.toLocaleString()} CASH
          </div>
          <button
            onClick={topUpWallet}
            className="px-3 py-1.5 text-xs border border-emerald-300/30 text-emerald-300 rounded-lg hover:bg-emerald-300/10"
          >
            +100K (test)
          </button>
          {teams.length < 3 && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Team
            </button>
          )}
        </div>
      </div>

      {addError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {addError}
        </div>
      )}

      {addSuccess && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          {addSuccess}
        </div>
      )}

      {showCreate && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create New Team</h3>
          {createError && (
            <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {createError}
            </div>
          )}
          <div className="flex gap-4">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              className="flex-1 px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={createTeam}
              className="px-6 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-muted-foreground hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No teams yet</h3>
          <p className="text-muted-foreground mb-6">Create your first team to start playing</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent/90"
          >
            Create Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Selector */}
          <div className="lg:col-span-1 space-y-3">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                className={`w-full text-left p-4 rounded-lg transition-all ${
                  selectedTeam?.id === team.id
                    ? 'bg-accent/10 border border-accent/30'
                    : 'bg-card border border-border hover:bg-secondary'
                }`}
              >
                <div className="font-semibold text-white">{team.name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {team.teamPlayers?.length || 0} players • {team.points} pts
                </div>
                <div className="flex gap-2 mt-2 text-xs">
                  <span className="text-green-400">{team.wins}W</span>
                  <span className="text-yellow-400">{team.draws}D</span>
                  <span className="text-red-400">{team.losses}L</span>
                </div>
              </button>
            ))}
          </div>

          {/* Team Details */}
          {selectedTeam && (
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedTeam.name}</h2>
                    <p className="text-muted-foreground">Formation: {selectedTeam.formation}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-accent">{selectedTeam.points}</div>
                    <div className="text-sm text-muted-foreground">Points</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-secondary rounded-lg">
                    <div className="text-lg font-bold text-green-400">{selectedTeam.wins}</div>
                    <div className="text-xs text-muted-foreground">Wins</div>
                  </div>
                  <div className="text-center p-3 bg-secondary rounded-lg">
                    <div className="text-lg font-bold text-yellow-400">{selectedTeam.draws}</div>
                    <div className="text-xs text-muted-foreground">Draws</div>
                  </div>
                  <div className="text-center p-3 bg-secondary rounded-lg">
                    <div className="text-lg font-bold text-red-400">{selectedTeam.losses}</div>
                    <div className="text-xs text-muted-foreground">Losses</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Goals: {selectedTeam.goalsFor} - {selectedTeam.goalsAgainst}
                  </div>
                  <button
                    onClick={() => navigate('/matches')}
                    className="text-sm text-accent hover:underline"
                  >
                    Schedule Match
                  </button>
                </div>
              </div>

              {/* Squad */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Squad ({selectedTeam.teamPlayers?.length || 0}/25)</h3>
                  {(selectedTeam.teamPlayers?.length || 0) < 25 && (
                    <button
                      onClick={openPlayerSelect}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90"
                    >
                      <Plus className="w-4 h-4" />
                      Hire Player
                    </button>
                  )}
                </div>

                {selectedTeam.teamPlayers?.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No players in squad yet</p>
                    <button
                      onClick={openPlayerSelect}
                      className="text-accent text-sm hover:underline mt-2"
                    >
                      Hire players for your squad
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTeam.teamPlayers.map((tp) => (
                      <div
                        key={tp.id}
                        className={`flex items-center justify-between p-4 bg-secondary rounded-lg border ${getRarityColor(tp.player.rarity)}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{tp.player.name}</span>
                            {tp.isStarter && <Star className="w-4 h-4 text-yellow-400" />}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {tp.player.position} • OVR {tp.player.overall}
                          </div>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span>PAC {tp.player.pace}</span>
                            <span>SHO {tp.player.shooting}</span>
                            <span>PAS {tp.player.passing}</span>
                            <span>DRI {tp.player.dribbling}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removePlayer(tp.player.id)}
                          className="p-2 hover:bg-destructive/20 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Player Selection Modal */}
      {showPlayerSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="glass-card w-full max-w-2xl max-h-[80vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Hire Player</h3>
                <p className="text-sm text-muted-foreground">
                  <Coins className="w-3.5 h-3.5 inline mr-1" />
                  {myWallet.cash.toLocaleString()} CASH available
                </p>
              </div>
              <button
                onClick={() => setShowPlayerSelect(false)}
                className="p-2 hover:bg-secondary rounded-lg"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {addError}
              </div>
            )}

            {addSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
                {addSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availablePlayers.map((player) => (
                <div
                  key={player.id}
                  className={`text-left p-4 bg-secondary rounded-lg border hover:bg-secondary/80 transition-colors ${getRarityColor(player.rarity)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-white">{player.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {player.position} • OVR {player.overall} • {player.rarity}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${getRarityBg(player.rarity)} ${getRarityColor(player.rarity).split(' ')[0]}`}>
                      {player.rarity}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs mb-3">
                    <span>PAC {player.pace}</span>
                    <span>SHO {player.shooting}</span>
                    <span>PAS {player.passing}</span>
                    <span>DRI {player.dribbling}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Hire cost</p>
                      <p className="text-lg font-black text-yellow-400">
                        {player.currentPrice.toLocaleString()} CASH
                      </p>
                    </div>
                    <button
                      onClick={() => addPlayer(player.id, player.currentPrice)}
                      disabled={addingPlayer === player.id || myWallet.cash < player.currentPrice}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {addingPlayer === player.id ? 'Hiring...' : 'Hire'}
                    </button>
                  </div>
                  {myWallet.cash < player.currentPrice && (
                    <p className="text-xs text-red-300 mt-2">Not enough CASH</p>
                  )}
                </div>
              ))}
            </div>
            {availablePlayers.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No available players. Check the marketplace or wait for new prospects.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
