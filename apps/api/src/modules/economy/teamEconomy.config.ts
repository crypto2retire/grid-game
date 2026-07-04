export const LEAGUE_TIERS = [
  'LOCAL_REC',
  'REGIONAL',
  'SEMI_PRO',
  'PRO',
] as const;

export type LeagueTier = (typeof LEAGUE_TIERS)[number];

export const VENUE_TIERS = [
  'PARK_FIELD',
  'COMMUNITY_FIELD',
  'SMALL_STADIUM',
  'REGIONAL_STADIUM',
  'PRO_STADIUM',
] as const;

export type VenueTier = (typeof VENUE_TIERS)[number];

export const TRANSPORT_TIERS = [
  'CARPOOL',
  'USED_BUS',
  'TEAM_BUS',
  'LUXURY_COACH',
  'CHARTER_FLIGHT',
  'TEAM_AIRCRAFT',
  'CUSTOM_JET',
] as const;

export type TransportTier = (typeof TRANSPORT_TIERS)[number];

export const VENUE_CAPACITY: Record<VenueTier, number> = {
  PARK_FIELD: 250,
  COMMUNITY_FIELD: 800,
  SMALL_STADIUM: 3000,
  REGIONAL_STADIUM: 15000,
  PRO_STADIUM: 65000,
};

export const VENUE_TICKET_PRICE: Record<VenueTier, number> = {
  PARK_FIELD: 8,
  COMMUNITY_FIELD: 12,
  SMALL_STADIUM: 20,
  REGIONAL_STADIUM: 35,
  PRO_STADIUM: 75,
};

export const TRANSPORT_OPERATING_COST: Record<TransportTier, number> = {
  CARPOOL: 100,
  USED_BUS: 250,
  TEAM_BUS: 500,
  LUXURY_COACH: 1200,
  CHARTER_FLIGHT: 5000,
  TEAM_AIRCRAFT: 15000,
  CUSTOM_JET: 40000,
};

export const TRANSPORT_FATIGUE_REDUCTION: Record<TransportTier, number> = {
  CARPOOL: 0,
  USED_BUS: 2,
  TEAM_BUS: 5,
  LUXURY_COACH: 8,
  CHARTER_FLIGHT: 10,
  TEAM_AIRCRAFT: 12,
  CUSTOM_JET: 15,
};

export const LEAGUE_REWARD_MULTIPLIER: Record<LeagueTier, number> = {
  LOCAL_REC: 1.0,
  REGIONAL: 1.5,
  SEMI_PRO: 2.5,
  PRO: 4.0,
};

/**
 * Core safe-economy policy guardrail.
 * This object exists so tests and code can reference it directly
 * and fail loudly if someone accidentally implements a
 * winner-takes-opponent-fees model.
 */
export const SAFE_REWARD_POLICY = {
  /** Winners never receive the opponent's operating costs or entry fees. */
  winnerDoesNotReceiveOpponentFees: true,

  /** Entry fees are operating costs / sinks, not prize pools. */
  entryFeesAreOperatingCosts: true,

  /** Rewards are funded by league budgets, sponsors, game-day revenue, and platform grants. */
  rewardsFundedBy: ['LEAGUE_BUDGET', 'SPONSOR_BUDGET', 'GAME_DAY_REVENUE', 'PLATFORM_GRANT'] as string[],

  /** Revenue sources that are safe and do not create legal risk. */
  safeRevenueSources: [
    'TICKET_SALES',
    'CONCESSIONS',
    'MERCHANDISE',
    'LEAGUE_RESULT_REWARD',
    'SPONSOR_REVENUE',
    'SPONSOR_GAME_REVENUE',
    'SPONSOR_SEASON_BONUS',
    'LEAGUE_STANDING_BONUS',
    'LEAGUE_PLAYOFF_BONUS',
    'PLATFORM_GRANT',
    'HIGH_SCORING_BONUS',
    'CLEAN_SHEET_BONUS',
    'HOME_FIELD_ADVANTAGE',
  ] as string[],

  /** Operating costs that are sinks (money leaves the team, does not go to opponent). */
  operatingCostSinks: [
    'TRAVEL_TRANSPORT',
    'VENUE_STAFF_REFEREES',
    'PLAYER_RECOVERY',
    'FACILITY_WEAR',
    'LEAGUE_DUES',
  ] as string[],
} as const;

/**
 * Fixed game-day reward amounts (not dependent on opponent payment).
 * These are league-funded or platform-funded bonuses.
 */
export const GAME_DAY_FIXED_REWARDS = {
  WIN_BASE: 3000,
  DRAW_BASE: 1500,
  LOSS_BASE: 500,
  HOME_FIELD_ADVANTAGE_BONUS: 500,
  CLEAN_SHEET_BONUS: 300, // For defense (shutout in football, clean sheet in soccer)
  HIGH_SCORING_BONUS: 200, // 3+ touchdowns / 4+ goals
} as const;

/**
 * Calculate attendance based on venue capacity, team form, and league tier.
 */
export function calculateAttendance(
  venueCapacity: number,
  teamForm: number,
  leagueTier: LeagueTier
): number {
  const baseRate = 0.4 + teamForm / 200; // 40% base + up to 50% from form
  const tierMultiplier = LEAGUE_REWARD_MULTIPLIER[leagueTier] / 2;
  const cappedRate = Math.min(baseRate * tierMultiplier, 0.95);
  return Math.round(venueCapacity * cappedRate);
}
