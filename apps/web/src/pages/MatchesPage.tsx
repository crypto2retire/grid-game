import { useState, useEffect } from 'react';
import {
  Swords,
  Calendar,
  ArrowRight,
  AlertCircle,
  Trophy,
  Clock,
  Users,
  Bot,
  Star,
  Shield,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Trophy as TrophyIcon,
} from 'lucide-react';
import { getSportLabel, useGameStore } from '../store/gameStore';

interface Match {
  id: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  homeScore: number;
  awayScore: number;
  status: string;
  scheduledAt: string;
  completedAt: string | null;
}

interface Team {
  id: string;
  name: string;
  tier: string;
}

interface LiveOpponent {
  id: string;
  name: string;
  tier: string;
  owner: { username: string; displayName: string | null };
  wins: number;
  losses: number;
  overall: number;
}

interface AIOpponent {
  id: string;
  name: string;
  tier: string;
  aiDifficulty: string;
  aiStrategy: string;
  wins: number;
  losses: number;
  overall: number;
  purchasePrice: number;
  purchaseCurrency: string;
}

interface MatchmakingData {
  userTeam: { id: string; name: string; tier: string; wins: number; losses: number };
  liveOpponents: LiveOpponent[];
  aiOpponents: AIOpponent[];
}

interface MatchDetail {
  id: string;
  homeTeam: { id: string; name: string; formation?: string | null; wins: number; draws: number; losses: number; points: number };
  awayTeam: { id: string; name: string; formation?: string | null; wins: number; draws: number; losses: number; points: number };
  homeScore: number;
  awayScore: number;
  status: string;
  scheduledAt: string;
  completedAt: string | null;
  events?: any[];
  playerStats?: any[];
}

interface PlayState {
  matchId: string;
  quarter: number;
  clock: string;
  down: number;
  distance: number;
  yardLine: number;
  possession: 'home' | 'away';
  homeScore: number;
  awayScore: number;
  homeTeamName: string;
  awayTeamName: string;
  lastPlay?: string;
  gameOver?: boolean;
  log?: string[];
}

export default function MatchesPage() {
  const { activeSportId } = useGameStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [matchmaking, setMatchmaking] = useState<MatchmakingData | null>(null);
  const [matchmakingLoading, setMatchmakingLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [showLive, setShowLive] = useState(true);
  const [showAI, setShowAI] = useState(true);
  const [detailMatchId, setDetailMatchId] = useState<string | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [playMatchId, setPlayMatchId] = useState<string | null>(null);
  const [playState, setPlayState] = useState<PlayState | null>(null);
  const [playLoading, setPlayLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [selectedPlay, setSelectedPlay] = useState<string>('');

  useEffect(() => {
    fetchMatches();
    fetchTeams();
  }, [activeSportId]);

  const fetchMatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/matches?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        setMatches((result.data?.matches || []).filter((match: any) => (match.sportId || 'american-football') === activeSportId));
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/teams/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const userTeams = (data.data || []).filter((team: any) => (team.sportId || 'american-football') === activeSportId);
        setTeams(userTeams);
        if (userTeams.length === 1) {
          setSelectedTeam(userTeams[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const findOpponents = async () => {
    if (!selectedTeam) {
      setScheduleError('Select a team first');
      return;
    }
    setScheduleError(null);
    setScheduleSuccess(null);
    setMatchmakingLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/ai-teams/matchmaking/${selectedTeam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMatchmaking(data.data);
      } else {
        const data = await res.json();
        setScheduleError(data.message || 'Failed to find opponents');
      }
    } catch (err) {
      console.error('Failed to find opponents:', err);
      setScheduleError('Network error');
    } finally {
      setMatchmakingLoading(false);
    }
  };

  const scheduleLive = async (opponentId: string) => {
    setScheduleError(null);
    setScheduleSuccess(null);
    setScheduling(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai-teams/schedule/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ homeTeamId: selectedTeam, awayTeamId: opponentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setScheduleSuccess('Match scheduled vs live opponent!');
        fetchMatches();
        setMatchmaking(null);
        setTimeout(() => setScheduleSuccess(null), 3000);
      } else {
        setScheduleError(data.message || 'Failed to schedule');
      }
    } catch (err) {
      setScheduleError('Network error');
    } finally {
      setScheduling(false);
    }
  };

  const scheduleAI = async (opponentId: string) => {
    setScheduleError(null);
    setScheduleSuccess(null);
    setScheduling(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai-teams/schedule/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userTeamId: selectedTeam, aiTeamId: opponentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setScheduleSuccess('Match scheduled vs AI opponent!');
        fetchMatches();
        setMatchmaking(null);
        setTimeout(() => setScheduleSuccess(null), 3000);
      } else {
        setScheduleError(data.message || 'Failed to schedule');
      }
    } catch (err) {
      setScheduleError('Network error');
    } finally {
      setScheduling(false);
    }
  };

  const fetchMatchDetail = async (matchId: string) => {
    setDetailLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/matches/${matchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMatchDetail(data.data);
      } else {
        setMatchDetail(null);
      }
    } catch (err) {
      console.error('Failed to fetch match detail:', err);
      setMatchDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const startPlaying = async (matchId: string) => {
    setPlayMatchId(matchId);
    setPlayState(null);
    setPlayError(null);
    setSelectedPlay('');
    setPlayLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Initialize playable match
      const initRes = await fetch(`/api/play-game/${matchId}/init`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!initRes.ok) {
        const data = await initRes.json();
        throw new Error(data.message || 'Failed to initialize game');
      }
      // Set default lineup and styles (balanced)
      const lineupRes = await fetch(`/api/play-game/${matchId}/lineup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          offensiveLineup: [],
          defensiveLineup: [],
          offensiveStyle: 'balanced',
          defensiveStyle: 'balanced',
        }),
      });
      if (!lineupRes.ok) {
        const data = await lineupRes.json();
        throw new Error(data.message || 'Failed to set lineup');
      }
      await refreshPlayState(matchId);
    } catch (err: any) {
      setPlayError(err.message || 'Failed to start game');
    } finally {
      setPlayLoading(false);
    }
  };

  const refreshPlayState = async (matchId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/play-game/${matchId}/state`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlayState(data.data);
      }
    } catch (err) {
      console.error('Failed to refresh play state:', err);
    }
  };

  const submitPlay = async () => {
    if (!playMatchId || !selectedPlay) return;
    setPlayLoading(true);
    setPlayError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/play-game/${playMatchId}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ playType: selectedPlay }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Play failed');
      }
      setPlayState(data.data);
      if (data.data?.gameOver) {
        await completeGame(playMatchId);
      }
    } catch (err: any) {
      setPlayError(err.message || 'Play failed');
    } finally {
      setPlayLoading(false);
    }
  };

  const simRemainder = async () => {
    if (!playMatchId) return;
    setPlayLoading(true);
    setPlayError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/play-game/${playMatchId}/sim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Simulation failed');
      setPlayState(data.data);
      await completeGame(playMatchId);
    } catch (err: any) {
      setPlayError(err.message || 'Simulation failed');
    } finally {
      setPlayLoading(false);
    }
  };

  const completeGame = async (matchId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/play-game/${matchId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMatches();
    } catch (err) {
      console.error('Failed to complete game:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-1 rounded text-xs bg-green-400/10 text-green-400">Completed</span>;
      case 'SCHEDULED':
        return <span className="px-2 py-1 rounded text-xs bg-yellow-400/10 text-yellow-400">Scheduled</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-1 rounded text-xs bg-blue-400/10 text-blue-400">Live</span>;
      default:
        return <span className="px-2 py-1 rounded text-xs bg-gray-400/10 text-gray-400">{status}</span>;
    }
  };

  const getDifficultyColor = (diff: string) => {
    if (diff === 'rookie') return 'text-green-400';
    if (diff === 'veteran') return 'text-blue-400';
    if (diff === 'elite') return 'text-purple-400';
    return 'text-red-400';
  };

  const getDifficultyStars = (diff: string) => {
    const stars = { rookie: 1, veteran: 2, elite: 3, legend: 4 };
    return stars[diff as keyof typeof stars] || 1;
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
          <h1 className="text-3xl font-bold text-white">Games</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule and view your {getSportLabel(activeSportId)} games
          </p>
        </div>
      </div>

      {/* Alerts */}
      {scheduleError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {scheduleError}
        </div>
      )}
      {scheduleSuccess && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          {scheduleSuccess}
        </div>
      )}

      {/* Schedule Game Card */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Swords className="w-5 h-5 text-accent" />
          Schedule New Game
        </h2>

        {teams.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No teams yet</p>
            <p className="text-muted-foreground text-sm mb-4">
              Create a team to start playing
            </p>
            <p className="text-muted-foreground text-sm">
              Create a team from the Locker Room to start playing
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Select Your Team</label>
              <select
                value={selectedTeam}
                onChange={(e) => { setSelectedTeam(e.target.value); setMatchmaking(null); }}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select team...</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={findOpponents}
              disabled={matchmakingLoading || !selectedTeam}
              className="w-full px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50"
            >
              {matchmakingLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Finding opponents...
                </span>
              ) : (
                'Find Opponents'
              )}
            </button>
          </div>
        )}

        {/* Matchmaking Results */}
        {matchmaking && (
          <div className="mt-6 space-y-4">
            {/* Live Opponents */}
            <div>
              <button
                onClick={() => setShowLive(!showLive)}
                className="flex items-center justify-between w-full p-3 bg-secondary/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-white">Live Players</span>
                  <span className="text-sm text-muted-foreground">({matchmaking.liveOpponents.length})</span>
                </div>
                {showLive ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showLive && (
                <div className="mt-2 space-y-2">
                  {matchmaking.liveOpponents.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No live players available in your tier. Try an AI opponent below.
                    </div>
                  ) : (
                    matchmaking.liveOpponents.map((opp) => (
                      <div key={opp.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-3">
                          <Shield className="w-8 h-8 text-blue-400" />
                          <div>
                            <div className="font-medium text-white">{opp.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Owner: {opp.owner.displayName || opp.owner.username} • {opp.wins}-{opp.losses}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-bold text-white">OVR {opp.overall}</div>
                          </div>
                          <button
                            onClick={() => scheduleLive(opp.id)}
                            disabled={scheduling}
                            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            Challenge
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* AI Opponents */}
            <div>
              <button
                onClick={() => setShowAI(!showAI)}
                className="flex items-center justify-between w-full p-3 bg-secondary/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold text-white">AI Opponents</span>
                  <span className="text-sm text-muted-foreground">({matchmaking.aiOpponents.length})</span>
                </div>
                {showAI ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showAI && (
                <div className="mt-2 space-y-2">
                  {matchmaking.aiOpponents.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No AI opponents available right now.
                    </div>
                  ) : (
                    matchmaking.aiOpponents.map((opp) => (
                      <div key={opp.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-3">
                          <Bot className="w-8 h-8 text-purple-400" />
                          <div>
                            <div className="font-medium text-white">{opp.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <span className={getDifficultyColor(opp.aiDifficulty)}>
                                {Array.from({ length: getDifficultyStars(opp.aiDifficulty) }).map((_, i) => (
                                  <Star key={i} className="w-3 h-3 inline" />
                                ))} {opp.aiDifficulty}
                              </span>
                              <span>• {opp.aiStrategy}</span>
                              <span>• {opp.wins}-{opp.losses}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-bold text-white">OVR {opp.overall}</div>
                            <div className="text-xs text-muted-foreground">{opp.purchasePrice.toLocaleString()} {opp.purchaseCurrency}</div>
                          </div>
                          <button
                            onClick={() => scheduleAI(opp.id)}
                            disabled={scheduling}
                            className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            Play
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Game History */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-accent" />
          Game History
        </h2>

        {matches.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No games yet</p>
            <p className="text-muted-foreground text-sm">
              Schedule your first game above
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.id}
                onClick={() => { setDetailMatchId(match.id); fetchMatchDetail(match.id); }}
                className="flex items-center justify-between p-4 bg-secondary rounded-lg hover:bg-secondary/80 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-right flex-1">
                    <div className="font-semibold text-white">{match.homeTeam.name}</div>
                  </div>
                  <div className="text-center px-4">
                    {match.status === 'COMPLETED' ? (
                      <div className="text-xl font-bold text-white">
                        {match.homeScore} - {match.awayScore}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">vs</div>
                    )}
                    <div className="mt-1">{getStatusBadge(match.status)}</div>
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-white">{match.awayTeam.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {match.status === 'SCHEDULED' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startPlaying(match.id);
                      }}
                      className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium rounded-lg transition-colors"
                    >
                      Play Game
                    </button>
                  )}
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match Detail Modal */}
      {detailMatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1a] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <TrophyIcon className="w-5 h-5 text-accent" /> Game Details
              </h3>
              <button
                onClick={() => setDetailMatchId(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : matchDetail ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
                  <div className="text-center flex-1">
                    <div className="font-bold text-white">{matchDetail.homeTeam.name}</div>
                    <div className="text-xs text-muted-foreground">{matchDetail.homeTeam.wins}-{matchDetail.homeTeam.losses}</div>
                  </div>
                  <div className="text-center px-6">
                    <div className="text-2xl font-black text-white">{matchDetail.homeScore} - {matchDetail.awayScore}</div>
                    <div className="mt-1">{getStatusBadge(matchDetail.status)}</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="font-bold text-white">{matchDetail.awayTeam.name}</div>
                    <div className="text-xs text-muted-foreground">{matchDetail.awayTeam.wins}-{matchDetail.awayTeam.losses}</div>
                  </div>
                </div>
                {matchDetail.events && matchDetail.events.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-white">Game Log</h4>
                    <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl bg-secondary p-3">
                      {matchDetail.events.map((ev, i) => (
                        <div key={i} className="text-xs text-slate-300">Q{ev.quarter || '?'} {ev.clock || ''} — {ev.description || ev.type}</div>
                      ))}
                    </div>
                  </div>
                )}
                {matchDetail.playerStats && matchDetail.playerStats.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-white">Player Stats</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {matchDetail.playerStats.map((ps, i) => (
                        <div key={i} className="p-2 rounded-lg bg-secondary text-xs text-slate-300">
                          <span className="font-medium text-white">{ps.player?.name || 'Player'}</span> — {ps.player?.position || 'N/A'}: {Object.entries(ps).filter(([k]) => !['player','id','matchId','playerId'].includes(k)).map(([k,v]) => `${k}: ${v}`).join(', ')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">Failed to load game details.</div>
            )}
          </div>
        </div>
      )}

      {/* Play Game Modal */}
      {playMatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1a] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-accent" /> Play Game
              </h3>
              <button
                onClick={() => setPlayMatchId(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {playLoading && !playState ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : playError ? (
              <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{playError}</div>
            ) : playState ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
                  <div className="text-center flex-1">
                    <div className="font-bold text-white">{playState.homeTeamName}</div>
                    <div className="text-2xl font-black text-white">{playState.homeScore}</div>
                  </div>
                  <div className="text-center px-6">
                    <div className="text-sm text-muted-foreground">Q{playState.quarter}</div>
                    <div className="text-lg font-bold text-white">{playState.clock}</div>
                    <div className="text-xs text-muted-foreground">{playState.down} & {playState.distance}</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="font-bold text-white">{playState.awayTeamName}</div>
                    <div className="text-2xl font-black text-white">{playState.awayScore}</div>
                  </div>
                </div>
                <div className="text-center text-sm text-slate-300">
                  Ball at {playState.yardLine} yard line • {playState.possession === 'home' ? playState.homeTeamName : playState.awayTeamName} possession
                </div>
                {playState.lastPlay && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                    Last play: {playState.lastPlay}
                  </div>
                )}
                {playState.gameOver ? (
                  <div className="text-center py-6">
                    <div className="text-2xl font-black text-white mb-2">Game Over</div>
                    <div className="text-lg text-slate-300">Final: {playState.homeScore} - {playState.awayScore}</div>
                    <button
                      onClick={() => setPlayMatchId(null)}
                      className="mt-4 px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        'RUN_LEFT', 'RUN_MIDDLE', 'RUN_RIGHT', 'QB_DRAW',
                        'SHORT_PASS', 'MEDIUM_PASS', 'DEEP_BALL', 'SCREEN', 'PUNT', 'FIELD_GOAL'
                      ].map((play) => (
                        <button
                          key={play}
                          onClick={() => setSelectedPlay(play)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            selectedPlay === play
                              ? 'bg-accent text-white'
                              : 'bg-secondary text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {play.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={submitPlay}
                        disabled={playLoading || !selectedPlay}
                        className="flex-1 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-medium disabled:opacity-50"
                      >
                        {playLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Run Play'}
                      </button>
                      <button
                        onClick={simRemainder}
                        disabled={playLoading}
                        className="flex-1 px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg font-medium disabled:opacity-50"
                      >
                        Sim Rest
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">Preparing game...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
