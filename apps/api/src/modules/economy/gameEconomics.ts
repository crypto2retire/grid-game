import {
  GAME_DAY_FIXED_REWARDS,
  calculateAttendance,
  LEAGUE_REWARD_MULTIPLIER,
  type LeagueTier,
  type VenueTier,
  type TransportTier,
} from './teamEconomy.config';
import {
  applyEconomyHealthMultiplier,
  getProgressRewardForOutcome,
  staticBalancedRewardCash,
  type MatchOutcome,
} from './balance.service';

interface GameEconomicsInput {
  team: {
    id: string;
    sportId: string;
    wins: number;
    draws: number;
    losses: number;
    points: number;
  };
  opponent: {
    id: string;
    sportId: string;
  };
  venue: {
    capacity: number;
    ticketPrice: number;
    condition: number;
    prestige: number;
    tier: VenueTier;
  } | null;
  transport: {
    tier: TransportTier;
    operatingCost: number;
    fatigueReduction: number;
  } | null;
  sponsorships: {
    amountPerGame: number;
    active: boolean;
  }[];
  isHome: boolean;
  didWin: boolean;
  didTie: boolean;
  scoreFor: number;
  scoreAgainst: number;
  leagueTier: LeagueTier;
  economyHealthMultiplier?: number;
}

interface GameEconomicsResult {
  revenue: number;
  expenses: number;
  net: number;
  breakdown: Record<string, number>;
  progressRewards: { xp: number; fans: number; itemFragments: number };
  economyHealthMultiplier: number;
}

/**
 * Calculate game-day revenue and expenses for a single team.
 *
 * Core safe-economy rule: the opponent's costs NEVER flow to this team.
 * All revenue comes from league budgets, sponsors, ticket sales, and fixed bonuses.
 * All expenses are operating costs that leave the team (sinks).
 */
export function calculateGameEconomics(input: GameEconomicsInput): GameEconomicsResult {
  const { team, venue, transport, sponsorships, isHome, didWin, didTie, scoreFor, scoreAgainst, leagueTier } = input;
  const economyHealthMultiplier = Math.max(0.25, Math.min(1, input.economyHealthMultiplier ?? 1));
  const outcome: MatchOutcome = didWin ? 'WIN' : didTie ? 'DRAW' : 'LOSS';
  const scaleReward = (amount: number) => applyEconomyHealthMultiplier(amount, {
    windowStart: new Date(0),
    windowEnd: new Date(0),
    cashEmitted: 0,
    cashSunk: 0,
    treasuryReserve: Number.MAX_SAFE_INTEGER,
    sinkCoveragePct: 100,
    rewardMultiplier: economyHealthMultiplier,
  });

  const breakdown: Record<string, number> = {};

  // --- REVENUE ---

  // 1. Fixed league result reward (funded by league budget, not opponent fees)
  const baseResultReward = didWin
    ? GAME_DAY_FIXED_REWARDS.WIN_BASE
    : didTie
      ? GAME_DAY_FIXED_REWARDS.DRAW_BASE
      : GAME_DAY_FIXED_REWARDS.LOSS_BASE;
  const leagueMultiplier = LEAGUE_REWARD_MULTIPLIER[leagueTier] || 1.0;
  const faucetCutReward = staticBalancedRewardCash(baseResultReward, outcome);
  const resultReward = scaleReward(faucetCutReward * leagueMultiplier);
  breakdown['League Result Reward'] = resultReward;

  // 2. Home ticket revenue (only home team)
  let ticketRevenue = 0;
  if (isHome && venue) {
    const form = Math.min(100, Math.max(0, team.points * 2 + 50)); // proxy form from points
    const attendance = calculateAttendance(venue.capacity, form, leagueTier);
    ticketRevenue = scaleReward(attendance * venue.ticketPrice);
    breakdown['Ticket Sales'] = ticketRevenue;
  }

  // 3. Concessions & merchandise (home team gets more, away team gets small cut)
  let concessionsRevenue = 0;
  let merchRevenue = 0;
  if (isHome && venue) {
    const form = Math.min(100, Math.max(0, team.points * 2 + 50));
    const attendance = calculateAttendance(venue.capacity, form, leagueTier);
    concessionsRevenue = scaleReward(Math.round(attendance * 3)); // $3 per fan in concessions
    merchRevenue = scaleReward(Math.round(attendance * 1.5)); // $1.50 per fan in merch
    breakdown['Concessions'] = concessionsRevenue;
    breakdown['Merchandise'] = merchRevenue;
  } else if (!isHome) {
    // Away team gets a small road-game share (league revenue sharing, not opponent fee)
    concessionsRevenue = scaleReward(150);
    breakdown['Road Game Share'] = concessionsRevenue;
  }

  // 4. Sponsor revenue (active sponsors only)
  let sponsorRevenue = 0;
  for (const sponsor of sponsorships) {
    if (sponsor.active) {
      sponsorRevenue += scaleReward(sponsor.amountPerGame);
    }
  }
  if (sponsorRevenue > 0) {
    breakdown['Sponsor Revenue'] = sponsorRevenue;
  }

  // 5. Performance bonuses (funded by league/platform, not opponent)
  let performanceBonus = 0;
  if (scoreFor >= 3 && input.team.sportId === 'american-football') {
    const bonus = scaleReward(GAME_DAY_FIXED_REWARDS.HIGH_SCORING_BONUS);
    performanceBonus += bonus;
    breakdown['High Scoring Bonus'] = bonus;
  }
  if (scoreAgainst === 0) {
    const bonus = scaleReward(GAME_DAY_FIXED_REWARDS.CLEAN_SHEET_BONUS);
    performanceBonus += bonus;
    breakdown['Clean Sheet Bonus'] = bonus;
  }
  if (isHome) {
    const bonus = scaleReward(GAME_DAY_FIXED_REWARDS.HOME_FIELD_ADVANTAGE_BONUS);
    performanceBonus += bonus;
    breakdown['Home Field Advantage'] = bonus;
  }

  const totalRevenue = resultReward + ticketRevenue + concessionsRevenue + merchRevenue + sponsorRevenue + performanceBonus;

  // --- EXPENSES ---

  // 1. Travel/transport operating cost (away team pays more)
  const baseTravelCost = transport?.operatingCost ?? (isHome ? 65 : 195); // default travel cost
  const travelCost = !isHome ? Math.round(baseTravelCost * 1.95) : Math.round(baseTravelCost * 1.3); // fuel/maintenance sink
  breakdown['Travel & Transport'] = -travelCost;

  // 2. Venue/staff/referee cost (home team pays)
  let venueCost = 0;
  if (isHome && venue) {
    venueCost = Math.round((venue.capacity * 0.5 + 200) * 1.3); // staff + refs + facility wear
    breakdown['Venue Staff & Referees'] = -venueCost;
  }

  // 3. Player recovery cost
  const recoveryCost = 175;
  breakdown['Player Recovery & Medical Staff'] = -recoveryCost;

  // 4. League dues (small per-game fee, goes to league sink)
  const leagueDues = 65;
  breakdown['League Dues'] = -leagueDues;

  const equipmentWearReserve = 120;
  breakdown['Equipment Wear Reserve'] = -equipmentWearReserve;

  const totalExpenses = travelCost + venueCost + recoveryCost + leagueDues + equipmentWearReserve;
  const net = totalRevenue - totalExpenses;

  return {
    revenue: totalRevenue,
    expenses: totalExpenses,
    net,
    breakdown,
    progressRewards: getProgressRewardForOutcome(outcome),
    economyHealthMultiplier,
  };
}

/**
 * Verify that no opponent fees are transferred.
 * This is a pure assertion helper for tests and live validation.
 */
export function assertNoOpponentFeeTransfer(
  homeResult: Pick<GameEconomicsResult, 'net' | 'breakdown'>,
  awayResult: Pick<GameEconomicsResult, 'net' | 'breakdown'>
): void {
  // The winner's revenue must NOT include the opponent's operating costs
  const winnerResult = homeResult.net > awayResult.net ? homeResult : awayResult;
  const loserResult = homeResult.net > awayResult.net ? awayResult : homeResult;

  const winnerHasOpponentFee = Object.keys(winnerResult.breakdown).some(
    (key) =>
      key.toLowerCase().includes('opponent fee') ||
      key.toLowerCase().includes('entry fee') ||
      key.toLowerCase().includes('opponent cost')
  );

  if (winnerHasOpponentFee) {
    throw new Error('Winner revenue includes opponent fees — this violates SAFE_REWARD_POLICY');
  }

  // The loser should not have a negative revenue line labeled as "fee paid to opponent"
  const loserHasOpponentPayment = Object.keys(loserResult.breakdown).some(
    (key) =>
      key.toLowerCase().includes('paid to opponent') ||
      key.toLowerCase().includes('opponent payout')
  );

  if (loserHasOpponentPayment) {
    throw new Error('Loser expenses include direct payment to opponent — this violates SAFE_REWARD_POLICY');
  }
}
