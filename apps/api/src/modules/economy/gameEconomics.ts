import {
  GAME_DAY_FIXED_REWARDS,
  calculateAttendance,
  LEAGUE_REWARD_MULTIPLIER,
  type LeagueTier,
  type VenueTier,
  type TransportTier,
} from './teamEconomy.config';

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
}

interface GameEconomicsResult {
  revenue: number;
  expenses: number;
  net: number;
  breakdown: Record<string, number>;
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

  const breakdown: Record<string, number> = {};

  // --- REVENUE ---

  // 1. Fixed league result reward (funded by league budget, not opponent fees)
  let resultReward = 0;
  if (didWin) {
    resultReward = GAME_DAY_FIXED_REWARDS.WIN_BASE;
  } else if (didTie) {
    resultReward = GAME_DAY_FIXED_REWARDS.DRAW_BASE;
  } else {
    resultReward = GAME_DAY_FIXED_REWARDS.LOSS_BASE;
  }
  const leagueMultiplier = LEAGUE_REWARD_MULTIPLIER[leagueTier] || 1.0;
  resultReward = Math.round(resultReward * leagueMultiplier);
  breakdown['League Result Reward'] = resultReward;

  // 2. Home ticket revenue (only home team)
  let ticketRevenue = 0;
  if (isHome && venue) {
    const form = Math.min(100, Math.max(0, team.points * 2 + 50)); // proxy form from points
    const attendance = calculateAttendance(venue.capacity, form, leagueTier);
    ticketRevenue = attendance * venue.ticketPrice;
    breakdown['Ticket Sales'] = ticketRevenue;
  }

  // 3. Concessions & merchandise (home team gets more, away team gets small cut)
  let concessionsRevenue = 0;
  let merchRevenue = 0;
  if (isHome && venue) {
    const form = Math.min(100, Math.max(0, team.points * 2 + 50));
    const attendance = calculateAttendance(venue.capacity, form, leagueTier);
    concessionsRevenue = Math.round(attendance * 3); // $3 per fan in concessions
    merchRevenue = Math.round(attendance * 1.5); // $1.50 per fan in merch
    breakdown['Concessions'] = concessionsRevenue;
    breakdown['Merchandise'] = merchRevenue;
  } else if (!isHome) {
    // Away team gets a small road-game share (league revenue sharing, not opponent fee)
    concessionsRevenue = 150;
    breakdown['Road Game Share'] = concessionsRevenue;
  }

  // 4. Sponsor revenue (active sponsors only)
  let sponsorRevenue = 0;
  for (const sponsor of sponsorships) {
    if (sponsor.active) {
      sponsorRevenue += sponsor.amountPerGame;
    }
  }
  if (sponsorRevenue > 0) {
    breakdown['Sponsor Revenue'] = sponsorRevenue;
  }

  // 5. Performance bonuses (funded by league/platform, not opponent)
  let performanceBonus = 0;
  if (scoreFor >= 3 && input.team.sportId === 'american-football') {
    performanceBonus += GAME_DAY_FIXED_REWARDS.HIGH_SCORING_BONUS;
    breakdown['High Scoring Bonus'] = GAME_DAY_FIXED_REWARDS.HIGH_SCORING_BONUS;
  }
  if (scoreAgainst === 0) {
    performanceBonus += GAME_DAY_FIXED_REWARDS.CLEAN_SHEET_BONUS;
    breakdown['Clean Sheet Bonus'] = GAME_DAY_FIXED_REWARDS.CLEAN_SHEET_BONUS;
  }
  if (isHome) {
    performanceBonus += GAME_DAY_FIXED_REWARDS.HOME_FIELD_ADVANTAGE_BONUS;
    breakdown['Home Field Advantage'] = GAME_DAY_FIXED_REWARDS.HOME_FIELD_ADVANTAGE_BONUS;
  }

  const totalRevenue = resultReward + ticketRevenue + concessionsRevenue + merchRevenue + sponsorRevenue + performanceBonus;

  // --- EXPENSES ---

  // 1. Travel/transport operating cost (away team pays more)
  let travelCost = 0;
  if (transport) {
    travelCost = transport.operatingCost;
  } else {
    travelCost = isHome ? 50 : 150; // default travel cost
  }
  if (!isHome) {
    travelCost = Math.round(travelCost * 1.5); // away games cost more
  }
  breakdown['Travel & Transport'] = -travelCost;

  // 2. Venue/staff/referee cost (home team pays)
  let venueCost = 0;
  if (isHome && venue) {
    venueCost = Math.round(venue.capacity * 0.5 + 200); // staff + refs + facility wear
    breakdown['Venue Staff & Referees'] = -venueCost;
  }

  // 3. Player recovery cost
  const recoveryCost = 75;
  breakdown['Player Recovery'] = -recoveryCost;

  // 4. League dues (small per-game fee, goes to league sink)
  const leagueDues = 50;
  breakdown['League Dues'] = -leagueDues;

  const totalExpenses = travelCost + venueCost + recoveryCost + leagueDues;
  const net = totalRevenue - totalExpenses;

  return {
    revenue: totalRevenue,
    expenses: totalExpenses,
    net,
    breakdown,
  };
}

/**
 * Verify that no opponent fees are transferred.
 * This is a pure assertion helper for tests and live validation.
 */
export function assertNoOpponentFeeTransfer(
  homeResult: GameEconomicsResult,
  awayResult: GameEconomicsResult
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
