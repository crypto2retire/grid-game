import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';

const router = Router();

// League tiers with min/max overall ratings
export const LEAGUE_TIER_CONFIG: Record<string, { minOverall: number; maxOverall: number; nextTierUnlock: string | null }> = {
  STATE_COLLEGE: { minOverall: 50, maxOverall: 69, nextTierUnlock: 'MID_COLLEGE' },
  MID_COLLEGE:   { minOverall: 60, maxOverall: 74, nextTierUnlock: 'TOP_COLLEGE' },
  TOP_COLLEGE:   { minOverall: 70, maxOverall: 79, nextTierUnlock: 'REGIONAL_PRO' },
  REGIONAL_PRO:  { minOverall: 75, maxOverall: 84, nextTierUnlock: 'PRO_ENTRY' },
  PRO_ENTRY:     { minOverall: 80, maxOverall: 89, nextTierUnlock: 'PRO_ELITE' },
  PRO_ELITE:     { minOverall: 85, maxOverall: 99, nextTierUnlock: null },
};

// Progressive pricing: basePrice * (2 ^ slotIndex)
export function calculateTeamSlotPrice(basePrice: number, teamCount: number): number {
  const slotIndex = Math.max(0, teamCount);
  return Math.floor(basePrice * Math.pow(2, slotIndex));
}

// In-game time: 1 real day = 1 in-game week
export interface GameTime {
  week: number;
  day: number; // 1-7 within the week
  season: number;
  year: number;
  display: string;
}

export function getGameTime(epochStart: Date): GameTime {
  const now = new Date();
  const msSinceEpoch = now.getTime() - epochStart.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  const totalDays = Math.floor(msSinceEpoch / msPerDay);
  const week = totalDays + 1; // Week 1 is the first day
  const day = (totalDays % 7) + 1;
  const season = Math.floor(totalDays / 7) + 1; // 1 week = 1 season (for now, could expand)
  const year = Math.floor(totalDays / 365) + 1;
  
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  return {
    week,
    day,
    season,
    year,
    display: `Year ${year}, Week ${week} — ${dayNames[day - 1]}`,
  };
}

// Check if a team can play today (1 match per real day per team)
export async function canTeamPlayToday(teamId: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const matchCount = await prisma.match.count({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      scheduledAt: { gte: today, lt: tomorrow },
      status: { not: 'CANCELLED' },
    },
  });
  
  return matchCount === 0;
}

// Validate roster against league tier restrictions
export function validateRosterForTier(
  players: { overall: number }[],
  tier: string
): { valid: boolean; violations: string[] } {
  const config = LEAGUE_TIER_CONFIG[tier];
  if (!config) return { valid: true, violations: [] };
  
  const violations: string[] = [];
  
  for (const player of players) {
    if (player.overall < config.minOverall) {
      violations.push(`Player rating ${player.overall} below minimum ${config.minOverall} for ${tier}`);
    }
    if (player.overall > config.maxOverall) {
      violations.push(`Player rating ${player.overall} above maximum ${config.maxOverall} for ${tier}`);
    }
  }
  
  return { valid: violations.length === 0, violations };
}

// GET /api/game-time — current in-game time
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    let epochStart = new Date('2026-01-01');
    try {
      const settings = await (prisma as any).gameSettings.findUnique({ where: { id: 'main' } });
      if (settings?.gameEpochStart) epochStart = settings.gameEpochStart;
    } catch (err: any) {
      if (err.code !== 'P2021') throw err; // Ignore missing table, use default epoch
    }
    const gameTime = getGameTime(epochStart);
    res.json({ status: 'success', data: gameTime });
  })
);

// GET /api/team-slot-pricing — check progressive pricing for user's next team
router.get(
  '/team-slot-pricing',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const teamCount = await prisma.team.count({ where: { ownerId: userId } });
    const catalog = await prisma.teamCatalog.findMany({ where: { active: true } });
    
    const pricing = catalog.map((entry) => ({
      catalogId: entry.id,
      tier: entry.tier,
      name: entry.name,
      basePrice: entry.gridPrice,
      slotPrice: calculateTeamSlotPrice(entry.gridPrice, teamCount),
      solPrice: entry.solPrice ? calculateTeamSlotPrice(entry.solPrice * 1000, teamCount) / 1000 : null,
      teamCount,
      slotIndex: teamCount,
    }));
    
    res.json({ status: 'success', data: pricing });
  })
);

// GET /api/league-tier-config — all league restrictions
router.get(
  '/league-tier-config',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ status: 'success', data: LEAGUE_TIER_CONFIG });
  })
);

// GET /api/teams/:id/roster-validation — validate a team's roster against league tier
router.get(
  '/teams/:id/roster-validation',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const teamId = req.params.id as string;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        teamPlayers: { include: { player: true } },
        leagueMemberships: { include: { league: true } },
      },
    });
    
    if (!team) throw new AppError(404, 'Team not found');
    
    const league = (team as any).leagueMemberships[0]?.league;
    if (!league) {
      res.json({ status: 'success', data: { valid: true, violations: [], tier: null } });
      return;
    }
    
    const players = (team as any).teamPlayers.map((tp: any) => tp.player);
    const validation = validateRosterForTier(players, league.tier);
    
    res.json({
      status: 'success',
      data: {
        ...validation,
        tier: league.tier,
        leagueName: league.name,
        minOverall: LEAGUE_TIER_CONFIG[league.tier]?.minOverall || null,
        maxOverall: LEAGUE_TIER_CONFIG[league.tier]?.maxOverall || null,
      },
    });
  })
);

// GET /api/teams/:id/can-play-today — check if team can schedule a match today
router.get(
  '/teams/:id/can-play-today',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const teamId = req.params.id as string;
    const canPlay = await canTeamPlayToday(teamId);
    res.json({ status: 'success', data: { canPlay } });
  })
);

export { router as gameTimeRouter };
