import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
import {
  claimSellerWeeklyObjective,
  chooseFacilitySpecialization,
  getEconomyBalancePolicy,
  getFacilityEconomyState,
  getSellerDashboard,
  purchaseFacilitySeasonCycle,
} from './economy-balance.service';

const router = Router();

router.get(
  '/policy',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res) => {
    res.json({ status: 'success', data: getEconomyBalancePolicy() });
  }),
);

router.get(
  '/seller',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await getSellerDashboard(req.user!.id);
    res.json({ status: 'success', data: result });
  }),
);

router.post(
  '/seller/weekly/claim',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await claimSellerWeeklyObjective(req.user!.id);
    res.json({ status: 'success', data: result, message: 'Seller progression rewards claimed' });
  }),
);

router.get(
  '/facilities/:teamId',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teamId = routeParam(req.params.teamId, 'teamId');
    const result = await getFacilityEconomyState(req.user!.id, teamId);
    res.json({ status: 'success', data: result });
  }),
);

router.post(
  '/facilities/:teamId/specialize',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teamId = routeParam(req.params.teamId, 'teamId');
    const input = z.object({
      facilityType: z.string().min(2).max(30),
      path: z.string().min(2).max(40),
    }).parse(req.body);
    const result = await chooseFacilitySpecialization(req.user!.id, teamId, input.facilityType, input.path);
    res.status(201).json({ status: 'success', data: result, message: 'Facility specialization activated' });
  }),
);

router.post(
  '/facilities/:teamId/season-cycle',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const teamId = routeParam(req.params.teamId, 'teamId');
    const input = z.object({
      seasonKey: z.string().min(2).max(32),
      cycleType: z.enum(['RENOVATION', 'STAFFING', 'EQUIPMENT']),
    }).parse(req.body);
    const result = await purchaseFacilitySeasonCycle(req.user!.id, teamId, input.seasonKey, input.cycleType);
    res.status(201).json({ status: 'success', data: result, message: 'Seasonal facility cycle purchased' });
  }),
);

export const economyBalanceRouter = router;
