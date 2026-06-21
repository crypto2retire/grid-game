export type SportId = 'soccer' | 'american-football' | 'basketball' | 'baseball';

export interface SportConfig {
  id: SportId;
  label: string;
  launchPhase: number;
  primaryToken: 'GRID';
  marketPosition: string;
  roster: {
    starters: number;
    bench: number;
    maxRoster: number;
  };
  positions: string[];
  stats: string[];
  season: {
    lengthDays: number;
    fixturesPerWeek: number;
    playoffEnabled: boolean;
  };
  regularUserLoops: string[];
  whaleLoops: string[];
  sharedLoops: string[];
  economySinks: string[];
  limitedWidgetExamples: string[];
}

export const SPORT_CONFIGS: SportConfig[] = [
  {
    id: 'soccer',
    label: 'Global Football Clubs',
    launchPhase: 2,
    primaryToken: 'GRID',
    marketPosition: 'Worldwide expansion sport after the American football pilot with academies, transfers, loans, cups, and promotion/relegation.',
    roster: { starters: 11, bench: 7, maxRoster: 28 },
    positions: ['GK', 'DEF', 'MID', 'FWD'],
    stats: ['pace', 'shooting', 'passing', 'defending', 'physical', 'vision'],
    season: { lengthDays: 30, fixturesPerWeek: 3, playoffEnabled: false },
    regularUserLoops: ['scout youth prospects', 'train academy players', 'win amateur cups', 'sell or loan developed talent'],
    whaleLoops: ['fund academies', 'own stadiums', 'sponsor cups', 'post prospect-development contracts'],
    sharedLoops: ['scholarship rosters', 'facility rentals', 'transfer-market liquidity', 'sponsored leagues'],
    economySinks: ['academy upgrades', 'transfer fees', 'stadium widgets', 'training recovery', 'cup entries'],
    limitedWidgetExamples: ['Founder Kit', 'Scout Drone', 'Stadium Atmosphere', 'Academy Accelerator'],
  },
  {
    id: 'american-football',
    label: 'Gridiron Franchises',
    launchPhase: 1,
    primaryToken: 'GRID',
    marketPosition: 'Launch sport for testers familiar with American football: US fantasy-football aligned management with franchises, combines, playbooks, and weekly high-stakes seasons.',
    roster: { starters: 22, bench: 18, maxRoster: 52 },
    positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'],
    stats: ['arm', 'speed', 'catching', 'blocking', 'tackling', 'coverage', 'footballIQ'],
    season: { lengthDays: 45, fixturesPerWeek: 1, playoffEnabled: true },
    regularUserLoops: ['run combine drills', 'train role players', 'optimize tactics', 'complete franchise contracts'],
    whaleLoops: ['own franchises', 'sponsor bowls', 'rent training complexes', 'fund draft boards'],
    sharedLoops: ['contract coaching', 'facility boosts', 'playbook marketplaces', 'sponsor-funded bowls'],
    economySinks: ['combine entries', 'playbook installs', 'franchise dues', 'training camps', 'stadium widgets'],
    limitedWidgetExamples: ['Founder Helmet', 'Analytics Booth', 'Prime Turf', 'Legacy Playbook'],
  },
  {
    id: 'basketball',
    label: 'Arena Basketball',
    launchPhase: 3,
    primaryToken: 'GRID',
    marketPosition: 'Star-driven player-card economy where small rosters make rare talent and facility access highly legible.',
    roster: { starters: 5, bench: 7, maxRoster: 15 },
    positions: ['PG', 'SG', 'SF', 'PF', 'C'],
    stats: ['shooting', 'playmaking', 'rebounding', 'defense', 'athleticism', 'clutch'],
    season: { lengthDays: 21, fixturesPerWeek: 4, playoffEnabled: true },
    regularUserLoops: ['train prospects', 'run gym sessions', 'enter street circuits', 'flip undervalued stars'],
    whaleLoops: ['own arenas', 'sponsor circuits', 'fund gyms', 'lease elite trainers'],
    sharedLoops: ['gym rentals', 'trainer contracts', 'sponsored tournaments', 'star-loan revenue shares'],
    economySinks: ['gym upgrades', 'trainer fees', 'tournament entries', 'court widgets', 'recovery boosts'],
    limitedWidgetExamples: ['Founder Court', 'Shoe Lab', 'Holo Jersey', 'Clutch Meter'],
  },
  {
    id: 'baseball',
    label: 'Diamond Baseball Systems',
    launchPhase: 4,
    primaryToken: 'GRID',
    marketPosition: 'Deep-stat prospect and farm-system expansion with long seasons, scouting depth, and collectible ballpark assets.',
    roster: { starters: 9, bench: 16, maxRoster: 40 },
    positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH'],
    stats: ['contact', 'power', 'plateDiscipline', 'fielding', 'velocity', 'control', 'stamina'],
    season: { lengthDays: 60, fixturesPerWeek: 6, playoffEnabled: true },
    regularUserLoops: ['develop farm prospects', 'scout regions', 'manage rotations', 'sell specialized talent'],
    whaleLoops: ['own ballparks', 'fund farm systems', 'sponsor pennants', 'rent analytics labs'],
    sharedLoops: ['farm contracts', 'ballpark rentals', 'analytics subscriptions', 'prospect auctions'],
    economySinks: ['farm upgrades', 'scouting reports', 'rotation recovery', 'ballpark widgets', 'pennant entries'],
    limitedWidgetExamples: ['Founder Pennant', 'Analytics Lab', 'Classic Bat', 'Ballpark Skyline'],
  },
];

export function listSports(): SportConfig[] {
  return [...SPORT_CONFIGS].sort((a, b) => a.launchPhase - b.launchPhase);
}

export function getSportConfig(id: SportId): SportConfig {
  const sport = SPORT_CONFIGS.find((config) => config.id === id);
  if (!sport) {
    throw new Error(`Unknown sport config: ${id}`);
  }
  return sport;
}

export function summarizeSportEconomy(id: SportId): string {
  const sport = getSportConfig(id);
  return `${sport.label}: regular users earn through ${sport.regularUserLoops.slice(0, 2).join(' and ')}, whales fund ${sport.whaleLoops.slice(0, 2).join(' and ')}, and both create demand for the shared ${sport.primaryToken} token through ${sport.economySinks.slice(0, 2).join(' and ')}.`;
}
