export const JOURNEY_STAGES = ['PREPARE', 'DEVELOP', 'COMPETE', 'GROW'] as const;
export type JourneyStage = typeof JOURNEY_STAGES[number];

export const utcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const isJourneyComplete = (stages: Record<string, boolean>) =>
  JOURNEY_STAGES.every((stage) => stages[stage] === true);

export function computeDailyChestReward(streak: number) {
  const value = Math.max(1, Math.floor(streak));
  return {
    cash: Math.min(2500, 1500 + (value - 1) * 100),
    dyn: value % 7 === 0 ? 10 : 0,
  };
}
