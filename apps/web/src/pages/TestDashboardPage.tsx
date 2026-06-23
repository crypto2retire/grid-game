import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, RotateCcw, BarChart3, AlertTriangle, CheckCircle, TrendingUp, Users, DollarSign, Trophy } from 'lucide-react';

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
    gamesPlayed: number;
    beforeOverall: number;
    afterOverall: number;
    statChanges: Record<string, number>;
    mvpScore: number;
    ratingAverage: number;
  }>;
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

interface EconomicAudit {
  treasuryBalance: number;
  totalPlayerCash: number;
  totalPlayerGrid: number;
  gameOwnerCash: number;
  gameOwnerGrid: number;
  aiOwnerCash: number;
  aiOwnerGrid: number;
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
                    <th className="pb-2">Team</th>
                    <th className="pb-2">Pos</th>
                    <th className="pb-2 text-right">Games</th>
                    <th className="pb-2 text-right">OVR Before</th>
                    <th className="pb-2 text-right">OVR After</th>
                    <th className="pb-2 text-right">Change</th>
                    <th className="pb-2 text-right">MVP Score</th>
                    <th className="pb-2 text-right">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonResult.playerDevelopment.slice(0, 20).map((p) => (
                    <tr key={p.playerId} className="border-b border-white/5">
                      <td className="py-2 text-white font-medium">{p.playerName}</td>
                      <td className="py-2 text-muted-foreground">{p.teamName}</td>
                      <td className="py-2 text-muted-foreground">{p.position}</td>
                      <td className="py-2 text-right text-white">{p.gamesPlayed}</td>
                      <td className="py-2 text-right text-white">{p.beforeOverall}</td>
                      <td className="py-2 text-right text-white">{p.afterOverall}</td>
                      <td className="py-2 text-right">
                        <span className={p.statChanges.overall > 0 ? 'text-emerald-400' : p.statChanges.overall < 0 ? 'text-red-400' : 'text-muted-foreground'}>
                          {p.statChanges.overall > 0 ? '+' : ''}{p.statChanges.overall}
                        </span>
                      </td>
                      <td className="py-2 text-right text-accent font-bold">{p.mvpScore.toFixed(1)}</td>
                      <td className="py-2 text-right text-white">{p.ratingAverage.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
