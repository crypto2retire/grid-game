import { prisma } from '../../config/database';
import { debitCurrency } from '../economy/currency.service';
import {
  LEAGUE_TIERS,
  type LeagueTier,
} from '../economy/teamEconomy.config';

// ─── Promotion Requirements ───

interface PromotionRequirement {
  minWins: number;
  minPoints: number;
  minVenueTierIndex: number;
  minTransportTierIndex: number;
  minTeamOverall: number;
  requiredCash: number;
}

const VENUE_TIER_ORDER = [
  'PARK_FIELD',
  'COMMUNITY_FIELD',
  'SMALL_STADIUM',
  'REGIONAL_STADIUM',
  'PRO_STADIUM',
] as const;

const TRANSPORT_TIER_ORDER = [
  'CARPOOL',
  'USED_BUS',
  'TEAM_BUS',
  'LUXURY_COACH',
  'CHARTER_FLIGHT',
  'TEAM_AIRCRAFT',
  'CUSTOM_JET',
] as const;

const PROMOTION_REQUIREMENTS: Record<LeagueTier, PromotionRequirement> = {
  LOCAL_REC: {
    minWins: 5,
    minPoints: 15,
    minVenueTierIndex: 1, // COMMUNITY_FIELD
    minTransportTierIndex: 1, // USED_BUS
    minTeamOverall: 55,
    requiredCash: 5000,
  },
  REGIONAL: {
    minWins: 10,
    minPoints: 30,
    minVenueTierIndex: 2, // SMALL_STADIUM
    minTransportTierIndex: 2, // TEAM_BUS
    minTeamOverall: 65,
    requiredCash: 25000,
  },
  SEMI_PRO: {
    minWins: 15,
    minPoints: 45,
    minVenueTierIndex: 3, // REGIONAL_STADIUM
    minTransportTierIndex: 4, // CHARTER_FLIGHT
    minTeamOverall: 75,
    requiredCash: 100000,
  },
  PRO: {
    minWins: 25,
    minPoints: 75,
    minVenueTierIndex: 4, // PRO_STADIUM
    minTransportTierIndex: 6, // CUSTOM_JET
    minTeamOverall: 85,
    requiredCash: 500000,
  },
};

function getTierIndex(tier: string, order: readonly string[]): number {
  return order.indexOf(tier);
}

function getNextLeagueTier(current: LeagueTier): LeagueTier | null {
  const idx = LEAGUE_TIERS.indexOf(current);
  if (idx === -1 || idx >= LEAGUE_TIERS.length - 1) return null;
  return LEAGUE_TIERS[idx + 1];
}

interface PromotionEligibilityResult {
  eligible: boolean;
  currentTier: LeagueTier;
  nextTier: LeagueTier | null;
  requirements: PromotionRequirement;
  checks: {
    wins: { met: boolean; value: number; required: number };
    points: { met: boolean; value: number; required: number };
    venue: { met: boolean; value: string; required: string };
    transport: { met: boolean; value: string; required: string };
    teamOverall: { met: boolean; value: number; required: number };
    cash: { met: boolean; value: number; required: number };
  };
  progress: number; // 0-100
}

/**
 * Check if a team is eligible for promotion to the next league tier.
 */
export async function checkPromotionEligibility(
  teamId: string
): Promise<PromotionEligibilityResult> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      venue: true,
      transportationAssets: true,
      teamPlayers: { include: { player: true } },
      leagueMemberships: { include: { league: true } },
      owner: { include: { wallet: true } },
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const activeMembership = team.leagueMemberships.find((m: any) => m.status === 'ACTIVE');
  const currentTier: LeagueTier = (activeMembership?.league?.tier as LeagueTier) || 'LOCAL_REC';
  const nextTier = getNextLeagueTier(currentTier);

  if (!nextTier) {
    return {
      eligible: false,
      currentTier,
      nextTier: null,
      requirements: PROMOTION_REQUIREMENTS[currentTier],
      checks: {
        wins: { met: true, value: team.wins, required: 0 },
        points: { met: true, value: team.points, required: 0 },
        venue: { met: true, value: team.venue?.tier || 'PARK_FIELD', required: 'PRO_STADIUM' },
        transport: { met: true, value: team.transportationAssets[0]?.tier || 'CARPOOL', required: 'CUSTOM_JET' },
        teamOverall: { met: true, value: 0, required: 0 },
        cash: { met: true, value: team.owner?.wallet?.cash || 0, required: 0 },
      },
      progress: 100,
    };
  }

  const req = PROMOTION_REQUIREMENTS[currentTier];
  const venueTierIndex = getTierIndex(team.venue?.tier || 'PARK_FIELD', VENUE_TIER_ORDER);
  const transportTierIndex = getTierIndex(
    team.transportationAssets[0]?.tier || 'CARPOOL',
    TRANSPORT_TIER_ORDER
  );

  // Calculate team overall average
  const players = team.teamPlayers.map((tp: any) => tp.player);
  const teamOverall =
    players.length > 0
      ? Math.round(players.reduce((sum: number, p: any) => sum + p.overall, 0) / players.length)
      : 0;

  const cash = team.owner?.wallet?.cash || 0;

  const winsCheck = { met: team.wins >= req.minWins, value: team.wins, required: req.minWins };
  const pointsCheck = { met: team.points >= req.minPoints, value: team.points, required: req.minPoints };
  const venueCheck = {
    met: venueTierIndex >= req.minVenueTierIndex,
    value: team.venue?.tier || 'PARK_FIELD',
    required: VENUE_TIER_ORDER[req.minVenueTierIndex],
  };
  const transportCheck = {
    met: transportTierIndex >= req.minTransportTierIndex,
    value: team.transportationAssets[0]?.tier || 'CARPOOL',
    required: TRANSPORT_TIER_ORDER[req.minTransportTierIndex],
  };
  const overallCheck = {
    met: teamOverall >= req.minTeamOverall,
    value: teamOverall,
    required: req.minTeamOverall,
  };
  const cashCheck = {
    met: cash >= req.requiredCash,
    value: cash,
    required: req.requiredCash,
  };

  const allMet =
    winsCheck.met &&
    pointsCheck.met &&
    venueCheck.met &&
    transportCheck.met &&
    overallCheck.met &&
    cashCheck.met;

  // Calculate progress percentage
  const checks = [winsCheck, pointsCheck, venueCheck, transportCheck, overallCheck, cashCheck];
  const metCount = checks.filter((c) => c.met).length;
  const progress = Math.round((metCount / checks.length) * 100);

  return {
    eligible: allMet,
    currentTier,
    nextTier,
    requirements: req,
    checks: {
      wins: winsCheck,
      points: pointsCheck,
      venue: venueCheck,
      transport: transportCheck,
      teamOverall: overallCheck,
      cash: cashCheck,
    },
    progress,
  };
}

/**
 * Promote a team to the next league tier.
 * Deducts the required cash and moves the team to the next league.
 */
export async function promoteTeam(teamId: string) {
  const eligibility = await checkPromotionEligibility(teamId);

  if (!eligibility.eligible || !eligibility.nextTier) {
    throw new Error('Team is not eligible for promotion');
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      leagueMemberships: { include: { league: true } },
      owner: { include: { wallet: true } },
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const req = PROMOTION_REQUIREMENTS[eligibility.currentTier];

  // Verify cash again
  const cash = team.owner?.wallet?.cash || 0;
  if (cash < req.requiredCash) {
    throw new Error('Insufficient cash for promotion');
  }

  // Find or create the next tier league
  const nextLeagueId = `${eligibility.nextTier.toLowerCase().replace(/_/g, '-')}-football`;
  const nextLeague = await prisma.league.upsert({
    where: { id: nextLeagueId },
    update: {},
    create: {
      id: nextLeagueId,
      sportId: team.sportId,
      name: `${eligibility.nextTier.replace(/_/g, ' ')} Football League`,
      tier: eligibility.nextTier,
      level: LEAGUE_TIERS.indexOf(eligibility.nextTier) + 1,
    },
  });

  return prisma.$transaction(async (tx: any) => {
    // Deduct promotion fee
    const { wallet: walletAfter } = await debitCurrency(tx, {
      userId: team.ownerId,
      currency: 'CASH',
      amount: req.requiredCash,
      reason: 'LEAGUE_PROMOTION_FEE',
      sourceType: 'TEAM',
      sourceId: teamId,
      metadata: { fromTier: eligibility.currentTier, toTier: eligibility.nextTier },
    });

    // Deactivate current league membership
    const activeMembership = team.leagueMemberships.find((m: any) => m.status === 'ACTIVE');
    if (activeMembership) {
      await tx.teamLeagueMembership.update({
        where: { id: activeMembership.id },
        data: { status: 'COMPLETED' },
      });
    }

    // Create new league membership
    await tx.teamLeagueMembership.create({
      data: {
        teamId,
        leagueId: nextLeague.id,
        season: 'beta',
        status: 'ACTIVE',
      },
    });

    return {
      teamId,
      previousTier: eligibility.currentTier,
      newTier: eligibility.nextTier,
      feePaid: req.requiredCash,
      remainingCash: walletAfter.cash,
    };
  });
}
