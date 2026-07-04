import {
  calculateGameEconomics,
  assertNoOpponentFeeTransfer,
} from './gameEconomics';
import { SAFE_REWARD_POLICY } from './teamEconomy.config';

describe('calculateGameEconomics', () => {
  const baseTeam = {
    id: 'team-1',
    sportId: 'american-football',
    wins: 2,
    draws: 1,
    losses: 1,
    points: 7,
  };

  const baseVenue = {
    capacity: 250,
    ticketPrice: 8,
    condition: 70,
    prestige: 10,
    tier: 'PARK_FIELD' as const,
  };

  const baseTransport = {
    tier: 'CARPOOL' as const,
    operatingCost: 100,
    fatigueReduction: 0,
  };

  const baseSponsorships = [{ amountPerGame: 200, active: true }];

  it('home winner earns ticket revenue and fixed league reward', () => {
    const result = calculateGameEconomics({
      team: baseTeam,
      opponent: { id: 'team-2', sportId: 'american-football' },
      venue: baseVenue,
      transport: baseTransport,
      sponsorships: baseSponsorships,
      isHome: true,
      didWin: true,
      didTie: false,
      scoreFor: 3,
      scoreAgainst: 1,
      leagueTier: 'LOCAL_REC',
    });

    expect(result.revenue).toBeGreaterThan(0);
    expect(result.breakdown['Ticket Sales']).toBeGreaterThan(0);
    expect(result.breakdown['League Result Reward']).toBeGreaterThan(0);
    expect(result.breakdown['Sponsor Revenue']).toBe(200);
  });

  it('away team pays travel cost but does not receive opponent fees', () => {
    const result = calculateGameEconomics({
      team: baseTeam,
      opponent: { id: 'team-2', sportId: 'american-football' },
      venue: null,
      transport: baseTransport,
      sponsorships: [],
      isHome: false,
      didWin: false,
      didTie: false,
      scoreFor: 1,
      scoreAgainst: 3,
      leagueTier: 'LOCAL_REC',
    });

    expect(result.expenses).toBeGreaterThan(0);
    expect(result.breakdown['Travel & Transport']).toBeLessThan(0);
    expect(result.breakdown['Road Game Share']).toBeGreaterThan(0);
    // No opponent fee revenue
    const hasOpponentFee = Object.keys(result.breakdown).some((k) =>
      k.toLowerCase().includes('opponent')
    );
    expect(hasOpponentFee).toBe(false);
  });

  it('winner does not receive opponent operating costs', () => {
    const homeResult = calculateGameEconomics({
      team: { ...baseTeam, id: 'home' },
      opponent: { id: 'away', sportId: 'american-football' },
      venue: baseVenue,
      transport: baseTransport,
      sponsorships: [],
      isHome: true,
      didWin: true,
      didTie: false,
      scoreFor: 2,
      scoreAgainst: 0,
      leagueTier: 'LOCAL_REC',
    });

    const awayResult = calculateGameEconomics({
      team: { ...baseTeam, id: 'away' },
      opponent: { id: 'home', sportId: 'american-football' },
      venue: null,
      transport: baseTransport,
      sponsorships: [],
      isHome: false,
      didWin: false,
      didTie: false,
      scoreFor: 0,
      scoreAgainst: 2,
      leagueTier: 'LOCAL_REC',
    });

    assertNoOpponentFeeTransfer(homeResult, awayResult);

    // Winner's revenue should only come from safe sources
    const homeRevenueKeys = Object.keys(homeResult.breakdown).filter(
      (k) => homeResult.breakdown[k] > 0
    );
    for (const key of homeRevenueKeys) {
      expect(SAFE_REWARD_POLICY.safeRevenueSources.map((s) => s.toLowerCase())).toContainEqual(
        expect.stringContaining(key.toLowerCase().replace(/\s/g, '_'))
      );
    }
  });

  it('home team earns ticket revenue from venue', () => {
    const result = calculateGameEconomics({
      team: baseTeam,
      opponent: { id: 'team-2', sportId: 'american-football' },
      venue: baseVenue,
      transport: baseTransport,
      sponsorships: [],
      isHome: true,
      didWin: true,
      didTie: false,
      scoreFor: 3,
      scoreAgainst: 0,
      leagueTier: 'LOCAL_REC',
    });

    expect(result.breakdown['Ticket Sales']).toBeGreaterThan(0);
    const expectedAttendance = Math.round(250 * 0.45 * 0.5); // approximate from formula
    expect(result.breakdown['Ticket Sales']).toBeGreaterThanOrEqual(expectedAttendance * 8);
  });

  it('sponsor bonus is fixed and does not depend on opponent payment', () => {
    const result = calculateGameEconomics({
      team: baseTeam,
      opponent: { id: 'team-2', sportId: 'american-football' },
      venue: baseVenue,
      transport: baseTransport,
      sponsorships: [
        { amountPerGame: 500, active: true },
        { amountPerGame: 300, active: false },
      ],
      isHome: true,
      didWin: true,
      didTie: false,
      scoreFor: 1,
      scoreAgainst: 1,
      leagueTier: 'LOCAL_REC',
    });

    expect(result.breakdown['Sponsor Revenue']).toBe(500); // only active sponsor counts
    expect(result.breakdown['Sponsor Revenue']).not.toBe(800);
  });

  it('operating costs are sinks and do not become a winner pot', () => {
    const homeResult = calculateGameEconomics({
      team: { ...baseTeam, id: 'home' },
      opponent: { id: 'away', sportId: 'american-football' },
      venue: baseVenue,
      transport: baseTransport,
      sponsorships: [],
      isHome: true,
      didWin: true,
      didTie: false,
      scoreFor: 3,
      scoreAgainst: 1,
      leagueTier: 'LOCAL_REC',
    });

    const awayResult = calculateGameEconomics({
      team: { ...baseTeam, id: 'away' },
      opponent: { id: 'home', sportId: 'american-football' },
      venue: null,
      transport: baseTransport,
      sponsorships: [],
      isHome: false,
      didWin: false,
      didTie: false,
      scoreFor: 1,
      scoreAgainst: 3,
      leagueTier: 'LOCAL_REC',
    });

    // Home team has venue costs, away team has travel costs
    expect(homeResult.breakdown['Venue Staff & Referees']).toBeLessThan(0);
    expect(awayResult.breakdown['Travel & Transport']).toBeLessThan(0);

    // Neither team's expenses should be a positive revenue line for the other
    const allKeys = new Set([...Object.keys(homeResult.breakdown), ...Object.keys(awayResult.breakdown)]);
    for (const key of allKeys) {
      const homeVal = homeResult.breakdown[key] || 0;
      const awayVal = awayResult.breakdown[key] || 0;
      // If both have the same key with opposite signs, that's suspicious
      if (homeVal > 0 && awayVal < 0 && key !== 'League Result Reward') {
        // This would indicate a transfer
        expect(false).toBe(true); // fail the test
      }
    }
  });

  it('higher league tiers give larger result rewards', () => {
    const local = calculateGameEconomics({
      team: baseTeam,
      opponent: { id: 'team-2', sportId: 'american-football' },
      venue: null,
      transport: baseTransport,
      sponsorships: [],
      isHome: true,
      didWin: true,
      didTie: false,
      scoreFor: 1,
      scoreAgainst: 0,
      leagueTier: 'LOCAL_REC',
    });

    const pro = calculateGameEconomics({
      team: baseTeam,
      opponent: { id: 'team-2', sportId: 'american-football' },
      venue: null,
      transport: baseTransport,
      sponsorships: [],
      isHome: true,
      didWin: true,
      didTie: false,
      scoreFor: 1,
      scoreAgainst: 0,
      leagueTier: 'PRO',
    });

    expect(pro.breakdown['League Result Reward']).toBeGreaterThan(local.breakdown['League Result Reward']);
  });
});

describe('assertNoOpponentFeeTransfer', () => {
  it('passes when no opponent fees are present', () => {
    const homeResult = {
      revenue: 5000,
      expenses: 1000,
      net: 4000,
      breakdown: { 'Ticket Sales': 5000, 'Travel': -1000 },
    };
    const awayResult = {
      revenue: 3000,
      expenses: 1500,
      net: 1500,
      breakdown: { 'League Reward': 3000, 'Travel': -1500 },
    };

    expect(() => assertNoOpponentFeeTransfer(homeResult, awayResult)).not.toThrow();
  });

  it('throws when winner has opponent fee revenue', () => {
    const homeResult = {
      revenue: 6000,
      expenses: 1000,
      net: 5000,
      breakdown: { 'Ticket Sales': 5000, 'Opponent Fee': 1000, 'Travel': -1000 },
    };
    const awayResult = {
      revenue: 3000,
      expenses: 1500,
      net: 1500,
      breakdown: { 'League Reward': 3000, 'Travel': -1500 },
    };

    expect(() => assertNoOpponentFeeTransfer(homeResult, awayResult)).toThrow(
      'SAFE_REWARD_POLICY'
    );
  });
});
