import { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const CURRENCIES = {
  CASH: 'CASH',
  DYN: 'DYN',
} as const;

export type CurrencyCode = typeof CURRENCIES[keyof typeof CURRENCIES];

interface LedgerInput {
  userId: string;
  currency: CurrencyCode | string;
  amount: number;
  balanceAfter?: number | null;
  reason: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordCurrencyLedger(tx: TransactionClient | any, input: LedgerInput) {
  return tx.currencyLedger.create({
    data: {
      userId: input.userId,
      currency: input.currency,
      amount: input.amount,
      balanceAfter: input.balanceAfter ?? null,
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: input.metadata ?? {},
    },
  });
}

export function legacyAttributesFromPlayer(player: any) {
  const attributes = player.attributes && typeof player.attributes === 'object' ? player.attributes : {};
  return {
    speed: attributes.speed ?? player.pace,
    arm: attributes.arm ?? player.shooting,
    footballIQ: attributes.footballIQ ?? attributes.iq ?? player.passing,
    agility: attributes.agility ?? player.dribbling,
    tackling: attributes.tackling ?? player.defending,
    strength: attributes.strength ?? player.physical,
    blocking: attributes.blocking ?? player.physical,
    catching: attributes.catching ?? player.shooting,
    coverage: attributes.coverage ?? player.defending,
    legacy: {
      pace: player.pace,
      shooting: player.shooting,
      passing: player.passing,
      dribbling: player.dribbling,
      defending: player.defending,
      physical: player.physical,
      goalkeeping: player.goalkeeping ?? 0,
    },
  };
}
