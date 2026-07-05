import { Router } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest, requireRole } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { creditCurrency } from '../economy/currency.service';
import { logger } from '../../config/logger';
import { applyEconomyHealthMultiplier, getEconomyHealthSnapshot } from '../economy/balance.service';

const router = Router();

// ─── Reward tiers: how many CASH each rank gets per week ───
const WEEKLY_REWARDS: Record<number, number> = {
  1: 3000,
  2: 2000,
  3: 1500,
  4: 1000,
  5: 750,
  6: 500,
  7: 400,
  8: 300,
  9: 250,
  10: 200,
};

// ─── GET /api/leaderboard/snapshots — list historical snapshots ───
router.get(
  '/snapshots',
  asyncHandler(async (req, res) => {
    const { sportId = 'american-football', season = 'beta', limit = '10' } = req.query;
    const snapshots = await prisma.leaderboardSnapshot.findMany({
      where: { sportId: sportId as string, season: season as string },
      orderBy: { week: 'desc' },
      take: Math.min(Number(limit), 50),
    });
    res.json({ status: 'success', data: snapshots });
  })
);

// ─── GET /api/leaderboard/snapshots/:id — single snapshot with rewards ───
router.get(
  '/snapshots/:id',
  asyncHandler(async (req, res) => {
    const snapshot = await prisma.leaderboardSnapshot.findUnique({
      where: { id: req.params.id },
    });
    if (!snapshot) throw new AppError(404, 'Snapshot not found');

    const rewards = await prisma.leaderboardReward.findMany({
      where: { snapshotId: snapshot.id },
      orderBy: { rank: 'asc' },
    });

    res.json({ status: 'success', data: { snapshot, rewards } });
  })
);

// ─── GET /api/leaderboard/snapshots/latest — current standings preview ───
router.get(
  '/snapshots/latest',
  asyncHandler(async (req, res) => {
    const sportId = (req.query.sportId as string) || 'american-football';
    const season = (req.query.season as string) || 'beta';

    // Get current standings
    const teams = await prisma.team.findMany({
      where: { sportId },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }, { pointsFor: 'desc' }],
      select: {
        id: true,
        name: true,
        wins: true,
        draws: true,
        losses: true,
        points: true,
        pointsFor: true,
        pointsAgainst: true,
        owner: { select: { id: true, username: true } },
      },
    });

    // Compute current week
    const gameSettings = await prisma.gameSettings.findFirst();
    const epochStart = gameSettings?.gameEpochStart
      ? new Date(gameSettings.gameEpochStart)
      : new Date('2025-01-01');
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const currentWeek = Math.floor((Date.now() - epochStart.getTime()) / msPerWeek) + 1;

    // Get last snapshot
    const lastSnapshot = await prisma.leaderboardSnapshot.findFirst({
      where: { sportId, season },
      orderBy: { week: 'desc' },
    });

    res.json({
      status: 'success',
      data: {
        currentWeek,
        lastSnapshotWeek: lastSnapshot?.week || 0,
        teams,
      },
    });
  })
);

// ─── POST /api/leaderboard/snapshots — create a snapshot (admin) ───
router.post(
  '/snapshots',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (_req: AuthRequest, res) => {
    const sportId = 'american-football';
    const season = 'beta';

    // Get current standings
    const teams = await prisma.team.findMany({
      where: { sportId },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }, { pointsFor: 'desc' }],
      select: {
        id: true,
        name: true,
        wins: true,
        draws: true,
        losses: true,
        points: true,
        pointsFor: true,
        pointsAgainst: true,
        owner: { select: { id: true, username: true } },
      },
    });

    // Determine week number
    const existingSnapshots = await prisma.leaderboardSnapshot.count({
      where: { sportId, season },
    });
    const week = existingSnapshots + 1;

    const entries = teams.map((t, i) => ({
      rank: i + 1,
      teamId: t.id,
      teamName: t.name,
      ownerId: t.owner.id,
      ownerName: t.owner.username,
      wins: t.wins,
      draws: t.draws,
      losses: t.losses,
      points: t.points,
      pointsFor: t.pointsFor,
      pointsAgainst: t.pointsAgainst,
    }));

    // Create snapshot and rewards in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const snapshot = await tx.leaderboardSnapshot.create({
        data: {
          sportId,
          season,
          week,
          entries,
          totalTeams: teams.length,
        },
      });

      // Create reward entries for top 10
      const rewards = [];
      for (const entry of entries.slice(0, 10)) {
        const amount = WEEKLY_REWARDS[entry.rank] || 0;
        if (amount > 0) {
          const reward = await tx.leaderboardReward.create({
            data: {
              snapshotId: snapshot.id,
              rank: entry.rank,
              teamId: entry.teamId,
              ownerId: entry.ownerId,
              rewardAmount: amount,
              currency: 'CASH',
              status: 'PENDING',
            },
          });
          rewards.push(reward);
        }
      }

      return { snapshot, rewards };
    });

    logger.info(`Leaderboard snapshot created: week ${week}, ${teams.length} teams, ${result.rewards.length} rewards`);

    res.status(201).json({
      status: 'success',
      data: result,
      message: `Week ${week} snapshot created with ${result.rewards.length} reward recipients`,
    });
  })
);

// ─── POST /api/leaderboard/rewards/pay — pay out pending rewards (admin) ───
router.post(
  '/rewards/pay',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (_req: AuthRequest, res) => {
    const pendingRewards = await prisma.leaderboardReward.findMany({
      where: { status: 'PENDING' },
    });

    if (pendingRewards.length === 0) {
      res.json({ status: 'success', message: 'No pending rewards to pay' });
      return;
    }

    let totalPaid = 0;
    let recipients = 0;

    const health = await getEconomyHealthSnapshot(prisma);

    for (const reward of pendingRewards) {
      await prisma.$transaction(async (tx: any) => {
        const adjustedReward = applyEconomyHealthMultiplier(reward.rewardAmount, health);
        await creditCurrency(tx, {
          userId: reward.ownerId,
          currency: 'CASH',
          amount: adjustedReward,
          reason: 'LEADERBOARD_REWARD',
          sourceType: 'LEADERBOARD_SNAPSHOT',
          sourceId: reward.snapshotId,
          metadata: { rank: reward.rank, originalRewardAmount: reward.rewardAmount, economyMultiplier: health.rewardMultiplier },
        });
        await tx.leaderboardReward.update({
          where: { id: reward.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
        totalPaid += adjustedReward;
        recipients++;
      });
    }

    logger.info(`Paid ${recipients} leaderboard rewards: ${totalPaid.toLocaleString()} CASH`);

    res.json({
      status: 'success',
      data: { recipients, totalPaid },
      message: `Paid ${recipients} rewards totaling ${totalPaid.toLocaleString()} CASH`,
    });
  })
);

export const leaderboardSnapshotRouter = router;
