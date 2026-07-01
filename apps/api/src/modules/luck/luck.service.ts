import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export const LUCK_MIN_HELD_DYN = 100; // minimum tokens held to start earning luck
export const LUCK_MAX_HELD_MULTIPLIER = 50_000; // cap for held-token contribution
export const LUCK_MAX_LIFETIME_MULTIPLIER = 200_000; // cap for lifetime earned/purchased contribution
export const LUCK_DECAY_SELL_FACTOR = 0.5; // how much selling reduces luck
export const LUCK_HOLD_RATIO_WEIGHT = 0.35; // weight of current hold vs lifetime
export const LUCK_LIFETIME_WEIGHT = 0.45; // weight of lifetime earned+purchased
export const LUCK_SELL_PENALTY_WEIGHT = 0.20; // weight of sold penalty

export type LuckTier = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'ELITE' | 'LEGEND';

export interface LuckBreakdown {
  heldDyn: number;
  lifetimeEarned: number;
  lifetimePurchased: number;
  lifetimeSold: number;
  holdRatio: number;
  holdComponent: number;
  lifetimeComponent: number;
  sellPenaltyComponent: number;
  luckScore: number;
  tier: LuckTier;
  description: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function computeLuckScore(wallet: {
  dynTokens: number;
  lifetimeDynEarned: number;
  lifetimeDynPurchased: number;
  lifetimeDynSold: number;
}): LuckBreakdown {
  const heldDyn = Math.max(0, wallet.dynTokens || 0);
  const lifetimeEarned = Math.max(0, wallet.lifetimeDynEarned || 0);
  const lifetimePurchased = Math.max(0, wallet.lifetimeDynPurchased || 0);
  const lifetimeSold = Math.max(0, wallet.lifetimeDynSold || 0);
  const lifetimeTotal = lifetimeEarned + lifetimePurchased;

  // Hold ratio: tokens held vs lifetime acquired (capped at 1.0)
  const holdRatio = lifetimeTotal > 0 ? clamp(heldDyn / lifetimeTotal, 0, 1) : 0;

  // If below minimum held threshold, luck is zero (no cheating by buying and immediately selling)
  if (heldDyn < LUCK_MIN_HELD_DYN) {
    return {
      heldDyn,
      lifetimeEarned,
      lifetimePurchased,
      lifetimeSold,
      holdRatio: 0,
      holdComponent: 0,
      lifetimeComponent: 0,
      sellPenaltyComponent: 0,
      luckScore: 0,
      tier: 'NONE',
      description: 'No active luck. Hold at least 100 DYN to start earning luck.',
    };
  }

  // Components normalized to 0-100
  const holdComponent = (clamp(heldDyn, 0, LUCK_MAX_HELD_MULTIPLIER) / LUCK_MAX_HELD_MULTIPLIER) * 100 * LUCK_HOLD_RATIO_WEIGHT;
  const lifetimeComponent = (clamp(lifetimeTotal, 0, LUCK_MAX_LIFETIME_MULTIPLIER) / LUCK_MAX_LIFETIME_MULTIPLIER) * 100 * LUCK_LIFETIME_WEIGHT;
  const sellPenalty = lifetimeTotal > 0
    ? (clamp(lifetimeSold, 0, lifetimeTotal) / lifetimeTotal) * 100 * LUCK_SELL_PENALTY_WEIGHT
    : 0;
  const sellPenaltyComponent = clamp(sellPenalty, 0, LUCK_SELL_PENALTY_WEIGHT * 100);

  const rawScore = holdComponent + lifetimeComponent - sellPenaltyComponent;
  const luckScore = clamp(rawScore, 0, 100);

  let tier: LuckTier = 'NONE';
  if (luckScore >= 80) tier = 'LEGEND';
  else if (luckScore >= 65) tier = 'ELITE';
  else if (luckScore >= 50) tier = 'GOLD';
  else if (luckScore >= 30) tier = 'SILVER';
  else if (luckScore >= 10) tier = 'BRONZE';

  return {
    heldDyn,
    lifetimeEarned,
    lifetimePurchased,
    lifetimeSold,
    holdRatio,
    holdComponent: holdComponent / LUCK_HOLD_RATIO_WEIGHT, // raw 0-100 for display
    lifetimeComponent: lifetimeComponent / LUCK_LIFETIME_WEIGHT,
    sellPenaltyComponent: sellPenaltyComponent / LUCK_SELL_PENALTY_WEIGHT,
    luckScore,
    tier,
    description: luckDescription(tier),
  };
}

export async function recalculateLuckScore(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return null;
  const breakdown = computeLuckScore(wallet);
  await prisma.wallet.update({
    where: { userId },
    data: { luckScore: breakdown.luckScore, luckTier: breakdown.tier },
  });
  return breakdown;
}

export async function getLuckBreakdown(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError(404, 'Wallet not found');
  return computeLuckScore(wallet);
}

/**
 * Apply a luck adjustment to a probability or roll.
 * Returns a modifier between 0 and +boost (e.g., +0.15 = up to 15% better outcomes).
 */
export function luckModifier(luckScore: number, maxBoost: number): number {
  return (clamp(luckScore, 0, 100) / 100) * maxBoost;
}

export function luckDescription(tier: LuckTier): string {
  switch (tier) {
    case 'LEGEND': return 'Legendary luck — your loyalty is rewarded across the league.';
    case 'ELITE': return 'Elite luck — holders like you tilt the odds.';
    case 'GOLD': return 'Gold luck — your DYN stack is working for you.';
    case 'SILVER': return 'Silver luck — keep holding to climb higher.';
    case 'BRONZE': return 'Bronze luck — just getting started. Hold more DYN to rise.';
    default: return 'No active luck. Hold at least 100 DYN to start earning luck.';
  }
}
