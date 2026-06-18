import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Swords, Calendar, ArrowRight } from 'lucide-react';

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
  const { user } = useAuthStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHomeTeam, setSelectedHomeTeam] = useState('');
  const [selectedAwayTeam, setSelectedAwayTeam] = useState('');
  const [scheduling, setScheduling] = useState(false);

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
        const data = await res.json();
        // Note: In a real app, we'd have a dedicated endpoint for listing matches
        // This is a simplified version
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
    if (!selectedHomeTeam || !selectedAwayTeam) return;
    if (selectedHomeTeam === selectedAwayTeam) {
      alert('Cannot schedule a match against yourself');
      return;
    }

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

      if (res.ok) {
        const data = await res.json();
        navigate(`/matches/${data.data.match.id}`);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to schedule match');
      }
    } catch (err) {
      console.error('Failed to schedule match:', err);
      alert('Failed to schedule match');
    } finally {
      setScheduling(false);
    }
  };

  const simulateMatch = async (matchId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/matches/${matchId}/simulate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        navigate(`/matches/${matchId}`);
      }
    } catch (err) {
      console.error('Failed to simulate match:', err);
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
      <h1 className="text-3xl font-bold text-white">Matches</h1>

      {/* Schedule Match */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Schedule Match</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Home Team</label>
            <select
              value={selectedHomeTeam}
              onChange={(e) => setSelectedHomeTeam(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Away Team</label>
            <select
              value={selectedAwayTeam}
              onChange={(e) => setSelectedAwayTeam(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={scheduleMatch}
            disabled={scheduling || !selectedHomeTeam || !selectedAwayTeam}
            className="px-6 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {scheduling ? 'Scheduling...' : 'Schedule Match'}
          </button>
        </div>
      </div>

      {/* Match History */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Matches</h2>
        {matches.length === 0 ? (
          <div className="text-center py-12">
            <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No matches yet</p>
            <p className="text-sm text-muted-foreground mt-2">
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
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{match.homeTeam.name}</span>
                    <span className="text-2xl font-bold text-accent">
                      {match.homeScore} - {match.awayScore}
                    </span>
                    <span className="font-medium text-white">{match.awayTeam.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {match.status === 'SCHEDULED'
                      ? `Scheduled for ${new Date(match.scheduledAt).toLocaleDateString()}`
                      : `Completed ${match.completedAt ? new Date(match.completedAt).toLocaleDateString() : ''}`
                    }
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
