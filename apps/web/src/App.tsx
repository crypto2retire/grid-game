import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TeamPage from './pages/TeamPage';
import PlayersPage from './pages/PlayersPage';
import MatchPage from './pages/MatchPage';
import MatchesPage from './pages/MatchesPage';
import MarketplacePage from './pages/MarketplacePage';
import LeaderboardPage from './pages/LeaderboardPage';
import WalletPage from './pages/WalletPage';
import SportsEconomyPage from './pages/SportsEconomyPage';
import AssetsPage from './pages/AssetsPage';
import SponsorshipsPage from './pages/SponsorshipsPage';

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/team/:id" element={<TeamPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/matches/:id" element={<MatchPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/sports-economy" element={<SportsEconomyPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/sponsorships" element={<SponsorshipsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/wallet" element={<WalletPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
