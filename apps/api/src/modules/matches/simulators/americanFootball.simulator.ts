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

const FOOTBALL_EVENTS = {
  KICKOFF: 'kickoff',
  DRIVE_START: 'drive_start',
  PASS_COMPLETION: 'pass_completion',
  RUSH: 'rush',
  SACK: 'sack',
  TURNOVER: 'turnover',
  FIELD_GOAL: 'field_goal',
  TOUCHDOWN: 'touchdown',
  END_QUARTER: 'end_quarter',
  FINAL: 'final',
};

export class AmericanFootballSimulator implements SportSimulator {
  readonly sportId = 'american-football';

  simulate(_matchId: string, seed: string, homeTeam: TeamState, awayTeam: TeamState): SimulationResult {
    const rng = new SeededRNG(seed);
    const events: SimulationEvent[] = [];
    const playerStats = createEmptyPlayerStats([...homeTeam.players, ...awayTeam.players]);
    let homeScore = 0;
    let awayScore = 0;
    let tick = 0;
    let possession: 'home' | 'away' = rng.bool() ? 'home' : 'away';

    events.push({ timestamp: 0, tick: tick++, type: FOOTBALL_EVENTS.KICKOFF, metadata: { possession } });

    const getTeam = (side: 'home' | 'away') => side === 'home' ? homeTeam : awayTeam;
    const addScore = (side: 'home' | 'away', points: number) => {
      if (side === 'home') homeScore += points;
      else awayScore += points;
    };

    for (let drive = 1; drive <= 18; drive++) {
      const offense = getTeam(possession);
      const defense = getTeam(possession === 'home' ? 'away' : 'home');
      const offenseQuality = teamQuality(offense, { shooting: 0.25, passing: 0.25, dribbling: 0.15, physical: 0.2, pace: 0.15 });
      const defenseQuality = teamQuality(defense, { defending: 0.45, physical: 0.25, pace: 0.15, passing: 0.15 });
      const driveAdvantage = offenseQuality - defenseQuality;
      const timestamp = drive * 200;

      events.push({
        timestamp,
        tick: tick++,
        type: FOOTBALL_EVENTS.DRIVE_START,
        metadata: { drive, possession, offense: offense.name, score: `${homeScore}-${awayScore}` },
      });

      const qb = this.bestAt(offense, ['QB']) || this.bestOffensivePlayer(offense);
      const runner = this.bestAt(offense, ['RB', 'WR', 'TE']) || this.bestOffensivePlayer(offense);
      const receiver = this.bestAt(offense, ['WR', 'TE', 'RB']) || this.bestOffensivePlayer(offense);
      const defender = this.bestAt(defense, ['DL', 'LB', 'CB', 'S']) || this.bestDefensivePlayer(defense);
      const kicker = this.bestAt(offense, ['K']) || this.bestOffensivePlayer(offense);

      const turnoverChance = Math.max(0.04, Math.min(0.22, 0.13 - driveAdvantage / 350));
      const touchdownChance = Math.max(0.08, Math.min(0.42, 0.20 + driveAdvantage / 220));
      const fieldGoalChance = Math.max(0.10, Math.min(0.35, 0.20 + driveAdvantage / 350));

      if (rng.bool(turnoverChance)) {
        if (defender) {
          playerStats[defender.playerId].tackles += 1;
          playerStats[defender.playerId].sportStats = {
            ...playerStats[defender.playerId].sportStats,
            turnoversForced: (playerStats[defender.playerId].sportStats?.turnoversForced || 0) + 1,
          };
        }
        events.push({
          timestamp: timestamp + rng.int(10, 150),
          tick: tick++,
          type: FOOTBALL_EVENTS.TURNOVER,
          actorId: defender?.playerId,
          actorName: defender?.name,
          targetId: qb?.playerId,
          targetName: qb?.name,
          metadata: { drive, possession, score: `${homeScore}-${awayScore}` },
        });
      } else if (rng.bool(touchdownChance)) {
        addScore(possession, 7);
        const scorer = rng.bool(0.55) ? receiver : runner;
        if (scorer) {
          playerStats[scorer.playerId].goals += 1; // legacy compatibility: TDs
          playerStats[scorer.playerId].shots += 1;
          playerStats[scorer.playerId].shotsOnTarget += 1;
          playerStats[scorer.playerId].sportStats = {
            ...playerStats[scorer.playerId].sportStats,
            touchdowns: (playerStats[scorer.playerId].sportStats?.touchdowns || 0) + 1,
            yards: (playerStats[scorer.playerId].sportStats?.yards || 0) + rng.int(12, 75),
          };
        }
        if (qb && scorer?.playerId !== qb.playerId && ['WR', 'TE', 'RB'].includes(scorer?.position || '')) {
          playerStats[qb.playerId].assists += 1; // legacy compatibility: passing TD assist
          playerStats[qb.playerId].passes += 1;
          playerStats[qb.playerId].sportStats = {
            ...playerStats[qb.playerId].sportStats,
            passingTouchdowns: (playerStats[qb.playerId].sportStats?.passingTouchdowns || 0) + 1,
          };
        }
        events.push({
          timestamp: timestamp + rng.int(30, 190),
          tick: tick++,
          type: FOOTBALL_EVENTS.TOUCHDOWN,
          actorId: scorer?.playerId,
          actorName: scorer?.name,
          targetId: qb?.playerId,
          targetName: qb?.name,
          metadata: { drive, possession, points: 7, score: `${homeScore}-${awayScore}` },
        });
      } else if (rng.bool(fieldGoalChance)) {
        addScore(possession, 3);
        if (kicker) {
          playerStats[kicker.playerId].saves += 1; // legacy compatibility: special-teams make
          playerStats[kicker.playerId].sportStats = {
            ...playerStats[kicker.playerId].sportStats,
            fieldGoals: (playerStats[kicker.playerId].sportStats?.fieldGoals || 0) + 1,
          };
        }
        events.push({
          timestamp: timestamp + rng.int(80, 195),
          tick: tick++,
          type: FOOTBALL_EVENTS.FIELD_GOAL,
          actorId: kicker?.playerId,
          actorName: kicker?.name,
          metadata: { drive, possession, points: 3, score: `${homeScore}-${awayScore}` },
        });
      } else {
        const playType = rng.bool(0.58) ? FOOTBALL_EVENTS.RUSH : FOOTBALL_EVENTS.PASS_COMPLETION;
        const actor = playType === FOOTBALL_EVENTS.RUSH ? runner : qb;
        if (actor) {
          playerStats[actor.playerId].passes += playType === FOOTBALL_EVENTS.PASS_COMPLETION ? 1 : 0;
          playerStats[actor.playerId].shots += 1;
          playerStats[actor.playerId].sportStats = {
            ...playerStats[actor.playerId].sportStats,
            yards: (playerStats[actor.playerId].sportStats?.yards || 0) + rng.int(1, 35),
          };
        }
        if (defender) playerStats[defender.playerId].tackles += 1;
        events.push({
          timestamp: timestamp + rng.int(20, 170),
          tick: tick++,
          type: playType,
          actorId: actor?.playerId,
          actorName: actor?.name,
          targetId: defender?.playerId,
          targetName: defender?.name,
          metadata: { drive, possession, yards: rng.int(1, 35), score: `${homeScore}-${awayScore}` },
        });
      }

      if (drive % 5 === 0) {
        events.push({ timestamp: timestamp + 199, tick: tick++, type: FOOTBALL_EVENTS.END_QUARTER, metadata: { quarter: Math.min(4, Math.ceil(drive / 5)), score: `${homeScore}-${awayScore}` } });
      }
      possession = possession === 'home' ? 'away' : 'home';
    }

    if (homeScore === awayScore) {
      const overtimeWinner = rng.bool() ? 'home' : 'away';
      addScore(overtimeWinner, 3);
      events.push({ timestamp: 3900, tick: tick++, type: FOOTBALL_EVENTS.FIELD_GOAL, metadata: { overtime: true, possession: overtimeWinner, points: 3, score: `${homeScore}-${awayScore}` } });
    }

    for (const stats of Object.values(playerStats)) {
      const sportStats = stats.sportStats || {};
      const rating = 6 + stats.goals * 1.4 + stats.assists * 0.9 + stats.tackles * 0.25 + (sportStats.yards || 0) / 120 + (sportStats.turnoversForced || 0) * 0.8;
      stats.rating = Math.round(Math.min(10, Math.max(1, rating)) * 10) / 10;
    }

    events.push({ timestamp: 4200, tick, type: FOOTBALL_EVENTS.FINAL, metadata: { score: `${homeScore}-${awayScore}`, sportId: this.sportId } });

    return {
      homeScore,
      awayScore,
      events,
      playerStats,
      seed,
      sportId: this.sportId,
      metadata: { drives: 18, scoringUnit: 'points', simulator: 'american-football-v1' },
    };
  }

  private bestAt(team: TeamState, positions: string[]): PlayerState | undefined {
    return activePlayers(team)
      .filter((player) => positions.includes(player.position))
      .sort((a, b) => this.offenseScore(b) - this.offenseScore(a))[0];
  }

  private bestOffensivePlayer(team: TeamState): PlayerState | undefined {
    return activePlayers(team).sort((a, b) => this.offenseScore(b) - this.offenseScore(a))[0];
  }

  private bestDefensivePlayer(team: TeamState): PlayerState | undefined {
    return activePlayers(team).sort((a, b) => this.defenseScore(b) - this.defenseScore(a))[0];
  }

  private offenseScore(player: PlayerState): number {
    return player.stats.shooting + player.stats.passing + player.stats.dribbling + player.stats.pace + player.stats.physical;
  }

  private defenseScore(player: PlayerState): number {
    return player.stats.defending + player.stats.physical + player.stats.pace + player.stats.passing;
  }
}
