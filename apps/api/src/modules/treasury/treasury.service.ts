import { prisma } from '../../config/database';

// ─── Treasury & Burn Management ───

function normalizeTreasuryCurrency(currency: string): string {
  const normalized = String(currency || '').trim().toUpperCase();
  return normalized === 'GRID' ? 'DYN' : normalized;
}

function treasuryIdForCurrency(currency: string): string {
  return `treasury-${normalizeTreasuryCurrency(currency).toLowerCase()}`;
}

/**
 * Get treasury balance for a specific currency.
 */
export async function getTreasuryBalance(currencyInput: string) {
  const currency = normalizeTreasuryCurrency(currencyInput);
  const treasury = await prisma.gameTreasury.findUnique({
    where: { currency },
  });

  if (!treasury) {
    // Create if not exists
    return prisma.gameTreasury.create({
      data: {
        id: treasuryIdForCurrency(currency),
        currency,
        balance: 0,
        totalInflows: 0,
        totalOutflows: 0,
        totalBurned: 0,
      },
    });
  }

  return treasury;
}

/**
 * Record an inflow to the treasury.
 * tx: Prisma transaction client
 */
export async function processTreasuryInflow(
  tx: any,
  currencyInput: string,
  amount: number,
  reason: string,
  sourceId?: string,
  sourceType?: string,
  metadata: Record<string, unknown> = {},
) {
  if (amount <= 0) return null;

  const currency = normalizeTreasuryCurrency(currencyInput);

  const treasury = await tx.gameTreasury.upsert({
    where: { currency },
    update: {
      balance: { increment: amount },
      totalInflows: { increment: amount },
    },
    create: {
      id: treasuryIdForCurrency(currency),
      currency,
      balance: amount,
      totalInflows: amount,
      totalOutflows: 0,
      totalBurned: 0,
    },
  });

  await tx.treasuryTransaction.create({
    data: {
      treasuryId: treasury.id,
      type: 'INFLOW',
      amount,
      currency,
      reason,
      sourceType,
      sourceId,
      metadata: { ...metadata, sourceId, sourceType, reason },
    },
  });

  return treasury;
}

/**
 * Record an outflow from the treasury (e.g., league rewards).
 */
export async function processTreasuryOutflow(
  tx: any,
  currencyInput: string,
  amount: number,
  reason: string,
  sourceId?: string,
  sourceType?: string,
  metadata: Record<string, unknown> = {},
) {
  if (amount <= 0) return null;

  const currency = normalizeTreasuryCurrency(currencyInput);

  const treasury = await tx.gameTreasury.upsert({
    where: { currency },
    update: {
      balance: { decrement: amount },
      totalOutflows: { increment: amount },
    },
    create: {
      id: treasuryIdForCurrency(currency),
      currency,
      balance: -amount,
      totalInflows: 0,
      totalOutflows: amount,
      totalBurned: 0,
    },
  });

  await tx.treasuryTransaction.create({
    data: {
      treasuryId: treasury.id,
      type: 'OUTFLOW',
      amount: -amount,
      currency,
      reason,
      sourceType,
      sourceId,
      metadata: { ...metadata, sourceId, sourceType, reason },
    },
  });

  return treasury;
}

/**
 * Record a token burn.
 */
export async function processBurn(
  tx: any,
  currencyInput: string,
  amount: number,
  reason: string,
  sourceId?: string,
  sourceType?: string,
  metadata: Record<string, unknown> = {},
) {
  if (amount <= 0) return null;

  const currency = normalizeTreasuryCurrency(currencyInput);

  const treasury = await tx.gameTreasury.upsert({
    where: { currency },
    update: {
      totalBurned: { increment: amount },
    },
    create: {
      id: treasuryIdForCurrency(currency),
      currency,
      balance: 0,
      totalInflows: 0,
      totalOutflows: 0,
      totalBurned: amount,
    },
  });

  await tx.treasuryTransaction.create({
    data: {
      treasuryId: treasury.id,
      type: 'BURN',
      amount: -amount,
      currency,
      reason,
      sourceType,
      sourceId,
      metadata: { ...metadata, sourceId, sourceType, reason, burn: true },
    },
  });

  return treasury;
}

/**
 * Distribute treasury funds to teams as league rewards.
 * This is called after matches or at season end.
 */
export async function distributeTreasuryRewards(
  tx: any,
  currency: string,
  distribution: { teamId: string; amount: number }[]
) {
  const totalAmount = distribution.reduce((sum, d) => sum + d.amount, 0);

  // Verify treasury has enough
  const treasury = await getTreasuryBalance(currency);
  if (treasury.balance < totalAmount) {
    throw new Error(`Treasury insufficient. Has ${treasury.balance}, needs ${totalAmount}`);
  }

  // Process outflow
  await processTreasuryOutflow(tx, currency, totalAmount, 'LEAGUE_REWARD_DISTRIBUTION');

  // Distribute to each team
  const results = [];
  const { creditCurrency } = await import('../economy/currency.service');
  for (const { teamId, amount } of distribution) {
    const team = await tx.team.findUnique({
      where: { id: teamId },
      include: { owner: { include: { wallet: true } } },
    });

    if (!team || !team.owner?.wallet) continue;

    await creditCurrency(tx, {
      userId: team.ownerId,
      currency,
      amount,
      reason: 'LEAGUE_REWARD',
      sourceType: 'TREASURY',
      sourceId: teamId,
      metadata: { teamId, amount },
    });

    results.push({ teamId, amount, ownerId: team.ownerId });
  }

  return results;
}

/**
 * Get full treasury report.
 */
export async function getTreasuryReport() {
  const treasuries = await prisma.gameTreasury.findMany({
    orderBy: { currency: 'asc' },
  });

  const recentTransactions = await prisma.treasuryTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return {
    treasuries,
    recentTransactions,
  };
}
