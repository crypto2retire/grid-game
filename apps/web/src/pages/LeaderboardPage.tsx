import { useState, useEffect } from 'react';
import { Trophy, Medal, TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface LeaderboardTeam {
  id: string;
  name: string;
  owner: { username: string; displayName: string | null };
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  _count: { teamPlayers: number };
}

interface LeaderboardPlayer {
  id: string;
  name: string;
  position: string;
  overall: number;
  rarity: string;
  matchStats: any[];
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [teams, setTeams] = useState<LeaderboardTeam[]>([]);
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (activeTab === 'teams') fetchTeams();
    else fetchPlayers();
  }, [activeTab, page]);

  const fetchTeams = async () => {
    try {
      const res = await fetch(`/api/leaderboard/teams?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data.data?.teams || []);
        setTotalPages(data.data?.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`/api/leaderboard/players?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.data?.players || []);
        setTotalPages(data.data?.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch player leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Medal className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-700" />;
    return <span className="text-sm text-muted-foreground w-5 text-center">{rank}</span>;
  };

  const getFormIndicator = (team: LeaderboardTeam) => {
    const total = team.wins + team.draws + team.losses;
    if (total === 0) return <Minus className="w-4 h-4 text-muted-foreground" />;
    const winRate = team.wins / total;
    if (winRate >= 0.6) return <ArrowUp className="w-4 h-4 text-green-400" />;
    if (winRate >= 0.4) return <ArrowUp className="w-4 h-4 text-yellow-400" />;
    return <ArrowDown className="w-4 h-4 text-red-400" />;
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
        <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'teams'
                ? 'bg-accent text-white'
                : 'bg-secondary text-muted-foreground hover:text-white'
            }`}
          >
            Teams
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'players'
                ? 'bg-accent text-white'
                : 'bg-secondary text-muted-foreground hover:text-white'
            }`}
          >
            Players
          </button>
        </div>
      </div>

      {activeTab === 'teams' ? (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/50 text-left">
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Rank</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Team</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Manager</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-center">W</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-center">D</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-center">L</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-center">GF</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-center">GA</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-center">GD</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-center">Pts</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground text-center">Form</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => (
                  <tr
                    key={team.id}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center w-8">
                        {getRankIcon(index + 1 + (page - 1) * 20)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{team.name}</div>
                      <div className="text-xs text-muted-foreground">{team._count.teamPlayers} players</div>
                    </td>
                    <td className="px-4 py-3 text-white">
                      {team.owner.displayName || team.owner.username}
                    </td>
                    <td className="px-4 py-3 text-center text-green-400">{team.wins}</td>
                    <td className="px-4 py-3 text-center text-yellow-400">{team.draws}</td>
                    <td className="px-4 py-3 text-center text-red-400">{team.losses}</td>
                    <td className="px-4 py-3 text-center text-white">{team.goalsFor}</td>
                    <td className="px-4 py-3 text-center text-white">{team.goalsAgainst}</td>
                    <td className="px-4 py-3 text-center text-white">
                      {team.goalsFor - team.goalsAgainst > 0 ? '+' : ''}
                      {team.goalsFor - team.goalsAgainst}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-accent">{team.points}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getFormIndicator(team)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {teams.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No teams on the leaderboard yet</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {players.map((player, index) => (
            <div key={player.id} className="glass-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="text-sm font-bold text-muted-foreground">#{index + 1}</div>
                <div className="text-2xl font-bold text-white">{player.overall}</div>
              </div>
              <h3 className="font-semibold text-white mb-1">{player.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {player.position} • {player.rarity}
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 bg-secondary rounded">
                  <div className="font-bold text-white">{player.matchStats[0]?.goals || 0}</div>
                  <div className="text-muted-foreground">Goals</div>
                </div>
                <div className="text-center p-2 bg-secondary rounded">
                  <div className="font-bold text-white">{player.matchStats[0]?.assists || 0}</div>
                  <div className="text-muted-foreground">Assists</div>
                </div>
                <div className="text-center p-2 bg-secondary rounded">
                  <div className="font-bold text-white">{player.matchStats[0]?.rating || '6.0'}</div>
                  <div className="text-muted-foreground">Rating</div>
                </div>
              </div>
            </div>
          ))}
          {players.length === 0 && (
            <div className="col-span-full text-center py-12">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No player stats yet</p>
            </div>
          )}
        </div>
      )}

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
