import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { processWeeklyMaintenance, applyPostMatchStadiumWear } from './maintenance.service';
import { logger } from '../../config/logger';

const router = Router();

export { applyPostMatchStadiumWear };

// POST /api/economy/maintenance/weekly — run weekly maintenance for all teams (admin)
router.post(
  '/weekly',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const result = await processWeeklyMaintenance();

    logger.info(
      `Weekly maintenance: ${result.processedTeams} teams, ` +
      `${result.totalRegularCosts.toLocaleString()} regular + ${result.totalRepairCosts.toLocaleString()} repairs`
    );

    res.json({
      status: 'success',
      data: result,
      message: `Processed ${result.processedTeams} teams — ` +
        `${result.totalRegularCosts.toLocaleString()} CASH regular costs, ` +
        `${result.totalRepairCosts.toLocaleString()} CASH repairs`,
    });
  })
);

// GET /api/economy/maintenance/stats — get maintenance stats overview
router.get(
  '/stats',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const teams = await processWeeklyMaintenance();
    const withRepairs = teams.results.filter(r => r.totalRepairs > 0);

    res.json({
      status: 'success',
      data: {
        totalTeams: teams.processedTeams,
        totalRegularCosts: teams.totalRegularCosts,
        totalRepairCosts: teams.totalRepairCosts,
        teamsWithRepairs: withRepairs.length,
        repairRate: teams.processedTeams > 0
          ? Math.round((withRepairs.length / teams.processedTeams) * 100)
          : 0,
      },
    });
  })
);

export const maintenanceRouter = router;
