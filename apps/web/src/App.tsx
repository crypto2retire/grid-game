import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PanelProvider } from './components/world/PanelSystem';
import { TravelProvider } from './components/travel/TravelSystem';
import { TrainingProvider } from './components/training/TrainingSystem';
import { MatchScheduleProvider } from './components/match/MatchScheduleSystem';
import { MatchDayProvider } from './components/match/MatchDaySystem';
import { GamePlanProvider } from './components/gameplan/GamePlanSystem';
import { PlayerProgressionProvider } from './components/player/PlayerProgressionSystem';
import { WorldProvider } from './components/world/WorldSystem';
import GameShell from './components/world/GameShell';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

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
