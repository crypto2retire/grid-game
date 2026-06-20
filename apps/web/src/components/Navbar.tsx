import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { SPORT_OPTIONS, useGameStore, type SportId } from '../store/gameStore';
import { Wallet, LogOut, Zap, Trophy } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { wallet, activeSportId, setActiveSportId } = useGameStore();

  const handleSportChange = (sportId: SportId) => {
    setActiveSportId(sportId);
  };

  return (
    <header className="h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-50">
      <Link to="/dashboard" className="flex items-center gap-3 group">
        <div className="w-10 h-10 bg-gradient-to-br from-[#E94560] to-[#FF6B6B] rounded-xl flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-shadow">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xl font-black text-white tracking-tight">GRID</span>
          <span className="text-xs text-[#E94560] font-bold ml-1">BETA</span>
        </div>
      </Link>

      <div className="flex items-center gap-3">
        {/* Sport Switcher */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
          <Trophy className="w-4 h-4 text-[#E94560]" />
          <select
            value={activeSportId}
            onChange={(event) => handleSportChange(event.target.value as SportId)}
            className="bg-transparent text-sm font-bold text-white focus:outline-none"
            title="Switch sport"
          >
            {SPORT_OPTIONS.map((sport) => (
              <option key={sport.id} value={sport.id} className="bg-[#0B1020] text-white">
                {sport.shortLabel}
              </option>
            ))}
          </select>
        </div>

        {/* Wallet Display - uses global game store */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
          <Wallet className="w-4 h-4 text-[#FFD700]" />
          <span className="text-sm font-mono font-bold text-[#FFD700]">
            {wallet.cash.toLocaleString()}
          </span>
          <span className="text-xs text-white/40 font-medium">CASH</span>
        </div>

        {/* User Profile */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
          <div className="w-8 h-8 bg-gradient-to-br from-[#E94560] to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {(user?.displayName || user?.username || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-semibold text-white hidden lg:block">
            {user?.displayName || user?.username}
          </span>
        </div>

        <button
          onClick={logout}
          className="p-2.5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
          title="Logout"
        >
          <LogOut className="w-4 h-4 text-white/50" />
        </button>
      </div>
    </header>
  );
}
