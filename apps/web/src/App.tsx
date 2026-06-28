import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PanelProvider, usePanels } from './components/world/PanelSystem';
import { TravelProvider } from './components/travel/TravelSystem';
import { TrainingProvider } from './components/training/TrainingSystem';
import { MatchScheduleProvider } from './components/match/MatchScheduleSystem';
import { MatchDayProvider } from './components/match/MatchDaySystem';
import { GamePlanProvider } from './components/gameplan/GamePlanSystem';
import { PlayerProgressionProvider } from './components/player/PlayerProgressionSystem';
import { WorldProvider } from './components/world/WorldSystem';
import PlayerProgressionPage from './pages/PlayerProgressionPage';
import GameShell from './components/world/GameShell';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CityPage from './pages/CityPage';
import TeamPage from './pages/TeamPage';
import MarketplacePage from './pages/MarketplacePage';
import LeaderboardPage from './pages/LeaderboardPage';
import WalletPage from './pages/WalletPage';
import TrainingPage from './pages/TrainingPage';
import EquipmentPage from './pages/EquipmentPage';
import WorldMapPage from './pages/WorldMapPage';
import StadiumInteriorPage from './pages/StadiumInteriorPage';
import TransportGaragePage from './pages/TransportGaragePage';
import TestDashboardPage from './pages/TestDashboardPage';

// Map of routes to panel content for auto-opening panels on direct link
const ROUTE_CONTENT: Record<string, { id: string; title: string; content: React.ReactNode }> = {
  '/dashboard': { id: 'dashboard', title: 'HQ', content: <CityPage /> },
  '/team': { id: 'team', title: 'Team Office', content: <TeamPage /> },
  '/marketplace': { id: 'market', title: 'Market', content: <MarketplacePage /> },
  '/leaderboard': { id: 'leaderboard', title: 'Hall of Fame', content: <LeaderboardPage /> },
  '/wallet': { id: 'wallet', title: 'Bank', content: <WalletPage /> },
  '/training': { id: 'training', title: 'Training', content: <TrainingPage /> },
  '/locker': { id: 'locker', title: 'Locker Room', content: <EquipmentPage /> },
  '/world-map': { id: 'world', title: 'World Map', content: <WorldMapPage /> },
  '/progression': { id: 'progression', title: 'Player Progression', content: <PlayerProgressionPage /> },
  '/gameplan': { id: 'gameplan', title: 'Game Plan', content: <StadiumInteriorPage /> },
  '/stadium/interior': { id: 'stadium', title: 'Stadium', content: <StadiumInteriorPage /> },
  '/garage': { id: 'transport', title: 'Garage', content: <TransportGaragePage /> },
  '/test-dashboard': { id: 'dashboard', title: 'HQ', content: <TestDashboardPage /> },
};

function AutoPanelOpener() {
  const location = useLocation();
  const { openPanel } = usePanels();
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (!hasOpened && location.pathname !== '/city') {
      const panelConfig = ROUTE_CONTENT[location.pathname];
      if (panelConfig) {
        // Small delay so the shell mounts first
        setTimeout(() => {
          openPanel({
            id: panelConfig.id,
            title: panelConfig.title,
            buildingId: panelConfig.id,
            x: 100 + Math.random() * 100,
            y: 60 + Math.random() * 50,
            width: 800,
            height: 600,
            minimized: false,
            maximized: false,
            content: panelConfig.content,
          });
        }, 100);
      }
      setHasOpened(true);
    }
  }, [location.pathname, hasOpened, openPanel]);

  return null;
}

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/*"
          element={
            <PlayerProgressionProvider>
              <GamePlanProvider>
                <MatchScheduleProvider>
                  <TrainingProvider>
                    <TravelProvider>
                      <MatchDayProvider>
                        <WorldProvider>
                          <PanelProvider>
                            <GameShell />
                            <AutoPanelOpener />
                          </PanelProvider>
                        </WorldProvider>
                      </MatchDayProvider>
                    </TravelProvider>
                  </TrainingProvider>
                </MatchScheduleProvider>
              </GamePlanProvider>
            </PlayerProgressionProvider>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
