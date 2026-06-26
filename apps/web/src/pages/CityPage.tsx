import { motion } from 'framer-motion';
import { Building2, TrendingUp, Users, Trophy, ArrowRight } from 'lucide-react';
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, i) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              onClick={() => navigate(action.route)}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10 transition-all hover:border-white/20"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${action.color}20` }}>
                <Icon className="w-5 h-5" style={{ color: action.color }} />
              </div>
              <h3 className="font-bold text-white group-hover:text-white/90">{action.label}</h3>
              <p className="text-xs text-slate-400 mt-1">{action.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-bold" style={{ color: action.color }}>
                Go <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-bold text-white mb-2">How to Play</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-400">
          <div className="space-y-1">
            <span className="text-white font-bold">1. Build Your Team</span>
            <p>Start with your free college team. Develop players through matches and training.</p>
          </div>
          <div className="space-y-1">
            <span className="text-white font-bold">2. Upgrade Facilities</span>
            <p>Buy bigger stadiums, better transport, and training equipment to earn more revenue.</p>
          </div>
          <div className="space-y-1">
            <span className="text-white font-bold">3. Trade & Compete</span>
            <p>Sell developed players, buy teams, and climb the leaderboard to become a pro.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
