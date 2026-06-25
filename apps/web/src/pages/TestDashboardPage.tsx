import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, RotateCcw, BarChart3, AlertTriangle, CheckCircle, TrendingUp, Users, DollarSign, Trophy, Zap } from 'lucide-react';

interface TestStatus {
  aiTeams: number;
  totalPlayers: number;
  completedMatches: number;
  testMatches: number;
  treasuryBalance: number;
  gameOwnerCash: number;
  gameOwnerGrid: number;
}

interface SeasonResult {
  matchesPlayed: number;
  totalHomeWins: number;
  totalAwayWins: number;
  totalDraws: number;
  avgHomeScore: number;
  avgAwayScore: number;
  playerDevelopment: Array<{
    playerId: string;
    playerName: string;
    teamName: string;
    position: string;
    age: number;
    ageAfter: number;
    gamesPlayed: number;
    beforeOverall: number;
    afterOverall: number;
    statChanges: Record<string, number>;
    health: number;
    injuryStatus: string | null;
    injuryType: string | null;
    mvpScore: number;
    ratingAverage: number;
  }>;
  injuries: Array<{
    playerId: string;
    playerName: string;
    type: string;
    severity: string;
    weeks: number;
    healthLoss: number;
  }>;
  ageProgression: {
    playersAged: number;
    agesChanged: Array<{ playerId: string; name: string; before: number; after: number }>;
  };
  economicFlow: {
    totalTicketRevenue: number;
    totalVenueLeaseFees: number;
    totalEntryFees: number;
    totalTreasuryInflow: number;
    totalPlayerPayouts: number;
    totalGameOwnerRevenue: number;
    totalWeeklyCosts: number;
    weeklyCostRuns: number;
    avgRevenuePerHomeGame: number;
    avgRevenuePerAwayGame: number;
    balanceCheck: boolean;
    pumpfunRevenue: {
      tokenSymbol: string;
      tokenAddress: string | null;
      estimatedDailyVolume: number;
      tradingFeePct: number;
      creatorSharePct: number;
      projectedDailyRevenue: number;
      projectedMonthlyRevenue: number;
      projectedYearlyRevenue: number;
    } | null;
  };
  teamStandings: Array<{
    teamId: string;
    teamName: string;
    tier: string;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    netRevenue: number;
  }>;
  issues: string[];
}

interface MegaSimSeason {
  seasonNumber: number;
  activeUsers: number;
  totalUsers: number;
  newUsers: number;
  churnedUsers: number;
  matchesPlayed: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  avgHomeScore: number;
  avgAwayScore: number;
  trainingSessions: number;
  trainingGridSpent: number;
  trainingCashSpent: number;
  equipmentPurchases: number;
  equipmentGridSpent: number;
  equipmentCashSpent: number;
  playerListings: number;
  playerSales: number;
  playerMarketplaceVolume: number;
  teamListings: number;
  teamSales: number;
  teamMarketplaceVolume: number;
  venuePurchases: number;
  venueSolPurchases: number;
  transportPurchases: number;
  transportSolPurchases: number;
  gridExchanges: number;
  gridExchanged: number;
  stakingEvents: number;
  stakedAmount: number;
  stakingRewards: number;
  injuries: number;
  retirements: number;
  promotions: number;
  demotions: number;
  weeklyCostsProcessed: number;
  totalCashSpent: number;
  totalGridSpent: number;
  totalSolSpent: number;
  treasuryInflow: number;
  solTreasuryInflow: number;
  pumpfunPrice: number;
  pumpfunVolume: number;
  pumpfunFees: number;
  pumpfunMarketCap: number;
  pumpfunRegime: string;
  sponsorRevenue: number;
  issues: string[];
}

interface MegaSimResult {
  usersCreated: number;
  teamsCreated: number;
  aiTeamsCreated: number;
  totalPlayers: number;
  seasons: MegaSimSeason[];
  finalStandings: Array<{
    teamId: string; teamName: string; tier: string;
    owner: string; wins: number; draws: number; losses: number;
    points: number; goalsFor: number; goalsAgainst: number;
    netRevenue: number;
  }>;
  topPlayers: Array<{
    playerId: string; playerName: string; teamName: string;
    position: string; age: number; overall: number;
    mvpScore: number; ratingAverage: number;
  }>;
  feeTracker: any;
  pumpfunSummary: {
    startingPrice: number; finalPrice: number; allTimeHigh: number;
    allTimeLow: number; totalVolume: number; totalFees: number;
    finalMarketCap: number; priceHistory: any[];
    regimeTransitions: Array<{ season: number; week: number; from: string; to: string }>;
  };
  marketplaceSummary: {
    totalPlayerListings: number; totalPlayerSales: number; totalPlayerVolume: number;
    totalTeamListings: number; totalTeamSales: number; totalTeamVolume: number;
    totalVenuePurchases: number; totalTransportPurchases: number;
    totalSolSpent: number; totalCashSpent: number; totalGridSpent: number;
  };
  economicSummary: any;
  issues: string[];
  duration: number;
}

interface EconomicAudit {
  treasuryBalance: number;
  totalPlayerCash: number;
  totalPlayerGrid: number;
  gameOwnerCash: number;
  gameOwnerGrid: number;
  aiOwnerCash: number;
  aiOwnerGrid: number;
  solTreasuryBalance: number;
  totalSolInflows: number;
  topWallets: Array<{ username: string; cash: number; gridTokens: number }>;
  tokenData: {
    tokenSymbol: string;
    tokenAddress: string | null;
    tokenTreasuryBalance: number;
    totalFeesEarned: number;
    latestPrice: number | null;
    latestMarketCap: number | null;
    latestVolume24h: number | null;
    recentTokenRevenue: Array<any>;
    pumpfunProjection: {
      tokenSymbol: string;
      tokenAddress: string | null;
      estimatedDailyVolume: number;
      tradingFeePct: number;
      creatorSharePct: number;
      projectedDailyRevenue: number;
      projectedMonthlyRevenue: number;
      projectedYearlyRevenue: number;
    } | null;
  };
}

export default function TestDashboardPage() {
  const [status, setStatus] = useState<TestStatus | null>(null);
  const [seasonResult, setSeasonResult] = useState<SeasonResult | null>(null);
  const [economicAudit, setEconomicAudit] = useState<EconomicAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningSeason, setRunningSeason] = useState(false);
  const [resettingEconomy, setResettingEconomy] = useState(false);
  const [runningWeeklyCosts, setRunningWeeklyCosts] = useState(false);
  const [weeklyResults, setWeeklyResults] = useState<any>(null);
  const [gameCount, setGameCount] = useState(20);
  const [error, setError] = useState('');

  // Mega Simulation V2 state
  const [userCount, setUserCount] = useState(50);
  const [seasonCount, setSeasonCount] = useState(2);
  const [runningMegaSim, setRunningMegaSim] = useState(false);
  const [megaSimResult, setMegaSimResult] = useState<MegaSimResult | null>(null);
  const [megaSimError, setMegaSimError] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchStatus();
    fetchEconomicAudit();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/testing/status', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.status === 'success') setStatus(json.data);
    } catch { /* ignore */ }
  }

  async function fetchEconomicAudit() {
    try {
      const res = await fetch('/api/testing/audit/economics', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.status === 'success') setEconomicAudit(json.data);
    } catch { /* ignore */ }
  }

  async function runSeason() {
    setRunningSeason(true);
    setError('');
    try {
      const res = await fetch('/api/testing/season', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameCount }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSeasonResult(json.data);
        fetchStatus();
        fetchEconomicAudit();
      } else {
        setError(json.message || 'Test season failed');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setRunningSeason(false);
    }
  }

  async function runMegaSim() {
    setRunningMegaSim(true);
    setMegaSimError('');
    setMegaSimResult(null);
    try {
      const res = await fetch('/api/testing/mega-simulation-v2', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCount, seasonCount, throttleMs: 0 }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setMegaSimResult(json.data);
        fetchStatus();
        fetchEconomicAudit();
      } else {
        setMegaSimError(json.message || 'Mega simulation failed');
      }
    } catch (e) {
      setMegaSimError('Network error or timeout — try a smaller run');
    } finally {
      setRunningMegaSim(false);
    }
  }

  async function resetTests() {
    if (!confirm('Reset all test data? This deletes test matches and resets AI team records.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/testing/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSeasonResult(null);
        fetchStatus();
        fetchEconomicAudit();
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function resetEconomy() {
    if (!confirm('Reset economy? This zeros the AI owner and sets all player wallets to 50,000 CASH. Treasury is also reset.')) return;
    setResettingEconomy(true);
    try {
      const res = await fetch('/api/testing/economy/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        fetchStatus();
        fetchEconomicAudit();
      }
    } catch { /* ignore */ }
    finally { setResettingEconomy(false); }
  }

  async function runWeeklyCosts() {
    setRunningWeeklyCosts(true);
    try {
      const res = await fetch('/api/testing/economy/weekly-costs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.status === 'success') {
        setWeeklyResults(json.data);
        fetchEconomicAudit();
      }
    } catch { /* ignore */ }
    finally { setRunningWeeklyCosts(false); }
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Test Dashboard</h1>
        <div className="glass-card p-8 text-center">
          <p className="text-slate-300">Please log in to access the test dashboard.</p>
          <Link to="/login" className="mt-4 inline-block text-accent hover:underline">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Test Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run test seasons, audit economics, and verify game balance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetTests}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset Tests
          </button>
          <button
            onClick={resetEconomy}
            disabled={resettingEconomy}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset Economy
          </button>
          <button
            onClick={runWeeklyCosts}
            disabled={runningWeeklyCosts}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500/20 px-4 py-2.5 text-sm font-bold text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
          >
            <DollarSign className="h-4 w-4" /> Weekly Costs
          </button>
        </div>
      </div>

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> AI Teams
            </div>
            <div className="text-2xl font-bold text-white">{status.aiTeams}</div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4" /> Test Matches
            </div>
            <div className="text-2xl font-bold text-white">{status.testMatches}</div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" /> Treasury
            </div>
            <div className="text-2xl font-bold text-white">{status.treasuryBalance.toLocaleString()}</div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Game Owner
            </div>
            <div className="text-2xl font-bold text-white">{status.gameOwnerCash.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Run Test Season */}
      <div className="glass-card p-5">
        <h2 className="text-xl font-bold text-white mb-4">Run Test Season</h2>
        <div className="flex items-center gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Games to simulate</label>
            <input
              type="number"
              min={1}
              max={100}
              value={gameCount}
              onChange={(e) => setGameCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              className="mt-1 block w-32 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white text-sm"
            />
          </div>
          <button
            onClick={runSeason}
            disabled={runningSeason}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {runningSeason ? 'Running...' : 'Run Test Season'}
          </button>
        </div>
        {error && (
          <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">
            <AlertTriangle className="inline h-4 w-4 mr-1" /> {error}
          </div>
        )}
      </div>

      {/* Run Mega Simulation V2 */}
      <div className="glass-card p-5 border border-accent/30">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" /> Mega Simulation V2
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Full economic simulation with training, marketplace, venue purchases, staking, and Pump.fun price modeling.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-sm text-muted-foreground">Users</label>
            <input
              type="number"
              min={10}
              max={500}
              value={userCount}
              onChange={(e) => setUserCount(Math.min(500, Math.max(10, parseInt(e.target.value) || 10)))}
              className="mt-1 block w-28 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Seasons</label>
            <input
              type="number"
              min={1}
              max={10}
              value={seasonCount}
              onChange={(e) => setSeasonCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
              className="mt-1 block w-28 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white text-sm"
            />
          </div>
          <button
            onClick={runMegaSim}
            disabled={runningMegaSim}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {runningMegaSim ? 'Running...' : 'Run Mega Simulation'}
          </button>
        </div>
        {megaSimError && (
          <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">
            <AlertTriangle className="inline h-4 w-4 mr-1" /> {megaSimError}
          </div>
        )}
      </div>

      {/* Mega Simulation Results */}
      {megaSimResult && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="glass-card p-5">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" /> Mega Simulation Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Users</div>
                <div className="text-white font-bold text-lg">{megaSimResult.usersCreated.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Teams</div>
                <div className="text-white font-bold text-lg">{megaSimResult.teamsCreated.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">AI Teams</div>
                <div className="text-white font-bold text-lg">{megaSimResult.aiTeamsCreated.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Players</div>
                <div className="text-white font-bold text-lg">{megaSimResult.totalPlayers.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Matches</div>
                <div className="text-white font-bold text-lg">{megaSimResult.seasons.reduce((s, m) => s + m.matchesPlayed, 0).toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Duration</div>
                <div className="text-white font-bold text-lg">{(megaSimResult.duration / 1000).toFixed(1)}s</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">GRID Spent</div>
                <div className="text-accent font-bold text-lg">{Math.round(megaSimResult.marketplaceSummary.totalGridSpent).toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">CASH Spent</div>
                <div className="text-emerald-400 font-bold text-lg">{Math.round(megaSimResult.marketplaceSummary.totalCashSpent).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Season-by-season breakdown */}
          <div className="glass-card p-5">
            <h2 className="text-xl font-bold text-white mb-4">Season Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-2">Season</th>
                    <th className="pb-2 text-right">Active</th>
                    <th className="pb-2 text-right">Matches</th>
                    <th className="pb-2 text-right">Training</th>
                    <th className="pb-2 text-right">Equip</th>
                    <th className="pb-2 text-right">Player Vol</th>
                    <th className="pb-2 text-right">Team Vol</th>
                    <th className="pb-2 text-right">GRID</th>
                    <th className="pb-2 text-right">CASH</th>
                    <th className="pb-2 text-right">SOL</th>
                    <th className="pb-2 text-right">Inj</th>
                    <th className="pb-2 text-right">Ret</th>
                    <th className="pb-2 text-right">Pump.fun</th>
                  </tr>
                </thead>
                <tbody>
                  {megaSimResult.seasons.map((s) => (
                    <tr key={s.seasonNumber} className="border-b border-white/5">
                      <td className="py-2 text-white font-medium">{s.seasonNumber}</td>
                      <td className="py-2 text-right text-white">{s.activeUsers}</td>
                      <td className="py-2 text-right text-white">{s.matchesPlayed}</td>
                      <td className="py-2 text-right text-white">{s.trainingSessions}</td>
                      <td className="py-2 text-right text-white">{s.equipmentPurchases}</td>
                      <td className="py-2 text-right text-white">{Math.round(s.playerMarketplaceVolume).toLocaleString()}</td>
                      <td className="py-2 text-right text-white">{Math.round(s.teamMarketplaceVolume).toLocaleString()}</td>
                      <td className="py-2 text-right text-accent">{Math.round(s.totalGridSpent).toLocaleString()}</td>
                      <td className="py-2 text-right text-emerald-400">{Math.round(s.totalCashSpent).toLocaleString()}</td>
                      <td className="py-2 text-right text-purple-400">{s.totalSolSpent.toFixed(2)}</td>
                      <td className="py-2 text-right text-red-400">{s.injuries}</td>
                      <td className="py-2 text-right text-amber-400">{s.retirements}</td>
                      <td className="py-2 text-right text-white">${s.pumpfunPrice.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Final Standings */}
          <div className="glass-card p-5">
            <h2 className="text-xl font-bold text-white mb-4">Final Standings (Top 20)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-2">Team</th>
                    <th className="pb-2">Tier</th>
                    <th className="pb-2">Owner</th>
                    <th className="pb-2 text-right">W</th>
                    <th className="pb-2 text-right">D</th>
                    <th className="pb-2 text-right">L</th>
                    <th className="pb-2 text-right">Pts</th>
                    <th className="pb-2 text-right">GF</th>
                    <th className="pb-2 text-right">GA</th>
                    <th className="pb-2 text-right">Net Rev</th>
                  </tr>
                </thead>
                <tbody>
                  {megaSimResult.finalStandings.slice(0, 20).map((team) => (
                    <tr key={team.teamId} className="border-b border-white/5">
                      <td className="py-2 text-white font-medium">{team.teamName}</td>
                      <td className="py-2 text-muted-foreground">{team.tier}</td>
                      <td className="py-2 text-muted-foreground">{team.owner}</td>
                      <td className="py-2 text-right text-emerald-400">{team.wins}</td>
                      <td className="py-2 text-right text-amber-400">{team.draws}</td>
                      <td className="py-2 text-right text-red-400">{team.losses}</td>
                      <td className="py-2 text-right text-white font-bold">{team.points}</td>
                      <td className="py-2 text-right text-white">{team.goalsFor}</td>
                      <td className="py-2 text-right text-white">{team.goalsAgainst}</td>
                      <td className="py-2 text-right text-emerald-400">{team.netRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Players */}
          <div className="glass-card p-5">
            <h2 className="text-xl font-bold text-white mb-4">Top Players (Top 20)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-2">Player</th>
                    <th className="pb-2">Team</th>
                    <th className="pb-2">Pos</th>
                    <th className="pb-2 text-right">Age</th>
                    <th className="pb-2 text-right">OVR</th>
                    <th className="pb-2 text-right">MVP</th>
                  </tr>
                </thead>
                <tbody>
                  {megaSimResult.topPlayers.slice(0, 20).map((p) => (
                    <tr key={p.playerId} className="border-b border-white/5">
                      <td className="py-2 text-white font-medium">{p.playerName}</td>
                      <td className="py-2 text-muted-foreground">{p.teamName}</td>
                      <td className="py-2 text-muted-foreground">{p.position}</td>
                      <td className="py-2 text-right text-white">{p.age}</td>
                      <td className="py-2 text-right text-white">{p.overall}</td>
                      <td className="py-2 text-right text-accent font-bold">{p.mvpScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pump.fun Summary */}
          <div className="glass-card p-5">
            <h2 className="text-xl font-bold text-white mb-4">Pump.fun Token</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Start Price</div>
                <div className="text-white font-bold">${megaSimResult.pumpfunSummary.startingPrice.toFixed(4)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Final Price</div>
                <div className="text-white font-bold">${megaSimResult.pumpfunSummary.finalPrice.toFixed(4)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">All-Time High</div>
                <div className="text-emerald-400 font-bold">${megaSimResult.pumpfunSummary.allTimeHigh.toFixed(4)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">All-Time Low</div>
                <div className="text-red-400 font-bold">${megaSimResult.pumpfunSummary.allTimeLow.toFixed(4)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Final Market Cap</div>
                <div className="text-white font-bold">${(megaSimResult.pumpfunSummary.finalMarketCap / 1e6).toFixed(2)}M</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Total Volume</div>
                <div className="text-white font-bold">${megaSimResult.pumpfunSummary.totalVolume.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Total Fees</div>
                <div className="text-emerald-400 font-bold">${megaSimResult.pumpfunSummary.totalFees.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Regime Changes</div>
                <div className="text-white font-bold">{megaSimResult.pumpfunSummary.regimeTransitions.length}</div>
              </div>
            </div>
            {megaSimResult.pumpfunSummary.regimeTransitions.length > 0 && (
              <div className="mt-4 text-sm text-muted-foreground">
                Regime transitions: {megaSimResult.pumpfunSummary.regimeTransitions.map((t, i) => (
                  <span key={i} className="inline-block mr-3">
                    S{t.season}W{t.week}: {t.from} → {t.to}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Issues */}
          {megaSimResult.issues.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="text-xl font-bold text-white mb-4">Issues</h2>
              <div className="space-y-2">
                {megaSimResult.issues.map((issue, i) => (
                  <div key={i} className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">
                    <AlertTriangle className="inline h-4 w-4 mr-1" /> {issue}
                  </div>
                ))}
              </div>
            </div>
          )}
          {megaSimResult.issues.length === 0 && (
            <div className="glass-card p-5">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-200">
                <CheckCircle className="inline h-4 w-4 mr-1" /> No issues detected — simulation completed successfully!
              </div>
            </div>
          )}
        </div>
      )}

      {/* Season Results */}
      {seasonResult && (
        <div className="space-y-6">
          {/* Game Balance Summary */}
          <div className="glass-card p-5">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" /> Game Balance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Matches</div>
                <div className="text-white font-bold text-lg">{seasonResult.matchesPlayed}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Home Wins</div>
                <div className="text-emerald-400 font-bold text-lg">{seasonResult.totalHomeWins}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Away Wins</div>
                <div className="text-blue-400 font-bold text-lg">{seasonResult.totalAwayWins}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Draws</div>
                <div className="text-amber-400 font-bold text-lg">{seasonResult.totalDraws}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Avg Home Score</div>
                <div className="text-white font-bold text-lg">{seasonResult.avgHomeScore.toFixed(1)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Avg Away Score</div>
                <div className="text-white font-bold text-lg">{seasonResult.avgAwayScore.toFixed(1)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Home Net/Game</div>
                <div className="text-emerald-400 font-bold text-lg">{Math.round(seasonResult.economicFlow.avgRevenuePerHomeGame).toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Away Net/Game</div>
                <div className="text-blue-400 font-bold text-lg">{Math.round(seasonResult.economicFlow.avgRevenuePerAwayGame).toLocaleString()}</div>
              </div>
            </div>

            {seasonResult.issues.length > 0 && (
              <div className="mt-4 space-y-2">
                {seasonResult.issues.map((issue, i) => (
                  <div key={i} className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">
                    <AlertTriangle className="inline h-4 w-4 mr-1" /> {issue}
                  </div>
                ))}
              </div>
            )}
            {seasonResult.issues.length === 0 && (
              <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-200">
                <CheckCircle className="inline h-4 w-4 mr-1" /> No issues detected — game balance looks good!
              </div>
            )}
          </div>

          {/* Economic Flow */}
          <div className="glass-card p-5">
            <h2 className="text-xl font-bold text-white mb-4">Economic Flow</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Total Ticket Revenue</div>
                <div className="text-white font-bold">{seasonResult.economicFlow.totalTicketRevenue.toLocaleString()} CASH</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Venue Lease Fees</div>
                <div className="text-amber-400 font-bold">{seasonResult.economicFlow.totalVenueLeaseFees.toLocaleString()} CASH</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Entry Fees</div>
                <div className="text-blue-400 font-bold">{seasonResult.economicFlow.totalEntryFees.toLocaleString()} CASH</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Treasury Inflow</div>
                <div className="text-purple-400 font-bold">{seasonResult.economicFlow.totalTreasuryInflow.toLocaleString()} CASH</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Player Payouts</div>
                <div className="text-emerald-400 font-bold">{seasonResult.economicFlow.totalPlayerPayouts.toLocaleString()} CASH</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Game Owner Revenue</div>
                <div className="text-cyan-400 font-bold">{seasonResult.economicFlow.totalGameOwnerRevenue.toLocaleString()} CASH</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Weekly Costs ({seasonResult.economicFlow.weeklyCostRuns} runs)</div>
                <div className="text-red-400 font-bold">{seasonResult.economicFlow.totalWeeklyCosts.toLocaleString()} CASH</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-muted-foreground">Net After Costs</div>
                <div className="text-white font-bold">{(seasonResult.economicFlow.totalPlayerPayouts - seasonResult.economicFlow.totalWeeklyCosts).toLocaleString()} CASH</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {seasonResult.economicFlow.balanceCheck ? (
                <span className="text-emerald-400 text-sm font-bold flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Treasury balance verified
                </span>
              ) : (
                <span className="text-red-400 text-sm font-bold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Treasury balance mismatch
                </span>
              )}
            </div>
          </div>

          {/* Pump.fun Token Revenue */}
          {seasonResult.economicFlow.pumpfunRevenue && (
            <div className="glass-card p-5">
              <h2 className="text-xl font-bold text-white mb-4">Pump.fun Token Revenue Projection</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Token</div>
                  <div className="text-white font-bold">{seasonResult.economicFlow.pumpfunRevenue.tokenSymbol}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Est. Daily Volume</div>
                  <div className="text-white font-bold">${seasonResult.economicFlow.pumpfunRevenue.estimatedDailyVolume.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Trading Fee</div>
                  <div className="text-white font-bold">{(seasonResult.economicFlow.pumpfunRevenue.tradingFeePct * 100).toFixed(1)}%</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Creator Share</div>
                  <div className="text-white font-bold">{(seasonResult.economicFlow.pumpfunRevenue.creatorSharePct * 100).toFixed(0)}%</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Daily Revenue</div>
                  <div className="text-emerald-400 font-bold">${seasonResult.economicFlow.pumpfunRevenue.projectedDailyRevenue.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Monthly Revenue</div>
                  <div className="text-emerald-400 font-bold">${seasonResult.economicFlow.pumpfunRevenue.projectedMonthlyRevenue.toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-purple-500/10 border border-purple-500/20 p-3 text-sm text-purple-200">
                <TrendingUp className="inline h-4 w-4 mr-1" />
                Projected yearly revenue: ${seasonResult.economicFlow.pumpfunRevenue.projectedYearlyRevenue.toLocaleString()} at {seasonResult.economicFlow.pumpfunRevenue.estimatedDailyVolume.toLocaleString()} $ daily volume.
                Revenue scales with player count and trading activity.
              </div>
            </div>
          )}

          {/* Team Standings */}
          <div className="glass-card p-5">
            <h2 className="text-xl font-bold text-white mb-4">Test Season Standings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-2">Team</th>
                    <th className="pb-2">Tier</th>
                    <th className="pb-2 text-right">W</th>
                    <th className="pb-2 text-right">D</th>
                    <th className="pb-2 text-right">L</th>
                    <th className="pb-2 text-right">Pts</th>
                    <th className="pb-2 text-right">GF</th>
                    <th className="pb-2 text-right">GA</th>
                    <th className="pb-2 text-right">Net Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonResult.teamStandings.map((team) => (
                    <tr key={team.teamId} className="border-b border-white/5">
                      <td className="py-2 text-white font-medium">{team.teamName}</td>
                      <td className="py-2 text-muted-foreground">{team.tier}</td>
                      <td className="py-2 text-right text-emerald-400">{team.wins}</td>
                      <td className="py-2 text-right text-amber-400">{team.draws}</td>
                      <td className="py-2 text-right text-red-400">{team.losses}</td>
                      <td className="py-2 text-right text-white font-bold">{team.points}</td>
                      <td className="py-2 text-right text-white">{team.goalsFor}</td>
                      <td className="py-2 text-right text-white">{team.goalsAgainst}</td>
                      <td className="py-2 text-right text-emerald-400">{team.netRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Player Development */}
          <div className="glass-card p-5">
            <h2 className="text-xl font-bold text-white mb-4">Top Player Development</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-2">Player</th>
                    <th className="pb-2">Age</th>
                    <th className="pb-2">Pos</th>
                    <th className="pb-2 text-right">Games</th>
                    <th className="pb-2 text-right">OVR</th>
                    <th className="pb-2 text-right">Change</th>
                    <th className="pb-2 text-right">Health</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">MVP</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonResult.playerDevelopment.slice(0, 20).map((p) => (
                    <tr key={p.playerId} className="border-b border-white/5">
                      <td className="py-2 text-white font-medium">{p.playerName}</td>
                      <td className="py-2 text-muted-foreground">{p.age}→{p.ageAfter}</td>
                      <td className="py-2 text-muted-foreground">{p.position}</td>
                      <td className="py-2 text-right text-white">{p.gamesPlayed}</td>
                      <td className="py-2 text-right text-white">{p.afterOverall}</td>
                      <td className="py-2 text-right">
                        <span className={p.statChanges.overall > 0 ? 'text-emerald-400' : p.statChanges.overall < 0 ? 'text-red-400' : 'text-muted-foreground'}>
                          {p.statChanges.overall > 0 ? '+' : ''}{p.statChanges.overall}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <span className={p.health > 80 ? 'text-emerald-400' : p.health > 50 ? 'text-amber-400' : 'text-red-400'}>
                          {p.health}%
                        </span>
                      </td>
                      <td className="py-2 text-xs">
                        {p.injuryStatus && p.injuryStatus !== 'HEALTHY' ? (
                          <span className="text-red-400">{p.injuryStatus} {p.injuryType ? `(${p.injuryType})` : ''}</span>
                        ) : (
                          <span className="text-emerald-400">Healthy</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-accent font-bold">{p.mvpScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Injuries */}
          {seasonResult.injuries.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="text-xl font-bold text-white mb-4">Injuries This Season</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/10">
                      <th className="pb-2">Player</th>
                      <th className="pb-2">Injury</th>
                      <th className="pb-2">Severity</th>
                      <th className="pb-2 text-right">Weeks</th>
                      <th className="pb-2 text-right">Health Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonResult.injuries.map((inj, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-2 text-white">{inj.playerName}</td>
                        <td className="py-2 text-red-400">{inj.type}</td>
                        <td className="py-2 text-amber-400">{inj.severity}</td>
                        <td className="py-2 text-right text-white">{inj.weeks}</td>
                        <td className="py-2 text-right text-red-400">-{inj.healthLoss}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Age Progression */}
          {seasonResult.ageProgression.agesChanged.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="text-xl font-bold text-white mb-4">Age Progression (Year End)</h2>
              <div className="text-sm text-muted-foreground mb-3">
                {seasonResult.ageProgression.playersAged} players aged by 1 year. Older players may show stat decline.
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {seasonResult.ageProgression.agesChanged.slice(0, 12).map((c) => (
                  <div key={c.playerId} className="rounded-xl bg-white/5 p-2">
                    <div className="text-white">{c.name}</div>
                    <div className="text-muted-foreground">Age {c.before} → {c.after}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Economic Audit */}
      {economicAudit && (
        <div className="glass-card p-5">
          <h2 className="text-xl font-bold text-white mb-4">Live Economic Audit</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-muted-foreground">Treasury</div>
              <div className="text-white font-bold">{economicAudit.treasuryBalance.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-muted-foreground">Total Player Cash</div>
              <div className="text-white font-bold">{economicAudit.totalPlayerCash.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-muted-foreground">Game Owner</div>
              <div className="text-white font-bold">{economicAudit.gameOwnerCash.toLocaleString()}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <div className="text-muted-foreground">AI Owner</div>
              <div className="text-white font-bold">{economicAudit.aiOwnerCash.toLocaleString()}</div>
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mt-6 mb-3">Top Wallets</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="pb-2">User</th>
                  <th className="pb-2 text-right">CASH</th>
                  <th className="pb-2 text-right">GRID</th>
                </tr>
              </thead>
              <tbody>
                {economicAudit.topWallets.map((w, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 text-white">{w.username}</td>
                    <td className="py-2 text-right text-white">{w.cash.toLocaleString()}</td>
                    <td className="py-2 text-right text-accent">{w.gridTokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SOL Treasury */}
          <div className="mt-6">
            <h3 className="text-lg font-bold text-white mb-3">SOL Treasury (Real-World Revenue)</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
                <div className="text-muted-foreground">SOL Treasury Balance</div>
                <div className="text-purple-400 font-bold">{economicAudit.solTreasuryBalance.toFixed(4)} SOL</div>
              </div>
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
                <div className="text-muted-foreground">Total SOL Inflows</div>
                <div className="text-purple-400 font-bold">{economicAudit.totalSolInflows.toFixed(4)} SOL</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-purple-300">
              SOL purchases go to treasury for payroll, marketing, dev, and infrastructure. Never sell $GRID.
            </div>
          </div>

          {/* Pump.fun Token Data */}
          {economicAudit.tokenData && economicAudit.tokenData.pumpfunProjection && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white mb-3">Pump.fun Token ({economicAudit.tokenData.tokenSymbol})</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Latest Price</div>
                  <div className="text-white font-bold">{economicAudit.tokenData.latestPrice ? `$${economicAudit.tokenData.latestPrice.toFixed(6)}` : 'N/A'}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Market Cap</div>
                  <div className="text-white font-bold">{economicAudit.tokenData.latestMarketCap ? `$${economicAudit.tokenData.latestMarketCap.toLocaleString()}` : 'N/A'}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">24h Volume</div>
                  <div className="text-white font-bold">{economicAudit.tokenData.latestVolume24h ? `$${economicAudit.tokenData.latestVolume24h.toLocaleString()}` : 'N/A'}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Fees Earned</div>
                  <div className="text-emerald-400 font-bold">{economicAudit.tokenData.totalFeesEarned.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Token Treasury</div>
                  <div className="text-white font-bold">{economicAudit.tokenData.tokenTreasuryBalance.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Projected Daily</div>
                  <div className="text-emerald-400 font-bold">${economicAudit.tokenData.pumpfunProjection.projectedDailyRevenue.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Projected Monthly</div>
                  <div className="text-emerald-400 font-bold">${economicAudit.tokenData.pumpfunProjection.projectedMonthlyRevenue.toLocaleString()}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-muted-foreground">Projected Yearly</div>
                  <div className="text-emerald-400 font-bold">${economicAudit.tokenData.pumpfunProjection.projectedYearlyRevenue.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}

          {/* Weekly Costs Results */}
          {weeklyResults && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white mb-3">Weekly Operating Costs</h3>
              <div className="text-sm text-muted-foreground mb-3">
                Processed {weeklyResults.processedTeams} teams — venue maintenance, transport, and player wages deducted
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/10">
                      <th className="pb-2">Team</th>
                      <th className="pb-2 text-right">Total Cost</th>
                      <th className="pb-2 text-right">Wallet After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyResults.results.slice(0, 10).map((r: any, i: number) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-2 text-white">{r.teamName}</td>
                        <td className="py-2 text-right text-red-400">{r.totalCost.toLocaleString()}</td>
                        <td className="py-2 text-right text-white">{r.walletAfter.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
