import { prisma } from '../../config/database';
import { recordCurrencyLedger } from '../economy/ledger';
import { generatePlayerData } from '../players/player.generator';
import { processTreasuryInflow, processBurn } from '../treasury/treasury.service';

const footballPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S', 'K'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get all active team catalog entries (available for purchase from the game).
 * Optional: filter by tier, sort by price.
 */
export async function getTeamCatalog(filters?: { tier?: string; sportId?: string }) {
  const where: any = { active: true };
  if (filters?.tier) where.tier = filters.tier;
  if (filters?.sportId) where.sportId = filters.sportId;

  return prisma.teamCatalog.findMany({
    where,
    orderBy: [{ tier: 'asc' }, { solPrice: 'asc' }],
  });
}

/**
 * Get a single catalog entry by ID.
 */
export async function getCatalogEntry(id: string) {
  return prisma.teamCatalog.findUnique({ where: { id } });
}

/**
 * Check if a user can advance to the next tier.
 * Returns eligible tiers and requirements.
 */
export async function getTierEligibility(userId: string) {
  const teams = await prisma.team.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
  });

  if (teams.length === 0) {
    return { currentTier: null, eligibleTiers: ['STATE_COLLEGE'], canAdvance: false };
  }

  // Get highest tier owned
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

  // Check advancement requirements
  const nextCatalog = await prisma.teamCatalog.findFirst({
    where: { tier: nextTier, active: true },
  });

  if (!nextCatalog) {
    return { currentTier: highestTeam.tier, eligibleTiers: tierOrder.slice(0, currentTierIdx + 1), canAdvance: false };
  }

  const totalMatches = highestTeam.wins + highestTeam.draws + highestTeam.losses;
  const winPct = totalMatches > 0 ? highestTeam.wins / totalMatches : 0;
  const meetsWinPct = winPct >= nextCatalog.requiresWinPct;
  const meetsSeasons = highestTeam.seasonsPlayed >= nextCatalog.requiresSeasons;

  const eligibleTiers = meetsWinPct && meetsSeasons
    ? tierOrder.slice(0, currentTierIdx + 2)
    : tierOrder.slice(0, currentTierIdx + 1);

  return {
    currentTier: highestTeam.tier,
    nextTier,
    eligibleTiers,
    canAdvance: meetsWinPct && meetsSeasons,
    requirements: {
      seasonsPlayed: { current: highestTeam.seasonsPlayed, required: nextCatalog.requiresSeasons },
      winPct: { current: parseFloat(winPct.toFixed(2)), required: nextCatalog.requiresWinPct },
    },
  };
}

/**
 * Buy a team from the game catalog.
 * Creates a new team with pre-generated players based on the catalog template.
 */
export async function buyTeamFromCatalog(userId: string, catalogId: string, currency: 'GRID' | 'SOL') {
  const catalog = await prisma.teamCatalog.findUnique({ where: { id: catalogId, active: true } });
  if (!catalog) {
    throw new Error('Team catalog entry not found');
  }

  // Check supply limit
  if (catalog.maxSupply !== null && catalog.soldCount >= catalog.maxSupply) {
    throw new Error('This team tier is sold out');
  }

  // Check wallet
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const price = currency === 'GRID' ? catalog.gridPrice : Math.round(catalog.solPrice);
  if (currency === 'GRID' && wallet.gridTokens < price) {
    throw new Error(`Insufficient GRID. Need ${price.toLocaleString()} GRID`);
  }
  if (currency === 'SOL' && wallet.solBalance < price) {
    throw new Error(`Insufficient SOL. Need ${price.toLocaleString()} SOL`);
  }

  // Check eligibility
  const eligibility = await getTierEligibility(userId);
  if (!eligibility.eligibleTiers.includes(catalog.tier)) {
    throw new Error(`You are not eligible to purchase a ${catalog.tier} team. Current tier: ${eligibility.currentTier}`);
  }

  return prisma.$transaction(async (tx: any) => {
    // Deduct payment
    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: currency === 'GRID'
        ? { gridTokens: { decrement: price } }
        : { solBalance: { decrement: price } },
    });

    // Record ledger
    await recordCurrencyLedger(tx, {
      userId,
      currency,
      amount: -price,
      balanceAfter: currency === 'GRID' ? updatedWallet.gridTokens : Math.round(updatedWallet.solBalance),
      reason: 'TEAM_PURCHASE',
      sourceType: 'TEAM_CATALOG',
      sourceId: catalogId,
      metadata: { tier: catalog.tier, currency, catalogId },
    });

    // For GRID purchases: 50% to rewards pool, 50% burned
    if (currency === 'GRID') {
      await processTreasuryInflow(tx, 'GRID', Math.round(price * 0.5), 'TEAM_PURCHASE_GRID', catalogId);
      await processBurn(tx, 'GRID', Math.round(price * 0.5), 'TEAM_PURCHASE_GRID', catalogId);
    }
    // For SOL purchases: 100% to game operations (no treasury, no burn)
    // SOL goes to developer wallet / operations - handled externally

    // Create the team
    const team = await tx.team.create({
      data: {
        name: catalog.name,
        sportId: catalog.sportId,
        ownerId: userId,
        tier: catalog.tier,
        isFree: false,
        purchasePrice: price,
        purchaseCurrency: currency,
        catalogId: catalog.id,
        formation: '4-3-3',
        tactics: { formation: '4-3-3', sportId: catalog.sportId },
      },
    });

    // Create venue
    await tx.venue.create({
      data: {
        teamId: team.id,
        sportId: catalog.sportId,
        name: `${catalog.name} Stadium`,
        tier: catalog.stadiumTier,
        capacity: catalog.stadiumCapacity,
        ticketPrice: 15,
        condition: 80,
        prestige: catalog.tier === 'PRO_ELITE' ? 80 : catalog.tier === 'PRO_ENTRY' ? 60 : 40,
      },
    });

    // Create transportation
    await tx.transportationAsset.create({
      data: {
        teamId: team.id,
        tier: catalog.tier === 'PRO_ELITE' ? 'LUXURY' : catalog.tier === 'PRO_ENTRY' ? 'CHARTER' : 'BUS',
        name: catalog.tier === 'PRO_ELITE' ? 'Private Jet' : catalog.tier === 'PRO_ENTRY' ? 'Team Charter' : 'Team Bus',
        operatingCost: catalog.tier === 'PRO_ELITE' ? 5000 : catalog.tier === 'PRO_ENTRY' ? 2000 : 500,
        fatigueReduction: catalog.tier === 'PRO_ELITE' ? 30 : catalog.tier === 'PRO_ENTRY' ? 20 : 10,
        prestige: catalog.tier === 'PRO_ELITE' ? 50 : catalog.tier === 'PRO_ENTRY' ? 30 : 10,
      },
    });

    // Generate players with catalog-defined overall range
    const players = [];
    for (let i = 0; i < catalog.playerCount; i++) {
      const pos = footballPositions[i % footballPositions.length];
      const data = generatePlayerData({ sportId: catalog.sportId, position: pos });

      // Force stats into catalog's min/max range
      const targetOverall = randomInt(catalog.minOverall, catalog.maxOverall);
      const spread = targetOverall - 50;
      const adjusted = {
        ...data,
        pace: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))),
        shooting: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))),
        passing: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))),
        dribbling: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))),
        defending: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))),
        physical: Math.min(99, Math.max(30, 50 + spread + randomInt(-5, 5))),
      };
      adjusted.overall = Math.round((adjusted.pace + adjusted.shooting + adjusted.passing + adjusted.dribbling + adjusted.defending + adjusted.physical) / 6);
      adjusted.basePrice = adjusted.overall * 100;

      const player = await tx.player.create({
        data: {
          ...adjusted,
          attributes: {
            ...adjusted.attributes,
            legacy: { pace: adjusted.pace, shooting: adjusted.shooting, passing: adjusted.passing, dribbling: adjusted.dribbling, defending: adjusted.defending, physical: adjusted.physical, goalkeeping: 0 },
          },
        } as any,
      });
      players.push(player);

      await tx.teamPlayer.create({
        data: {
          teamId: team.id,
          playerId: player.id,
          isStarter: i < 11,
        },
      });
    }

    // Increment sold count
    await tx.teamCatalog.update({
      where: { id: catalog.id },
      data: { soldCount: { increment: 1 } },
    });

    // Mark user as paid if they bought a paid tier
    if (catalog.tier !== 'STATE_COLLEGE') {
      await tx.user.update({
        where: { id: userId },
        data: { hasPaidPurchase: true },
      });
    }

    return { team, players, wallet: updatedWallet, catalog };
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
