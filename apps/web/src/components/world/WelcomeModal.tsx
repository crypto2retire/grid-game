import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Coins, Users, Zap, Target, ArrowRight, MapPin, Dumbbell, Shirt, ChevronRight, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface WelcomeStep {
  title: string;
  body: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}

export default function WelcomeModal() {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const { user } = useAuthStore();

  const steps: WelcomeStep[] = [
    {
      title: 'Welcome to Gridiron Dynasty',
      icon: Trophy,
      body: (
        <div className="space-y-3">
          <p className="text-white/80">
            You are the owner of <span className="text-[#E94560] font-bold">{user?.username || 'your'}'s State College</span>, a State College football program.
          </p>
          <p className="text-white/60 text-sm">
            Your goal: build a championship dynasty by developing players, upgrading facilities, and climbing the league tiers from State College all the way to Pro Elite.
          </p>
          <div className="flex gap-3 mt-4">
            <div className="flex-1 p-3 bg-white/5 rounded-lg border border-white/10 text-center">
              <Users className="w-5 h-5 mx-auto text-blue-400 mb-1" />
              <div className="text-lg font-bold text-white">18</div>
              <div className="text-xs text-white/50">Players</div>
            </div>
            <div className="flex-1 p-3 bg-white/5 rounded-lg border border-white/10 text-center">
              <MapPin className="w-5 h-5 mx-auto text-emerald-400 mb-1" />
              <div className="text-lg font-bold text-white">5,000</div>
              <div className="text-xs text-white/50">Stadium</div>
            </div>
            <div className="flex-1 p-3 bg-white/5 rounded-lg border border-white/10 text-center">
              <Coins className="w-5 h-5 mx-auto text-yellow-400 mb-1" />
              <div className="text-lg font-bold text-white">5,000</div>
              <div className="text-xs text-white/50">Starting Cash</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Your Daily Loop',
      icon: Zap,
      body: (
        <div className="space-y-3">
          <p className="text-white/80">Every day you can do three things:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-[#E94560]/20 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-[#E94560]" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">Play 1 Match</div>
                <div className="text-xs text-white/50">Schedule a match vs AI or another player. Win to earn CASH and league points.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <Dumbbell className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">Train Your Team</div>
                <div className="text-xs text-white/50">Visit the Training building to improve player stats. Training costs CASH — 90% goes to the treasury, 10% is burned.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <Shirt className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="font-bold text-white text-sm">Buy Gear</div>
                <div className="text-xs text-white/50">Visit the Market to buy equipment for your players. Better gear = better stats. Or sell items to other players in the Marketplace.</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'How You Earn Money',
      icon: Coins,
      body: (
        <div className="space-y-3">
          <p className="text-white/80">Every match generates revenue from multiple sources:</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <div className="text-sm font-bold text-emerald-400">$3,000</div>
              <div className="text-[10px] text-white/50">Win Bonus</div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <div className="text-sm font-bold text-emerald-400">~$1,800</div>
              <div className="text-[10px] text-white/50">Ticket Sales</div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <div className="text-sm font-bold text-emerald-400">~$900</div>
              <div className="text-[10px] text-white/50">Concessions</div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <div className="text-sm font-bold text-emerald-400">~$450</div>
              <div className="text-[10px] text-white/50">Merchandise</div>
            </div>
          </div>
          <p className="text-xs text-white/50">
            <span className="text-red-400">Expenses:</span> Travel (~$300), venue staff (~$200), player recovery ($75), league dues ($50). Net profit per home win: <span className="text-emerald-400 font-bold">~$2,500–$4,000</span>.
          </p>
          <p className="text-xs text-white/40">
            Upgrade your stadium to increase capacity and ticket prices. Bigger stadium = more revenue per match.
          </p>
        </div>
      ),
    },
    {
      title: 'The Path to Pro',
      icon: Target,
      body: (
        <div className="space-y-3">
          <p className="text-white/80">There are 6 league tiers. Win matches to earn points and climb the leaderboard:</p>
          <div className="space-y-1.5">
            {[
              { tier: 'State College', color: '#22c55e', ovr: '50-69' },
              { tier: 'Mid College', color: '#06b6d4', ovr: '60-74' },
              { tier: 'Top College', color: '#d97706', ovr: '70-79' },
              { tier: 'Regional Pro', color: '#64748b', ovr: '75-84' },
              { tier: 'Pro Entry', color: '#e2e8f0', ovr: '80-89' },
              { tier: 'Pro Elite', color: '#dc2626', ovr: '85-99' },
            ].map((t, i) => (
              <div key={t.tier} className="flex items-center gap-2">
                <div className="w-6 text-center text-xs text-white/40 font-mono">{i + 1}</div>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                <div className="flex-1 text-sm text-white">{t.tier}</div>
                <div className="text-xs text-white/50">OVR {t.ovr}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/50 mt-2">
            At the end of each season (7 real days), top teams promote and bottom teams may face relegation. Build your roster, upgrade your stadium, and chase the championship.
          </p>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const Icon = current.icon;

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem('grid-welcome-shown', 'true');
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  // Only show if not previously dismissed
  const alreadyShown = localStorage.getItem('grid-welcome-shown') === 'true';
  if (alreadyShown) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E94560]/20 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#E94560]" />
                </div>
                <h2 className="text-lg font-bold text-white">{current.title}</h2>
              </div>
              <button onClick={handleClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="mb-6">{current.body}</div>

            {/* Step indicators */}
            <div className="flex items-center gap-1.5 mb-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-8 bg-[#E94560]' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="px-4 py-2 text-sm text-white/50 hover:text-white disabled:opacity-0 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="px-5 py-2 bg-[#E94560] text-white rounded-lg text-sm font-bold hover:bg-[#E94560]/80 flex items-center gap-2 transition-colors"
              >
                {step < steps.length - 1 ? (
                  <>Next <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Get Started <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
