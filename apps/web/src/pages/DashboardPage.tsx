import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { Swords, Shield, Trophy, TrendingUp, Clock, ArrowRight } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  teamPlayers: { player: { id: string; name: string; position: string; overall: number } }[];
}

interface RecentMatch {
  id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  homeScore: number;
  awayScore: number;
  completedAt: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
    fetchRecentMatches();
  }, []);

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

  const fetchRecentMatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/matches?status=COMPLETED&limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentMatches(data.data?.matches || []);
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    }
  };

  const stats = {
    teams: teams.length,
    totalPlayers: teams.reduce((sum, t) => sum + (t.teamPlayers?.length || 0), 0),
    totalPoints: teams.reduce((sum, t) => sum + t.points, 0),
    winRate: teams.length > 0
      ? Math.round((teams.reduce((sum, t) => sum + t.wins, 0) / Math.max(1, teams.reduce((sum, t) => sum + t.wins + t.draws + t.losses, 0))) * 100)
      : 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.displayName || user?.username}</p>
        </div>
        <Link
          to="/team"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors"
        >
          <Shield className="w-4 h-4" />
          Manage Teams
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Teams', value: stats.teams, icon: Shield, color: 'text-blue-400' },
          { label: 'Players', value: stats.totalPlayers, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Total Points', value: stats.totalPoints, icon: Trophy, color: 'text-yellow-400' },
          { label: 'Win Rate', value: `${stats.winRate}%`, icon: Swords, color: 'text-accent' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teams */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">My Teams</h2>
            <Link to="/team" className="text-sm text-accent hover:underline">View all</Link>
          </div>
          {teams.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No teams yet</p>
              <Link to="/team" className="text-accent text-sm hover:underline mt-2 inline-block">
                Create your first team
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  to={`/team/${team.id}`}
                  className="flex items-center justify-between p-4 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-white">{team.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {team.teamPlayers?.length || 0} players • {team.points} pts
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-green-400">{team.wins}W</div>
                    <div className="text-sm text-yellow-400">{team.draws}D</div>
                    <div className="text-sm text-red-400">{team.losses}L</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Matches */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Recent Matches</h2>
            <Link to="/matches" className="text-sm text-accent hover:underline">View all</Link>
          </div>
          {recentMatches.length === 0 ? (
            <div className="text-center py-8">
              <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No matches played yet</p>
              <Link to="/matches" className="text-accent text-sm hover:underline mt-2 inline-block">
                Schedule a match
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className="flex items-center justify-between p-4 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{match.homeTeam.name}</span>
                      <span className="text-accent font-bold">{match.homeScore}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-accent font-bold">{match.awayScore}</span>
                      <span className="font-medium text-white">{match.awayTeam.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(match.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
