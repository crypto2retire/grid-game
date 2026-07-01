import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import {
  WalletCurrency,
  creditCurrency,
  debitCurrency,
  normalizeCurrency,
  processCurrencySink,
} from '../economy/currency.service';

const DEFAULT_CYCLE_CODE = 'commissioner-season-1';
const DEFAULT_SPORT_ID = 'american-football';
const CASH_PER_DYN = 1000;
const SOL_TO_DYN = 1000;
const FUNDING_CREDIT_RATE = 0.85;
const REWARD_POOL_RATE = 0.10;
const PLATFORM_FEE_RATE = 0.05;

interface DefaultInventoryItem {
  sku: string;
  name: string;
  description: string;
  category: string;
  currency: WalletCurrency;
  price: number;
  quantityTotal: number;
  unlockFundingAmount: number;
  effects: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

const DEFAULT_INVENTORY: DefaultInventoryItem[] = [
  {
    sku: 'league-pass-rec-invitational',
    name: 'Rec Invitational Passes',
    description: 'Limited entry passes for commissioner-run starter tournaments that create match volume without mine/chop/fish grinding.',
    category: 'LEAGUE_PASS',
    currency: 'DYN',
    price: 250,
    quantityTotal: 80,
    unlockFundingAmount: 2500,
    effects: { loop: 'match_volume', unlocks: 'starter_tournament_entry', rewardBias: 'CASH' },
    metadata: { buildingId: 'practice', meter: 'Match Volume' },
  },
  {
    sku: 'stadium-slot-community-stands',
    name: 'Community Stand Build Slots',
    description: 'Finite stadium upgrade slots that turn community funding into visible venue capacity and ticket upside.',
    category: 'STADIUM_SLOT',
    currency: 'DYN',
    price: 900,
    quantityTotal: 28,
    unlockFundingAmount: 7500,
    effects: { loop: 'stadium_revenue', capacityBoost: 750, upkeepIncrease: 45 },
    metadata: { buildingId: 'stadium', meter: 'Ticket Yield' },
  },
  {
    sku: 'transport-charter-window',
    name: 'Regional Charter Windows',
    description: 'Limited travel windows that reduce fatigue but keep weekly operating costs meaningful.',
    category: 'TRANSPORT_SLOT',
    currency: 'DYN',
    price: 650,
    quantityTotal: 40,
    unlockFundingAmount: 12000,
    effects: { loop: 'travel_upkeep', fatigueReduction: 10, upkeepIncrease: 60 },
    metadata: { buildingId: 'garage', meter: 'Travel Capacity' },
  },
  {
    sku: 'medical-priority-clinic',
    name: 'Priority Recovery Clinics',
    description: 'A restock-limited recovery sink for owners protecting roster value during league pushes.',
    category: 'RECOVERY_SLOT',
    currency: 'DYN',
    price: 450,
    quantityTotal: 60,
    unlockFundingAmount: 16000,
    effects: { loop: 'recovery_sink', healthBoost: 8, injuryRiskReduction: 4 },
    metadata: { buildingId: 'medical', meter: 'Recovery Load' },
  },
  {
    sku: 'creator-league-franchise-kit',
    name: 'Creator League Franchise Kits',
    description: 'Whale/creator-grade kits for founding sports-management leagues with owner revenue, upkeep, and platform tax.',
    category: 'CREATOR_LEAGUE',
    currency: 'SOL',
    price: 0.075,
    quantityTotal: 12,
    unlockFundingAmount: 25000,
    effects: { loop: 'owned_leagues', leagueSlots: 1, ownerRevenueShare: 0.08, upkeepRequired: true },
    metadata: { buildingId: 'commissioner', meter: 'Owner League Supply' },
  },
];

function roundSol(amount: number) {
  return Math.round(amount * 1_000_000_000) / 1_000_000_000;
}

function dynEquivalent(currencyInput: WalletCurrency | string, amount: number) {
  const currency = normalizeCurrency(currencyInput);
  if (currency === 'DYN') return Math.round(amount);
  if (currency === 'CASH') return Math.round(amount / CASH_PER_DYN);
  return roundSol(amount) * SOL_TO_DYN;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatCurrency(amount: number, currency: string) {
  if (currency === 'SOL') return `${roundSol(amount).toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL`;
  return `${Math.round(amount).toLocaleString()} ${currency}`;
}

async function upsertDefaultInventory(tx: any, cycleId: string) {
  for (const item of DEFAULT_INVENTORY) {
    await tx.commissionerInventory.upsert({
      where: { cycleId_sku: { cycleId, sku: item.sku } },
      update: {
        name: item.name,
        description: item.description,
        category: item.category,
        currency: item.currency,
        price: item.price,
        unlockFundingAmount: item.unlockFundingAmount,
        effects: item.effects,
        metadata: item.metadata,
        active: true,
      },
      create: {
        cycleId,
        sku: item.sku,
        name: item.name,
        description: item.description,
        category: item.category,
        currency: item.currency,
        price: item.price,
        quantityTotal: item.quantityTotal,
        quantityRemaining: 0,
        phase: 'LOCKED',
        unlockFundingAmount: item.unlockFundingAmount,
        effects: item.effects,
        metadata: item.metadata,
        active: true,
      },
    });
  }
}

async function ensureActiveCycle(tx: any = prisma) {
  let cycle = await tx.commissionerCycle.findFirst({
    where: { sportId: DEFAULT_SPORT_ID, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (!cycle) {
    cycle = await tx.commissionerCycle.create({
      data: {
        code: DEFAULT_CYCLE_CODE,
        sportId: DEFAULT_SPORT_ID,
        title: 'Grid City Sports Commissioner Cycle',
        theme: 'Community-funded leagues, limited sports infrastructure, and creator-owned competition',
        phase: 'FUNDING',
        status: 'ACTIVE',
        fundingCurrency: 'DYN',
        fundingGoal: 25000,
        fundingRaised: 0,
        rewardPool: 0,
        fundingEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        economyMeters: {
          thesis: 'Fund shared sports infrastructure, release limited inventory, reward contributors, then restock from real demand.',
        },
        metadata: {
          antiCloneTheme: 'sports commissioner office, not mine/chop/fish loops',
          platformFeeRate: PLATFORM_FEE_RATE,
          fundingCreditRate: FUNDING_CREDIT_RATE,
          rewardPoolRate: REWARD_POOL_RATE,
        },
      },
    });
  }

  await upsertDefaultInventory(tx, cycle.id);
  return advanceCycleIfNeeded(tx, cycle.id);
}

async function advanceCycleIfNeeded(tx: any, cycleId: string) {
  let cycle = await tx.commissionerCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new AppError(404, 'Commissioner cycle not found');

  const unlockedInventory = await tx.commissionerInventory.findMany({
    where: {
      cycleId,
      active: true,
      unlockFundingAmount: { lte: cycle.fundingRaised },
      phase: 'LOCKED',
    },
  });

  for (const item of unlockedInventory) {
    const seed = DEFAULT_INVENTORY.find((defaultItem) => defaultItem.sku === item.sku);
    const releaseQuantity = Math.max(item.quantityRemaining, seed?.quantityTotal ?? item.quantityTotal);
    await tx.commissionerInventory.update({
      where: { id: item.id },
      data: {
        phase: 'RESTOCK',
        quantityTotal: Math.max(item.quantityTotal, releaseQuantity),
        quantityRemaining: releaseQuantity,
      },
    });
  }

  const nextPhase = cycle.fundingRaised >= cycle.fundingGoal ? 'RESTOCK' : 'FUNDING';
  if (cycle.phase !== nextPhase) {
    cycle = await tx.commissionerCycle.update({
      where: { id: cycleId },
      data: {
        phase: nextPhase,
        restockAt: nextPhase === 'RESTOCK' ? new Date() : cycle.restockAt,
        inventoryReleasedAt: nextPhase === 'RESTOCK' ? new Date() : cycle.inventoryReleasedAt,
      },
    });
  }

  return cycle;
}

async function loadCycleBundle(userId?: string) {
  const cycle = await ensureActiveCycle(prisma);
  const [inventory, contributions, myContributions] = await Promise.all([
    prisma.commissionerInventory.findMany({
      where: { cycleId: cycle.id, active: true },
      orderBy: [{ unlockFundingAmount: 'asc' }, { price: 'asc' }],
    }),
    prisma.commissionerContribution.findMany({
      where: { cycleId: cycle.id },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { user: { select: { id: true, username: true, displayName: true } }, inventory: true },
    }),
    userId
      ? prisma.commissionerContribution.findMany({ where: { cycleId: cycle.id, userId } })
      : Promise.resolve([]),
  ]);

  return { cycle, inventory, contributions, myContributions };
}

function buildTopContributors(contributions: any[]) {
  const totals = new Map<string, { userId: string; username: string; dynEquivalent: number; rewardDyn: number }>();
  for (const contribution of contributions) {
    if (contribution.type !== 'FUNDING') continue;
    const username = contribution.user?.displayName || contribution.user?.username || 'Owner';
    const prev = totals.get(contribution.userId) || { userId: contribution.userId, username, dynEquivalent: 0, rewardDyn: 0 };
    prev.dynEquivalent += Number(contribution.dynEquivalent || 0);
    prev.rewardDyn += Number(contribution.rewardDyn || 0);
    totals.set(contribution.userId, prev);
  }
  return Array.from(totals.values()).sort((a, b) => b.dynEquivalent - a.dynEquivalent).slice(0, 5);
}

function buildOverviewPayload(cycle: any, inventory: any[], contributions: any[], myContributions: any[]) {
  const fundingProgress = cycle.fundingGoal > 0 ? (cycle.fundingRaised / cycle.fundingGoal) * 100 : 0;
  const totalStock = inventory.reduce((sum, item) => sum + Number(item.quantityTotal || 0), 0);
  const remainingStock = inventory.reduce((sum, item) => sum + Number(item.quantityRemaining || 0), 0);
  const releasedStock = inventory.filter((item) => ['RESTOCK', 'LIVE'].includes(item.phase)).length;
  const soldOut = inventory.filter((item) => item.phase === 'SOLD_OUT' || item.quantityRemaining <= 0 && ['RESTOCK', 'LIVE'].includes(item.phase)).length;
  const myFunding = myContributions.filter((c: any) => c.type === 'FUNDING').reduce((sum: number, c: any) => sum + Number(c.dynEquivalent || 0), 0);
  const myPurchases = myContributions.filter((c: any) => c.type === 'PURCHASE').length;
  const myRewards = myContributions.reduce((sum: number, c: any) => sum + Number(c.rewardDyn || 0) + Number(c.rewardCash || 0) / CASH_PER_DYN, 0);
  const stockSold = Math.max(0, totalStock - remainingStock);
  const scarcity = totalStock > 0 ? (stockSold / totalStock) * 100 : 0;

  const meters = [
    {
      key: 'communityFunding',
      label: 'Community Funding',
      value: cycle.fundingRaised,
      target: cycle.fundingGoal,
      progress: clampPercent(fundingProgress),
      unit: cycle.fundingCurrency,
      description: 'Contributor spend that unlocks commissioner-run league assets.',
    },
    {
      key: 'limitedInventory',
      label: 'Limited Inventory Released',
      value: releasedStock,
      target: inventory.length,
      progress: inventory.length ? clampPercent((releasedStock / inventory.length) * 100) : 0,
      unit: 'drops',
      description: 'Finite sports infrastructure/restock slots unlocked by funding milestones.',
    },
    {
      key: 'inventoryScarcity',
      label: 'Inventory Scarcity',
      value: stockSold,
      target: totalStock,
      progress: clampPercent(scarcity),
      unit: 'claimed',
      description: 'How much released supply has been bought by active owners.',
    },
    {
      key: 'rewardPool',
      label: 'Contributor Reward Pool',
      value: cycle.rewardPool,
      target: cycle.fundingGoal * REWARD_POOL_RATE,
      progress: clampPercent(cycle.fundingGoal > 0 ? (cycle.rewardPool / (cycle.fundingGoal * REWARD_POOL_RATE)) * 100 : 0),
      unit: 'DYN-equiv',
      description: 'Reward budget created by contributions instead of pure inflation.',
    },
    {
      key: 'restockDemand',
      label: 'Restock Demand',
      value: soldOut,
      target: inventory.length,
      progress: inventory.length ? clampPercent((soldOut / inventory.length) * 100) : 0,
      unit: 'sold-out categories',
      description: 'Signals which sports economy categories deserve another batch.',
    },
  ];

  const meterByKey = Object.fromEntries(meters.map((meter) => [meter.key, meter]));
  const buildingLoops = [
    { buildingId: 'stadium', label: 'Game-day yield', meterKey: 'communityFunding', progress: meterByKey.communityFunding.progress, status: 'tickets + venue capacity' },
    { buildingId: 'practice', label: 'Match volume', meterKey: 'limitedInventory', progress: meterByKey.limitedInventory.progress, status: 'league passes unlock games' },
    { buildingId: 'training', label: 'Roster development', meterKey: 'rewardPool', progress: meterByKey.rewardPool.progress, status: 'training spend raises asset value' },
    { buildingId: 'team', label: 'Roster liquidity', meterKey: 'inventoryScarcity', progress: meterByKey.inventoryScarcity.progress, status: 'players and teams trade upward' },
    { buildingId: 'market', label: 'Trade liquidity', meterKey: 'inventoryScarcity', progress: meterByKey.inventoryScarcity.progress, status: 'limited supply drives exchange volume' },
    { buildingId: 'medical', label: 'Recovery sink', meterKey: 'restockDemand', progress: meterByKey.restockDemand.progress, status: 'health slots drain repeat spend' },
    { buildingId: 'garage', label: 'Travel capacity', meterKey: 'limitedInventory', progress: meterByKey.limitedInventory.progress, status: 'charters reduce fatigue, add upkeep' },
    { buildingId: 'bank', label: 'Treasury flow', meterKey: 'rewardPool', progress: meterByKey.rewardPool.progress, status: 'fees fund rewards + sinks' },
    { buildingId: 'commissioner', label: 'Commissioner cycle', meterKey: 'communityFunding', progress: meterByKey.communityFunding.progress, status: 'fund → unlock → buy → restock' },
    { buildingId: 'hall', label: 'Prestige chase', meterKey: 'restockDemand', progress: meterByKey.restockDemand.progress, status: 'rankings create demand for upgrades' },
    { buildingId: 'clubhouse', label: 'Daily retention', meterKey: 'communityFunding', progress: meterByKey.communityFunding.progress, status: 'quests point owners back to loops' },
  ];

  return {
    cycle,
    inventory: inventory.map((item) => ({
      ...item,
      priceLabel: formatCurrency(Number(item.price), item.currency),
      soldOut: item.quantityRemaining <= 0,
      unlocked: ['RESTOCK', 'LIVE'].includes(item.phase),
      unlockProgress: clampPercent(cycle.fundingRaised >= item.unlockFundingAmount ? 100 : (cycle.fundingRaised / Math.max(1, Number(item.unlockFundingAmount))) * 100),
    })),
    meters,
    buildingLoops,
    myStats: {
      dynEquivalentFunded: myFunding,
      purchaseCount: myPurchases,
      rewardDynEquivalent: myRewards,
      share: cycle.fundingRaised > 0 ? myFunding / cycle.fundingRaised : 0,
    },
    topContributors: buildTopContributors(contributions),
    recentActivity: contributions.slice(0, 12).map((contribution) => ({
      id: contribution.id,
      type: contribution.type,
      username: contribution.user?.displayName || contribution.user?.username || 'Owner',
      amount: contribution.amount,
      currency: contribution.currency,
      dynEquivalent: contribution.dynEquivalent,
      rewardDyn: contribution.rewardDyn,
      inventoryName: contribution.inventory?.name,
      createdAt: contribution.createdAt,
    })),
  };
}

export async function getCommissionerOverview(userId?: string) {
  const { cycle, inventory, contributions, myContributions } = await loadCycleBundle(userId);
  return buildOverviewPayload(cycle, inventory, contributions, myContributions);
}

export async function contributeToCommissionerCycle(userId: string, input: { amount: number; currency?: WalletCurrency | string }) {
  const currency = normalizeCurrency(input.currency || 'DYN');
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AppError(400, 'Contribution amount must be positive');
  }

  return prisma.$transaction(async (tx: any) => {
    const cycle = await ensureActiveCycle(tx);
    if (cycle.status !== 'ACTIVE') throw new AppError(400, 'Commissioner cycle is not active');

    const normalizedAmount = currency === 'SOL' ? roundSol(input.amount) : Math.round(input.amount);
    const equivalent = dynEquivalent(currency, normalizedAmount);
    const fundingCredit = Math.max(0, equivalent * FUNDING_CREDIT_RATE);
    const rewardPoolCredit = Math.max(0, equivalent * REWARD_POOL_RATE);
    const platformFeeInContributionCurrency = currency === 'SOL'
      ? roundSol(normalizedAmount * PLATFORM_FEE_RATE)
      : Math.round(normalizedAmount * PLATFORM_FEE_RATE);
    const contributorRewardDyn = Math.max(0, Math.floor(equivalent * 0.02));

    await debitCurrency(tx, {
      userId,
      currency,
      amount: normalizedAmount,
      reason: 'COMMISSIONER_FUNDING_CONTRIBUTION',
      sourceType: 'COMMISSIONER_CYCLE',
      sourceId: cycle.id,
      metadata: { dynEquivalent: equivalent, fundingCredit, rewardPoolCredit, platformFeeRate: PLATFORM_FEE_RATE },
    });

    if (platformFeeInContributionCurrency > 0) {
      await processCurrencySink(
        tx,
        currency,
        platformFeeInContributionCurrency,
        'COMMISSIONER_FUNDING_PLATFORM_FEE',
        'COMMISSIONER_CYCLE',
        cycle.id,
        { grossContribution: normalizedAmount, dynEquivalent: equivalent },
      );
    }

    const contribution = await tx.commissionerContribution.create({
      data: {
        cycleId: cycle.id,
        userId,
        type: 'FUNDING',
        currency,
        amount: normalizedAmount,
        dynEquivalent: equivalent,
        rewardDyn: contributorRewardDyn,
        share: cycle.fundingRaised + fundingCredit > 0 ? fundingCredit / (cycle.fundingRaised + fundingCredit) : 0,
        metadata: { fundingCredit, rewardPoolCredit, platformFeeInContributionCurrency },
      },
    });

    await tx.commissionerCycle.update({
      where: { id: cycle.id },
      data: {
        fundingRaised: { increment: fundingCredit },
        rewardPool: { increment: rewardPoolCredit },
      },
    });

    let wallet = null;
    if (contributorRewardDyn > 0) {
      const result = await creditCurrency(tx, {
        userId,
        currency: 'DYN',
        amount: contributorRewardDyn,
        reason: 'COMMISSIONER_CONTRIBUTOR_REWARD',
        sourceType: 'COMMISSIONER_CONTRIBUTION',
        sourceId: contribution.id,
        metadata: { cycleId: cycle.id, contributionAmount: normalizedAmount, contributionCurrency: currency },
      });
      wallet = result.wallet;
    }

    const updatedCycle = await advanceCycleIfNeeded(tx, cycle.id);
    return { contribution, wallet, cycle: updatedCycle };
  }).then(async (result) => ({ ...result, overview: await getCommissionerOverview(userId) }));
}

export async function purchaseCommissionerInventory(userId: string, inventoryId: string, quantityInput = 1) {
  const quantity = Math.max(1, Math.min(25, Math.floor(quantityInput || 1)));

  return prisma.$transaction(async (tx: any) => {
    const cycle = await ensureActiveCycle(tx);
    const item = await tx.commissionerInventory.findUnique({ where: { id: inventoryId } });
    if (!item || item.cycleId !== cycle.id || !item.active) throw new AppError(404, 'Commissioner inventory item not found');
    if (!['RESTOCK', 'LIVE'].includes(item.phase)) throw new AppError(400, `${item.name} is still locked. Fund the Commissioner cycle to unlock it.`);
    if (item.quantityRemaining < quantity) throw new AppError(400, `${item.name} only has ${item.quantityRemaining} remaining`);

    const currency = normalizeCurrency(item.currency);
    const totalPrice = currency === 'SOL' ? roundSol(Number(item.price) * quantity) : Math.round(Number(item.price) * quantity);
    const equivalent = dynEquivalent(currency, totalPrice);
    const platformFee = currency === 'SOL' ? roundSol(totalPrice * PLATFORM_FEE_RATE) : Math.round(totalPrice * PLATFORM_FEE_RATE);
    const rewardDyn = Math.max(0, Math.floor(equivalent * 0.01));

    await debitCurrency(tx, {
      userId,
      currency,
      amount: totalPrice,
      reason: 'COMMISSIONER_LIMITED_INVENTORY_PURCHASE',
      sourceType: 'COMMISSIONER_INVENTORY',
      sourceId: item.id,
      metadata: { cycleId: cycle.id, sku: item.sku, quantity, unitPrice: item.price, dynEquivalent: equivalent },
    });

    if (platformFee > 0) {
      await processCurrencySink(
        tx,
        currency,
        platformFee,
        'COMMISSIONER_INVENTORY_PLATFORM_FEE',
        'COMMISSIONER_INVENTORY',
        item.id,
        { cycleId: cycle.id, sku: item.sku, quantity, totalPrice },
      );
    }

    const updatedCount = await tx.commissionerInventory.updateMany({
      where: { id: item.id, quantityRemaining: { gte: quantity } },
      data: { quantityRemaining: { decrement: quantity } },
    });
    if (updatedCount.count !== 1) throw new AppError(409, 'Inventory changed while purchasing. Try again.');

    let updatedItem = await tx.commissionerInventory.findUnique({ where: { id: item.id } });
    if (!updatedItem) throw new AppError(404, 'Commissioner inventory item not found after purchase');
    if (updatedItem.quantityRemaining <= 0) {
      updatedItem = await tx.commissionerInventory.update({ where: { id: item.id }, data: { phase: 'SOLD_OUT' } });
    }

    const contribution = await tx.commissionerContribution.create({
      data: {
        cycleId: cycle.id,
        inventoryId: item.id,
        userId,
        type: 'PURCHASE',
        currency,
        amount: totalPrice,
        dynEquivalent: equivalent,
        rewardDyn,
        metadata: { sku: item.sku, quantity, unitPrice: item.price, platformFee },
      },
    });

    let wallet = null;
    if (rewardDyn > 0) {
      const result = await creditCurrency(tx, {
        userId,
        currency: 'DYN',
        amount: rewardDyn,
        reason: 'COMMISSIONER_INVENTORY_BUYER_REWARD',
        sourceType: 'COMMISSIONER_CONTRIBUTION',
        sourceId: contribution.id,
        metadata: { cycleId: cycle.id, inventoryId: item.id, sku: item.sku },
      });
      wallet = result.wallet;
    }

    return { item: updatedItem, contribution, wallet };
  }).then(async (result) => ({ ...result, overview: await getCommissionerOverview(userId) }));
}

export async function restockCommissionerInventory(input: { additionalQuantity?: number; cycleId?: string }) {
  const additionalQuantity = Math.max(1, Math.min(500, Math.floor(input.additionalQuantity || 10)));

  return prisma.$transaction(async (tx: any) => {
    const cycle = input.cycleId
      ? await tx.commissionerCycle.findUnique({ where: { id: input.cycleId } })
      : await ensureActiveCycle(tx);
    if (!cycle) throw new AppError(404, 'Commissioner cycle not found');

    const items = await tx.commissionerInventory.findMany({ where: { cycleId: cycle.id, active: true } });
    for (const item of items) {
      if (cycle.fundingRaised < Number(item.unlockFundingAmount || 0)) continue;
      await tx.commissionerInventory.update({
        where: { id: item.id },
        data: {
          quantityTotal: { increment: additionalQuantity },
          quantityRemaining: { increment: additionalQuantity },
          restockBatch: { increment: 1 },
          phase: 'RESTOCK',
        },
      });
    }

    const updatedCycle = await tx.commissionerCycle.update({
      where: { id: cycle.id },
      data: { phase: 'RESTOCK', restockAt: new Date() },
    });

    return { cycle: updatedCycle, restockedItems: items.length, additionalQuantity };
  });
}
