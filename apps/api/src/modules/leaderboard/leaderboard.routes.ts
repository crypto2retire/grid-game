import { Router } from 'express';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

const numeric = (value: unknown, fallback: number) => {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const playerSortMap: Record<string, string> = {
  mvpScore: 'mvpScore',
  touchdowns: 'touchdowns',
  passingTouchdowns: 'passingTouchdowns',
  yards: 'yards',
  tackles: 'tackles',
  turnoversForced: 'turnoversForced',
  fieldGoals: 'fieldGoals',
  ratingAverage: 'ratingAverage',
  gamesPlayed: 'gamesPlayed',
};

router.get(
  '/teams',
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '20', sportId = 'american-football' } = req.query;
    const take = numeric(limit, 20);
    const skip = (numeric(page, 1) - 1) * take;
    const where = { sportId: sportId as string };

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take,
        orderBy: [
          { points: 'desc' },
          { wins: 'desc' },
          { pointsFor: 'desc' },
        ],
        include: {
          owner: {
            select: { username: true, displayName: true },
          },
          _count: {
            select: { teamPlayers: true },
          },
        },
      }),
      prisma.team.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        teams,
        pagination: {
          page: numeric(page, 1),
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  })
);

router.get(
  '/players',
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '20', sortBy = 'mvpScore', sportId = 'american-football', season = 'beta' } = req.query;
    const take = numeric(limit, 20);
    const skip = (numeric(page, 1) - 1) * take;
    const sortField = playerSortMap[String(sortBy)] || 'mvpScore';
    const where = { sportId: sportId as string, season: season as string };

    const [rows, total] = await Promise.all([
      prisma.playerSeasonStats.findMany({
        where,
        skip,
        take,
        orderBy: [
          { [sortField]: 'desc' },
          { ratingAverage: 'desc' },
          { gamesPlayed: 'desc' },
        ] as any,
        include: {
          player: {
            select: {
              id: true,
              name: true,
              sportId: true,
              position: true,
              overall: true,
              rarity: true,
              form: true,
              fatigue: true,
              morale: true,
              pace: true,
              shooting: true,
              passing: true,
              dribbling: true,
              defending: true,
              physical: true,
            },
          },
        },
      }),
      prisma.playerSeasonStats.count({ where }),
    ]);

    const players = rows.map((row) => ({
      ...row.player,
      seasonStats: {
        id: row.id,
        season: row.season,
        gamesPlayed: row.gamesPlayed,
        starts: row.starts,
        touchdowns: row.touchdowns,
        passingTouchdowns: row.passingTouchdowns,
        fieldGoals: row.fieldGoals,
        yards: row.yards,
        plays: row.plays,
        assists: row.assists,
        tackles: row.tackles,
        stops: row.stops,
        turnoversForced: row.turnoversForced,
        ratingAverage: row.ratingAverage,
        mvpScore: row.mvpScore,
        stats: row.stats,
      },
      matchStats: [],
    }));

    res.json({
      status: 'success',
      data: {
        players,
        sortBy: sortField,
        season,
        pagination: {
          page: numeric(page, 1),
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  })
);

export const leaderboardRouter = router;
