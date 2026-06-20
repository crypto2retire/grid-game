import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Calendar, ArrowRight, AlertCircle, Trophy, Clock } from 'lucide-react';

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
}

export default function MatchesPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHomeTeam, setSelectedHomeTeam] = useState('');
  const [selectedAwayTeam, setSelectedAwayTeam] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
    fetchTeams();
  }, []);

  const fetchMatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/matches?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        setMatches(result.data?.matches || []);
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
        setTeams(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const scheduleMatch = async () => {
    if (!selectedHomeTeam || !selectedAwayTeam) {
      setScheduleError('Select both teams');
      return;
    }
    if (selectedHomeTeam === selectedAwayTeam) {
      setScheduleError('Cannot schedule a match against yourself');
      return;
    }

    setScheduleError(null);
    setScheduleSuccess(null);
    setScheduling(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          homeTeamId: selectedHomeTeam,
          awayTeamId: selectedAwayTeam,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setScheduleSuccess('Match scheduled!');
        setSelectedHomeTeam('');
        setSelectedAwayTeam('');
        fetchMatches();
        setTimeout(() => setScheduleSuccess(null), 3000);
      } else {
        setScheduleError(data.message || 'Failed to schedule match');
      }
    } catch (err) {
      console.error('Failed to schedule match:', err);
      setScheduleError('Network error. Please try again.');
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
          <h1 className="text-3xl font-bold text-white">Matches</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule and view your competitive matches
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

      {/* Schedule Match Card */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Swords className="w-5 h-5 text-accent" />
          Schedule New Match
        </h2>

        {teams.length < 2 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-white font-medium mb-1">Need more teams</p>
            <p className="text-muted-foreground text-sm mb-4">
              Create at least 2 teams to schedule matches between them
            </p>
            <button
              onClick={() => navigate('/team')}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90"
            >
              Create Team →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Home Team</label>
              <select
                value={selectedHomeTeam}
                onChange={(e) => setSelectedHomeTeam(e.target.value)}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select team...</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Away Team</label>
              <select
                value={selectedAwayTeam}
                onChange={(e) => setSelectedAwayTeam(e.target.value)}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select team...</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                onClick={scheduleMatch}
                disabled={scheduling || !selectedHomeTeam || !selectedAwayTeam}
                className="w-full px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50"
              >
                {scheduling ? 'Scheduling...' : 'Schedule Match'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Match History */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-accent" />
          Match History
        </h2>

        {matches.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No matches yet</p>
            <p className="text-muted-foreground text-sm">
              Schedule your first match above
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
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
