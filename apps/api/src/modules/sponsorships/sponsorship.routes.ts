import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { routeParam } from '../../utils/routeParams';
import {
  generateSponsorshipOffers,
  acceptSponsorshipOffer,
  cancelSponsorship,
  getTeamSponsorships,
} from './sponsorship.service';

const router = Router();

// GET /api/teams/:id/sponsorships — list all sponsorships for a team
router.get(
  '/:id/sponsorships',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const sponsorships = await getTeamSponsorships(teamId);
    res.json({ status: 'success', data: sponsorships });
  })
);

// POST /api/teams/:id/sponsorships/refresh — generate new offers
router.post(
  '/:id/sponsorships/refresh',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const result = await generateSponsorshipOffers(teamId);
    res.json({ status: 'success', data: result });
  })
);

// POST /api/teams/:id/sponsorships — accept an offer
router.post(
  '/:id/sponsorships',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const schema = z.object({
      sponsorName: z.string(),
      tier: z.string(),
      amountPerGame: z.number().int().positive(),
      amountPerSeason: z.number().int().positive(),
      bonusRules: z.record(z.any()).default({}),
    });
    const input = schema.parse(req.body);
    const teamId = routeParam(req.params.id, 'id');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    const sponsorship = await acceptSponsorshipOffer(teamId, input);
    res.status(201).json({ status: 'success', data: sponsorship });
  })
);

// DELETE /api/teams/:id/sponsorships/:sponsorshipId — cancel a sponsorship
router.delete(
  '/:id/sponsorships/:sponsorshipId',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    const teamId = routeParam(req.params.id, 'id');
    const sponsorshipId = routeParam(req.params.sponsorshipId, 'sponsorshipId');
    const userId = req.user!.id;

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: userId },
    });
    if (!team) {
      throw new AppError(403, 'You do not own this team');
    }

    await cancelSponsorship(teamId, sponsorshipId);
    res.json({ status: 'success', message: 'Sponsorship cancelled' });
  })
);

export const sponsorshipRouter = router;
