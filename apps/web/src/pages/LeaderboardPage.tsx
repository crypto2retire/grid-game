import { useState, useEffect } from 'react';
import { Trophy, Medal, ArrowUp, ArrowDown, Minus, Crown } from 'lucide-react';

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
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top performing teams and players
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        {[
          { id: 'teams' as const, label: 'Teams', icon: Trophy },
          { id: 'players' as const, label: 'Players', icon: Medal },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === t.id
                ? 'text-accent border-b-2 border-accent'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="glass-card p-6">
          {teams.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No teams ranked yet</p>
              <p className="text-muted-foreground text-sm">Play matches to earn points</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team, index) => (
                <div
                  key={team.id}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                    index < 3 ? 'bg-secondary/50' : 'bg-secondary/30'
                  }`}
                >
                  <div className="w-8 flex justify-center">
                    {getRankIcon((page - 1) * 20 + index + 1)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{team.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {team.owner.displayName || team.owner.username} • {team._count.teamPlayers} players
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-white">{team.wins}-{team.draws}-{team.losses}</div>
                      <div className="text-xs text-muted-foreground">W-D-L</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-white">{team.goalsFor}:{team.goalsAgainst}</div>
                      <div className="text-xs text-muted-foreground">Goals</div>
                    </div>
                    <div className="text-center w-16">
                      <div className="font-bold text-accent text-lg">{team.points}</div>
                      <div className="text-xs text-muted-foreground">PTS</div>
                    </div>
                    <div>{getFormIndicator(team)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
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
      )}

      {/* Players Tab */}
      {activeTab === 'players' && (
        <div className="glass-card p-6">
          {players.length === 0 ? (
            <div className="text-center py-8">
              <Medal className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No players ranked yet</p>
              <p className="text-muted-foreground text-sm">Play matches to earn stats</p>
            </div>
          ) : (
            <div className="space-y-3">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg"
                >
                  <div className="w-8 flex justify-center">
                    {getRankIcon((page - 1) * 20 + index + 1)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{player.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {player.position} • OVR {player.overall}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-accent">{player.matchStats.length}</div>
                    <div className="text-xs text-muted-foreground">Matches</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
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
      )}
    </div>
  );
}
