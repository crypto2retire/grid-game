import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Check, Trophy, Dumbbell, Shirt, Clock, X } from 'lucide-react';


interface Quest {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  reward: number;
  completed: boolean;
  target: number;
  current: number;
}

const DEFAULT_QUESTS: Quest[] = [
  {
    id: 'play-match',
    label: 'Play a Match',
    description: 'Schedule and play 1 match today',
    icon: Trophy,
    reward: 500,
    completed: false,
    target: 1,
    current: 0,
  },
  {
    id: 'train-players',
    label: 'Train Players',
    description: 'Complete 3 training sessions',
    icon: Dumbbell,
    reward: 300,
    completed: false,
    target: 3,
    current: 0,
  },
  {
    id: 'buy-item',
    label: 'Buy Equipment',
    description: 'Purchase 1 item from the Market',
    icon: Shirt,
    reward: 400,
    completed: false,
    target: 1,
    current: 0,
  },
];

export function useDailyQuests() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [claimedToday, setClaimedToday] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const stored = localStorage.getItem('grid-daily-quests');
    const storedReset = localStorage.getItem('grid-quests-reset');
    const storedClaimed = localStorage.getItem('grid-quests-claimed');

    if (storedReset === today && stored) {
      try {
        setQuests(JSON.parse(stored));
        setClaimedToday(new Set(JSON.parse(storedClaimed || '[]')));
      } catch {
        resetQuestsToDefault();
      }
    } else {
      resetQuestsToDefault();
    }
  }, [today]);

  const resetQuestsToDefault = () => {
    const fresh = DEFAULT_QUESTS.map(q => ({ ...q, completed: false, current: 0 }));
    setQuests(fresh);
    setClaimedToday(new Set());
    localStorage.setItem('grid-daily-quests', JSON.stringify(fresh));
    localStorage.setItem('grid-quests-reset', today);
    localStorage.setItem('grid-quests-claimed', '[]');
  };

  const updateQuest = useCallback((id: string, current: number) => {
    setQuests(prev => {
      const next = prev.map(q => {
        if (q.id !== id) return q;
        const completed = current >= q.target;
        return { ...q, current, completed };
      });
      localStorage.setItem('grid-daily-quests', JSON.stringify(next));
      return next;
    });
  }, []);

  const claimReward = useCallback((id: string) => {
    const quest = quests.find(q => q.id === id);
    if (!quest || !quest.completed || claimedToday.has(id)) return false;

    const next = new Set(claimedToday);
    next.add(id);
    setClaimedToday(next);
    localStorage.setItem('grid-quests-claimed', JSON.stringify([...next]));
    return true;
  }, [quests, claimedToday]);

  return { quests, updateQuest, claimReward, claimedToday };
}

export function DailyQuestPanel() {
  const { quests, claimReward, claimedToday } = useDailyQuests();
  const [open, setOpen] = useState(false);
  const [claimedMsg, setClaimedMsg] = useState<string | null>(null);

  const completedCount = quests.filter(q => q.completed).length;
  const allCompleted = completedCount === quests.length;

  const handleClaim = (id: string) => {
    const success = claimReward(id);
    if (success) {
      const quest = quests.find(q => q.id === id);
      setClaimedMsg(`+${quest?.reward} CASH claimed!`);
      setTimeout(() => setClaimedMsg(null), 3000);
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-14 left-4 z-20 flex items-center gap-2 px-3 py-2 bg-black/60 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-colors"
      >
        <Target className="w-4 h-4 text-[#E94560]" />
        <span className="text-xs font-bold">Daily</span>
        {completedCount > 0 && (
          <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${allCompleted ? 'bg-emerald-500 text-white' : 'bg-[#E94560] text-white'}`}>
            {completedCount}
          </span>
        )}
      </button>

      {/* Quest panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed top-28 left-4 w-72 bg-black/80 rounded-xl border border-white/10 p-4 z-20"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-white/50 uppercase tracking-wider">Daily Objectives</div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>

            {claimedMsg && (
              <div className="mb-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs text-center">
                {claimedMsg}
              </div>
            )}

            <div className="space-y-2">
              {quests.map(quest => {
                const Icon = quest.icon;
                const isClaimed = claimedToday.has(quest.id);
                return (
                  <div
                    key={quest.id}
                    className={`p-3 rounded-lg border transition-all ${
                      quest.completed
                        ? isClaimed
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-[#E94560]/5 border-[#E94560]/20'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        quest.completed ? (isClaimed ? 'bg-emerald-500/20' : 'bg-[#E94560]/20') : 'bg-white/10'
                      }`}>
                        {quest.completed ? (
                          isClaimed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Icon className="w-3.5 h-3.5 text-[#E94560]" />
                        ) : (
                          <Icon className="w-3.5 h-3.5 text-white/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className={`text-sm font-bold ${quest.completed ? 'text-white' : 'text-white/70'}`}>
                            {quest.label}
                          </div>
                          <div className="text-xs text-yellow-400 font-bold">{quest.reward} CASH</div>
                        </div>
                        <div className="text-[10px] text-white/50 mt-0.5">{quest.description}</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${quest.completed ? 'bg-emerald-400' : 'bg-[#E94560]'}`}
                              style={{ width: `${Math.min((quest.current / quest.target) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-white/50">
                            {quest.current}/{quest.target}
                          </span>
                        </div>
                      </div>
                    </div>
                    {quest.completed && !isClaimed && (
                      <button
                        onClick={() => handleClaim(quest.id)}
                        className="mt-2 w-full py-1.5 bg-[#E94560] text-white rounded-lg text-xs font-bold hover:bg-[#E94560]/80 transition-colors"
                      >
                        Claim {quest.reward} CASH
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-[10px] text-white/30 text-center flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Resets daily at midnight
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
