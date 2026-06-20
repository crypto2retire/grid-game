export {
  PlayerState,
  TeamState,
  SimulationEvent,
  SimulationResult,
  SportSimulator,
  getSportSimulator,
} from './simulators';

import { runSportSimulation, TeamState, SimulationResult } from './simulators';

export async function runMatchSimulation(
  sportId: string,
  matchId: string,
  seed: string,
  homeTeam: TeamState,
  awayTeam: TeamState
): Promise<SimulationResult> {
  return runSportSimulation(sportId, matchId, seed, homeTeam, awayTeam);
}
