import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Plus, X, Star } from 'lucide-react';

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

export default function TeamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);

  useEffect(() => {
    fetchTeams();
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

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
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
      if (res.ok) {
        const data = await res.json();
        setTeams([...teams, data.data]);
        setSelectedTeam(data.data);
        setShowCreate(false);
        setNewTeamName('');
      }
    } catch (err) {
      console.error('Failed to create team:', err);
    }
  };

  const addPlayer = async (playerId: string) => {
    if (!selectedTeam) return;
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
      if (res.ok) {
        fetchTeams();
        setShowPlayerSelect(false);
      }
    } catch (err) {
      console.error('Failed to add player:', err);
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
        // Filter out players already in the team
        const teamPlayerIds = new Set(selectedTeam?.teamPlayers.map(tp => tp.player.id) || []);
        const available = data.data?.players.filter((p: any) => !teamPlayerIds.has(p.id) && p.teamPlayers.length === 0) || [];
        setAvailablePlayers(available);
      }
    } catch (err) {
      console.error('Failed to fetch players:', err);
    }
  };

  const openPlayerSelect = () => {
    fetchAvailablePlayers();
    setShowPlayerSelect(true);
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
        <h1 className="text-3xl font-bold text-white">My Teams</h1>
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

      {showCreate && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Create New Team</h3>
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
                      Add Player
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
                      Add players to your squad
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
              <h3 className="text-lg font-semibold text-white">Select Player</h3>
              <button
                onClick={() => setShowPlayerSelect(false)}
                className="p-2 hover:bg-secondary rounded-lg"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availablePlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => addPlayer(player.id)}
                  className={`text-left p-4 bg-secondary rounded-lg border hover:bg-secondary/80 transition-colors ${getRarityColor(player.rarity)}`}
                >
                  <div className="font-semibold text-white">{player.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {player.position} • OVR {player.overall} • {player.rarity}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs">
                    <span>PAC {player.pace}</span>
                    <span>SHO {player.shooting}</span>
                    <span>PAS {player.passing}</span>
                    <span>DRI {player.dribbling}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
