import { computeDailyChestReward, isJourneyComplete, utcDateKey } from './retention.service';

describe('retention reward rules', () => {
  test('daily chest starts controlled and caps at 2500 CASH', () => {
    expect(computeDailyChestReward(1)).toEqual({ cash: 1500, dyn: 0 });
    expect(computeDailyChestReward(5)).toEqual({ cash: 1900, dyn: 0 });
    expect(computeDailyChestReward(99).cash).toBe(2500);
  });

  test('DYN is only included on seven-day streak boundaries', () => {
    expect(computeDailyChestReward(6).dyn).toBe(0);
    expect(computeDailyChestReward(7).dyn).toBe(10);
    expect(computeDailyChestReward(14).dyn).toBe(10);
  });

  test('journey requires all four management stages', () => {
    expect(isJourneyComplete({ PREPARE: true, DEVELOP: true, COMPETE: true, GROW: false })).toBe(false);
    expect(isJourneyComplete({ PREPARE: true, DEVELOP: true, COMPETE: true, GROW: true })).toBe(true);
  });

  test('date keys use UTC rollover', () => {
    expect(utcDateKey(new Date('2026-07-10T23:59:59.999Z'))).toBe('2026-07-10');
    expect(utcDateKey(new Date('2026-07-11T00:00:00.000Z'))).toBe('2026-07-11');
  });
});
