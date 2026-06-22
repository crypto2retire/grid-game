import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import {
  Coins,
  TrendingUp,
  Users,
  PiggyBank,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  Trophy,
  Loader2,
} from 'lucide-react';

interface PoolInfo {
  totalStaked: number;
  rewardRatePerDay: number;
  totalRewardsFunded: number;
  totalRewardsDistributed: number;
  active: boolean;
}

interface StakeInfo {
  id: string;
  amount: number;
  stakedAt: string;
  lastClaimedAt: string;
  totalClaimed: number;
  status: string;
}

interface UnstakingInfo {
  amount: number;
  requestedAt: string;
  readyAt: string;
  remainingHours: number;
}

interface StakingStats {
  pool: PoolInfo;
  stake: StakeInfo | null;
  claimable: number;
  userShare: number;
  unstaking: UnstakingInfo | null;
  estimatedDailyReward: number;
}

interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  amount: number;
  share: number;
  stakedAt: string;
  totalClaimed: number;
}

interface LeaderboardData {
  pool: PoolInfo & { stakerCount: number };
  topStakers: LeaderboardEntry[];
}

export default function StakingPage() {
  const [stats, setStats] = useState<StakingStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [walletGrid, setWalletGrid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
    fetchWallet();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/staking/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch staking stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/staking/leaderboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  const fetchWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/economy/wallet', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWalletGrid(data.data?.gridTokens || 0);
        useGameStore.getState().setWallet(data.data || { cash: 0, gridTokens: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleStake = async () => {
    const amount = parseInt(stakeAmount, 10);
    if (!amount || amount <= 0) {
      showMessage('error', 'Enter a valid stake amount');
      return;
    }
    if (amount > walletGrid) {
      showMessage('error', 'Insufficient GRID balance');
      return;
    }

    setActionLoading('stake');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/staking/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('success', data.message);
        setStakeAmount('');
        await Promise.all([fetchStats(), fetchWallet(), fetchLeaderboard()]);
      } else {
        showMessage('error', data.message || 'Stake failed');
      }
    } catch (err) {
      showMessage('error', 'Network error during stake');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClaim = async () => {
    setActionLoading('claim');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/staking/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('success', data.message);
        await Promise.all([fetchStats(), fetchWallet()]);
      } else {
        showMessage('error', data.message || 'Claim failed');
      }
    } catch (err) {
      showMessage('error', 'Network error during claim');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnstakeRequest = async () => {
    setActionLoading('unstakeRequest');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/staking/unstake/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('success', data.message);
        await fetchStats();
      } else {
        showMessage('error', data.message || 'Unstake request failed');
      }
    } catch (err) {
      showMessage('error', 'Network error during unstake request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnstakeComplete = async () => {
    setActionLoading('unstakeComplete');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/staking/unstake/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('success', data.message);
        await Promise.all([fetchStats(), fetchWallet(), fetchLeaderboard()]);
      } else {
        showMessage('error', data.message || 'Unstake failed');
      }
    } catch (err) {
      showMessage('error', 'Network error during unstake');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  const apy = stats ? (stats.pool.rewardRatePerDay * 365 * 100).toFixed(1) : '0';
  const hasActiveStake = stats?.stake?.status === 'ACTIVE';
  const hasUnstaking = stats?.unstaking !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">GRID Rewards Pool</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stake GRID tokens to earn rewards from game revenue
          </p>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Pool Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-400/10 rounded-lg flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-sm text-muted-foreground">Total Staked</div>
          </div>
          <div className="text-2xl font-bold text-white">
            {stats?.pool.totalStaked.toLocaleString() || 0} GRID
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-400/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-sm text-muted-foreground">Est. APY</div>
          </div>
          <div className="text-2xl font-bold text-white">{apy}%</div>
          <div className="text-xs text-muted-foreground mt-1">
            {(stats?.pool.rewardRatePerDay || 0) * 100}% daily
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-yellow-400/10 rounded-lg flex items-center justify-center">
              <Coins className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-sm text-muted-foreground">Rewards Funded</div>
          </div>
          <div className="text-2xl font-bold text-white">
            {stats?.pool.totalRewardsFunded.toLocaleString() || 0} GRID
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-400/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-sm text-muted-foreground">Stakers</div>
          </div>
          <div className="text-2xl font-bold text-white">
            {leaderboard?.pool.stakerCount || 0}
          </div>
        </div>
      </div>

      {/* User Staking Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stake / Manage */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {hasActiveStake ? 'Your Stake' : 'Stake GRID'}
          </h2>

          {hasActiveStake ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Staked Amount</div>
                  <div className="text-xl font-bold text-white">
                    {stats!.stake!.amount.toLocaleString()} GRID
                  </div>
                </div>
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Pool Share</div>
                  <div className="text-xl font-bold text-white">{stats!.userShare}%</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Claimable</div>
                  <div className="text-xl font-bold text-green-400">
                    {stats!.claimable.toLocaleString()} GRID
                  </div>
                </div>
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Est. Daily</div>
                  <div className="text-xl font-bold text-white">
                    +{Math.floor(stats!.estimatedDailyReward).toLocaleString()} GRID
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Total claimed: {stats!.stake!.totalClaimed.toLocaleString()} GRID
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClaim}
                  disabled={actionLoading === 'claim' || stats!.claimable <= 0}
                  className="flex-1 btn-primary py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'claim' ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <ArrowUpCircle className="w-4 h-4" />
                      Claim Rewards
                    </span>
                  )}
                </button>
                <button
                  onClick={handleUnstakeRequest}
                  disabled={actionLoading === 'unstakeRequest'}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'unstakeRequest' ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <ArrowDownCircle className="w-4 h-4" />
                      Unstake
                    </span>
                  )}
                </button>
              </div>
            </div>
          ) : hasUnstaking ? (
            <div className="space-y-4">
              <div className="bg-yellow-400/10 border border-yellow-400/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold">Unstaking in Progress</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {stats!.unstaking!.amount.toLocaleString()} GRID is being unstaked.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats!.unstaking!.remainingHours > 0
                    ? `${stats!.unstaking!.remainingHours} hours remaining`
                    : 'Ready to complete!'}
                </p>
              </div>
              {stats!.unstaking!.remainingHours === 0 && (
                <button
                  onClick={handleUnstakeComplete}
                  disabled={actionLoading === 'unstakeComplete'}
                  className="w-full btn-primary py-3 rounded-lg font-semibold disabled:opacity-50"
                >
                  {actionLoading === 'unstakeComplete' ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Complete Unstake'
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-secondary/50 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">Available GRID</div>
                <div className="text-xl font-bold text-white">{walletGrid.toLocaleString()} GRID</div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-2">Amount to Stake</label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="Enter GRID amount..."
                  min="1"
                  className="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:border-accent"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setStakeAmount(Math.floor(walletGrid * 0.25).toString())}
                    className="text-xs bg-white/5 hover:bg-white/10 text-white/60 px-3 py-1 rounded transition-colors"
                  >
                    25%
                  </button>
                  <button
                    onClick={() => setStakeAmount(Math.floor(walletGrid * 0.5).toString())}
                    className="text-xs bg-white/5 hover:bg-white/10 text-white/60 px-3 py-1 rounded transition-colors"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setStakeAmount(Math.floor(walletGrid * 0.75).toString())}
                    className="text-xs bg-white/5 hover:bg-white/10 text-white/60 px-3 py-1 rounded transition-colors"
                  >
                    75%
                  </button>
                  <button
                    onClick={() => setStakeAmount(walletGrid.toString())}
                    className="text-xs bg-white/5 hover:bg-white/10 text-white/60 px-3 py-1 rounded transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>

              <button
                onClick={handleStake}
                disabled={actionLoading === 'stake'}
                className="w-full btn-primary py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {actionLoading === 'stake' ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'Stake GRID'
                )}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                24-hour cooldown applies when unstaking. Rewards accrue daily.
              </p>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Top Stakers
          </h2>

          {leaderboard && leaderboard.topStakers.length > 0 ? (
            <div className="space-y-3">
              {leaderboard.topStakers.map((staker, index) => (
                <div
                  key={staker.userId}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0
                          ? 'bg-yellow-400/20 text-yellow-400'
                          : index === 1
                          ? 'bg-gray-300/20 text-gray-300'
                          : index === 2
                          ? 'bg-orange-400/20 text-orange-400'
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">
                        {staker.displayName || staker.username}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {staker.share}% of pool
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white text-sm">
                      {staker.amount.toLocaleString()} GRID
                    </div>
                    <div className="text-xs text-green-400">
                      +{staker.totalClaimed.toLocaleString()} claimed
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <PiggyBank className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No stakers yet</p>
              <p className="text-muted-foreground text-sm">
                Be the first to stake GRID and earn rewards
              </p>
            </div>
          )}
        </div>
      </div>

      {/* How It Works */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="w-8 h-8 bg-purple-400/10 rounded-lg flex items-center justify-center mb-3">
              <PiggyBank className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="font-medium text-white mb-1">Stake GRID</h3>
            <p className="text-sm text-muted-foreground">
              Deposit your GRID tokens into the rewards pool. No minimum required.
            </p>
          </div>
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="w-8 h-8 bg-green-400/10 rounded-lg flex items-center justify-center mb-3">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <h3 className="font-medium text-white mb-1">Earn Daily</h3>
            <p className="text-sm text-muted-foreground">
              Rewards accrue at {stats?.pool.rewardRatePerDay || 0.005} per day on your staked amount.
            </p>
          </div>
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="w-8 h-8 bg-yellow-400/10 rounded-lg flex items-center justify-center mb-3">
              <Coins className="w-4 h-4 text-yellow-400" />
            </div>
            <h3 className="font-medium text-white mb-1">Claim Anytime</h3>
            <p className="text-sm text-muted-foreground">
              Claim rewards without unstaking. Unstaking has a 24-hour cooldown.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
