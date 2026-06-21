import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function MatchesPage() {
  const navigate = useNavigate();
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
            <button
              onClick={() => navigate('/team')}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90"
            >
              Create Team →
            </button>
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
                onClick={() => navigate(`/matches/${match.id}`)}
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
                        navigate(`/matches/${match.id}/play`);
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
    </div>
  );
}
