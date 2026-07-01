import { prisma } from '../../config/database';
import { debitCurrency } from '../economy/currency.service';
import { processTreasuryInflow, processBurn } from '../treasury/treasury.service';
import { calculateTeamSlotPrice } from '../game-time/game-time.routes';

const AI_OWNER_ID = 'ai-system-owner-001';

const tierRequirements: Record<string, { seasons: number; winPct: number }> = {
  STATE_COLLEGE: { seasons: 0, winPct: 0 },
  MID_COLLEGE: { seasons: 1, winPct: 0.4 },
  TOP_COLLEGE: { seasons: 2, winPct: 0.5 },
  REGIONAL_PRO: { seasons: 3, winPct: 0.55 },
  PRO_ENTRY: { seasons: 4, winPct: 0.6 },
  PRO_ELITE: { seasons: 5, winPct: 0.65 },
};

/**
 * Get all available AI teams (actual teams with rosters, not templates).
 */
export async function getTeamCatalog(filters?: { tier?: string; sportId?: string }) {
  const where: any = { isAI: true, ownerId: AI_OWNER_ID };
  if (filters?.tier) where.tier = filters.tier;
  if (filters?.sportId) where.sportId = filters.sportId;

  const teams = await prisma.team.findMany({
    where,
    include: {
      teamPlayers: { include: { player: true } },
      venue: true,
      transportationAssets: true,
    },
    orderBy: [{ tier: 'asc' }, { createdAt: 'desc' }],
  });

  return teams.map(team => {
    const avgOverall = team.teamPlayers.length > 0
      ? Math.round(team.teamPlayers.reduce((sum, tp) => sum + tp.player.overall, 0) / team.teamPlayers.length)
      : 0;
    const minOverall = team.teamPlayers.length > 0
      ? Math.min(...team.teamPlayers.map(tp => tp.player.overall))
      : 0;
    const maxOverall = team.teamPlayers.length > 0
      ? Math.max(...team.teamPlayers.map(tp => tp.player.overall))
      : 0;

    return {
      id: team.id,
      name: team.name,
      description: `${team.tier.replace(/_/g, ' ')} team with ${team.teamPlayers.length} players`,
      tier: team.tier,
      gridPrice: team.purchasePrice || 0,
      solPrice: 0,
      playerCount: team.teamPlayers.length,
      minOverall,
      maxOverall,
      avgOverall,
      stadiumTier: team.venue?.tier || 'PARK_FIELD',
      stadiumCapacity: team.venue?.capacity || 5000,
      requiresSeasons: 0,
      requiresWinPct: 0,
      soldCount: 0,
      maxSupply: null,
      wins: team.wins,
      losses: team.losses,
      draws: team.draws,
      points: team.points,
      roster: team.teamPlayers.map(tp => tp.player),
      venue: team.venue,
      transport: team.transportationAssets?.[0],
    };
  });
}

/**
 * Get a single available AI team by ID.
 */
export async function getCatalogEntry(id: string) {
  return prisma.team.findFirst({
    where: { id, isAI: true, ownerId: AI_OWNER_ID },
    include: {
      teamPlayers: { include: { player: true } },
      venue: true,
      transportationAssets: true,
    },
  });
}

/**
 * Check if a user can advance to the next tier.
 */
export async function getTierEligibility(userId: string) {
  const teams = await prisma.team.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
  });

  if (teams.length === 0) {
    return { currentTier: null, eligibleTiers: ['STATE_COLLEGE'], canAdvance: false };
  }

  const tierOrder = ['STATE_COLLEGE', 'MID_COLLEGE', 'TOP_COLLEGE', 'REGIONAL_PRO', 'PRO_ENTRY', 'PRO_ELITE'];
  const highestTeam = teams.reduce((highest, team) => {
    const teamIdx = tierOrder.indexOf(team.tier);
    const highestIdx = tierOrder.indexOf(highest.tier);
    return teamIdx > highestIdx ? team : highest;
  }, teams[0]);

  const currentTierIdx = tierOrder.indexOf(highestTeam.tier);
  const nextTier = tierOrder[currentTierIdx + 1];

  if (!nextTier) {
    return { currentTier: highestTeam.tier, eligibleTiers: tierOrder, canAdvance: false, message: 'Already at highest tier' };
  }

  const totalMatches = highestTeam.wins + highestTeam.draws + highestTeam.losses;
  const winPct = totalMatches > 0 ? highestTeam.wins / totalMatches : 0;

  const nextTierReq = tierRequirements[nextTier] || { seasons: 0, winPct: 0 };
  const meetsWinPct = winPct >= nextTierReq.winPct;
  const meetsSeasons = highestTeam.seasonsPlayed >= nextTierReq.seasons;

  const eligibleTiers = meetsWinPct && meetsSeasons
    ? tierOrder.slice(0, currentTierIdx + 2)
    : tierOrder.slice(0, currentTierIdx + 1);

  return {
    currentTier: highestTeam.tier,
    nextTier,
    eligibleTiers,
    canAdvance: meetsWinPct && meetsSeasons,
    requirements: {
      seasonsPlayed: { current: highestTeam.seasonsPlayed, required: nextTierReq.seasons },
      winPct: { current: parseFloat(winPct.toFixed(2)), required: nextTierReq.winPct },
    },
  };
}

/**
 * Buy an AI team: transfer ownership to the buyer.
 * Progressive pricing: each additional team costs 2x the base price.
 */
export async function buyTeamFromCatalog(userId: string, teamId: string, currency: 'DYN' | 'SOL') {
  const team = await prisma.team.findFirst({
    where: { id: teamId, isAI: true, ownerId: AI_OWNER_ID },
    include: { venue: true },
  });

  if (!team) {
    throw new Error('Team not available for purchase');
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  // Apply progressive pricing based on current team count
  const teamCount = await prisma.team.count({ where: { ownerId: userId } });
  const basePrice = team.purchasePrice || 0;
  const price = calculateTeamSlotPrice(basePrice, teamCount);
  
  if (currency === 'DYN' && wallet.dynTokens < price) {
    throw new Error(`Insufficient DYN. Need ${price.toLocaleString()} DYN (slot ${teamCount + 1}, progressive pricing applied)`);
  }
  if (currency === 'SOL' && wallet.solBalance < price) {
    throw new Error(`Insufficient SOL. Need ${price.toLocaleString()} SOL (slot ${teamCount + 1}, progressive pricing applied)`);
  }

  // Check eligibility
  const eligibility = await getTierEligibility(userId);
  if (!eligibility.eligibleTiers.includes(team.tier)) {
    throw new Error(`You are not eligible to purchase a ${team.tier} team. Current tier: ${eligibility.currentTier}`);
  }

  return prisma.$transaction(async (tx: any) => {
    // Deduct payment
    const { wallet: updatedWallet } = await debitCurrency(tx, {
      userId,
      currency,
      amount: price,
      reason: 'TEAM_PURCHASE',
      sourceType: 'TEAM_CATALOG',
      sourceId: teamId,
      metadata: { tier: team.tier, currency, teamId, slotIndex: teamCount, basePrice, progressivePrice: price },
    });

    // For DYN purchases: 50% to rewards pool, 50% burned
    if (currency === 'DYN') {
      await processTreasuryInflow(tx, 'DYN', Math.round(price * 0.5), 'TEAM_PURCHASE_DYN', teamId);
      await processBurn(tx, 'DYN', Math.round(price * 0.5), 'TEAM_PURCHASE_DYN', teamId);
    }

    // Transfer ownership
    await tx.team.update({
      where: { id: teamId },
      data: {
        ownerId: userId,
        isAI: false,
        purchasedAt: new Date(),
        purchaseCurrency: currency,
      },
    });

    // Mark user as paid if not free
    if (team.tier !== 'STATE_COLLEGE') {
      await tx.user.update({
        where: { id: userId },
        data: { hasPaidPurchase: true },
      });
    }

    return { team: { ...team, ownerId: userId }, wallet: updatedWallet, catalog: { name: team.name, tier: team.tier } };
  });
}

/**
 * Get all teams owned by a user with their tier info.
 */
export async function getUserTeamsWithTier(userId: string) {
  return prisma.team.findMany({
    where: { ownerId: userId },
    include: {
      teamPlayers: { include: { player: true } },
      venue: true,
      leagueMemberships: { include: { league: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single team with full details including roster.
 */
export async function getTeamWithRoster(teamId: string) {
  return prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: { select: { id: true, username: true, displayName: true } },
      teamPlayers: { include: { player: true }, orderBy: { player: { position: 'asc' } } },
      venue: true,
      transportationAssets: true,
      leagueMemberships: { include: { league: true } },
      teamEquipments: { include: { equipmentType: true } },
    },
  });
}
