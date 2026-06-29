import { motion } from 'framer-motion';
import { Building2, TrendingUp, Users, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CityPage() {
  const navigate = useNavigate();

  const quickActions = [
    { label: 'My Team', route: '/team', icon: Users, color: '#3b82f6', desc: 'Manage roster and players' },
    { label: 'Stadium', route: '/stadium/interior', icon: Building2, color: '#22c55e', desc: 'Upgrade venue and facilities' },
    { label: 'Marketplace', route: '/marketplace', icon: TrendingUp, color: '#f59e0b', desc: 'Buy and sell players' },
    { label: 'Leaderboard', route: '/leaderboard', icon: Trophy, color: '#eab308', desc: 'See top teams' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-black text-white tracking-tight"
        >
          Welcome to Grid City
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-400 mt-2 max-w-md mx-auto"
        >
          Click any building in the city map above to navigate. Or use the quick actions below.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickActions.map((action, i) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              onClick={() => navigate(action.route)}
              className="group rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition-all hover:border-white/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${action.color}20` }}>
                  <Icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white group-hover:text-white/90 text-sm">{action.label}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-base font-bold text-white mb-3">How to Play</h2>
        <div className="space-y-2 text-sm text-slate-400">
          <div className="p-2 rounded-lg bg-white/5">
            <span className="text-white font-bold text-sm">1. Build Your Team</span>
            <p className="text-xs mt-0.5">Start with your free college team. Develop players through matches and training.</p>
          </div>
          <div className="p-2 rounded-lg bg-white/5">
            <span className="text-white font-bold text-sm">2. Upgrade Facilities</span>
            <p className="text-xs mt-0.5">Buy bigger stadiums, better transport, and training equipment to earn more revenue.</p>
          </div>
          <div className="p-2 rounded-lg bg-white/5">
            <span className="text-white font-bold text-sm">3. Trade & Compete</span>
            <p className="text-xs mt-0.5">Sell developed players, buy teams, and climb the leaderboard to become a pro.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
