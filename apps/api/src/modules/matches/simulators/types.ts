export interface PlayerState {
  playerId: string;
  name: string;
  position: string;
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
    goalkeeping: number;
  };
  condition: number;
  morale: number;
  isActive: boolean;
}

export interface TeamState {
  teamId: string;
  name: string;
  players: PlayerState[];
  formation: string;
  style: string;
  pressing: string;
  mentality: string;
  morale: number;
  fatigue: number;
  possession: number;
}

export interface SimulationEvent {
  timestamp: number;
  tick: number;
  type: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
}

export interface LegacyCompatiblePlayerStats {
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  tackles: number;
  saves: number;
  rating: number;
  sportStats?: Record<string, any>;
}

export interface SimulationResult {
  homeScore: number;
  awayScore: number;
  events: SimulationEvent[];
  playerStats: Record<string, LegacyCompatiblePlayerStats>;
  seed: string;
  sportId: string;
  metadata?: Record<string, any>;
}

export interface SportSimulator {
  readonly sportId: string;
  simulate(matchId: string, seed: string, homeTeam: TeamState, awayTeam: TeamState): Promise<SimulationResult> | SimulationResult;
}

export function createEmptyPlayerStats(players: PlayerState[]): Record<string, LegacyCompatiblePlayerStats> {
  return Object.fromEntries(players.map((player) => [
    player.playerId,
    {
      goals: 0,
      assists: 0,
      shots: 0,
      shotsOnTarget: 0,
      passes: 0,
      tackles: 0,
      saves: 0,
      rating: 6.0,
      sportStats: {},
    },
  ]));
}

export function activePlayers(team: TeamState): PlayerState[] {
  const starters = team.players.filter((player) => player.isActive);
  return starters.length > 0 ? starters : team.players;
}

export function teamQuality(team: TeamState, weights: Partial<Record<keyof PlayerState['stats'], number>>): number {
  const players = activePlayers(team);
  if (players.length === 0) return 1;
  const weighted = players.reduce((sum, player) => {
    const statScore = Object.entries(weights).reduce((inner, [key, weight]) => {
      return inner + (player.stats[key as keyof PlayerState['stats']] || 0) * (weight || 0);
    }, 0);
    return sum + statScore * (player.condition / 100) * (0.8 + player.morale / 250);
  }, 0);
  return Math.max(1, weighted / players.length);
}
