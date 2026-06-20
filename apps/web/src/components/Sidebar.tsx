import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Users,
  Swords,
  ShoppingCart,
  Trophy,
  Rocket,
  Wallet,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/team', label: 'My Team', icon: Shield },
  { path: '/players', label: 'Players', icon: Users },
  { path: '/matches', label: 'Games', icon: Swords },
  { path: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
  { path: '/sports-economy', label: 'Sports Economy', icon: Rocket },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/wallet', label: 'Wallet', icon: Wallet },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-black/20 backdrop-blur-xl border-r border-white/5 hidden lg:flex flex-col"
    >
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-[#E94560]/20 to-transparent text-[#E94560] border border-[#E94560]/20'
                  : 'text-white/40 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-[#E94560]' : ''}`} />
              <span className="font-medium text-sm">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E94560] pulse-glow" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Info */}
      <div className="mt-auto p-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="text-xs text-white/30 font-medium mb-2">GRID TOKEN</div>
          <div className="text-lg font-black text-[#FFD700]">Coming Soon</div>
          <div className="text-xs text-white/30 mt-1">One coin across games</div>
        </div>
      </div>
    </aside>
  );
}
