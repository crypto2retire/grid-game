import { prisma } from '../../config/database';
import { recordCurrencyLedger } from './ledger';
import { logger } from '../../config/logger';

// ─── Stadium / Venue Maintenance ───

const BASE_VENUE_MAINTENANCE: Record<string, number> = {
  PARK_FIELD: 250,
  COMMUNITY_FIELD: 500,
  SMALL_STADIUM: 1000,
  REGIONAL_STADIUM: 2500,
  PRO_STADIUM: 5000,
};

const STADIUM_REPAIR_COSTS: Record<string, { min: number; max: number }> = {
  PARK_FIELD: { min: 500, max: 2000 },
  COMMUNITY_FIELD: { min: 1000, max: 4000 },
  SMALL_STADIUM: { min: 2000, max: 8000 },
  REGIONAL_STADIUM: { min: 5000, max: 20000 },
  PRO_STADIUM: { min: 10000, max: 50000 },
};

function stadiumRepairChance(condition: number): number {
  if (condition < 30) return 0.25;  // 25% chance per week — crumbling
  if (condition < 50) return 0.10;  // 10% — worn
  if (condition < 70) return 0.03;  // 3% — aging
  return 0.01;  // 1% — well-maintained
}

function rollStadiumRepair(tier: string, condition: number): { needed: boolean; cost: number } {
  const chance = stadiumRepairChance(condition);
  if (Math.random() > chance) return { needed: false, cost: 0 };
  const range = STADIUM_REPAIR_COSTS[tier] || { min: 500, max: 2000 };
  const cost = range.min + Math.floor(Math.random() * (range.max - range.min));
  return { needed: true, cost };
}

// ─── Transport Maintenance ───

const BASE_TRANSPORT_MAINTENANCE: Record<string, number> = {
  CARPOOL: 100,
  USED_BUS: 200,
  TEAM_BUS: 400,
  LUXURY_COACH: 800,
  CHARTER_FLIGHT: 2000,
  TEAM_AIRCRAFT: 5000,
  CUSTOM_JET: 10000,
};

const TRANSPORT_REPAIR_MULTIPLIER: Record<string, number> = {
  CARPOOL: 3,
  USED_BUS: 2.5,
  TEAM_BUS: 2.5,
  LUXURY_COACH: 3,
  CHARTER_FLIGHT: 4,
  TEAM_AIRCRAFT: 4,
  CUSTOM_JET: 5,
};

function transportBreakdownChance(tier: string): number {
  if (tier === 'CARPOOL') return 0.12;       // 12% per week — beaters
  if (tier === 'USED_BUS') return 0.08;       // 8%
  if (tier === 'TEAM_BUS') return 0.04;       // 4%
  if (tier === 'LUXURY_COACH') return 0.02;   // 2%
  if (tier === 'CHARTER_FLIGHT') return 0.015; // 1.5%
  return 0.01;  // 1% — premium
}

function rollTransportBreakdown(tier: string): { needed: boolean; cost: number; description: string } {
  const chance = transportBreakdownChance(tier);
  if (Math.random() > chance) return { needed: false, cost: 0, description: '' };
  const baseMaintenance = BASE_TRANSPORT_MAINTENANCE[tier] || 100;
  const multiplier = TRANSPORT_REPAIR_MULTIPLIER[tier] || 2;
  const cost = Math.round(baseMaintenance * multiplier * (0.5 + Math.random()));
  const breakdowns = [
    'Engine trouble', 'Transmission failure', 'Brake replacement', 'Suspension overhaul',
    'Tire blowout', 'AC system failure', 'Electrical issues', 'Fuel system repair',
  ];
  const description = breakdowns[Math.floor(Math.random() * breakdowns.length)];
  return { needed: true, cost, description };
}

// ─── Post-Match Stadium Wear ───

const STADIUM_WEAR_PER_GAME: Record<string, number> = {
  PARK_FIELD: 3,
  COMMUNITY_FIELD: 2,
  SMALL_STADIUM: 1.5,
  REGIONAL_STADIUM: 1,
  PRO_STADIUM: 0.5,
};

export function calculateStadiumWear(venueTier: string, attendance: number, capacity: number): number {
  const base = STADIUM_WEAR_PER_GAME[venueTier] || 2;
  const crowdFactor = capacity > 0 ? attendance / capacity : 0.5;
  return Math.round(base * (1 + crowdFactor));
}

// ─── Main Weekly Processing ───

export interface MaintenanceResult {
  teamId: string;
  teamName: string;
  ownerId: string;
  regularCosts: { type: string; amount: number; description?: string }[];
  repairs: { type: string; amount: number; description: string }[];
  totalRegular: number;
  totalRepairs: number;
  grandTotal: number;
  venueConditionChange: number;
  paid: boolean;
}

export async function processWeeklyMaintenance(): Promise<{
  processedTeams: number;
  totalRegularCosts: number;
  totalRepairCosts: number;
  results: MaintenanceResult[];
}> {
  const teams = await prisma.team.findMany({
    where: { isAI: false },
    include: {
      venue: true,
      transportationAssets: true,
    },
  }) as any[];

  let totalRegularCosts = 0;
  let totalRepairCosts = 0;
  const results: MaintenanceResult[] = [];

  for (const team of teams) {
    if (!team.ownerId) continue;

    const regularCosts: { type: string; amount: number; description?: string }[] = [];
    const repairs: { type: string; amount: number; description: string }[] = [];

    // 1. Venue maintenance
    if (team.venue) {
      const venueTier = team.venue.tier || 'PARK_FIELD';
      const baseMaintenance = BASE_VENUE_MAINTENANCE[venueTier] || 250;
      regularCosts.push({ type: 'VENUE_MAINTENANCE', amount: baseMaintenance, description: `${venueTier} upkeep` });

      // Random major repair
      const repair = rollStadiumRepair(venueTier, team.venue.condition || 50);
      if (repair.needed) {
        repairs.push({ type: 'STADIUM_REPAIR', amount: repair.cost, description: `${venueTier} structural repair` });
      }
    }

    // 2. Transport maintenance
    for (const transport of team.transportationAssets || []) {
      const tier = transport.tier || 'CARPOOL';
      const baseMaint = BASE_TRANSPORT_MAINTENANCE[tier] || 100;
      regularCosts.push({ type: 'TRANSPORT_MAINTENANCE', amount: baseMaint, description: transport.name || tier });

      // Random breakdown
      const breakdown = rollTransportBreakdown(tier);
      if (breakdown.needed) {
        repairs.push({ type: 'TRANSPORT_REPAIR', amount: breakdown.cost, description: `${transport.name || tier}: ${breakdown.description}` });
      }
    }

    // 3. Player wages
    const playerCount = await prisma.teamPlayer.count({ where: { teamId: team.id } });
    const wageMap: Record<string, number> = {
      STATE_COLLEGE: 50, MID_COLLEGE: 100, TOP_COLLEGE: 200,
      REGIONAL_PRO: 500, PRO_ENTRY: 1000, PRO_ELITE: 2500,
    };
    const wagePerPlayer = wageMap[team.tier] || 50;
    const totalWages = playerCount * wagePerPlayer;
    regularCosts.push({ type: 'PLAYER_WAGES', amount: totalWages, description: `${playerCount} players × ${wagePerPlayer} CASH` });

    const totalRegular = regularCosts.reduce((s, c) => s + c.amount, 0);
    const totalRepairs = repairs.reduce((s, r) => s + r.amount, 0);
    const grandTotal = totalRegular + totalRepairs;

    // Process payment
    totalRegularCosts += totalRegular;
    totalRepairCosts += totalRepairs;

    const ownerWallet = await prisma.wallet.findUnique({ where: { userId: team.ownerId } });
    const canAfford = ownerWallet ? ownerWallet.cash >= grandTotal : false;

    await prisma.$transaction(async (tx: any) => {
      if (canAfford) {
        const walletAfter = await tx.wallet.update({
          where: { userId: team.ownerId },
          data: { cash: { decrement: grandTotal } },
        });
        await recordCurrencyLedger(tx, {
          userId: team.ownerId,
          currency: 'CASH',
          amount: -grandTotal,
          balanceAfter: walletAfter.cash,
          reason: 'WEEKLY_MAINTENANCE',
          sourceType: 'MAINTENANCE',
          sourceId: team.id,
          metadata: { regularCosts: totalRegular, repairCosts: totalRepairs, breakdown: [...regularCosts, ...repairs] },
        });
      } else if (ownerWallet) {
        // Can't afford — deduct what they have
        await tx.wallet.update({
          where: { userId: team.ownerId },
          data: { cash: 0 },
        });
        await recordCurrencyLedger(tx, {
          userId: team.ownerId,
          currency: 'CASH',
          amount: -(ownerWallet.cash),
          balanceAfter: 0,
          reason: 'WEEKLY_MAINTENANCE_PARTIAL',
          sourceType: 'MAINTENANCE',
          sourceId: team.id,
          metadata: { owed: grandTotal, paid: ownerWallet.cash, shortfall: grandTotal - ownerWallet.cash },
        });
      }

      // Apply stadium wear from the week
      if (team.venue) {
        const newCondition = Math.max(0, (team.venue.condition || 50) - 2); // -2 condition per week
        await tx.venue.update({
          where: { id: team.venue.id },
          data: { condition: newCondition },
        });
      }
    });

    results.push({
      teamId: team.id,
      teamName: team.name,
      ownerId: team.ownerId,
      regularCosts,
      repairs,
      totalRegular,
      totalRepairs,
      grandTotal,
      venueConditionChange: -2,
      paid: canAfford,
    });
  }

  if (totalRepairCosts > 0) {
    logger.info(`Weekly maintenance: ${teams.length} teams, ${totalRegularCosts.toLocaleString()} regular + ${totalRepairCosts.toLocaleString()} repairs`);
  }

  return { processedTeams: results.length, totalRegularCosts, totalRepairCosts, results };
}

/**
 * Apply stadium condition degradation after a match is played.
 * Called from post-match flow; deducts condition points based on attendance.
 */
export async function applyPostMatchStadiumWear(
  tx: any,
  venueId: string,
  attendance: number,
  capacity: number,
): Promise<number> {
  const venue = await tx.venue.findUnique({ where: { id: venueId } });
  if (!venue) return 0;

  const wear = calculateStadiumWear(venue.tier, attendance, capacity);
  const newCondition = Math.max(0, venue.condition - wear);
  await tx.venue.update({
    where: { id: venueId },
    data: { condition: newCondition },
  });
  return wear;
}
