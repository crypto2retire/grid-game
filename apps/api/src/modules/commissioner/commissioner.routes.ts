import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest, requireRole } from '../../middleware/auth';
import { AppError, asyncHandler } from '../../middleware/errorHandler';
import {
  contributeToCommissionerCycle,
  getCommissionerOverview,
  purchaseCommissionerInventory,
  restockCommissionerInventory,
} from './commissioner.service';

const router = Router();

router.get(
  '/overview',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const overview = await getCommissionerOverview(req.user!.id);
    res.json({ status: 'success', data: overview });
  })
);

router.get(
  '/meters',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const overview = await getCommissionerOverview(req.user!.id);
    res.json({
      status: 'success',
      data: {
        cycle: overview.cycle,
        meters: overview.meters,
        buildingLoops: overview.buildingLoops,
        myStats: overview.myStats,
      },
    });
  })
);

router.post(
  '/contribute',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      amount: z.number().positive().max(1_000_000),
      currency: z.enum(['CASH', 'DYN', 'GRID', 'SOL']).default('DYN'),
    });
    const input = schema.parse(req.body);
    const result = await contributeToCommissionerCycle(req.user!.id, input);
    res.json({
      status: 'success',
      data: result,
      message: 'Commissioner funding contribution recorded',
    });
  })
);

router.post(
  '/inventory/:inventoryId/purchase',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({ quantity: z.number().int().positive().max(25).default(1) });
    const input = schema.parse(req.body ?? {});
    const inventoryId = Array.isArray(req.params.inventoryId) ? req.params.inventoryId[0] : req.params.inventoryId;
    if (!inventoryId) throw new AppError(400, 'inventoryId is required');
    const result = await purchaseCommissionerInventory(req.user!.id, inventoryId, input.quantity);
    res.json({
      status: 'success',
      data: result,
      message: 'Commissioner limited inventory purchased',
    });
  })
);

router.post(
  '/restock',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
      cycleId: z.string().uuid().optional(),
      additionalQuantity: z.number().int().positive().max(500).default(10),
    });
    const input = schema.parse(req.body ?? {});
    const result = await restockCommissionerInventory(input);
    res.json({ status: 'success', data: result, message: 'Commissioner inventory restocked' });
  })
);

export { router as commissionerRouter };
