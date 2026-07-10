import { useAuthStore } from '../../store/authStore';
import { PanelOverlay } from './PanelSystem';
import KintaraSportsWorld from './KintaraSportsWorld';
import ModernSportsCampus from './ModernSportsCampus';
import SportsWorldChrome from './SportsWorldChrome';

export default function GameShell() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#07111f] flex items-center justify-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-300/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-orange-400 border-r-cyan-300" />
          <div className="absolute inset-3 rounded-full bg-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.25)]" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07111f]">
      <KintaraSportsWorld />
      <ModernSportsCampus />
      <SportsWorldChrome />
      <PanelOverlay />
    </div>
  );
}
