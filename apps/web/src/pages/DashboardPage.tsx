import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { getSportLabel, useGameStore } from '../store/gameStore';
import {
  ArrowRight,
  BadgeDollarSign,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Gauge,
  Gem,
  HandCoins,
  LayoutGrid,
  LineChart,
  ListChecks,
  Loader2,
  Rocket,
  Shield,
  ShoppingCart,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';

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

type DashboardOption = {
  title: string;
  eyebrow: string;
  description: string;
  why: string;
  start: string;
  path: string;
  cta: string;
  icon: typeof Shield;
  accent: string;
  ring: string;
  badge: string;
};

const dashboardOptions: DashboardOption[] = [
  {
    title: 'My Team',
    eyebrow: 'Build the roster',
    description: 'Create your franchise, view players on your roster, and decide who should develop next.',
    why: 'This is the core management loop: stronger teams unlock better game results and future marketplace value.',
    start: 'Start here if you are new.',
    path: '/team',
    cta: 'Manage team',
    icon: Shield,
    accent: 'from-blue-500/25 via-cyan-400/10 to-transparent',
    ring: 'border-blue-300/30 hover:border-blue-300/65',
    badge: 'Starter',
  },
  {
    title: 'Players',
    eyebrow: 'Scout talent',
    description: 'Review the player pool, compare positions, and identify prospects worth adding to your system.',
    why: 'Player quality drives match performance; prospects can become future starters or tradeable assets.',
    start: 'Use after you know what position your team needs.',
    path: '/players',
    cta: 'Browse players',
    icon: Users,
    accent: 'from-emerald-500/25 via-lime-400/10 to-transparent',
    ring: 'border-emerald-300/30 hover:border-emerald-300/65',
    badge: 'Scouting',
  },
  {
    title: 'Games',
    eyebrow: 'Compete',
    description: 'Schedule games, review recent results, and learn which roster choices are working.',
    why: 'Games turn roster decisions into standings progress, reputation, and future reward eligibility.',
    start: 'Use once you have a team ready.',
    path: '/matches',
    cta: 'Play games',
    icon: Swords,
    accent: 'from-rose-500/25 via-orange-400/10 to-transparent',
    ring: 'border-rose-300/30 hover:border-rose-300/65',
    badge: 'Action',
  },
  {
    title: 'Marketplace',
    eyebrow: 'Trade assets',
    description: 'Find roster upgrades, list spare assets, and watch where demand is forming.',
    why: 'The market connects regular player effort with ownership, liquidity, and scarce game assets.',
    start: 'Use after you understand your roster needs.',
    path: '/marketplace',
    cta: 'Open market',
    icon: ShoppingCart,
    accent: 'from-amber-400/25 via-yellow-300/10 to-transparent',
    ring: 'border-amber-300/30 hover:border-amber-300/65',
    badge: 'Economy',
  },
  {
    title: 'Sports Economy',
    eyebrow: 'Growth roadmap',
    description: 'Each sport launches as its own game, while one shared GRID coin powers utility across football, soccer, basketball, baseball, and future branches.',
    why: 'This explains separate game launches, shared coin utility, regular-user paths, whale/capital paths, token sinks, and expansion plans.',
    start: 'Use when you want the big-picture strategy.',
    path: '/sports-economy',
    cta: 'View economy',
    icon: Rocket,
    accent: 'from-cyan-400/25 via-fuchsia-400/10 to-transparent',
    ring: 'border-cyan-300/30 hover:border-cyan-300/65',
    badge: 'Roadmap',
  },
  {
    title: 'Wallet',
    eyebrow: 'Track balances',
    description: 'Review in-game currency, future GRID token actions, and transaction readiness.',
    why: 'Wallet visibility makes costs, claims, deposits, and future Solana settlement easier to trust.',
    start: 'Use before any marketplace or token action.',
    path: '/wallet',
    cta: 'Check wallet',
    icon: Wallet,
    accent: 'from-violet-500/25 via-purple-400/10 to-transparent',
    ring: 'border-violet-300/30 hover:border-violet-300/65',
    badge: 'Account',
  },
];

const economyExplainers = [
  {
    title: 'Regular player path',
    icon: ListChecks,
    copy: 'Scout and train players, compete in games, then use or trade improved assets. No guaranteed profit promises — results depend on play, supply, and market demand.',
  },
  {
    title: 'Whale / capital path',
    icon: Crown,
    copy: 'Fund facilities, sponsor cups, rentals, contracts, and prize pools once the ledger and escrow systems are live.',
  },
  {
    title: 'Where value comes from',
    icon: HandCoins,
    copy: 'Entry fees, marketplace activity, sponsorship escrow, limited widgets, and upgrade sinks create transparent in-game economic loops.',
  },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { activeSportId } = useGameStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const [teamsResult, matchesResult] = await Promise.allSettled([
          fetch('/api/teams/mine', { headers }),
          fetch('/api/matches?status=COMPLETED&limit=5', { headers }),
        ]);

        if (teamsResult.status === 'fulfilled' && teamsResult.value.ok) {
          const data = await teamsResult.value.json();
          setTeams((data.data || []).filter((team: any) => (team.sportId || 'american-football') === activeSportId));
        } else if (teamsResult.status === 'fulfilled') {
          throw new Error(`Teams API returned ${teamsResult.value.status}`);
        } else {
          throw teamsResult.reason;
        }

        if (matchesResult.status === 'fulfilled' && matchesResult.value.ok) {
          const data = await matchesResult.value.json();
          setRecentMatches((data.data?.matches || []).filter((match: any) => (match.sportId || 'american-football') === activeSportId));
        } else if (matchesResult.status === 'fulfilled') {
          // Games are helpful context, but they should not block the whole dashboard.
          console.warn(`Games API returned ${matchesResult.value.status}`);
        } else {
          console.warn('Failed to fetch games:', matchesResult.reason);
        }

        setLastUpdated(new Date());
      } catch (err) {
        console.error('Failed to load dashboard:', err);
        setError(err instanceof Error ? err.message : 'Dashboard data is temporarily unavailable.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [activeSportId]);

  const stats = useMemo(() => {
    const matchesPlayed = teams.reduce((sum, t) => sum + t.wins + t.draws + t.losses, 0);
    const wins = teams.reduce((sum, t) => sum + t.wins, 0);

    return {
      teams: teams.length,
      totalPlayers: teams.reduce((sum, t) => sum + (t.teamPlayers?.length || 0), 0),
      totalPoints: teams.reduce((sum, t) => sum + t.points, 0),
      matchesPlayed,
      winRate: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
    };
  }, [teams]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-6 flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Loading your GRID command center...
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-2xl bg-white/10" />
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-56 animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.28),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.20),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 shadow-2xl sm:p-8">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="relative grid gap-8 xl:grid-cols-[1.05fr_.95fr] xl:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              <Sparkles className="h-4 w-4" /> Command center
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Welcome back, {user?.displayName || user?.username || 'Coach'}.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              This {getSportLabel(activeSportId)} dashboard separates the game into clear choices: build your roster, compete in games, trade assets, study the economy, and track your wallet. Each card explains what the option does and why it matters.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" /> {stats.teams > 0 ? 'Team active' : 'Team setup needed'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2">
                <Gauge className="h-4 w-4 text-cyan-300" /> {stats.matchesPlayed} games tracked
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2">
                <Clock className="h-4 w-4 text-amber-300" /> {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Live data'}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-400">Recommended next step</p>
            <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-5">
              {stats.teams === 0 ? (
                <>
                  <Shield className="mb-4 h-10 w-10 text-accent" />
                  <h2 className="text-2xl font-black text-white">Create your first team</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Teams are the starting point for everything else: players, games, points, and marketplace strategy.
                  </p>
                  <Link to="/team" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-white transition hover:bg-accent/90">
                    Start team setup <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              ) : (
                <>
                  <Swords className="mb-4 h-10 w-10 text-accent" />
                  <h2 className="text-2xl font-black text-white">Play or review games</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    You have a team foundation. Use games to test lineup quality, build points, and find gaps to fix through scouting or the market.
                  </p>
                  <Link to="/matches" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-white transition hover:bg-accent/90">
                    Go to games <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100" role="status">
          Some live dashboard data could not be loaded: {error}. Navigation cards are still available.
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Dashboard summary">
        {[
          { label: 'Teams', value: stats.teams, detail: 'Teams you control', icon: Shield, color: 'text-blue-300' },
          { label: 'Players', value: stats.totalPlayers, detail: 'Rostered athletes', icon: Users, color: 'text-emerald-300' },
          { label: 'Points', value: stats.totalPoints, detail: 'Earned from results', icon: Trophy, color: 'text-yellow-300' },
          { label: 'Games', value: stats.matchesPlayed, detail: 'Record history', icon: CalendarDays, color: 'text-rose-300' },
          { label: 'Win Rate', value: `${stats.winRate}%`, detail: 'Wins / completed games', icon: LineChart, color: 'text-cyan-300' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-white/10 bg-card/80 p-5 backdrop-blur-md"
          >
            <div className="mb-4 flex items-center justify-between">
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-slate-300">Live</span>
            </div>
            <div className="text-3xl font-black text-white">{stat.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-200">{stat.label}</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{stat.detail}</p>
          </motion.div>
        ))}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <LayoutGrid className="h-3.5 w-3.5" /> Main options
            </div>
            <h2 className="mt-3 text-2xl font-black text-white">Choose what you want to do</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              The cards are color-coded by purpose so the dashboard is easier to scan: blue for team setup, green for scouting, red for competition, gold for marketplace, cyan for roadmap, purple for wallet/account.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {dashboardOptions.map((option, index) => (
            <motion.div
              key={option.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Link
                to={option.path}
                className={`group block h-full overflow-hidden rounded-3xl border bg-card/75 transition hover:-translate-y-0.5 hover:bg-card/95 hover:shadow-2xl ${option.ring}`}
              >
                <div className={`bg-gradient-to-br ${option.accent} p-5 sm:p-6`}>
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-white">
                      <option.icon className="h-7 w-7" />
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-200">
                      {option.badge}
                    </span>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{option.eyebrow}</p>
                  <h3 className="mt-2 text-2xl font-black text-white">{option.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{option.description}</p>

                  <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Why it matters</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{option.why}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Best use</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{option.start}</p>
                    </div>
                  </div>

                  <div className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-bold text-white transition group-hover:bg-white/15">
                    {option.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_.9fr]">
        <div className="rounded-3xl border border-white/10 bg-card/80 p-6 backdrop-blur-md">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">My Teams</h2>
              <p className="mt-1 text-sm text-muted-foreground">Roster overview and record snapshot.</p>
            </div>
            <Link to="/team" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {teams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
              <Shield className="mx-auto mb-4 h-12 w-12 text-blue-300" />
              <h3 className="text-xl font-black text-white">No team yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
                Create a team first. After that, this panel will show player count, points, wins, losses, and ties at a glance.
              </p>
              <Link to="/team" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-white hover:bg-accent/90">
                Create your first team <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  to={`/team/${team.id}`}
                  className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-blue-300/40 hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-bold text-white group-hover:text-blue-100">{team.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {(team.teamPlayers?.length || 0)} players • {team.points} pts
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm sm:min-w-48">
                    <span className="rounded-xl bg-emerald-400/10 px-3 py-2 font-bold text-emerald-200">{team.wins}W</span>
                    <span className="rounded-xl bg-yellow-400/10 px-3 py-2 font-bold text-yellow-200">{team.draws}T</span>
                    <span className="rounded-xl bg-rose-400/10 px-3 py-2 font-bold text-rose-200">{team.losses}L</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/80 p-6 backdrop-blur-md">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Recent Games</h2>
              <p className="mt-1 text-sm text-muted-foreground">Fast feedback from completed games.</p>
            </div>
            <Link to="/matches" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {recentMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
              <Swords className="mx-auto mb-4 h-12 w-12 text-rose-300" />
              <h3 className="text-xl font-black text-white">No completed games yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
                Schedule or complete a game to see scores here. Match history helps you decide whether to scout, trade, or adjust your roster.
              </p>
              <Link to="/matches" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-white hover:bg-accent/90">
                Schedule a game <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className="group block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-rose-300/40 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
                        <span className="font-bold text-white">{match.homeTeam.name}</span>
                        <span className="rounded-lg bg-accent/15 px-2 py-1 font-black text-accent">{match.homeScore}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="rounded-lg bg-accent/15 px-2 py-1 font-black text-accent">{match.awayScore}</span>
                        <span className="font-bold text-white">{match.awayTeam.name}</span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {new Date(match.completedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-white" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.90),rgba(2,6,23,0.96))] p-6">
        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">
              <BrainCircuit className="h-3.5 w-3.5" /> Economy explained
            </div>
            <h2 className="mt-3 text-2xl font-black text-white">How the GRID economy should make sense</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              AI and crypto are the engine under the hood, not the confusing theme. Players should always understand what an action costs, what it can improve, and where rewards or marketplace demand come from.
            </p>
            <Link to="/sports-economy" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-200">
              Read full economy roadmap <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {economyExplainers.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <item.icon className="mb-4 h-7 w-7 text-cyan-200" />
                <h3 className="font-black text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link to="/leaderboard" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-yellow-300/40 hover:bg-white/10">
          <Trophy className="mb-3 h-7 w-7 text-yellow-300" />
          <h3 className="font-black text-white">Leaderboard</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Compare team performance and see what top franchises are doing differently.</p>
        </Link>
        <Link to="/marketplace" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-amber-300/40 hover:bg-white/10">
          <Gem className="mb-3 h-7 w-7 text-amber-300" />
          <h3 className="font-black text-white">Limited assets</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Future widgets and scarce items should clearly show utility, supply, fees, and tradeability.</p>
        </Link>
        <Link to="/wallet" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-violet-300/40 hover:bg-white/10">
          <BadgeDollarSign className="mb-3 h-7 w-7 text-violet-300" />
          <h3 className="font-black text-white">Costs and balances</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Before real token actions, the wallet and ledger need to make every cost and claim transparent.</p>
        </Link>
      </section>
    </div>
  );
}
