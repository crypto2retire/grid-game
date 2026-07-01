import { prisma } from '../../config/database';
import { creditCurrency, debitCurrency } from '../economy/currency.service';

const COOLDOWN_HOURS = 24;

/**
 * Get or initialize the main rewards pool.
 */
export async function getPool() {
  let pool = await prisma.rewardsPool.findUnique({
    where: { id: 'main' },
  });

  if (!pool) {
    pool = await prisma.rewardsPool.create({
      data: {
        id: 'main',
        totalStaked: 0,
        rewardRatePerDay: 0.005,
        totalRewardsDistributed: 0,
        totalRewardsFunded: 0,
        lastDistributionAt: new Date(),
        active: true,
      },
    });
  }

  return pool;
}

/**
 * Get a user's active stake.
 */
export async function getUserStake(userId: string) {
  return prisma.userStake.findFirst({
    where: { userId, status: 'ACTIVE' },
  });
}

/**
 * Calculate claimable rewards for a user stake.
 * Rewards accrue at rewardRatePerDay per staked token.
 */
export function calculateClaimableRewards(
  stake: { amount: number; lastClaimedAt: Date; totalClaimed: number },
  pool: { rewardRatePerDay: number; totalRewardsFunded: number; totalStaked: number }
): number {
  if (pool.totalStaked === 0 || pool.totalRewardsFunded <= 0) return 0;

  const now = new Date();
  const hoursSinceClaim =
    (now.getTime() - new Date(stake.lastClaimedAt).getTime()) / (1000 * 60 * 60);

  // Daily reward = stake * rewardRatePerDay
  const dailyReward = stake.amount * pool.rewardRatePerDay;
  const accrued = Math.floor(dailyReward * (hoursSinceClaim / 24));

  // Cap at proportional share of funded pool
  const maxShare = Math.floor(
    (stake.amount / pool.totalStaked) * pool.totalRewardsFunded
  );

  return Math.min(accrued, maxShare);
}

/**
 * Stake DYN tokens into the rewards pool.
 */
export async function stakeGrid(userId: string, amount: number) {
  if (amount <= 0) {
    throw new Error('Stake amount must be greater than 0');
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  if (wallet.dynTokens < amount) {
    throw new Error(`Insufficient DYN. Need ${amount.toLocaleString()} DYN`);
  }

  const existingStake = await getUserStake(userId);

  return prisma.$transaction(async (tx: any) => {
    // Deduct from wallet
    await debitCurrency(tx, {
      userId,
      currency: 'DYN',
      amount,
      reason: 'STAKE_DEPOSIT',
      sourceType: 'STAKING',
      sourceId: 'main',
      metadata: { amount, poolId: 'main' },
    });

    // Update pool total
    await tx.rewardsPool.update({
      where: { id: 'main' },
      data: { totalStaked: { increment: amount } },
    });

    if (existingStake) {
      // Add to existing stake
      const claimable = calculateClaimableRewards(
        existingStake,
        await tx.rewardsPool.findUnique({ where: { id: 'main' } })
      );

      // Auto-claim any pending rewards before adding
      await tx.rewardsPool.update({
        where: { id: 'main' },
        data: {
          totalRewardsFunded: { decrement: claimable },
          totalRewardsDistributed: { increment: claimable },
        },
      });

      if (claimable > 0) {
        await creditCurrency(tx, {
          userId,
          currency: 'DYN',
          amount: claimable,
          reason: 'STAKE_REWARD',
          sourceType: 'STAKING',
          sourceId: 'main',
          metadata: { amount: claimable, poolId: 'main' },
        });
      }

      return tx.userStake.update({
        where: { id: existingStake.id },
        data: {
          amount: { increment: amount },
          lastClaimedAt: new Date(),
          totalClaimed: { increment: claimable },
        },
      });
    } else {
      // Create new stake
      return tx.userStake.create({
        data: {
          userId,
          poolId: 'main',
          amount,
          stakedAt: new Date(),
          lastClaimedAt: new Date(),
          status: 'ACTIVE',
        },
      });
    }
  });
}

/**
 * Claim accrued rewards without unstaking.
 */
export async function claimRewards(userId: string) {
  const stake = await getUserStake(userId);
  if (!stake) {
    throw new Error('No active stake found');
  }

  const pool = await getPool();
  const claimable = calculateClaimableRewards(stake, pool);

  if (claimable <= 0) {
    return { claimed: 0, stake };
  }

  return prisma.$transaction(async (tx: any) => {
    // Deduct from pool
    await tx.rewardsPool.update({
      where: { id: 'main' },
      data: {
        totalRewardsFunded: { decrement: claimable },
        totalRewardsDistributed: { increment: claimable },
      },
    });

    // Add to wallet
    await creditCurrency(tx, {
      userId,
      currency: 'DYN',
      amount: claimable,
      reason: 'STAKE_REWARD',
      sourceType: 'STAKING',
      sourceId: 'main',
      metadata: { amount: claimable, poolId: 'main' },
    });

    // Update stake
    const updatedStake = await tx.userStake.update({
      where: { id: stake.id },
      data: {
        lastClaimedAt: new Date(),
        totalClaimed: { increment: claimable },
      },
    });

    return { claimed: claimable, stake: updatedStake };
  });
}

/**
 * Request unstake (starts cooldown).
 */
export async function requestUnstake(userId: string) {
  const stake = await getUserStake(userId);
  if (!stake) {
    throw new Error('No active stake found');
  }

  return prisma.userStake.update({
    where: { id: stake.id },
    data: {
      status: 'UNSTAKING',
      unstakeRequestedAt: new Date(),
    },
  });
}

/**
 * Complete unstake after cooldown. Returns DYN to wallet.
 */
export async function completeUnstake(userId: string) {
  const stake = await prisma.userStake.findFirst({
    where: { userId, status: 'UNSTAKING' },
  });

  if (!stake) {
    throw new Error('No unstaking request found');
  }

  const hoursSinceRequest =
    (new Date().getTime() - new Date(stake.unstakeRequestedAt!).getTime()) /
    (1000 * 60 * 60);

  if (hoursSinceRequest < COOLDOWN_HOURS) {
    const remainingHours = Math.ceil(COOLDOWN_HOURS - hoursSinceRequest);
    throw new Error(`Unstake cooldown: ${remainingHours} hours remaining`);
  }

  const pool = await getPool();
  const claimable = calculateClaimableRewards(stake, pool);

  return prisma.$transaction(async (tx: any) => {
    // Claim any pending rewards first
    if (claimable > 0) {
      await tx.rewardsPool.update({
        where: { id: 'main' },
        data: {
          totalRewardsFunded: { decrement: claimable },
          totalRewardsDistributed: { increment: claimable },
        },
      });
    }

    // Return stake + rewards to wallet
    const totalReturn = stake.amount + claimable;
    await creditCurrency(tx, {
      userId,
      currency: 'DYN',
      amount: totalReturn,
      reason: 'STAKE_WITHDRAWAL',
      sourceType: 'STAKING',
      sourceId: 'main',
      metadata: { stakeAmount: stake.amount, rewards: claimable, poolId: 'main' },
    });

    // Update pool
    await tx.rewardsPool.update({
      where: { id: 'main' },
      data: { totalStaked: { decrement: stake.amount } },
    });

    // Mark stake completed
    const updatedStake = await tx.userStake.update({
      where: { id: stake.id },
      data: {
        status: 'COMPLETED',
        totalClaimed: { increment: claimable },
      },
    });

    return { returned: totalReturn, stakeAmount: stake.amount, rewards: claimable, stake: updatedStake };
  });
}

/**
 * Fund the rewards pool (admin/game system).
 */
export async function fundPool(amount: number, _reason: string = 'GAME_REVENUE') {
  if (amount <= 0) {
    throw new Error('Fund amount must be greater than 0');
  }

  return prisma.rewardsPool.update({
    where: { id: 'main' },
    data: {
      totalRewardsFunded: { increment: amount },
      lastDistributionAt: new Date(),
    },
  });
}

/**
 * Get full staking stats for a user.
 */
export async function getUserStakingStats(userId: string) {
  const pool = await getPool();
  const stake = await getUserStake(userId);

  let claimable = 0;
  let userShare = 0;

  if (stake && pool.totalStaked > 0) {
    claimable = calculateClaimableRewards(stake, pool);
    userShare = (stake.amount / pool.totalStaked) * 100;
  }

  // Get unstaking stake if any
  const unstaking = await prisma.userStake.findFirst({
    where: { userId, status: 'UNSTAKING' },
  });

  let unstakeReadyAt: Date | null = null;
  let unstakeRemainingHours = 0;
  if (unstaking?.unstakeRequestedAt) {
    unstakeReadyAt = new Date(
      new Date(unstaking.unstakeRequestedAt).getTime() + COOLDOWN_HOURS * 60 * 60 * 1000
    );
    const remaining = (unstakeReadyAt.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    unstakeRemainingHours = Math.max(0, Math.ceil(remaining));
  }

  return {
    pool: {
      totalStaked: pool.totalStaked,
      rewardRatePerDay: pool.rewardRatePerDay,
      totalRewardsFunded: pool.totalRewardsFunded,
      totalRewardsDistributed: pool.totalRewardsDistributed,
      active: pool.active,
    },
    stake: stake
      ? {
          id: stake.id,
          amount: stake.amount,
          stakedAt: stake.stakedAt,
          lastClaimedAt: stake.lastClaimedAt,
          totalClaimed: stake.totalClaimed,
          status: stake.status,
        }
      : null,
    claimable,
    userShare: parseFloat(userShare.toFixed(2)),
    unstaking: unstaking
      ? {
          amount: unstaking.amount,
          requestedAt: unstaking.unstakeRequestedAt,
          readyAt: unstakeReadyAt,
          remainingHours: unstakeRemainingHours,
        }
      : null,
    estimatedDailyReward: stake ? stake.amount * pool.rewardRatePerDay : 0,
  };
}

/**
 * Get global pool stats (leaderboard of stakers).
 */
export async function getPoolLeaderboard() {
  const pool = await getPool();

  const topStakers = await prisma.userStake.findMany({
    where: { status: 'ACTIVE' },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { amount: 'desc' },
    take: 20,
  });

  return {
    pool: {
      totalStaked: pool.totalStaked,
      rewardRatePerDay: pool.rewardRatePerDay,
      totalRewardsFunded: pool.totalRewardsFunded,
      totalRewardsDistributed: pool.totalRewardsDistributed,
      active: pool.active,
      stakerCount: topStakers.length,
    },
    topStakers: topStakers.map((s: any) => ({
      userId: s.user.id,
      username: s.user.username,
      displayName: s.user.displayName,
      amount: s.amount,
      share:
        pool.totalStaked > 0
          ? parseFloat(((s.amount / pool.totalStaked) * 100).toFixed(2))
          : 0,
      stakedAt: s.stakedAt,
      totalClaimed: s.totalClaimed,
    })),
  };
}
