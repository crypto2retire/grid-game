import { useState, useEffect } from 'react';
import { Trophy, Medal, ArrowUp, ArrowDown, Minus, Crown } from 'lucide-react';
import { getSportLabel, useGameStore } from '../store/gameStore';

interface LeaderboardTeam {
  id: string;
  name: string;
  owner: { username: string; displayName: string | null };
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
  prestige?: number;
  venue?: { tier?: string };
  _count: { teamPlayers: number };
}

interface LeaderboardPlayer {
  id: string;
  name: string;
  position: string;
  overall: number;
  rarity: string;
  form?: number;
  fatigue?: number;
  morale?: number;
  seasonStats?: {
    gamesPlayed: number;
    touchdowns: number;
    passingTouchdowns: number;
    fieldGoals: number;
    yards: number;
    tackles: number;
    turnoversForced: number;
    ratingAverage: number;
    mvpScore: number;
  };
}

export default function LeaderboardPage({ prestige }: { prestige?: boolean } = {}) {
  const { activeSportId } = useGameStore();
  const [activeTab, setActiveTab] = useState<'teams' | 'players' | 'prestige'>(prestige ? 'prestige' : 'teams');
  const [teams, setTeams] = useState<LeaderboardTeam[]>([]);
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [playerSort, setPlayerSort] = useState('mvpScore');

  const [prestigeTeams, setPrestigeTeams] = useState<LeaderboardTeam[]>([]);

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'teams') fetchTeams();
    else if (activeTab === 'prestige') fetchPrestige();
    else fetchPlayers();
  }, [activeTab, page, activeSportId, playerSort]);

  const fetchTeams = async () => {
    try {
      const res = await fetch(`/api/leaderboard/teams?page=${page}&limit=20&sportId=${activeSportId}`);
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

  const fetchPrestige = async () => {
    try {
      const res = await fetch(`/api/leaderboard/prestige?page=${page}&limit=20&sportId=${activeSportId}`);
      if (res.ok) {
        const data = await res.json();
        setPrestigeTeams(data.data?.teams || []);
        setTotalPages(data.data?.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch prestige leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`/api/leaderboard/players?page=${page}&limit=20&sportId=${activeSportId}&sortBy=${playerSort}`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top performing {getSportLabel(activeSportId)} teams and players
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border pb-1">
        {[
          { id: 'teams' as const, label: 'Teams', icon: Trophy },
          { id: 'prestige' as const, label: 'Prestige', icon: Crown },
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

      {activeTab === 'teams' && (
        <div className="glass-card p-6">
          {teams.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No teams ranked yet</p>
              <p className="text-muted-foreground text-sm">Play games to earn standings points</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team, index) => (
                <div key={team.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg transition-colors ${index < 3 ? 'bg-secondary/50' : 'bg-secondary/30'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 flex justify-center shrink-0">{getRankIcon((page - 1) * 20 + index + 1)}</div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-sm">{team.name}</div>
                      <div className="text-xs text-muted-foreground">{team.owner.displayName || team.owner.username} • {team._count.teamPlayers} players</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm ml-11 sm:ml-0">
                    <div className="text-center">
                      <div className="font-bold text-white">{team.wins}-{team.losses}-{team.draws}</div>
                      <div className="text-xs text-muted-foreground">W-L-T</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-white">{team.pointsFor}:{team.pointsAgainst}</div>
                      <div className="text-xs text-muted-foreground">PF:PA</div>
                    </div>
                    <div className="text-center w-12">
                      <div className="font-bold text-accent text-lg">{team.points}</div>
                      <div className="text-xs text-muted-foreground">PTS</div>
                    </div>
                    <div>{getFormIndicator(team)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'prestige' && (
        <div className="glass-card p-6">
          {prestigeTeams.length === 0 ? (
            <div className="text-center py-8">
              <Crown className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No prestige rankings yet</p>
              <p className="text-muted-foreground text-sm">Build your venue, roster, and transport to climb prestige</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prestigeTeams.map((team, index) => (
                <div key={team.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg transition-colors ${index < 3 ? 'bg-secondary/50' : 'bg-secondary/30'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 flex justify-center shrink-0">{getRankIcon((page - 1) * 20 + index + 1)}</div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-sm">{team.name}</div>
                      <div className="text-xs text-muted-foreground">{team.owner.displayName || team.owner.username} • {team._count.teamPlayers} players • {team.venue?.tier || '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm ml-11 sm:ml-0">
                    <div className="text-center w-12">
                      <div className="font-bold text-accent text-lg">{team.prestige ?? 0}</div>
                      <div className="text-xs text-muted-foreground">PRESTIGE</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-white">{team.wins}-{team.losses}-{team.draws}</div>
                      <div className="text-xs text-muted-foreground">W-L-T</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-white">{team.pointsFor}:{team.pointsAgainst}</div>
                      <div className="text-xs text-muted-foreground">PF:PA</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'players' && (
        <div className="glass-card p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Rank by:</span>
            {[
              ['mvpScore', 'MVP'], ['touchdowns', 'TD'], ['yards', 'Yards'], ['tackles', 'Tackles'], ['turnoversForced', 'Turnovers'], ['ratingAverage', 'Rating'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => { setPlayerSort(id); setPage(1); }}
                className={`rounded-lg px-3 py-1 text-sm font-bold ${playerSort === id ? 'bg-accent text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {players.length === 0 ? (
            <div className="text-center py-8">
              <Medal className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No players ranked yet</p>
              <p className="text-muted-foreground text-sm">Complete games to create season stats</p>
            </div>
          ) : (
            <div className="space-y-3">
              {players.map((player, index) => {
                const s = player.seasonStats;
                return (
                  <div key={player.id} className="rounded-lg bg-secondary/30 p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center shrink-0">{getRankIcon((page - 1) * 20 + index + 1)}</div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm">{player.name}</div>
                        <div className="text-xs text-muted-foreground">{player.position} • OVR {player.overall} • Form {player.form ?? '—'} • Morale {player.morale ?? '—'} • Fatigue {player.fatigue ?? '—'}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 gap-2 text-sm ml-11">
                      <Stat label="MVP" value={Math.round(s?.mvpScore || 0)} />
                      <Stat label="GP" value={s?.gamesPlayed || 0} />
                      <Stat label="TD" value={(s?.touchdowns || 0) + (s?.passingTouchdowns || 0)} />
                      <Stat label="YDS" value={s?.yards || 0} />
                      <Stat label="TCK" value={s?.tackles || 0} />
                      <Stat label="RAT" value={s?.ratingAverage?.toFixed(1) || '—'} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 bg-secondary border border-border rounded-lg text-white disabled:opacity-50">Previous</button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-4 py-2 bg-secondary border border-border rounded-lg text-white disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-bold text-accent">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
