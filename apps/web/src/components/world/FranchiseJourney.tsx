import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Flame, Goal, Sparkles, Trophy } from 'lucide-react';
import { usePanels } from './PanelSystem';

type JourneyGoal = {
  id: string;
  title: string;
  helper: string;
  buildingIds: string[];
};

const GOALS: JourneyGoal[] = [
  { id: 'prepare', title: 'Prepare your squad', helper: 'Visit Team HQ and review your roster.', buildingIds: ['team'] },
  { id: 'develop', title: 'Develop one advantage', helper: 'Train players or check recovery readiness.', buildingIds: ['training', 'medical', 'progression'] },
  { id: 'compete', title: 'Compete today', helper: 'Enter the Practice Field and play or schedule a match.', buildingIds: ['practice', 'matches'] },
  { id: 'improve', title: 'Improve the franchise', helper: 'Visit the market, stadium, sponsor bank, or clubhouse.', buildingIds: ['market', 'stadium', 'bank', 'clubhouse', 'dashboard'] },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function FranchiseJourney() {
  const { panels } = usePanels();
  const [open, setOpen] = useState(true);
  const [visited, setVisited] = useState<string[]>(() => readJson(`grid-journey-${todayKey()}`, []));
  const [streak, setStreak] = useState(1);

  const activePanel = panels.length > 0 ? [...panels].sort((a, b) => b.zIndex - a.zIndex)[0] : null;

  useEffect(() => {
    const today = todayKey();
    const lastVisit = localStorage.getItem('grid-last-visit');
    const storedStreak = Number(localStorage.getItem('grid-return-streak') || '0');
    let nextStreak = Math.max(1, storedStreak || 1);

    if (lastVisit && lastVisit !== today) {
      const gap = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${lastVisit}T00:00:00`).getTime()) / DAY_MS);
      nextStreak = gap === 1 ? Math.max(1, storedStreak + 1) : 1;
    }

    localStorage.setItem('grid-last-visit', today);
    localStorage.setItem('grid-return-streak', String(nextStreak));
    setStreak(nextStreak);
  }, []);

  useEffect(() => {
    if (!activePanel?.buildingId) return;
    setVisited((current) => {
      if (current.includes(activePanel.buildingId)) return current;
      const next = [...current, activePanel.buildingId];
      localStorage.setItem(`grid-journey-${todayKey()}`, JSON.stringify(next));
      return next;
    });
  }, [activePanel?.buildingId]);

  const completed = useMemo(
    () => GOALS.map((goal) => goal.buildingIds.some((id) => visited.includes(id))),
    [visited],
  );
  const completedCount = completed.filter(Boolean).length;
  const nextGoal = GOALS.find((_, index) => !completed[index]);
  const progress = Math.round((completedCount / GOALS.length) * 100);

  return (
    <aside className="pointer-events-none fixed left-4 top-24 z-[9] w-[330px] max-w-[calc(100vw-2rem)] text-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-cyan-200/20 bg-slate-950/92 px-4 py-3 text-left shadow-2xl backdrop-blur-xl transition hover:border-cyan-200/40"
        aria-expanded={open}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 shadow-lg shadow-orange-500/20">
          <Goal className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">Franchise Journey</div>
          <div className="truncate text-sm font-black">{nextGoal ? nextGoal.title : 'Daily plan complete'}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black">{completedCount}/{GOALS.length}</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-400">today</div>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="pointer-events-auto mt-2 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/94 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 bg-gradient-to-r from-cyan-500/15 via-transparent to-orange-500/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-orange-200">
                  <Flame className="h-4 w-4" /> {streak} day streak
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">Build momentum through one complete management cycle each day.</p>
              </div>
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-slate-800 bg-slate-900 text-sm font-black">
                {progress}%
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3">
            {GOALS.map((goal, index) => {
              const done = completed[index];
              const current = !done && goal.id === nextGoal?.id;
              return (
                <div key={goal.id} className={`rounded-2xl border p-3 transition ${done ? 'border-emerald-400/20 bg-emerald-400/10' : current ? 'border-orange-300/35 bg-orange-400/10' : 'border-white/10 bg-white/[0.035]'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-400 text-slate-950' : current ? 'bg-orange-400 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-black">{index + 1}</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-black">
                        {goal.title}
                        {current && <Sparkles className="h-3.5 w-3.5 text-orange-300" />}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{goal.helper}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 border-t border-white/10 bg-white/[0.025] px-4 py-3">
            <Trophy className="h-5 w-5 text-yellow-300" />
            <div>
              <div className="text-xs font-black text-yellow-100">Daily completion bonus path</div>
              <div className="text-[10px] text-slate-400">UI tracking only for now; server-backed rewards should be added next.</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
