import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Flame, Goal, Sparkles } from 'lucide-react';
import { usePanels } from './PanelSystem';

type JourneyGoal = {
  id: string;
  title: string;
  helper: string;
  buildingIds: string[];
};

const GOALS: JourneyGoal[] = [
  { id: 'prepare', title: 'Prepare your squad', helper: 'Review the roster at Team HQ.', buildingIds: ['team'] },
  { id: 'develop', title: 'Build an advantage', helper: 'Train players or review recovery.', buildingIds: ['training', 'medical', 'progression'] },
  { id: 'compete', title: 'Compete today', helper: 'Play or schedule a match.', buildingIds: ['practice', 'matches'] },
  { id: 'improve', title: 'Improve the club', helper: 'Visit a business or franchise facility.', buildingIds: ['market', 'stadium', 'bank', 'clubhouse', 'dashboard'] },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const todayKey = () => new Date().toISOString().slice(0, 10);

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
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState<string[]>(() => readJson(`grid-journey-${todayKey()}`, []));
  const [streak, setStreak] = useState(1);
  const activePanel = panels.length > 0 ? [...panels].sort((a, b) => b.zIndex - a.zIndex)[0] : null;

  useEffect(() => {
    const today = todayKey();
    const lastVisit = localStorage.getItem('grid-last-visit');
    const storedStreak = Number(localStorage.getItem('grid-return-streak') || '0');
    let nextStreak = Math.max(1, storedStreak || 1);
    if (lastVisit && lastVisit !== today) {
      const gap = Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${lastVisit}T00:00:00Z`).getTime()) / DAY_MS);
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

  const completed = useMemo(() => GOALS.map((goal) => goal.buildingIds.some((id) => visited.includes(id))), [visited]);
  const completedCount = completed.filter(Boolean).length;
  const nextGoal = GOALS.find((_, index) => !completed[index]);
  const progress = (completedCount / GOALS.length) * 100;

  return (
    <aside className="pointer-events-none fixed left-[18px] top-[76px] z-[9] w-[300px] max-w-[calc(100vw-36px)] text-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto flex w-full items-center gap-3 rounded-xl border border-white/15 bg-slate-900/90 px-3 py-2.5 text-left shadow-xl backdrop-blur-xl transition hover:bg-slate-800/95"
        aria-expanded={open}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 text-slate-950 shadow-inner">
          <Goal className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">Today’s plan</div>
          <div className="truncate text-xs font-black">{nextGoal ? nextGoal.title : 'Daily plan complete'}</div>
        </div>
        <span className="text-[10px] font-black text-amber-200">{completedCount}/{GOALS.length}</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="pointer-events-auto mt-2 overflow-hidden rounded-2xl border border-white/12 bg-slate-900/96 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                <Flame className="h-3.5 w-3.5" /> {streak} day streak
              </div>
              <div className="mt-1 text-[10px] text-slate-400">Complete one full club cycle today.</div>
            </div>
            <div className="relative h-9 w-9 rounded-full bg-slate-800">
              <div className="absolute inset-1 rounded-full bg-slate-900" />
              <div className="absolute inset-x-1 bottom-1 rounded-full bg-amber-400 transition-all" style={{ height: `${Math.max(4, progress * .28)}px` }} />
              <span className="absolute inset-0 grid place-items-center text-[9px] font-black">{Math.round(progress)}%</span>
            </div>
          </div>

          <div className="space-y-1.5 p-2.5">
            {GOALS.map((goal, index) => {
              const done = completed[index];
              const current = !done && goal.id === nextGoal?.id;
              return (
                <div key={goal.id} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${done ? 'border-emerald-400/15 bg-emerald-400/8' : current ? 'border-amber-300/25 bg-amber-300/8' : 'border-white/8 bg-white/[0.025]'}`}>
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-400 text-slate-950' : current ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                    {done ? <Check className="h-3.5 w-3.5" /> : <span className="text-[9px] font-black">{index + 1}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-black">
                      {goal.title}
                      {current && <Sparkles className="h-3 w-3 text-amber-300" />}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{goal.helper}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
