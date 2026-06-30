import { getSportConfig, listSports, summarizeSportEconomy } from './sports.config';

describe('sport configuration foundation', () => {
  it('ships an American-football-first roadmap with one shared DYN token across expansion sports', () => {
    const sports = listSports();

    expect(sports.map((sport) => sport.id)).toEqual(['american-football', 'soccer', 'basketball', 'baseball']);
    expect(new Set(sports.map((sport) => sport.primaryToken))).toEqual(new Set(['DYN']));
    expect(sports[0].launchPhase).toBe(1);
  });

  it('keeps the engine sport-agnostic through configs for rosters, stats, and economy sinks', () => {
    const football = getSportConfig('american-football');
    const basketball = getSportConfig('basketball');

    expect(football.roster.starters).toBe(22);
    expect(basketball.roster.starters).toBe(5);
    expect(football.stats).toContain('footballIQ');
    expect(basketball.stats).toContain('rebounding');
    expect(football.economySinks).toEqual(expect.arrayContaining(['combine entries', 'playbook installs', 'stadium widgets']));
  });

  it('summarizes whale and regular user alignment without pay-to-win laddering', () => {
    const summary = summarizeSportEconomy('american-football');

    expect(summary).toContain('whales fund');
    expect(summary).toContain('regular users earn');
    expect(summary).toContain('DYN');
  });
});
