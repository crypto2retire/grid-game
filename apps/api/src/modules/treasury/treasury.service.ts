import { prisma } from '../../config/database';

// ─── Treasury & Burn Management ───

/**
 * Get treasury balance for a specific currency.
 */
export async function getTreasuryBalance(currency: string) {
  const treasury = await prisma.gameTreasury.findUnique({
    where: { id: `treasury-${currency.toLowerCase()}` },
  });

  if (!treasury) {
    // Create if not exists
    return prisma.gameTreasury.create({
      data: {
        id: `treasury-${currency.toLowerCase()}`,
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
  currency: string,
  amount: number,
  reason: string,
  sourceId?: string
) {
  if (amount <= 0) return null;

  const treasuryId = `treasury-${currency.toLowerCase()}`;

  const treasury = await tx.gameTreasury.upsert({
    where: { id: treasuryId },
    update: {
      balance: { increment: amount },
      totalInflows: { increment: amount },
    },
    create: {
      id: treasuryId,
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
      sourceId,
      metadata: { sourceId, reason },
    },
  });

  return treasury;
}

/**
 * Record an outflow from the treasury (e.g., league rewards).
 */
export async function processTreasuryOutflow(
  tx: any,
  currency: string,
  amount: number,
  reason: string,
  sourceId?: string
) {
  if (amount <= 0) return null;

  const treasuryId = `treasury-${currency.toLowerCase()}`;

  const treasury = await tx.gameTreasury.upsert({
    where: { id: treasuryId },
    update: {
      balance: { decrement: amount },
      totalOutflows: { increment: amount },
    },
    create: {
      id: treasuryId,
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
      sourceId,
      metadata: { sourceId, reason },
    },
  });

  return treasury;
}

/**
 * Record a token burn.
 */
export async function processBurn(
  tx: any,
  currency: string,
  amount: number,
  reason: string,
  sourceId?: string
) {
  if (amount <= 0) return null;

  const treasuryId = `treasury-${currency.toLowerCase()}`;

  const treasury = await tx.gameTreasury.upsert({
    where: { id: treasuryId },
    update: {
      totalBurned: { increment: amount },
    },
    create: {
      id: treasuryId,
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
      sourceId,
      metadata: { sourceId, reason, burn: true },
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
  for (const { teamId, amount } of distribution) {
    const team = await tx.team.findUnique({
      where: { id: teamId },
      include: { owner: { include: { wallet: true } } },
    });

    if (!team || !team.owner?.wallet) continue;

    const updatedWallet = await tx.wallet.update({
      where: { userId: team.ownerId },
      data: {
        [currency === 'CASH' ? 'cash' : 'gridTokens']: { increment: amount },
      },
    });

    await tx.currencyLedger.create({
      data: {
        userId: team.ownerId,
        currency,
        amount,
        balanceAfter: currency === 'CASH' ? updatedWallet.cash : updatedWallet.gridTokens,
        reason: 'LEAGUE_REWARD',
        sourceType: 'TREASURY',
        sourceId: teamId,
        metadata: { teamId, amount },
      },
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
