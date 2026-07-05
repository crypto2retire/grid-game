class AppError extends Error {
  constructor(public statusCode: number, public message: string, public isOperational = true) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const ECONOMY_BALANCE_POLICY = {
  /** Unified-CASH model: CASH is one wallet balance; controls happen at reward/withdrawal rails. */
  unifiedCashBalance: true,
  localMatchFaucetCutPct: 0.40,
  lossRewardCutPct: 0.75,
  marketplaceSaleFeeRate: 0.075,
  marketplaceListingFeeRate: 0.02,
  trainingEquipmentWear: 2,
  matchEquipmentWear: 3,
  minWithdrawalFeeRate: 0.03,
  maxWithdrawalFeeRate: 0.40,
  baseDailyWithdrawalLimit: 500,
  maxTreasuryReservePayoutPctPerDay: 0.02,
  rewardMultipliersBySinkCoverage: [
    { minSinkCoverage: 0.90, multiplier: 1.00 },
    { minSinkCoverage: 0.75, multiplier: 0.90 },
    { minSinkCoverage: 0.60, multiplier: 0.75 },
    { minSinkCoverage: 0.45, multiplier: 0.65 },
    { minSinkCoverage: 0.00, multiplier: 0.55 },
  ],
} as const;

export type MatchOutcome = 'WIN' | 'DRAW' | 'LOSS';

export const GAME_DAY_PROGRESS_REWARDS: Record<MatchOutcome, { xp: number; fans: number; itemFragments: number }> = {
  WIN: { xp: 1050, fans: 25, itemFragments: 2 },
  DRAW: { xp: 600, fans: 10, itemFragments: 1 },
  LOSS: { xp: 250, fans: 3, itemFragments: 0 },
};

export interface EconomyHealthSnapshot {
  windowStart: Date;
  windowEnd: Date;
  cashEmitted: number;
  cashSunk: number;
  treasuryReserve: number;
  sinkCoveragePct: number;
  rewardMultiplier: number;
}

export interface WithdrawalLimitBreakdown {
  walletCash: number;
  dynHeld: number;
  accountAgeDays: number;
  teamInvestmentScore: number;
  economyMultiplier: number;
  treasuryReserve: number;
  baseLimit: number;
  dynMultiplier: number;
  accountAgeMultiplier: number;
  teamInvestmentMultiplier: number;
  reserveLimit: number;
  dailyLimit: number;
  withdrawnToday: number;
  remainingLimit: number;
  feeRate: number;
  feeAmount: number;
  netAmount: number;
  requestedAmount: number;
  approvedAmount: number;
}

const CASH_REWARD_REASON_PATTERNS = [
  'REWARD',
  'GAME_TICKET_REVENUE',
  'GAME_VENUE_REVENUE',
  'GAME_DAY_REVENUE',
  'LEAGUE',
  'SPONSOR',
  'MERCHANT',
  'MINI_GAME',
];

const CASH_SINK_REASON_PATTERNS = [
  'MAINTENANCE',
  'REPAIR',
  'TRAINING',
  'EQUIPMENT',
  'FEE',
  'DUES',
  'RECOVERY',
  'MEDICAL',
  'WAGES',
  'WITHDRAWAL',
  'FUEL',
  'WEAR',
  'TRANSPORT',
];

function numeric(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundCash(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function reasonMatches(reason: string | null | undefined, patterns: string[]) {
  const normalized = String(reason || '').toUpperCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

export function staticBalancedRewardCash(baseAmount: number, outcome: MatchOutcome): number {
  const multiplier = outcome === 'LOSS' ? 1 - ECONOMY_BALANCE_POLICY.lossRewardCutPct : 1 - ECONOMY_BALANCE_POLICY.localMatchFaucetCutPct;
  return roundCash(baseAmount * multiplier);
}

export function getProgressRewardForOutcome(outcome: MatchOutcome) {
  return GAME_DAY_PROGRESS_REWARDS[outcome];
}

export function calculateRewardMultiplierFromSnapshot(input: { cashEmitted: number; cashSunk: number; treasuryReserve: number }): number {
  const emitted = Math.max(0, input.cashEmitted);
  const sunk = Math.max(0, input.cashSunk);
  const reserve = Math.max(0, input.treasuryReserve);
  const sinkCoverage = emitted > 0 ? sunk / emitted : 1;
  let multiplier: number = ECONOMY_BALANCE_POLICY.rewardMultipliersBySinkCoverage.find((row) => sinkCoverage >= row.minSinkCoverage)?.multiplier ?? 0.55;

  // If reserves are almost empty, tighten faucets even if yesterday's sink coverage looked fine.
  if (reserve < 10_000) multiplier = Math.min(multiplier, 0.75);
  if (reserve < 1_000) multiplier = Math.min(multiplier, 0.60);

  return clamp(multiplier, 0.25, 1.0);
}

export async function getEconomyHealthSnapshot(tx: any, now = new Date()): Promise<EconomyHealthSnapshot> {
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ledgerRows = await tx.currencyLedger.findMany({
    where: {
      currency: 'CASH',
      createdAt: { gte: windowStart, lte: now },
    },
    select: { amount: true, reason: true },
  });

  let cashEmitted = 0;
  let cashSunk = 0;
  for (const row of ledgerRows) {
    const amount = numeric(row.amount);
    if (amount > 0 && reasonMatches(row.reason, CASH_REWARD_REASON_PATTERNS)) {
      cashEmitted += amount;
    }
    if (amount < 0 && reasonMatches(row.reason, CASH_SINK_REASON_PATTERNS)) {
      cashSunk += Math.abs(amount);
    }
  }

  const treasury = await tx.gameTreasury.findUnique({ where: { currency: 'CASH' } });
  const treasuryReserve = Math.max(0, Math.floor(numeric(treasury?.balance)));
  const rewardMultiplier = calculateRewardMultiplierFromSnapshot({ cashEmitted, cashSunk, treasuryReserve });

  return {
    windowStart,
    windowEnd: now,
    cashEmitted,
    cashSunk,
    treasuryReserve,
    sinkCoveragePct: cashEmitted > 0 ? (cashSunk / cashEmitted) * 100 : 100,
    rewardMultiplier,
  };
}

export function applyEconomyHealthMultiplier(amount: number, snapshot: EconomyHealthSnapshot) {
  return roundCash(amount * snapshot.rewardMultiplier);
}

export function dynWithdrawalMultiplier(dynHeld: number): number {
  if (dynHeld >= 10_000) return 5.0;
  if (dynHeld >= 5_000) return 3.5;
  if (dynHeld >= 2_500) return 2.5;
  if (dynHeld >= 1_000) return 1.8;
  if (dynHeld >= 500) return 1.4;
  if (dynHeld >= 100) return 1.15;
  return 0.50;
}

export function accountAgeWithdrawalMultiplier(accountAgeDays: number): number {
  if (accountAgeDays >= 180) return 2.0;
  if (accountAgeDays >= 90) return 1.6;
  if (accountAgeDays >= 30) return 1.25;
  if (accountAgeDays >= 7) return 0.75;
  return 0.35;
}

export function investmentWithdrawalMultiplier(score: number): number {
  if (score >= 5_000) return 2.0;
  if (score >= 2_500) return 1.6;
  if (score >= 1_000) return 1.25;
  if (score >= 250) return 0.9;
  return 0.55;
}

export function calculateWithdrawalFeeRate(input: { dynHeld: number; accountAgeDays: number; teamInvestmentScore: number; economyMultiplier: number }): number {
  let rate = 0.28;
  if (input.dynHeld >= 500) rate -= 0.04;
  if (input.dynHeld >= 2_500) rate -= 0.05;
  if (input.dynHeld >= 5_000) rate -= 0.04;
  if (input.accountAgeDays >= 30) rate -= 0.04;
  if (input.accountAgeDays >= 90) rate -= 0.03;
  if (input.teamInvestmentScore >= 1_000) rate -= 0.04;
  if (input.teamInvestmentScore >= 2_500) rate -= 0.03;
  if (input.economyMultiplier < 0.75) rate += 0.06;
  if (input.economyMultiplier < 0.60) rate += 0.08;
  return clamp(rate, ECONOMY_BALANCE_POLICY.minWithdrawalFeeRate, ECONOMY_BALANCE_POLICY.maxWithdrawalFeeRate);
}

export async function calculateTeamInvestmentScore(tx: any, userId: string): Promise<number> {
  const teams = await tx.team.findMany({
    where: { ownerId: userId },
    include: {
      venue: true,
      transportationAssets: true,
      teamEquipments: { include: { equipmentType: true } },
      playerTrainings: true,
    },
  });

  let score = 0;
  for (const team of teams) {
    score += Math.floor(numeric(team.purchasePrice) / 1000);
    if (team.venue) {
      score += Math.floor((numeric(team.venue.purchasePrice) + numeric(team.venue.capacity) * 5 + numeric(team.venue.prestige) * 100) / 1000);
    }
    for (const transport of team.transportationAssets || []) {
      score += Math.floor((numeric(transport.purchasePrice) + numeric(transport.prestige) * 100) / 1000);
    }
    for (const equipment of team.teamEquipments || []) {
      score += Math.floor((numeric(equipment.equipmentType?.baseCostCash) + numeric(equipment.equipmentType?.baseCostGrid) * 1000) / 1000);
      score += numeric(equipment.level) * 25;
    }
    score += (team.playerTrainings || []).length * 10;
  }

  return Math.max(0, Math.round(score));
}

export async function calculateWithdrawalLimit(tx: any, userId: string, requestedAmountInput: number, now = new Date()): Promise<WithdrawalLimitBreakdown> {
  const requestedAmount = roundCash(requestedAmountInput);
  if (requestedAmount <= 0) throw new AppError(400, 'Withdrawal amount must be positive');

  const user = await tx.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) throw new AppError(404, 'User not found');

  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError(404, 'Wallet not found');

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const withdrawalsToday = await tx.currencyLedger.aggregate({
    where: {
      userId,
      currency: 'CASH',
      amount: { lt: 0 },
      reason: 'CASH_WITHDRAWAL_REQUEST',
      createdAt: { gte: dayStart, lte: now },
    },
    _sum: { amount: true },
  });

  const snapshot = await getEconomyHealthSnapshot(tx, now);
  const teamInvestmentScore = await calculateTeamInvestmentScore(tx, userId);
  const accountAgeDays = Math.max(0, Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
  const dynHeld = Math.max(0, Math.floor(numeric(wallet.dynTokens)));
  const walletCash = Math.max(0, Math.floor(numeric(wallet.cash)));
  const dynMultiplier = dynWithdrawalMultiplier(dynHeld);
  const accountAgeMultiplier = accountAgeWithdrawalMultiplier(accountAgeDays);
  const teamInvestmentMultiplier = investmentWithdrawalMultiplier(teamInvestmentScore);
  const baseLimit = ECONOMY_BALANCE_POLICY.baseDailyWithdrawalLimit;
  const reserveLimit = Math.floor(snapshot.treasuryReserve * ECONOMY_BALANCE_POLICY.maxTreasuryReservePayoutPctPerDay);
  const rawDailyLimit = Math.floor(baseLimit * dynMultiplier * accountAgeMultiplier * teamInvestmentMultiplier * snapshot.rewardMultiplier);
  const dailyLimit = Math.max(0, Math.min(rawDailyLimit, reserveLimit));
  const withdrawnToday = Math.abs(Math.round(numeric(withdrawalsToday._sum.amount)));
  const remainingLimit = Math.max(0, dailyLimit - withdrawnToday);
  const approvedAmount = Math.min(requestedAmount, walletCash, remainingLimit);
  const feeRate = calculateWithdrawalFeeRate({ dynHeld, accountAgeDays, teamInvestmentScore, economyMultiplier: snapshot.rewardMultiplier });
  const feeAmount = Math.floor(approvedAmount * feeRate);
  const netAmount = Math.max(0, approvedAmount - feeAmount);

  return {
    walletCash,
    dynHeld,
    accountAgeDays,
    teamInvestmentScore,
    economyMultiplier: snapshot.rewardMultiplier,
    treasuryReserve: snapshot.treasuryReserve,
    baseLimit,
    dynMultiplier,
    accountAgeMultiplier,
    teamInvestmentMultiplier,
    reserveLimit,
    dailyLimit,
    withdrawnToday,
    remainingLimit,
    feeRate,
    feeAmount,
    netAmount,
    requestedAmount,
    approvedAmount,
  };
}
