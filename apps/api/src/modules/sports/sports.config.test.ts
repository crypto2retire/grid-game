import { getSportConfig, listSports, summarizeSportEconomy } from './sports.config';

describe('sport configuration foundation', () => {
  it('ships a soccer-first roadmap with one shared GRID token across expansion sports', () => {
    const sports = listSports();

    expect(sports.map((sport) => sport.id)).toEqual(['soccer', 'american-football', 'basketball', 'baseball']);
    expect(new Set(sports.map((sport) => sport.primaryToken))).toEqual(new Set(['GRID']));
    expect(sports[0].launchPhase).toBe(1);
  });

  it('keeps the engine sport-agnostic through configs for rosters, stats, and economy sinks', () => {
    const soccer = getSportConfig('soccer');
    const basketball = getSportConfig('basketball');

    expect(soccer.roster.starters).toBe(11);
    expect(basketball.roster.starters).toBe(5);
    expect(soccer.stats).toContain('passing');
    expect(basketball.stats).toContain('rebounding');
    expect(soccer.economySinks).toEqual(expect.arrayContaining(['academy upgrades', 'transfer fees', 'stadium widgets']));
  });

  it('summarizes whale and regular user alignment without pay-to-win laddering', () => {
    const summary = summarizeSportEconomy('american-football');

    expect(summary).toContain('whales fund');
    expect(summary).toContain('regular users earn');
    expect(summary).toContain('GRID');
  });
});
