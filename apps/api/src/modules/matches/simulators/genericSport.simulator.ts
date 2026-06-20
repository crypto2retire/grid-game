import { SeededRNG } from '../../../utils/rng';
import {
  activePlayers,
  createEmptyPlayerStats,
  PlayerState,
  SimulationEvent,
  SimulationResult,
  SportSimulator,
  TeamState,
  teamQuality,
} from './types';

type GenericProfile = {
  sportId: string;
  scoringEvent: string;
  finalEvent: string;
  scoringUnit: string;
  regulationTicks: number;
  maxScorePerEvent: number;
};

const PROFILES: Record<string, GenericProfile> = {
  soccer: {
    sportId: 'soccer',
    scoringEvent: 'goal',
    finalEvent: 'fulltime',
    scoringUnit: 'goals',
    regulationTicks: 90,
    maxScorePerEvent: 1,
  },
  basketball: {
    sportId: 'basketball',
    scoringEvent: 'basket',
    finalEvent: 'final_buzzer',
    scoringUnit: 'points',
    regulationTicks: 48,
    maxScorePerEvent: 3,
  },
  baseball: {
    sportId: 'baseball',
    scoringEvent: 'run',
    finalEvent: 'final_out',
    scoringUnit: 'runs',
    regulationTicks: 9,
    maxScorePerEvent: 4,
  },
  'ai-crypto': {
    sportId: 'ai-crypto',
    scoringEvent: 'agent_profit_cycle',
    finalEvent: 'simulation_settled',
    scoringUnit: 'score',
    regulationTicks: 12,
    maxScorePerEvent: 5,
  },
};

export class GenericSportSimulator implements SportSimulator {
  readonly sportId: string;
  private readonly profile: GenericProfile;

  constructor(sportId: string) {
    this.profile = PROFILES[sportId] || PROFILES.soccer;
    this.sportId = this.profile.sportId;
  }

  simulate(_matchId: string, seed: string, homeTeam: TeamState, awayTeam: TeamState): SimulationResult {
    const rng = new SeededRNG(`${this.sportId}:${seed}`);
    const events: SimulationEvent[] = [];
    const playerStats = createEmptyPlayerStats([...homeTeam.players, ...awayTeam.players]);
    let homeScore = 0;
    let awayScore = 0;
    let tick = 0;

    const homeQuality = teamQuality(homeTeam, { pace: 0.15, shooting: 0.25, passing: 0.2, dribbling: 0.15, defending: 0.15, physical: 0.1 });
    const awayQuality = teamQuality(awayTeam, { pace: 0.15, shooting: 0.25, passing: 0.2, dribbling: 0.15, defending: 0.15, physical: 0.1 });

    const scoreChance = (attack: number, defense: number) => Math.max(0.08, Math.min(0.52, 0.22 + (attack - defense) / 240));

    for (let phase = 1; phase <= this.profile.regulationTicks; phase++) {
      const timestamp = phase * 60;
      const homeChance = scoreChance(homeQuality, awayQuality);
      const awayChance = scoreChance(awayQuality, homeQuality);

      if (rng.bool(homeChance)) {
        const points = this.points(rng);
        homeScore += points;
        const scorer = this.pickScorer(rng, homeTeam);
        this.applyScoring(playerStats, scorer, points);
        events.push(this.scoringEvent(timestamp, tick++, 'home', scorer, points, homeScore, awayScore));
      }

      if (rng.bool(awayChance)) {
        const points = this.points(rng);
        awayScore += points;
        const scorer = this.pickScorer(rng, awayTeam);
        this.applyScoring(playerStats, scorer, points);
        events.push(this.scoringEvent(timestamp + 30, tick++, 'away', scorer, points, homeScore, awayScore));
      }

      if (rng.bool(0.18)) {
        const side = rng.bool() ? 'home' : 'away';
        const team = side === 'home' ? homeTeam : awayTeam;
        const defender = this.pickDefender(rng, side === 'home' ? awayTeam : homeTeam);
        const actor = this.pickScorer(rng, team);
        if (actor) playerStats[actor.playerId].passes += 1;
        if (defender) playerStats[defender.playerId].tackles += 1;
        events.push({
          timestamp: timestamp + 15,
          tick: tick++,
          type: 'possession_sequence',
          actorId: actor?.playerId,
          actorName: actor?.name,
          targetId: defender?.playerId,
          targetName: defender?.name,
          metadata: { side, sportId: this.sportId, score: `${homeScore}-${awayScore}` },
        });
      }
    }

    if (homeScore === awayScore) {
      const winner = rng.bool() ? 'home' : 'away';
      if (winner === 'home') homeScore += 1;
      else awayScore += 1;
      events.push({ timestamp: this.profile.regulationTicks * 60 + 60, tick: tick++, type: 'tiebreaker', metadata: { winner, score: `${homeScore}-${awayScore}` } });
    }

    for (const stats of Object.values(playerStats)) {
      const rating = 6 + stats.goals * 0.9 + stats.assists * 0.5 + stats.passes * 0.03 + stats.tackles * 0.2;
      stats.rating = Math.round(Math.min(10, Math.max(1, rating)) * 10) / 10;
    }

    events.push({ timestamp: this.profile.regulationTicks * 60 + 120, tick: tick++, type: this.profile.finalEvent, metadata: { sportId: this.sportId, score: `${homeScore}-${awayScore}` } });

    return {
      homeScore,
      awayScore,
      events,
      playerStats,
      seed,
      sportId: this.sportId,
      metadata: { simulator: `${this.sportId}-generic-v1`, scoringUnit: this.profile.scoringUnit },
    };
  }

  private points(rng: SeededRNG): number {
    if (this.profile.maxScorePerEvent <= 1) return 1;
    return rng.int(1, this.profile.maxScorePerEvent);
  }

  private pickScorer(rng: SeededRNG, team: TeamState): PlayerState | undefined {
    const players = activePlayers(team).sort((a, b) => (b.stats.shooting + b.stats.dribbling + b.stats.passing) - (a.stats.shooting + a.stats.dribbling + a.stats.passing));
    return players.length ? rng.choice(players.slice(0, Math.min(5, players.length))) : undefined;
  }

  private pickDefender(rng: SeededRNG, team: TeamState): PlayerState | undefined {
    const players = activePlayers(team).sort((a, b) => (b.stats.defending + b.stats.physical) - (a.stats.defending + a.stats.physical));
    return players.length ? rng.choice(players.slice(0, Math.min(5, players.length))) : undefined;
  }

  private applyScoring(playerStats: SimulationResult['playerStats'], scorer: PlayerState | undefined, points: number): void {
    if (!scorer) return;
    playerStats[scorer.playerId].goals += points;
    playerStats[scorer.playerId].shots += 1;
    playerStats[scorer.playerId].shotsOnTarget += 1;
    playerStats[scorer.playerId].sportStats = {
      ...playerStats[scorer.playerId].sportStats,
      [this.profile.scoringUnit]: (playerStats[scorer.playerId].sportStats?.[this.profile.scoringUnit] || 0) + points,
    };
  }

  private scoringEvent(timestamp: number, tick: number, side: 'home' | 'away', scorer: PlayerState | undefined, points: number, homeScore: number, awayScore: number): SimulationEvent {
    return {
      timestamp,
      tick,
      type: this.profile.scoringEvent,
      actorId: scorer?.playerId,
      actorName: scorer?.name,
      metadata: { side, points, sportId: this.sportId, score: `${homeScore}-${awayScore}` },
    };
  }
}
