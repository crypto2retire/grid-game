import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { debitCurrency, processCurrencySink } from '../economy/currency.service';

const SPECIALIZATION_PATHS: Record<string, Record<string, { cash: number; dyn: number; maintenanceCash: number; maintenanceDyn: number; effects: Record<string, number> }>> = {
  STADIUM: {
    REVENUE: { cash: 15000, dyn: 250, maintenanceCash: 750, maintenanceDyn: 10, effects: { ticketRevenuePct: 8, sponsorValuePct: 5 } },
    FAN_EXPERIENCE: { cash: 12000, dyn: 200, maintenanceCash: 600, maintenanceDyn: 8, effects: { attendancePct: 10, prestige: 4 } },
    PERFORMANCE: { cash: 18000, dyn: 300, maintenanceCash: 900, maintenanceDyn: 12, effects: { homeAdvantagePct: 4, recoveryPct: 5 } },
  },
  TRAINING: {
    DEVELOPMENT: { cash: 10000, dyn: 180, maintenanceCash: 500, maintenanceDyn: 8, effects: { trainingProgressPct: 10, fatigueCostPct: -5 } },
    POSITION_LAB: { cash: 13000, dyn: 220, maintenanceCash: 650, maintenanceDyn: 9, effects: { positionFitPct: 15, trainingProgressPct: 6 } },
    RECOVERY: { cash: 11000, dyn: 190, maintenanceCash: 550, maintenanceDyn: 8, effects: { recoveryPct: 12, injuryRiskPct: -5 } },
  },
  MARKET: {
    SELLER_HUB: { cash: 8000, dyn: 140, maintenanceCash: 400, maintenanceDyn: 6, effects: { listingSlots: 2, sellerXpPct: 10 } },
    SCOUTING: { cash: 12000, dyn: 200, maintenanceCash: 600, maintenanceDyn: 8, effects: { marketInsightPct: 12, scoutingPct: 8 } },
    RETAIL: { cash: 9000, dyn: 160, maintenanceCash: 450, maintenanceDyn: 7, effects: { equipmentDiscountPct: 5, merchRevenuePct: 5 } },
  },
  MEDICAL: {
    PREVENTION: { cash: 10000, dyn: 170, maintenanceCash: 500, maintenanceDyn: 7, effects: { injuryRiskPct: -10, recoveryPct: 4 } },
    REHAB: { cash: 12500, dyn: 210, maintenanceCash: 625, maintenanceDyn: 9, effects: { recoveryPct: 15, treatmentCostPct: -5 } },
    SPORTS_SCIENCE: { cash: 15000, dyn: 260, maintenanceCash: 750, maintenanceDyn: 10, effects: { fatiguePct: -8, trainingProgressPct: 5 } },
  },
};

const CYCLE_COSTS: Record<string, { cash: number; dyn: number; effects: Record<string, number> }> = {
  RENOVATION: { cash: 9000, dyn: 90, effects: { condition: 12, prestige: 2 } },
  STAFFING: { cash: 6500, dyn: 70, effects: { operatingEfficiencyPct: 6, recoveryPct: 4 } },
  EQUIPMENT: { cash: 8000, dyn: 85, effects: { trainingProgressPct: 5, equipmentWearPct: -8 } },
};

function weekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export function sellerBenefits(dynHeld: number, reputationLevel: number) {
  const dynTier = dynHeld >= 2500 ? 3 : dynHeld >= 500 ? 2 : dynHeld >= 100 ? 1 : 0;
  const baseSlots = 3;
  const reputationSlots = Math.min(4, Math.floor(Math.max(0, reputationLevel - 1) / 3));
  const feeRebatePct = dynTier === 3 ? 2.5 : dynTier === 2 ? 1.5 : dynTier === 1 ? 0.75 : 0;
  return {
    dynTier,
    activeListingLimit: baseSlots + reputationSlots + dynTier,
    feeRebatePct,
    nextDynThreshold: dynTier === 0 ? 100 : dynTier === 1 ? 500 : dynTier === 2 ? 2500 : null,
    fasterSettlement: dynTier >= 2,
  };
}

export async function getSellerDashboard(userId: string, now = new Date()) {
  const currentWeek = weekKey(now);
  const [wallet, profileRows, objectiveRows] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId }, select: { dynTokens: true } }),
    prisma.$queryRaw<Array<any>>(Prisma.sql`SELECT * FROM "SellerProfile" WHERE "userId" = ${userId}`),
    prisma.$queryRaw<Array<any>>(Prisma.sql`
      INSERT INTO "SellerWeeklyObjective" ("userId", "weekKey") VALUES (${userId}, ${currentWeek})
      ON CONFLICT ("userId", "weekKey") DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `),
  ]);
  const profile = profileRows[0] || { reputationXp: 0, reputationLevel: 1, completedSales: 0, lifetimeVolume: 0, seasonXpEarned: 0 };
  const objective = objectiveRows[0];
  return {
    profile,
    objective,
    benefits: sellerBenefits(wallet?.dynTokens || 0, profile.reputationLevel || 1),
  };
}

export async function claimSellerWeeklyObjective(userId: string, now = new Date()) {
  const currentWeek = weekKey(now);
  return prisma.$transaction(async (tx: any) => {
    const [objective] = await tx.$queryRaw<Array<any>>(Prisma.sql`
      SELECT * FROM "SellerWeeklyObjective" WHERE "userId" = ${userId} AND "weekKey" = ${currentWeek} FOR UPDATE
    `);
    if (!objective) throw new AppError(404, 'Weekly seller objective not found');
    if (!objective.completedAt) throw new AppError(400, 'Weekly seller objective is not complete');
    if (objective.claimedAt) throw new AppError(409, 'Weekly seller objective already claimed');

    await tx.$executeRaw(Prisma.sql`
      UPDATE "SellerWeeklyObjective" SET "claimedAt" = ${now}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${objective.id}
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SellerProfile" ("userId", "reputationXp", "seasonXpEarned")
      VALUES (${userId}, ${objective.rewardSellerXp}, ${objective.rewardSeasonXp})
      ON CONFLICT ("userId") DO UPDATE SET
        "reputationXp" = "SellerProfile"."reputationXp" + ${objective.rewardSellerXp},
        "seasonXpEarned" = "SellerProfile"."seasonXpEarned" + ${objective.rewardSeasonXp},
        "reputationLevel" = economy_reputation_level("SellerProfile"."reputationXp" + ${objective.rewardSellerXp}),
        "updatedAt" = CURRENT_TIMESTAMP
    `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "RetentionProfile" SET "seasonXp" = "seasonXp" + ${objective.rewardSeasonXp}, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = ${userId}
    `);
    return { sellerXp: objective.rewardSellerXp, seasonXp: objective.rewardSeasonXp, liquidDyn: 0 };
  });
}

async function requireOwnedTeam(tx: any, userId: string, teamId: string) {
  const team = await tx.team.findFirst({ where: { id: teamId, ownerId: userId }, include: { venue: { include: { upgrades: true } } } });
  if (!team) throw new AppError(403, 'You do not own this team');
  return team;
}

export async function getFacilityEconomyState(userId: string, teamId: string) {
  await requireOwnedTeam(prisma, userId, teamId);
  const [specializations, cycles] = await Promise.all([
    prisma.$queryRaw<Array<any>>(Prisma.sql`SELECT * FROM "FacilitySpecialization" WHERE "teamId" = ${teamId} ORDER BY "facilityType"`),
    prisma.$queryRaw<Array<any>>(Prisma.sql`SELECT * FROM "FacilitySeasonCycle" WHERE "teamId" = ${teamId} ORDER BY "createdAt" DESC`),
  ]);
  return { specializations, cycles, catalog: SPECIALIZATION_PATHS, cycleCatalog: CYCLE_COSTS };
}

export async function chooseFacilitySpecialization(userId: string, teamId: string, facilityTypeInput: string, pathInput: string) {
  const facilityType = facilityTypeInput.toUpperCase();
  const path = pathInput.toUpperCase();
  const selection = SPECIALIZATION_PATHS[facilityType]?.[path];
  if (!selection) throw new AppError(400, 'Invalid facility specialization path');

  return prisma.$transaction(async (tx: any) => {
    await requireOwnedTeam(tx, userId, teamId);
    const existing = await tx.$queryRaw<Array<any>>(Prisma.sql`
      SELECT * FROM "FacilitySpecialization" WHERE "teamId" = ${teamId} AND "facilityType" = ${facilityType} FOR UPDATE
    `);
    if (existing.length && existing[0].path !== path) {
      throw new AppError(409, `${facilityType} is already specialized as ${existing[0].path}. Specializations are mutually exclusive.`);
    }
    const level = existing.length ? Number(existing[0].level) + 1 : 1;
    const multiplier = 1 + Math.max(0, level - 1) * 0.65;
    const cashCost = Math.round(selection.cash * multiplier);
    const dynCost = Math.round(selection.dyn * multiplier);

    await debitCurrency(tx, { userId, currency: 'CASH', amount: cashCost, reason: 'FACILITY_SPECIALIZATION', sourceType: 'TEAM', sourceId: teamId, metadata: { facilityType, path, level } });
    await debitCurrency(tx, { userId, currency: 'DYN', amount: dynCost, reason: 'FACILITY_SPECIALIZATION', sourceType: 'TEAM', sourceId: teamId, metadata: { facilityType, path, level } });
    await processCurrencySink(tx, 'CASH', cashCost, 'FACILITY_SPECIALIZATION', 'TEAM', teamId, { facilityType, path, level });
    await processCurrencySink(tx, 'DYN', dynCost, 'FACILITY_SPECIALIZATION', 'TEAM', teamId, { facilityType, path, level });

    const effects = Object.fromEntries(Object.entries(selection.effects).map(([key, value]) => [key, Number(value) * level]));
    const [saved] = await tx.$queryRaw<Array<any>>(Prisma.sql`
      INSERT INTO "FacilitySpecialization" ("teamId", "facilityType", "path", "level", "effects", "maintenanceCash", "maintenanceDyn", "updatedAt")
      VALUES (${teamId}, ${facilityType}, ${path}, ${level}, ${JSON.stringify(effects)}::jsonb,
        ${Math.round(selection.maintenanceCash * level)}, ${Math.round(selection.maintenanceDyn * level)}, CURRENT_TIMESTAMP)
      ON CONFLICT ("teamId", "facilityType") DO UPDATE SET
        "level" = EXCLUDED."level", "effects" = EXCLUDED."effects", "maintenanceCash" = EXCLUDED."maintenanceCash",
        "maintenanceDyn" = EXCLUDED."maintenanceDyn", "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `);
    return { specialization: saved, paid: { cash: cashCost, dyn: dynCost } };
  });
}

export async function purchaseFacilitySeasonCycle(userId: string, teamId: string, seasonKey: string, cycleTypeInput: string) {
  const cycleType = cycleTypeInput.toUpperCase();
  const base = CYCLE_COSTS[cycleType];
  if (!base) throw new AppError(400, 'Invalid facility cycle type');
  if (!/^[a-zA-Z0-9_-]{2,32}$/.test(seasonKey)) throw new AppError(400, 'Invalid season key');

  return prisma.$transaction(async (tx: any) => {
    const team = await requireOwnedTeam(tx, userId, teamId);
    const upgradeCount = team.venue?.upgrades?.length || 0;
    const specializationRows = await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT COUNT(*)::int AS count FROM "FacilitySpecialization" WHERE "teamId" = ${teamId}`);
    const specializationCount = Number(specializationRows[0]?.count || 0);
    const multiplier = 1 + upgradeCount * 0.08 + specializationCount * 0.12;
    const cashCost = Math.round(base.cash * multiplier);
    const dynCost = Math.round(base.dyn * multiplier);

    const exists = await tx.$queryRaw<Array<any>>(Prisma.sql`
      SELECT "id" FROM "FacilitySeasonCycle" WHERE "teamId" = ${teamId} AND "seasonKey" = ${seasonKey} AND "cycleType" = ${cycleType}
    `);
    if (exists.length) throw new AppError(409, `${cycleType} cycle already purchased for ${seasonKey}`);

    await debitCurrency(tx, { userId, currency: 'CASH', amount: cashCost, reason: 'FACILITY_SEASON_CYCLE', sourceType: 'TEAM', sourceId: teamId, metadata: { seasonKey, cycleType } });
    await debitCurrency(tx, { userId, currency: 'DYN', amount: dynCost, reason: 'FACILITY_SEASON_CYCLE', sourceType: 'TEAM', sourceId: teamId, metadata: { seasonKey, cycleType } });
    await processCurrencySink(tx, 'CASH', cashCost, 'FACILITY_SEASON_CYCLE', 'TEAM', teamId, { seasonKey, cycleType });
    await processCurrencySink(tx, 'DYN', dynCost, 'FACILITY_SEASON_CYCLE', 'TEAM', teamId, { seasonKey, cycleType });

    const [cycle] = await tx.$queryRaw<Array<any>>(Prisma.sql`
      INSERT INTO "FacilitySeasonCycle" ("teamId", "seasonKey", "cycleType", "costCash", "costDyn", "effects")
      VALUES (${teamId}, ${seasonKey}, ${cycleType}, ${cashCost}, ${dynCost}, ${JSON.stringify(base.effects)}::jsonb)
      RETURNING *
    `);
    return cycle;
  });
}

export function getEconomyBalancePolicy() {
  return {
    seller: {
      saleRewards: 'reputation XP and season XP only',
      weeklyObjective: { sales: 3, volume: 2500, rewardSellerXp: 125, rewardSeasonXp: 75, liquidDyn: 0 },
      dynBenefits: [
        { held: 100, listingSlots: 1, feeRebatePct: 0.75 },
        { held: 500, listingSlots: 2, feeRebatePct: 1.5, fasterSettlement: true },
        { held: 2500, listingSlots: 3, feeRebatePct: 2.5, fasterSettlement: true },
      ],
    },
    staking: { tiers: [{ max: 5000, multiplier: 1 }, { max: 25000, multiplier: 0.75 }, { max: 100000, multiplier: 0.5 }, { max: null, multiplier: 0.3 }] },
    matches: { fullRewardWeeklyGames: 12, softCapTiers: [{ max: 20, multiplier: 0.75 }, { max: 30, multiplier: 0.5 }, { max: null, multiplier: 0.25 }] },
    facilities: { progressiveUpgradeSurchargeAfter: 3, mutuallyExclusiveSpecializations: true, seasonalCycles: Object.keys(CYCLE_COSTS) },
  };
}
