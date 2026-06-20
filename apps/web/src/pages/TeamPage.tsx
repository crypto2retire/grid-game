import { useState, useEffect } from 'react';
import { Shield, Plus, X, Star, Coins, AlertCircle, Users, ChevronRight } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export default function TeamPage() {
  const {
    teams,
    selectedTeamId,
    teamsLoading,
    wallet,
    setSelectedTeamId,
    refreshTeams,
    refreshWallet,
  } = useGameStore();

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0] || null;

  const [newTeamName, setNewTeamName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [addingPlayer, setAddingPlayer] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Load data on mount if not already loaded
  useEffect(() => {
    if (teams.length === 0 && !teamsLoading) {
      refreshTeams();
    }
    if (wallet.cash === 0) {
      refreshWallet();
    }
  }, []);

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
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewTeamName('');
        setShowCreate(false);
        refreshTeams();
      } else {
        setCreateError(data.message || `Failed to create team (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to create team:', err);
      setCreateError('Network error. Please try again.');
    }
  };

  const openPlayerSelect = async () => {
    setShowPlayerSelect(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/players?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailablePlayers(data.data?.players || []);
      }
    } catch (err) {
      console.error('Failed to fetch players:', err);
    }
  };

  const addPlayerToTeam = async (playerId: string) => {
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
        setAddSuccess('Player hired successfully!');
        // Remove hired player and fetch a new random one to replace them
        setAvailablePlayers((prev) => prev.filter((p) => p.id !== playerId));
        fetchNewRandomPlayer();
        refreshTeams();
        refreshWallet();
        setTimeout(() => setAddSuccess(null), 3000);
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

  const fetchNewRandomPlayer = async () => {
    try {
      const token = localStorage.getItem('token');
      // Fetch a single random player not already in the available list
      const res = await fetch('/api/players?limit=1&random=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const newPlayers = data.data?.players || [];
        if (newPlayers.length > 0) {
          setAvailablePlayers((prev) => [...prev, ...newPlayers]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch new random player:', err);
    }
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
        refreshWallet();
      } else {
        const data = await res.json();
        console.error('Top up failed:', data.message);
      }
    } catch (err) {
      console.error('Failed to top up wallet:', err);
    }
  };

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      COMMON: 'text-gray-400 border-gray-500/30',
      BRONZE: 'text-amber-600 border-amber-700/30',
      SILVER: 'text-slate-300 border-slate-300/30',
      GOLD: 'text-yellow-400 border-yellow-400/30',
      ELITE: 'text-purple-400 border-purple-400/30',
      LEGEND: 'text-red-400 border-red-400/30',
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

  const calculateTeamOVR = (team: any) => {
    if (!team.teamPlayers?.length) return 0;
    const total = team.teamPlayers.reduce((sum: number, tp: any) => sum + tp.player.overall, 0);
    return Math.round(total / team.teamPlayers.length);
  };

  const loading = teamsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#E94560]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            MY <span className="text-[#E94560]">TEAM</span>
          </h1>
          <p className="text-white/40 mt-1">Build your squad. Players cost CASH to hire.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-black/30 border border-[#FFD700]/20 rounded-xl">
            <Coins className="w-5 h-5 text-[#FFD700]" />
            <span className="text-lg font-mono font-bold text-[#FFD700]">{wallet.cash.toLocaleString()}</span>
            <span className="text-xs text-[#FFD700]/60">CASH</span>
          </div>
          <button
            onClick={topUpWallet}
            className="px-3 py-2 bg-[#E94560]/10 border border-[#E94560]/30 text-[#E94560] rounded-xl text-sm font-medium hover:bg-[#E94560]/20 transition-colors"
          >
            +100K
          </button>
        </div>
      </div>

      {/* Alerts */}
      {addError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {addError}
        </div>
      )}
      {addSuccess && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
          {addSuccess}
        </div>
      )}

      {/* No Teams State */}
      {teams.length === 0 && (
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#E94560]/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-[#E94560]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Create Your First Team</h2>
          <p className="text-white/40 mb-6 max-w-md mx-auto">
            Build a squad of 25 players and compete in matches to earn points and climb the leaderboard.
          </p>
          <div className="flex items-center gap-4 justify-center mb-6">
            <div className="text-center">
              <div className="text-2xl font-black text-[#E94560]">25</div>
              <div className="text-xs text-white/30">Players</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <div className="text-2xl font-black text-[#FFD700]">∞</div>
              <div className="text-xs text-white/30">Matches</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <div className="text-2xl font-black text-purple-400">#1</div>
              <div className="text-xs text-white/30">Goal</div>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-8 py-3 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-bold text-lg hover:shadow-glow-lg transition-shadow"
          >
            Create Your First Team
          </button>
        </div>
      )}

      {/* Team Selector + Content */}
      {teams.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Teams List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Your Teams</h3>
                {teams.length < 3 && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4 text-[#E94560]" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {teams.map((team) => {
                  const isSelected = selectedTeam?.id === team.id;
                  const teamOVR = calculateTeamOVR(team);
                  return (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${
                        isSelected
                          ? 'bg-[#E94560]/10 border-[#E94560]/30'
                          : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-white text-sm">{team.name}</div>
                        {isSelected && <ChevronRight className="w-4 h-4 text-[#E94560]" />}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                        <span>OVR {teamOVR || '—'}</span>
                        <span>{team.teamPlayers?.length || 0}/25</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Stats */}
            {selectedTeam && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Team Stats</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Overall Rating</span>
                    <span className="text-lg font-black text-[#E94560]">{calculateTeamOVR(selectedTeam) || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Record</span>
                    <span className="text-sm font-bold text-white">{selectedTeam.wins}-{selectedTeam.draws}-{selectedTeam.losses}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Points</span>
                    <span className="text-sm font-bold text-[#FFD700]">{selectedTeam.points}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Squad Size</span>
                    <span className="text-sm font-bold text-white">{selectedTeam.teamPlayers?.length || 0}/25</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {selectedTeam && (
              <>
                {/* Team Header Card */}
                <div className="glass-card p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#E94560]/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#E94560] to-purple-600 rounded-2xl flex items-center justify-center shadow-glow">
                          <Shield className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white">{selectedTeam.name}</h2>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-white/40">{selectedTeam.teamPlayers?.length || 0} players</span>
                            <span className="text-sm text-white/20">•</span>
                            <span className="text-sm text-[#FFD700]">{selectedTeam.points} pts</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-black text-[#E94560]">{calculateTeamOVR(selectedTeam) || '—'}</div>
                        <div className="text-xs text-white/30 uppercase tracking-wider">Team OVR</div>
                      </div>
                    </div>

                    {/* Record Bar */}
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        <span className="text-sm text-white/40">{selectedTeam.wins} Wins</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <span className="text-sm text-white/40">{selectedTeam.draws} Draws</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <span className="text-sm text-white/40">{selectedTeam.losses} Losses</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Squad Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#E94560]" />
                      Squad ({selectedTeam.teamPlayers?.length || 0}/25)
                    </h3>
                    {(selectedTeam.teamPlayers?.length || 0) < 25 && (
                      <button
                        onClick={openPlayerSelect}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-medium hover:shadow-glow transition-shadow"
                      >
                        <Plus className="w-4 h-4" />
                        {selectedTeam.teamPlayers?.length === 0 ? 'Hire Your First Player' : 'Hire Player'}
                      </button>
                    )}
                  </div>

                  {selectedTeam.teamPlayers?.length === 0 ? (
                    <div className="glass-card p-12 text-center border-2 border-dashed border-white/10">
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-white/20" />
                      </div>
                      <p className="text-white font-medium mb-1">No players yet</p>
                      <p className="text-white/30 text-sm">Click "Hire Player" to add your first squad member</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {selectedTeam.teamPlayers.map((tp) => (
                        <div
                          key={tp.id}
                          className={`glass-card p-4 card-lift border ${getRarityColor(tp.player.rarity)}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-bold text-white">{tp.player.name}</div>
                              <div className="text-sm text-white/40">{tp.player.position}</div>
                            </div>
                            <div className={`px-2 py-1 rounded-lg text-xs font-bold ${getRarityBg(tp.player.rarity)} ${getRarityColor(tp.player.rarity).split(' ')[0]}`}>
                              {tp.player.rarity}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mb-3">
                            <div className="text-center">
                              <div className="text-2xl font-black text-white">{tp.player.overall}</div>
                              <div className="text-xs text-white/30">OVR</div>
                            </div>
                            <div className="flex-1 grid grid-cols-3 gap-1 text-xs">
                              {[
                                { label: 'PAC', value: tp.player.pace },
                                { label: 'SHO', value: tp.player.shooting },
                                { label: 'PAS', value: tp.player.passing },
                                { label: 'DRI', value: tp.player.dribbling },
                                { label: 'DEF', value: tp.player.defending },
                                { label: 'PHY', value: tp.player.physical },
                              ].map((stat) => (
                                <div key={stat.label} className="text-center bg-white/5 rounded-lg py-1">
                                  <div className="font-bold text-white">{stat.value}</div>
                                  <div className="text-[10px] text-white/30">{stat.label}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {tp.isStarter && (
                            <div className="flex items-center gap-1 text-xs text-[#E94560]">
                              <Star className="w-3 h-3" />
                              Starter
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Create New Team</h3>
              <button onClick={() => { setShowCreate(false); setCreateError(null); }} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>
            {createError && (
              <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200 mb-4">
                {createError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/40 mb-1 block">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Thunder FC"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#E94560] focus:ring-1 focus:ring-[#E94560]/30 transition-all"
                />
              </div>
              <button
                onClick={createTeam}
                disabled={!newTeamName.trim()}
                className="w-full px-4 py-3 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-bold hover:shadow-glow transition-shadow disabled:opacity-50"
              >
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hire Player Modal */}
      {showPlayerSelect && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card w-full max-w-6xl p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Hire Player</h3>
                <p className="text-sm text-white/40">Available players with their hire costs</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 border border-[#FFD700]/20 rounded-lg">
                  <Coins className="w-4 h-4 text-[#FFD700]" />
                  <span className="text-sm font-bold text-[#FFD700]">{wallet.cash.toLocaleString()}</span>
                </div>
                <button
                  onClick={topUpWallet}
                  className="px-3 py-1.5 bg-[#E94560]/10 border border-[#E94560]/30 text-[#E94560] rounded-lg text-xs font-medium hover:bg-[#E94560]/20 transition-colors"
                >
                  +100K
                </button>
                <button onClick={() => setShowPlayerSelect(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Sidebar - Current Squad Overview */}
              <div className="lg:col-span-1 space-y-4">
                <div className="glass-card p-4">
                  <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Current Squad</h4>
                  
                  {/* Position Counts */}
                  <div className="space-y-2 mb-4">
                    {['GK', 'DEF', 'MID', 'FWD'].map((pos) => {
                      const count = selectedTeam?.teamPlayers?.filter((tp: any) => tp.player.position === pos).length || 0;
                      const maxCount = pos === 'GK' ? 2 : pos === 'DEF' ? 5 : pos === 'MID' ? 5 : 4;
                      const isNeeded = count < maxCount;
                      return (
                        <div key={pos} className={`flex items-center justify-between p-2 rounded-lg ${isNeeded ? 'bg-[#E94560]/10 border border-[#E94560]/20' : 'bg-white/5'}`}>
                          <span className="text-sm font-medium text-white">{pos}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isNeeded ? 'text-[#E94560]' : 'text-green-400'}`}>
                              {count}/{maxCount}
                            </span>
                            {isNeeded && <span className="text-[10px] text-[#E94560]">NEED</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Current Players List */}
                  <div className="space-y-1 max-h-60 overflow-auto">
                    <div className="text-xs text-white/30 mb-2">{selectedTeam?.teamPlayers?.length || 0} players</div>
                    {selectedTeam?.teamPlayers?.map((tp: any) => (
                      <div key={tp.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${
                          tp.player.position === 'GK' ? 'bg-yellow-400' :
                          tp.player.position === 'DEF' ? 'bg-blue-400' :
                          tp.player.position === 'MID' ? 'bg-green-400' :
                          'bg-red-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">{tp.player.name}</div>
                          <div className="text-[10px] text-white/30">{tp.player.position} • OVR {tp.player.overall}</div>
                        </div>
                      </div>
                    )) || (
                      <div className="text-center py-4 text-white/20 text-xs">No players yet</div>
                    )}
                  </div>
                </div>

                {/* Formation Preview */}
                <div className="glass-card p-4">
                  <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Formation</h4>
                  <div className="text-center">
                    <div className="text-2xl font-black text-[#E94560] mb-1">4-3-3</div>
                    <div className="text-xs text-white/30">Default Formation</div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px]">
                    <div className="text-yellow-400">1 GK</div>
                    <div className="text-blue-400">4 DEF</div>
                    <div className="text-green-400">3 MID</div>
                    <div className="text-red-400">3 FWD</div>
                  </div>
                </div>
              </div>

              {/* Right Side - Available Players */}
              <div className="lg:col-span-3">
                {/* Position Filter */}
                <div className="flex items-center gap-2 mb-4">
                  {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((pos) => {
                    const isActive = positionFilter === pos;
                    const posCount = pos === 'ALL' ? availablePlayers.length : availablePlayers.filter((p: any) => p.position === pos).length;
                    return (
                      <button
                        key={pos}
                        onClick={() => setPositionFilter(pos)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-[#E94560] text-white shadow-glow'
                            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {pos} ({posCount})
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {availablePlayers
                    .filter((player) => positionFilter === 'ALL' || player.position === positionFilter)
                    .map((player) => {
                    const posCount = selectedTeam?.teamPlayers?.filter((tp: any) => tp.player.position === player.position).length || 0;
                    const maxCount = player.position === 'GK' ? 2 : player.position === 'DEF' ? 5 : player.position === 'MID' ? 5 : 4;
                    const isNeeded = posCount < maxCount;
                    
                    return (
                      <div key={player.id} className={`glass-card p-4 border ${getRarityColor(player.rarity)} ${isNeeded ? 'ring-1 ring-[#E94560]/30' : ''}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-bold text-white">{player.name}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white/40">{player.position}</span>
                              {isNeeded && (
                                <span className="px-1.5 py-0.5 bg-[#E94560]/20 text-[#E94560] text-[10px] font-bold rounded">NEEDED</span>
                              )}
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-lg text-xs font-bold ${getRarityBg(player.rarity)} ${getRarityColor(player.rarity).split(' ')[0]}`}>
                            {player.rarity}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-center">
                            <div className="text-2xl font-black text-white">{player.overall}</div>
                            <div className="text-xs text-white/30">OVR</div>
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-1 text-xs">
                            {[
                              { label: 'PAC', value: player.pace },
                              { label: 'SHO', value: player.shooting },
                              { label: 'PAS', value: player.passing },
                              { label: 'DRI', value: player.dribbling },
                              { label: 'DEF', value: player.defending },
                              { label: 'PHY', value: player.physical },
                            ].map((stat) => (
                              <div key={stat.label} className="text-center bg-white/5 rounded-lg py-1">
                                <div className="font-bold text-white">{stat.value}</div>
                                <div className="text-[10px] text-white/30">{stat.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                          <div className="text-lg font-black text-[#FFD700]">{player.currentPrice.toLocaleString()} CASH</div>
                          <button
                            onClick={() => addPlayerToTeam(player.id)}
                            disabled={addingPlayer === player.id || wallet.cash < player.currentPrice}
                            className="px-4 py-2 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-lg font-medium hover:shadow-glow transition-shadow disabled:opacity-50 text-sm"
                          >
                            {addingPlayer === player.id ? 'Hiring...' : 'Hire'}
                          </button>
                        </div>
                        {wallet.cash < player.currentPrice && (
                          <p className="text-xs text-red-300 mt-2">Not enough CASH</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
