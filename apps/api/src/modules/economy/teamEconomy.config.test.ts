import {
  SAFE_REWARD_POLICY,
  GAME_DAY_FIXED_REWARDS,
  LEAGUE_TIERS,
  VENUE_TIERS,
  TRANSPORT_TIERS,
  calculateAttendance,
} from './teamEconomy.config';

describe('SAFE_REWARD_POLICY', () => {
  it('must forbid winner from receiving opponent fees', () => {
    expect(SAFE_REWARD_POLICY.winnerDoesNotReceiveOpponentFees).toBe(true);
  });

  it('must classify entry fees as operating costs, not prize pools', () => {
    expect(SAFE_REWARD_POLICY.entryFeesAreOperatingCosts).toBe(true);
  });

  it('must define rewards funded by safe sources only', () => {
    expect(SAFE_REWARD_POLICY.rewardsFundedBy).toEqual(
      expect.arrayContaining([
        'LEAGUE_BUDGET',
        'SPONSOR_BUDGET',
        'GAME_DAY_REVENUE',
        'PLATFORM_GRANT',
      ])
    );
  });

  it('must not include opponent fees as a reward source', () => {
    const allSources = SAFE_REWARD_POLICY.rewardsFundedBy.join(' ').toLowerCase();
    expect(allSources).not.toContain('opponent');
    expect(allSources).not.toContain('entry fee');
    expect(allSources).not.toContain('prize pool');
  });

  it('must list safe revenue sources that do not involve gambling mechanics', () => {
    expect(SAFE_REWARD_POLICY.safeRevenueSources).toEqual(
      expect.arrayContaining([
        'TICKET_SALES',
        'CONCESSIONS',
        'MERCHANDISE',
        'SPONSOR_GAME_REVENUE',
      ])
    );
  });

  it('must list operating costs as sinks, not opponent transfers', () => {
    expect(SAFE_REWARD_POLICY.operatingCostSinks).toEqual(
      expect.arrayContaining([
        'TRAVEL_TRANSPORT',
        'VENUE_STAFF_REFEREES',
        'PLAYER_RECOVERY',
      ])
    );

    const allSinks = SAFE_REWARD_POLICY.operatingCostSinks.join(' ').toLowerCase();
    expect(allSinks).not.toContain('opponent');
    expect(allSinks).not.toContain('winner');
  });
});

describe('GAME_DAY_FIXED_REWARDS', () => {
  it('win reward must be greater than draw reward', () => {
    expect(GAME_DAY_FIXED_REWARDS.WIN_BASE).toBeGreaterThan(GAME_DAY_FIXED_REWARDS.DRAW_BASE);
  });

  it('draw reward must be greater than loss reward', () => {
    expect(GAME_DAY_FIXED_REWARDS.DRAW_BASE).toBeGreaterThan(GAME_DAY_FIXED_REWARDS.LOSS_BASE);
  });

  it('all rewards must be positive', () => {
    expect(GAME_DAY_FIXED_REWARDS.WIN_BASE).toBeGreaterThan(0);
    expect(GAME_DAY_FIXED_REWARDS.DRAW_BASE).toBeGreaterThan(0);
    expect(GAME_DAY_FIXED_REWARDS.LOSS_BASE).toBeGreaterThan(0);
  });
});

describe('Tier constants', () => {
  it('LEAGUE_TIERS must be ordered from lowest to highest', () => {
    expect(LEAGUE_TIERS).toEqual(['LOCAL_REC', 'REGIONAL', 'SEMI_PRO', 'PRO']);
  });

  it('VENUE_TIERS must be ordered from smallest to largest', () => {
    expect(VENUE_TIERS).toEqual([
      'PARK_FIELD',
      'COMMUNITY_FIELD',
      'SMALL_STADIUM',
      'REGIONAL_STADIUM',
      'PRO_STADIUM',
    ]);
  });

  it('TRANSPORT_TIERS must be ordered from cheapest to most expensive', () => {
    expect(TRANSPORT_TIERS).toEqual([
      'CARPOOL',
      'USED_BUS',
      'TEAM_BUS',
      'LUXURY_COACH',
      'CHARTER_FLIGHT',
      'TEAM_AIRCRAFT',
      'CUSTOM_JET',
    ]);
  });
});

describe('calculateAttendance', () => {
  it('returns a number between 0 and venue capacity', () => {
    const attendance = calculateAttendance(1000, 50, 'LOCAL_REC');
    expect(attendance).toBeGreaterThanOrEqual(0);
    expect(attendance).toBeLessThanOrEqual(1000);
  });

  it('returns higher attendance for better form', () => {
    const lowForm = calculateAttendance(1000, 10, 'LOCAL_REC');
    const highForm = calculateAttendance(1000, 90, 'LOCAL_REC');
    expect(highForm).toBeGreaterThan(lowForm);
  });

  it('returns higher attendance for higher league tiers', () => {
    const local = calculateAttendance(10000, 50, 'LOCAL_REC');
    const pro = calculateAttendance(10000, 50, 'PRO');
    expect(pro).toBeGreaterThan(local);
  });
});
