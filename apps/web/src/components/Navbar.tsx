import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Trophy, Wallet, LogOut } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuthStore();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-50">
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">G</span>
        </div>
        <span className="text-lg font-bold text-white">GRID</span>
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
          <Wallet className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-mono font-medium text-yellow-400">
            {user?.wallet?.cash?.toLocaleString() || 0}
          </span>
          <span className="text-xs text-muted-foreground">CASH</span>
        </div>

        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-white">{user?.displayName || user?.username}</span>
        </div>

        <button
          onClick={logout}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
