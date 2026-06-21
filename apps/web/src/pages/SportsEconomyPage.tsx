import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeDollarSign, BrainCircuit, Clock, Crown, Dumbbell, Gem, LineChart, Shield, Sparkles, Trophy, Users, Zap } from 'lucide-react';

type SportConfig = {
  id: string;
  label: string;
  launchPhase: number;
  primaryToken: 'GRID';
  marketPosition: string;
  roster: { starters: number; bench: number; maxRoster: number };
  positions: string[];
  stats: string[];
  season: { lengthDays: number; fixturesPerWeek: number; playoffEnabled: boolean };
  regularUserLoops: string[];
  whaleLoops: string[];
  sharedLoops: string[];
  economySinks: string[];
  limitedWidgetExamples: string[];
};

type SportsPayload = {
  sports: SportConfig[];
  roadmap: {
    positioning: string;
    tokenThesis: string;
    buildPrinciples: string[];
    commercialReadinessGates: string[];
  };
  summaries: { id: string; summary: string }[];
};

const fallbackPayload: SportsPayload = {
  sports: [
    {
      id: 'american-football',
      label: 'Gridiron Franchises',
      launchPhase: 1,
      primaryToken: 'GRID',
      marketPosition: 'Launch sport for testers familiar with American football: franchises, combines, weekly matchups, and player development.',
      roster: { starters: 22, bench: 21, maxRoster: 43 },
      positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'],
      stats: ['speed', 'arm', 'routeIQ', 'agility', 'tackling', 'strength', 'footballIQ'],
      season: { lengthDays: 45, fixturesPerWeek: 1, playoffEnabled: true },
      regularUserLoops: ['run combine drills', 'train role players', 'optimize playbooks', 'complete franchise contracts'],
      whaleLoops: ['own franchises', 'sponsor bowls', 'rent training complexes', 'fund draft boards'],
      sharedLoops: ['contract coaching', 'facility boosts', 'playbook marketplaces', 'sponsor-funded bowls'],
      economySinks: ['combine entries', 'playbook installs', 'franchise dues', 'training camps', 'stadium widgets'],
      limitedWidgetExamples: ['Founder Helmet', 'Analytics Booth', 'Prime Turf', 'Legacy Playbook'],
    },
  ],
  roadmap: {
    positioning: 'Solana-powered multi-sport management economy with one shared GRID token.',
    tokenThesis: 'Every sport adds utility sinks, asset demand, and marketplace volume for the same primary GRID token instead of fragmenting liquidity.',
    buildPrinciples: ['sport-agnostic core engine', 'ledger-first economy accounting', 'regular users earn through effort and skill', 'whales fund infrastructure and contracts'],
    commercialReadinessGates: ['append-only currency ledger before real-money rewards', 'admin economy dashboard sourced from live ledger rows', 'anti-bot and abuse monitoring before cash-out'],
  },
  summaries: [],
};

const sportGradients: Record<string, string> = {
  soccer: 'from-emerald-400 via-cyan-400 to-blue-500',
  'american-football': 'from-orange-400 via-red-400 to-rose-500',
  basketball: 'from-amber-300 via-orange-400 to-purple-500',
  baseball: 'from-sky-300 via-indigo-400 to-violet-500',
};

const formatSportId = (id: string) => id.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export default function SportsEconomyPage() {
  const [payload, setPayload] = useState<SportsPayload>(fallbackPayload);
  const [activeSportId, setActiveSportId] = useState('american-football');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch('/api/sports')
      .then((res) => {
        if (!res.ok) throw new Error(`Sports economy API returned ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!mounted) return;
        const data = json.data as SportsPayload;
        setPayload(data);
        setActiveSportId(data.sports[0]?.id || 'american-football');
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Sports economy API unavailable');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const activeSport = useMemo(
    () => payload.sports.find((sport) => sport.id === activeSportId) || payload.sports[0],
    [activeSportId, payload.sports]
  );

  const economyCards = [
    { label: 'Regular path', value: 'Effort → assets → earnings', icon: Users, copy: 'Scouting, training, amateur cups, service contracts, and prospect sales. All earnings come from game-day revenue, sponsors, and league standings.' },
    { label: 'Whale path', value: 'Capital → infrastructure', icon: Crown, copy: 'Facilities, franchises, sponsor cups, scholarships, and premium widgets. Infrastructure creates revenue streams that all players use.' },
    { label: 'Shared token', value: '$GRID across sports', icon: BadgeDollarSign, copy: payload.roadmap.tokenThesis },
    { label: 'AI layer', value: 'AI scouts + leagues', icon: BrainCircuit, copy: 'AI keeps fixtures, scouting boards, and market activity moving when users are offline.' },
  ];

  return (
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.22),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 sm:p-8 lg:p-10 shadow-2xl">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              <Sparkles className="h-4 w-4" /> Commercial economy roadmap
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Build a sports empire where effort, capital, and ownership all compound.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              {payload.roadmap.positioning} Sports are the front-facing fantasy; AI and Solana power the self-growing economy underneath.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#sports-roadmap" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 py-3 font-bold text-white shadow-lg shadow-accent/25 transition hover:bg-accent/90">
                View sport roadmap
              </a>
              <a href="#economy-loop" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-5 py-3 font-bold text-white transition hover:bg-white/15">
                See economy loop
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Launch wedge</span>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">Phase 1</span>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
              <Trophy className="mb-4 h-10 w-10 text-emerald-300" />
              <h2 className="text-2xl font-black text-white">Gridiron Franchises</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">The first theme uses American football: franchises, combines, playbooks, weekly matchups, and player development. Revenue comes from ticket sales, sponsors, and league standings—not entry fees or prize pools.</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">
          Live API fallback active: {error}
        </div>
      )}

      <section id="economy-loop" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {economyCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="glass-card p-5"
          >
            <card.icon className="mb-4 h-7 w-7 text-accent" />
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <h3 className="mt-1 text-xl font-black text-white">{card.value}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{card.copy}</p>
          </motion.div>
        ))}
      </section>

      <section id="sports-roadmap" className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="glass-card p-4">
          <div className="mb-4 px-2">
            <h2 className="text-xl font-black text-white">Multi-sport roadmap</h2>
            <p className="mt-1 text-sm text-muted-foreground">One core engine. One token. Multiple sports audiences.</p>
          </div>
          <div className="space-y-2">
            {payload.sports.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setActiveSportId(sport.id)}
                className={`flex min-h-11 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${activeSportId === sport.id ? 'border-accent/60 bg-accent/15 text-white' : 'border-white/5 bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                <span>
                  <span className="block font-bold">{sport.label}</span>
                  <span className="text-xs text-muted-foreground">{formatSportId(sport.id)} • Phase {sport.launchPhase}</span>
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold">GRID</span>
              </button>
            ))}
          </div>
        </div>

        {activeSport && (
          <motion.div key={activeSport.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="glass-card overflow-hidden">
            <div className={`bg-gradient-to-r ${sportGradients[activeSport.id] || 'from-accent to-cyan-400'} p-[1px]`}>
              <div className="bg-card/95 p-6 sm:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.25em] text-muted-foreground">Phase {activeSport.launchPhase}</p>
                    <h2 className="mt-2 text-3xl font-black text-white">{activeSport.label}</h2>
                    <p className="mt-3 max-w-3xl leading-7 text-slate-300">{activeSport.marketPosition}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Shared token</p>
                    <p className="text-3xl font-black text-white">${activeSport.primaryToken}</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Metric icon={Shield} label="Starters" value={String(activeSport.roster.starters)} />
                  <Metric icon={Users} label="Max roster" value={String(activeSport.roster.maxRoster)} />
                  <Metric icon={Clock} label="Season" value={`${activeSport.season.lengthDays}d`} />
                </div>

                <div className="mt-8 grid gap-5 lg:grid-cols-3">
                  <LoopColumn title="Regular users earn" icon={Dumbbell} items={activeSport.regularUserLoops} />
                  <LoopColumn title="Whales deploy capital" icon={Crown} items={activeSport.whaleLoops} />
                  <LoopColumn title="Shared value loops" icon={Zap} items={activeSport.sharedLoops} />
                </div>

                <div className="mt-8 grid gap-5 lg:grid-cols-2">
                  <TagPanel title="Economy sinks" icon={LineChart} tags={activeSport.economySinks} />
                  <TagPanel title="Limited widgets" icon={Gem} tags={activeSport.limitedWidgetExamples} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card p-6">
          <h2 className="text-xl font-black text-white">Commercial launch gates</h2>
          <div className="mt-4 space-y-3">
            {payload.roadmap.commercialReadinessGates.map((gate) => (
              <div key={gate} className="flex gap-3 rounded-xl bg-white/5 p-3 text-sm text-slate-300">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                {gate}
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card p-6">
          <h2 className="text-xl font-black text-white">Next build slice</h2>
          <p className="mt-3 leading-7 text-slate-300">
            The next production slice is ledger-first accounting, then training/scouting timers, then AI season workers. Real-money rewards should stay disabled until ledger, admin metrics, abuse controls, and risk language are verified from source-complete records.
          </p>
          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-100">
            {loading ? 'Loading live economy configuration…' : 'Live economy configuration loaded.'}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <Icon className="mb-3 h-5 w-5 text-accent" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function LoopColumn({ title, icon: Icon, items }: { title: string; icon: typeof Shield; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center gap-2 font-bold text-white">
        <Icon className="h-5 w-5 text-accent" />
        {title}
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TagPanel({ title, icon: Icon, tags }: { title: string; icon: typeof Shield; tags: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center gap-2 font-bold text-white">
        <Icon className="h-5 w-5 text-accent" />
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-slate-200">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
