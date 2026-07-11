export type WorldId = 'headquarters' | 'regional' | 'elite' | 'college' | 'entry';

export type BuildingId =
  | 'commissioner'
  | 'market'
  | 'media'
  | 'team'
  | 'training'
  | 'medical'
  | 'garage'
  | 'bank'
  | 'stadium'
  | 'matches';

export type BuildingDefinition = {
  id: BuildingId;
  name: string;
  purpose: string;
  x: number;
  y: number;
  accent: string;
};

export type LeagueDefinition = {
  id: Exclude<WorldId, 'headquarters'>;
  name: string;
  tier: string;
  accent: string;
};

export const HEADQUARTERS_BUILDINGS: BuildingDefinition[] = [
  { id: 'commissioner', name: 'League Office', purpose: 'League administration', x: 18, y: 24, accent: '#14b8a6' },
  { id: 'market', name: 'Sports Market', purpose: 'Teams and asset trading', x: 18, y: 66, accent: '#f59e0b' },
  { id: 'media', name: 'Media Center', purpose: 'News and broadcasts', x: 39, y: 18, accent: '#f97316' },
  { id: 'team', name: 'Team Headquarters', purpose: 'Roster and lineup management', x: 61, y: 18, accent: '#38bdf8' },
  { id: 'training', name: 'Training Complex', purpose: 'Development and player equipment', x: 82, y: 24, accent: '#8b5cf6' },
  { id: 'medical', name: 'Sports Medicine', purpose: 'Treatment and recovery', x: 82, y: 66, accent: '#ef4444' },
  { id: 'garage', name: 'Mobility Depot', purpose: 'Transport, maintenance and upgrades', x: 61, y: 80, accent: '#64748b' },
  { id: 'bank', name: 'Sponsor Bank', purpose: 'Wallet, sponsorships and treasury', x: 39, y: 80, accent: '#0ea5e9' },
];

export const LEAGUES: LeagueDefinition[] = [
  { id: 'regional', name: 'Regional League', tier: 'REGIONAL_PRO', accent: '#38bdf8' },
  { id: 'elite', name: 'Elite Franchise Circuit', tier: 'PRO_ELITE', accent: '#a855f7' },
  { id: 'college', name: 'College Conference', tier: 'TOP_COLLEGE', accent: '#22c55e' },
  { id: 'entry', name: 'Pro Entry League', tier: 'PRO_ENTRY', accent: '#f59e0b' },
];
