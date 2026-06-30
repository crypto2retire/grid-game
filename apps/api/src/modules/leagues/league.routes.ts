import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { Response } from 'express';

const router = Router();

// ─── GET /api/leagues — list all leagues user can see ───
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { visibility, tier, sportId } = req.query;

    const where: any = { status: 'ACTIVE' };
    if (visibility) where.visibility = visibility as string;
    if (tier) where.tier = tier as string;
    if (sportId) where.sportId = sportId as string;

    const leagues = await prisma.league.findMany({
      where,
      include: {
        island: true,
        creator: { select: { id: true, username: true, displayName: true } },
        memberships: { select: { id: true } },
      },
      orderBy: [{ isDefault: 'desc' as any }, { createdAt: 'desc' }],
    });

    // For each league, check if user can join
    const userTeam = await prisma.team.findFirst({
      where: { ownerId: userId, isAI: false },
      include: { teamPlayers: { include: { player: true } } },
    });

    const userTeamOvr = userTeam
      ? Math.round(userTeam.teamPlayers.reduce((s, tp) => s + tp.player.overall, 0) / userTeam.teamPlayers.length)
      : 0;

    const enriched = leagues.map((l) => ({
      ...l,
      _canJoin: l.visibility === 'PUBLIC' || l.creatorId === userId,
      _meetsRating: l.visibility === 'RATING_BASED' ? userTeamOvr >= (l.minTeamRating || 0) : true,
      _teamCount: l.memberships.length,
    }));

    res.json({ status: 'success', data: enriched });
  })
);

// ─── POST /api/leagues — create a new league (creates island too) ───
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const schema = z.object({
      name: z.string().min(1).max(60),
      sportId: z.string().default('american-football'),
      tier: z.string().default('STATE_COLLEGE'),
      visibility: z.enum(['PUBLIC', 'PRIVATE', 'RATING_BASED']).default('PUBLIC'),
      entryFee: z.number().int().min(0).default(0),
      maxTeams: z.number().int().min(4).max(32).default(12),
      minTeamRating: z.number().int().min(0).default(0),
      islandX: z.number().default(0),
      islandY: z.number().default(0),
      theme: z.string().default('grass'),
    });

    const input = schema.parse(req.body);
    const userId = req.user!.id;

    // Check wallet for league creation fee (progressive: 50k DYN for 1st, 100k for 2nd, etc.)
    const createdCount = await prisma.league.count({ where: { creatorId: userId } });
    const creationFee = 50000 * Math.pow(2, createdCount);

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new AppError(400, 'Wallet not found');
    if (wallet.dynTokens < creationFee) {
      throw new AppError(400, `Need ${creationFee.toLocaleString()} DYN to create a league. You have ${wallet.dynTokens.toLocaleString()}.`);
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Deduct fee
      await tx.wallet.update({
        where: { userId },
        data: { dynTokens: { decrement: creationFee } },
      });

      // Create island
      const island = await tx.island.create({
        data: {
          name: `${input.name} Island`,
          type: 'LEAGUE',
          x: input.islandX,
          y: input.islandY,
          theme: input.theme,
          color: getThemeColor(input.theme),
          maxTeams: input.maxTeams,
        },
      });

      // Create league
      const league = await tx.league.create({
        data: {
          sportId: input.sportId,
          name: input.name,
          tier: input.tier,
          creatorId: userId,
          islandId: island.id,
          visibility: input.visibility,
          entryFee: input.entryFee,
          maxTeams: input.maxTeams,
          minTeamRating: input.minTeamRating,
          status: 'ACTIVE',
        },
      });

      return { league, island, fee: creationFee };
    });

    res.status(201).json({
      status: 'success',
      data: result,
      message: `Created ${input.name} for ${creationFee.toLocaleString()} DYN`,
    });
  })
);

// ─── POST /api/leagues/:id/join — join a public league ───
router.post(
  '/:id/join',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const league = await prisma.league.findUnique({
      where: { id: req.params.id as string },
      include: { memberships: true, island: true },
    });
    if (!league) throw new AppError(404, 'League not found');
    if (league.status !== 'ACTIVE') throw new AppError(400, 'League is not active');
    if ((league as any).memberships.length >= (league as any).maxTeams) throw new AppError(400, 'League is full');
    if ((league as any).visibility === 'PRIVATE') throw new AppError(403, 'This league is invite-only');

    // Find user's team
    const team = await prisma.team.findFirst({
      where: { ownerId: userId, isAI: false },
      include: { teamPlayers: { include: { player: true } } },
    });
    if (!team) throw new AppError(400, 'You need a team to join a league');

    // Check rating requirement
    if ((league as any).visibility === 'RATING_BASED') {
      const avgOvr = team.teamPlayers.length > 0
        ? Math.round(team.teamPlayers.reduce((s, tp) => s + tp.player.overall, 0) / team.teamPlayers.length)
        : 0;
      if (avgOvr < (league as any).minTeamRating) {
        throw new AppError(400, `Your team average (${avgOvr}) is below the league minimum (${(league as any).minTeamRating})`);
      }
    }

    // Check entry fee
    if ((league as any).entryFee > 0) {
      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet || wallet.dynTokens < (league as any).entryFee) {
        throw new AppError(400, `Need ${(league as any).entryFee.toLocaleString()} DYN entry fee`);
      }
      await prisma.wallet.update({
        where: { userId },
        data: { dynTokens: { decrement: (league as any).entryFee } },
      });
    }

    // Check if already in league
    const existing = await prisma.teamLeagueMembership.findFirst({
      where: { teamId: team.id, leagueId: req.params.id as string },
    });
    if (existing) throw new AppError(400, 'Already in this league');

    const membership = await prisma.teamLeagueMembership.create({
      data: {
        teamId: team.id,
        leagueId: req.params.id as string,
        season: 'beta',
        status: 'ACTIVE',
      },
    });

    // Update island team count
    if ((league as any).islandId) {
      await prisma.island.update({
        where: { id: (league as any).islandId },
        data: { teamCount: { increment: 1 } },
      });
    }

    res.json({ status: 'success', data: membership });
  })
);

// ─── GET /api/leagues/:id/applications — list pending applications (owner only) ───
router.get(
  '/:id/applications',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const league = await prisma.league.findUnique({ where: { id: req.params.id as string } });
    if (!league) throw new AppError(404, 'League not found');
    if ((league as any).creatorId !== userId) throw new AppError(403, 'Only the league owner can view applications');

    const applications = await (prisma as any).leagueApplication.findMany({
      where: { leagueId: req.params.id as string, status: 'PENDING' },
      include: {
        team: { include: { owner: { select: { id: true, username: true, displayName: true } }, teamPlayers: { include: { player: true } } } },
        user: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: applications });
  })
);

// ─── POST /api/leagues/:id/applications/:appId/accept ───
router.post(
  '/:id/applications/:appId/accept',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: leagueId, appId } = req.params;
    const userId = req.user!.id;

    const league = await prisma.league.findUnique({ where: { id: leagueId as string } });
    if (!league) throw new AppError(404, 'League not found');
    if ((league as any).creatorId !== userId) throw new AppError(403, 'Only the league owner can accept applications');

    const application = await (prisma as any).leagueApplication.findUnique({
      where: { id: appId as string },
      include: { team: true },
    });
    if (!application) throw new AppError(404, 'Application not found');
    if (application.status !== 'PENDING') throw new AppError(400, 'Application already processed');

    const membership = await prisma.$transaction(async (tx: any) => {
      await tx.leagueApplication.update({
        where: { id: appId as string },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      return tx.teamLeagueMembership.create({
        data: {
          teamId: application.teamId,
          leagueId: leagueId as string,
          season: 'beta',
          status: 'ACTIVE',
        },
      });
    });

    res.json({ status: 'success', data: membership });
  })
);

function getThemeColor(theme: string): string {
  const colors: Record<string, string> = {
    grass: '#4ade80',
    desert: '#fbbf24',
    snow: '#e2e8f0',
    tropical: '#06b6d4',
    industrial: '#64748b',
    volcanic: '#ef4444',
    mystical: '#a855f7',
  };
  return colors[theme] || '#4ade80';
}

export { router as leagueRouter };
