process.env.DATABASE_URL ||= 'postgresql://grid:gridpassword@127.0.0.1:5432/gridgame_test';
process.env.JWT_SECRET ||= 'test-jwt-secret-at-least-32-characters';

let getEconomyBalancePolicy: typeof import('./economy-balance.service').getEconomyBalancePolicy;
let sellerBenefits: typeof import('./economy-balance.service').sellerBenefits;

beforeAll(async () => {
  ({ getEconomyBalancePolicy, sellerBenefits } = await import('./economy-balance.service'));
});

describe('economy balance V2 policy', () => {
  test('keeps the marketplace usable without DYN', () => {
    expect(sellerBenefits(0, 1)).toEqual({
      dynTier: 0,
      activeListingLimit: 3,
      feeRebatePct: 0,
      nextDynThreshold: 100,
      fasterSettlement: false,
    });
  });

  test('adds reachable DYN utility without making the base market paywalled', () => {
    expect(sellerBenefits(100, 1).activeListingLimit).toBe(4);
    expect(sellerBenefits(500, 1)).toMatchObject({ dynTier: 2, activeListingLimit: 5, feeRebatePct: 1.5, fasterSettlement: true });
    expect(sellerBenefits(2500, 10)).toMatchObject({ dynTier: 3, activeListingLimit: 9, feeRebatePct: 2.5 });
  });

  test('seller objectives grant progression but no liquid DYN', () => {
    const policy = getEconomyBalancePolicy();
    expect(policy.seller.weeklyObjective).toMatchObject({ sales: 3, volume: 2500, liquidDyn: 0 });
  });

  test('staking and match rewards use diminishing return tiers', () => {
    const policy = getEconomyBalancePolicy();
    expect(policy.staking.tiers).toEqual([
      { max: 5000, multiplier: 1 },
      { max: 25000, multiplier: 0.75 },
      { max: 100000, multiplier: 0.5 },
      { max: null, multiplier: 0.3 },
    ]);
    expect(policy.matches.fullRewardWeeklyGames).toBe(12);
    expect(policy.matches.softCapTiers.at(-1)).toEqual({ max: null, multiplier: 0.25 });
  });
});
