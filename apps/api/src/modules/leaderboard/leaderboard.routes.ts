import { Router } from 'express';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

function numeric(value: any, fallback: number): number {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

router.get(
  '/teams',
  asyncHandler(async (req, res) => {
    const { page = '1', limit = '20', sportId = 'american-football' } = req.query;
    const take = numeric(limit, 20);
    const skip = (numeric(page, 1) - 1) * take;

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where: { sportId: sportId as string },
        skip,
        take,
        orderBy: [
          { points: 'desc' },
          { wins: 'desc' },
          { losses: 'asc' },
        ],
        include: {
          owner: { select: { username: true, displayName: true } },
          _count: { select: { teamPlayers: true } },
        },
      }),
      prisma.team.count({ where: { sportId: sportId as string } }),
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
    const { page = '1', limit = '20', sortBy = 'mvpScore', sportId = 'american-football', season } = req.query;
    const take = numeric(limit, 20);
    const skip = (numeric(page, 1) - 1) * take;
    const sortField = String(sortBy || 'mvpScore');
    const allowedSortFields = ['mvpScore', 'touchdowns', 'yards', 'tackles', 'turnoversForced', 'ratingAverage'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'mvpScore';

    const where: any = {
      sportId: sportId as string,
    };
    if (season) {
      where.season = season as string;
    }

    const [rows, total] = await Promise.all([
      prisma.playerSeasonStats.findMany({
        where,
        orderBy: { [safeSortField]: 'desc' },
        skip,
        take,
        include: {
          player: {
            include: {
              teamPlayers: {
                include: { team: { select: { name: true } } },
              },
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

router.get(
  '/prestige',
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
          { losses: 'asc' },
        ],
        include: {
          owner: {
            select: { username: true, displayName: true },
          },
          venue: { select: { tier: true, prestige: true } },
          _count: {
            select: { teamPlayers: true },
          },
        },
      }),
      prisma.team.count({ where }),
    ]);

    // Sort by prestige in-memory since the Prisma client type may not expose the field directly.
    const sortedTeams = (teams as any[])
      .map((team) => ({ ...team, prestige: team.prestige ?? team.venue?.prestige ?? 0 }))
      .sort((a, b) => {
        const prestigeDiff = b.prestige - a.prestige;
        if (prestigeDiff !== 0) return prestigeDiff;
        return b.points - a.points || b.wins - a.wins;
      });

    res.json({
      status: 'success',
      data: {
        teams: sortedTeams,
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
