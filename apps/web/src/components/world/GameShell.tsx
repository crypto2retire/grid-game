import { useAuthStore } from '../../store/authStore';
import { PanelOverlay } from './PanelSystem';
import IslandWorldMap from './IslandWorldMap';

export default function GameShell() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0f1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E94560]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0f1a]">
      <IslandWorldMap />
      <PanelOverlay />
    </div>
  );
}
