import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Users,
  Swords,
  ShoppingCart,
  Trophy,
  Wallet,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/team', label: 'My Team', icon: Shield },
  { path: '/players', label: 'Players', icon: Users },
  { path: '/matches', label: 'Matches', icon: Swords },
  { path: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/wallet', label: 'Wallet', icon: Wallet },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-card border-r border-border hidden lg:flex flex-col">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:bg-secondary hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
