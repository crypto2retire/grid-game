import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';

const router = Router();

// GET /api/equipment/types — list all equipment types
router.get(
  '/types',
  authMiddleware,
  asyncHandler(async (_req, res) => {
    const types = await prisma.equipmentType.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { tier: 'asc' }],
    });
    res.json({ status: 'success', data: types });
  })
);

// GET /api/equipment/team/:teamId — equipment owned by a team
router.get(
  '/team/:teamId',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const teamId = routeParam(req.params.teamId, 'teamId');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const equipment = await prisma.teamEquipment.findMany({
      where: { teamId },
      include: { equipmentType: true },
      orderBy: { purchasedAt: 'desc' },
    });

    res.json({ status: 'success', data: equipment });
  })
);

// POST /api/equipment/purchase — buy equipment for a team
router.post(
  '/purchase',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      teamId: z.string().uuid(),
      equipmentTypeId: z.string(),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: input.teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const equipmentType = await prisma.equipmentType.findUnique({
      where: { id: input.equipmentTypeId, active: true },
    });
    if (!equipmentType) {
      throw new AppError(404, 'Equipment type not found');
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    if (wallet.gridTokens < equipmentType.baseCostGrid) {
      throw new AppError(400, `Insufficient GRID. Need ${equipmentType.baseCostGrid.toLocaleString()} GRID`);
    }
    if (wallet.cash < equipmentType.baseCostCash) {
      throw new AppError(400, `Insufficient CASH. Need ${equipmentType.baseCostCash.toLocaleString()} CASH`);
    }

    // Check if team already has this equipment
    const existing = await prisma.teamEquipment.findFirst({
      where: { teamId: input.teamId, equipmentTypeId: input.equipmentTypeId },
    });

    if (existing) {
      throw new AppError(409, 'Team already owns this equipment');
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: {
          gridTokens: { decrement: equipmentType.baseCostGrid },
          cash: { decrement: equipmentType.baseCostCash },
        },
      });

      await tx.currencyLedger.create({
        data: {
          userId,
          currency: 'GRID',
          amount: -equipmentType.baseCostGrid,
          balanceAfter: updatedWallet.gridTokens,
          reason: 'EQUIPMENT_PURCHASE',
          sourceType: 'EQUIPMENT',
          sourceId: input.equipmentTypeId,
          metadata: { teamId: input.teamId, equipmentName: equipmentType.name },
        },
      });

      await tx.currencyLedger.create({
        data: {
          userId,
          currency: 'CASH',
          amount: -equipmentType.baseCostCash,
          balanceAfter: updatedWallet.cash,
          reason: 'EQUIPMENT_PURCHASE',
          sourceType: 'EQUIPMENT',
          sourceId: input.equipmentTypeId,
          metadata: { teamId: input.teamId, equipmentName: equipmentType.name },
        },
      });

      const teamEquipment = await tx.teamEquipment.create({
        data: {
          teamId: input.teamId,
          equipmentTypeId: input.equipmentTypeId,
          level: 1,
          activeEffects: equipmentType.effects,
        },
      });

      return { teamEquipment, wallet: updatedWallet };
    });

    res.status(201).json({
      status: 'success',
      data: result,
      message: `Purchased ${equipmentType.name}`,
    });
  })
);

// POST /api/equipment/equip — equip an item to a player
router.post(
  '/equip',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      playerItemId: z.string().uuid(),
      playerId: z.string().uuid(),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    // Verify ownership
    const playerItem = await prisma.playerItem.findFirst({
      where: {
        id: input.playerItemId,
        playerId: input.playerId,
        player: { teamPlayers: { some: { team: { ownerId: userId } } } },
      },
      include: { item: true },
    });
    if (!playerItem) {
      throw new AppError(403, 'You do not own this item');
    }

    // Unequip any existing item in the same slot for this player
    await prisma.playerItem.updateMany({
      where: {
        playerId: input.playerId,
        item: { slot: playerItem.item.slot },
        equipped: true,
      },
      data: { equipped: false },
    });

    // Equip the new item
    const updated = await prisma.playerItem.update({
      where: { id: input.playerItemId },
      data: { equipped: true },
      include: { item: true },
    });

    res.json({ status: 'success', data: updated });
  })
);

// POST /api/equipment/unequip — unequip an item
router.post(
  '/unequip',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      playerItemId: z.string().uuid(),
    });
    const input = schema.parse(req.body);
    const userId = req.user!.id;

    const playerItem = await prisma.playerItem.findFirst({
      where: {
        id: input.playerItemId,
        player: { teamPlayers: { some: { team: { ownerId: userId } } } },
      },
    });
    if (!playerItem) {
      throw new AppError(403, 'You do not own this item');
    }

    const updated = await prisma.playerItem.update({
      where: { id: input.playerItemId },
      data: { equipped: false },
      include: { item: true },
    });

    res.json({ status: 'success', data: updated });
  })
);

export const equipmentRouter = router;
