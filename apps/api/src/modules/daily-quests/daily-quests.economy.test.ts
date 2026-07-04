import { readFileSync } from 'fs';
import { join } from 'path';

describe('daily quest economy guardrails', () => {
  const serviceSource = readFileSync(join(process.cwd(), 'src/modules/daily-quests/daily-quests.service.ts'), 'utf8');

  it('keeps daily quests as payout eligibility gates instead of direct CASH rewards', () => {
    const rewardCashValues = [...serviceSource.matchAll(/rewardCash:\s*(\d+)/g)].map((match) => Number(match[1]));

    expect(rewardCashValues.length).toBeGreaterThan(0);
    expect(rewardCashValues.every((value) => value === 0)).toBe(true);
    expect(serviceSource).toContain('Daily payout access');
  });

  it('does not credit wallets from daily quest claims', () => {
    expect(serviceSource).not.toContain('creditCurrency');
    expect(serviceSource).not.toContain('DAILY_QUEST_REWARD');
    expect(serviceSource).not.toContain("sourceType: 'DAILY_QUEST'");
  });
});
