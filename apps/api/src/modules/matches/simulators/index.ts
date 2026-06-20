import { AmericanFootballSimulator } from './americanFootball.simulator';
import { GenericSportSimulator } from './genericSport.simulator';
import { SimulationResult, SportSimulator, TeamState } from './types';

export * from './types';

const simulators: Record<string, SportSimulator> = {
  'american-football': new AmericanFootballSimulator(),
  soccer: new GenericSportSimulator('soccer'),
  basketball: new GenericSportSimulator('basketball'),
  baseball: new GenericSportSimulator('baseball'),
  'ai-crypto': new GenericSportSimulator('ai-crypto'),
};

export function getSportSimulator(sportId: string): SportSimulator {
  return simulators[sportId] || simulators['american-football'];
}

export async function runSportSimulation(
  sportId: string,
  matchId: string,
  seed: string,
  homeTeam: TeamState,
  awayTeam: TeamState
): Promise<SimulationResult> {
  const simulator = getSportSimulator(sportId);
  const result = await simulator.simulate(matchId, seed, homeTeam, awayTeam);
  return { ...result, seed, sportId: simulator.sportId };
}
