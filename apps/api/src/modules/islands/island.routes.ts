import { Router } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { Response } from 'express';

const router = Router();

// ─── GET /api/islands — list all islands with league info ───
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const islands = await prisma.island.findMany({
        include: {
          league: {
            select: {
              id: true,
              name: true,
              tier: true,
              visibility: true,
              minOverall: true,
              maxOverall: true,
              maxTeams: true,
              isDefault: true,
              creator: { select: { id: true, username: true, displayName: true } },
            },
          },
        },
        orderBy: [{ type: 'desc' as any }, { prestige: 'desc' }],
      });
      res.json({ status: 'success', data: islands });
    } catch (err: any) {
      if (err.code === 'P2021') {
        // Table doesn't exist yet — return default islands so world map works
        res.json({ status: 'success', data: DEFAULT_ISLANDS });
      } else {
        throw err;
      }
    }
  })
);

// Default islands when DB table doesn't exist
const DEFAULT_ISLANDS = [
  { id: 'island-hub', name: 'Grid City Central', type: 'HUB', x: 0, y: 0, size: 2.5, theme: 'grass', color: '#4ade80', teamCount: 0, maxTeams: 999, prestige: 10, league: { id: 'league-hub', name: 'Grid City Central', tier: 'HUB', visibility: 'PUBLIC', minOverall: 0, maxOverall: 99, maxTeams: 999, isDefault: true, creator: null } },
  { id: 'island-state-001', name: 'State College Circuit', type: 'LEAGUE', x: -200, y: -150, size: 1.0, theme: 'grass', color: '#86efac', teamCount: 0, maxTeams: 16, prestige: 5, league: { id: 'league-state-001', name: 'State College Circuit', tier: 'STATE_COLLEGE', visibility: 'PUBLIC', minOverall: 50, maxOverall: 69, maxTeams: 16, isDefault: true, creator: null } },
  { id: 'island-mid-001', name: 'Mid-College Conference', type: 'LEAGUE', x: 200, y: -150, size: 1.1, theme: 'tropical', color: '#22d3ee', teamCount: 0, maxTeams: 16, prestige: 8, league: { id: 'league-mid-001', name: 'Mid-College Conference', tier: 'MID_COLLEGE', visibility: 'PUBLIC', minOverall: 60, maxOverall: 74, maxTeams: 16, isDefault: true, creator: null } },
  { id: 'island-top-001', name: 'Top College Tournament', type: 'LEAGUE', x: -250, y: 100, size: 1.2, theme: 'desert', color: '#fbbf24', teamCount: 0, maxTeams: 12, prestige: 12, league: { id: 'league-top-001', name: 'Top College Tournament', tier: 'TOP_COLLEGE', visibility: 'PUBLIC', minOverall: 70, maxOverall: 79, maxTeams: 12, isDefault: true, creator: null } },
  { id: 'island-regional-001', name: 'Regional Pro Circuit', type: 'LEAGUE', x: 250, y: 100, size: 1.3, theme: 'industrial', color: '#94a3b8', teamCount: 0, maxTeams: 12, prestige: 15, league: { id: 'league-regional-001', name: 'Regional Pro Circuit', tier: 'REGIONAL_PRO', visibility: 'PUBLIC', minOverall: 75, maxOverall: 84, maxTeams: 12, isDefault: true, creator: null } },
  { id: 'island-pro-001', name: 'Pro Entry League', type: 'LEAGUE', x: -150, y: 250, size: 1.4, theme: 'snow', color: '#e2e8f0', teamCount: 0, maxTeams: 10, prestige: 18, league: { id: 'league-pro-001', name: 'Pro Entry League', tier: 'PRO_ENTRY', visibility: 'PUBLIC', minOverall: 80, maxOverall: 89, maxTeams: 10, isDefault: true, creator: null } },
  { id: 'island-elite-001', name: 'Pro Elite Championship', type: 'LEAGUE', x: 150, y: 250, size: 1.5, theme: 'volcanic', color: '#f87171', teamCount: 0, maxTeams: 8, prestige: 25, league: { id: 'league-elite-001', name: 'Pro Elite Championship', tier: 'PRO_ELITE', visibility: 'PUBLIC', minOverall: 85, maxOverall: 99, maxTeams: 8, isDefault: true, creator: null } },
];

// ─── GET /api/islands/:id — island detail with teams and stadiums ───
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const island = await prisma.island.findUnique({
        where: { id: req.params.id as string },
        include: {
          league: {
            include: {
              memberships: {
                include: {
                  team: {
                    include: {
                      owner: { select: { id: true, username: true, displayName: true } },
                      venue: true,
                      teamPlayers: { include: { player: true } },
                    },
                  },
                },
              },
              creator: { select: { id: true, username: true, displayName: true } },
            },
          },
        },
      });

      if (!island) {
        // Fallback: return default island by ID if table doesn't exist
        const fallback = DEFAULT_ISLANDS.find((i) => i.id === req.params.id);
        if (fallback) {
          res.json({ status: 'success', data: fallback });
          return;
        }
        throw new AppError(404, 'Island not found');
      }

      res.json({ status: 'success', data: island });
    } catch (err: any) {
      if (err.code === 'P2021') {
        const fallback = DEFAULT_ISLANDS.find((i) => i.id === req.params.id);
        if (fallback) {
          res.json({ status: 'success', data: fallback });
          return;
        }
      }
      throw err;
    }
  })
);

export { router as islandRouter };
