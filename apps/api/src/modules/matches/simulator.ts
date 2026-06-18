import { SeededRNG } from '../utils/rng';
import { prisma } from '../config/database';

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

export interface MatchState {
  matchId: string;
  homeTeam: TeamState;
  awayTeam: TeamState;
  homeScore: number;
  awayScore: number;
  time: number;
  phase: 'first_half' | 'halftime' | 'second_half' | 'extra_time' | 'penalties' | 'finished';
  possession: 'home' | 'away';
  zone: 'defensive' | 'midfield' | 'attacking';
  events: SimulationEvent[];
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

export interface SimulationResult {
  homeScore: number;
  awayScore: number;
  events: SimulationEvent[];
  playerStats: Record<string, {
    goals: number;
    assists: number;
    shots: number;
    shotsOnTarget: number;
    passes: number;
    tackles: number;
    saves: number;
    rating: number;
  }>;
  seed: string;
}

const EVENT_TYPES = {
  PASS: 'pass',
  TACKLE: 'tackle',
  SHOT: 'shot',
  SAVE: 'save',
  GOAL: 'goal',
  CORNER: 'corner',
  FOUL: 'foul',
  CARD: 'card',
  SUBSTITUTION: 'substitution',
  INJURY: 'injury',
  POSSESSION_CHANGE: 'possession_change',
  HALFTIME: 'halftime',
  FULLTIME: 'fulltime',
};

export class SoccerSimulator {
  private rng: SeededRNG;
  private state: MatchState;
  private tick: number = 0;
  private readonly GAME_DURATION = 5400; // 90 minutes in seconds
  private readonly HALFTIME = 2700; // 45 minutes

  constructor(seed: string, homeTeam: TeamState, awayTeam: TeamState) {
    this.rng = new SeededRNG(seed);
    this.state = {
      matchId: '',
      homeTeam,
      awayTeam,
      homeScore: 0,
      awayScore: 0,
      time: 0,
      phase: 'first_half',
      possession: this.rng.bool() ? 'home' : 'away',
      zone: 'midfield',
      events: [],
    };
  }

  simulate(): SimulationResult {
    const playerStats: SimulationResult['playerStats'] = {};
    
    // Initialize player stats
    for (const player of [...this.state.homeTeam.players, ...this.state.awayTeam.players]) {
      playerStats[player.playerId] = {
        goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
        passes: 0, tackles: 0, saves: 0, rating: 6.0,
      };
    }

    while (this.state.time < this.GAME_DURATION) {
      this.tick++;
      this.state.time += 1; // 1 second per tick

      // Check halftime
      if (this.state.time === this.HALFTIME && this.state.phase === 'first_half') {
        this.state.phase = 'halftime';
        this.addEvent(EVENT_TYPES.HALFTIME, { score: `${this.state.homeScore}-${this.state.awayScore}` });
        this.state.time += 900; // 15 minute halftime
        this.state.phase = 'second_half';
      }

      // Resolve possession and zone
      this.resolvePossession();
      this.resolveZone();

      // Generate events based on zone and possession
      const event = this.resolveEvent();
      if (event) {
        this.state.events.push(event);
        this.applyEvent(event, playerStats);
      }

      // Update player fatigue
      this.updateFatigue();
    }

    // Fulltime
    this.state.phase = 'finished';
    this.addEvent(EVENT_TYPES.FULLTIME, { 
      score: `${this.state.homeScore}-${this.state.awayScore}`,
      homeTeam: this.state.homeTeam.name,
      awayTeam: this.state.awayTeam.name,
    });

    // Calculate final ratings
    this.calculateFinalRatings(playerStats);

    return {
      homeScore: this.state.homeScore,
      awayScore: this.state.awayScore,
      events: this.state.events,
      playerStats,
      seed: '',
    };
  }

  private resolvePossession(): void {
    const team = this.state.possession === 'home' ? this.state.homeTeam : this.state.awayTeam;
    const opponent = this.state.possession === 'home' ? this.state.awayTeam : this.state.homeTeam;

    // Possession probability based on tactics and player quality
    const passingQuality = this.getTeamPassingQuality(team);
    const pressingQuality = this.getTeamPressingQuality(opponent);
    const possessionProb = 0.5 + (passingQuality - pressingQuality) * 0.002;

    // Small chance of turnover each tick
    if (this.rng.bool(1 - possessionProb)) {
      this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
      
      // Add possession change event (not every time, only significant ones)
      if (this.rng.bool(0.05)) {
        const tackler = this.getRandomActivePlayer(opponent);
        this.addEvent(EVENT_TYPES.POSSESSION_CHANGE, {
          tacklerId: tackler?.playerId,
          tacklerName: tackler?.name,
        });
      }
    }
  }

  private resolveZone(): void {
    const team = this.state.possession === 'home' ? this.state.homeTeam : this.state.awayTeam;
    const opponent = this.state.possession === 'home' ? this.state.awayTeam : this.state.homeTeam;

    const attackQuality = this.getTeamAttackQuality(team);
    const defenseQuality = this.getTeamDefenseQuality(opponent);
    const progressionProb = 0.1 + (attackQuality - defenseQuality) * 0.001;

    if (this.state.zone === 'defensive') {
      if (this.rng.bool(progressionProb)) this.state.zone = 'midfield';
    } else if (this.state.zone === 'midfield') {
      if (this.rng.bool(progressionProb)) {
        this.state.zone = 'attacking';
      } else if (this.rng.bool(0.05)) {
        this.state.zone = 'defensive';
      }
    } else if (this.state.zone === 'attacking') {
      if (this.rng.bool(0.08)) this.state.zone = 'midfield';
    }
  }

  private resolveEvent(): SimulationEvent | null {
    const team = this.state.possession === 'home' ? this.state.homeTeam : this.state.awayTeam;
    const opponent = this.state.possession === 'home' ? this.state.awayTeam : this.state.homeTeam;

    // Event probability based on zone
    if (this.state.zone === 'attacking') {
      // Shot or chance creation
      if (this.rng.bool(0.03)) {
        return this.resolveShot(team, opponent);
      }
      if (this.rng.bool(0.02)) {
        return this.resolveCorner(team, opponent);
      }
    }

    if (this.state.zone === 'midfield') {
      // Tackle or foul
      if (this.rng.bool(0.02)) {
        return this.resolveTackle(team, opponent);
      }
      if (this.rng.bool(0.005)) {
        return this.resolveFoul(team, opponent);
      }
    }

    // Pass event (frequent but we don't log every pass)
    if (this.rng.bool(0.01)) {
      const passer = this.getRandomActivePlayer(team);
      const receiver = this.getRandomActivePlayer(team);
      if (passer && receiver && passer.playerId !== receiver.playerId) {
        return {
          timestamp: this.state.time,
          tick: this.tick,
          type: EVENT_TYPES.PASS,
          actorId: passer.playerId,
          actorName: passer.name,
          targetId: receiver.playerId,
          targetName: receiver.name,
        };
      }
    }

    return null;
  }

  private resolveShot(attackingTeam: TeamState, defendingTeam: TeamState): SimulationEvent | null {
    const shooter = this.getBestShooter(attackingTeam);
    const goalkeeper = defendingTeam.players.find(p => p.position === 'GK' && p.isActive);
    
    if (!shooter || !goalkeeper) return null;

    const shotQuality = shooter.stats.shooting * (shooter.condition / 100) * (1 + attackingTeam.morale * 0.01);
    const saveQuality = goalkeeper.stats.goalkeeping * (goalkeeper.condition / 100);
    
    const shotOnTarget = this.rng.bool(shotQuality / (shotQuality + 30));
    const goal = shotOnTarget && this.rng.bool(shotQuality / (shotQuality + saveQuality + 20));

    const metadata: Record<string, any> = {
      distance: this.rng.int(10, 30),
      shotQuality: Math.round(shotQuality),
    };

    if (goal) {
      if (this.state.possession === 'home') {
        this.state.homeScore++;
      } else {
        this.state.awayScore++;
      }
      
      // Update morale
      attackingTeam.morale = Math.min(100, attackingTeam.morale + 10);
      defendingTeam.morale = Math.max(0, defendingTeam.morale - 5);

      return {
        timestamp: this.state.time,
        tick: this.tick,
        type: EVENT_TYPES.GOAL,
        actorId: shooter.playerId,
        actorName: shooter.name,
        metadata: { ...metadata, score: `${this.state.homeScore}-${this.state.awayScore}` },
      };
    } else if (shotOnTarget) {
      return {
        timestamp: this.state.time,
        tick: this.tick,
        type: EVENT_TYPES.SAVE,
        actorId: goalkeeper.playerId,
        actorName: goalkeeper.name,
        targetId: shooter.playerId,
        targetName: shooter.name,
        metadata,
      };
    } else {
      return {
        timestamp: this.state.time,
        tick: this.tick,
        type: EVENT_TYPES.SHOT,
        actorId: shooter.playerId,
        actorName: shooter.name,
        metadata: { ...metadata, onTarget: false },
      };
    }
  }

  private resolveCorner(attackingTeam: TeamState, defendingTeam: TeamState): SimulationEvent | null {
    const taker = attackingTeam.players.find(p => p.isActive && p.stats.passing > 70);
    if (!taker) return null;

    const goal = this.rng.bool(0.15); // 15% chance of goal from corner

    if (goal) {
      const scorer = this.getBestShooter(attackingTeam);
      if (this.state.possession === 'home') this.state.homeScore++;
      else this.state.awayScore++;
      
      return {
        timestamp: this.state.time,
        tick: this.tick,
        type: EVENT_TYPES.GOAL,
        actorId: scorer?.playerId,
        actorName: scorer?.name,
        metadata: { fromCorner: true, score: `${this.state.homeScore}-${this.state.awayScore}` },
      };
    }

    return {
      timestamp: this.state.time,
      tick: this.tick,
      type: EVENT_TYPES.CORNER,
      actorId: taker.playerId,
      actorName: taker.name,
    };
  }

  private resolveTackle(team: TeamState, opponent: TeamState): SimulationEvent | null {
    const tackler = this.getRandomActivePlayer(opponent);
    const target = this.getRandomActivePlayer(team);
    
    if (!tackler || !target) return null;

    const tackleSuccess = this.rng.bool(
      (tackler.stats.defending + tackler.stats.physical) / 
      (tackler.stats.defending + tackler.stats.physical + target.stats.dribbling + 40)
    );

    if (tackleSuccess) {
      this.state.possession = this.state.possession === 'home' ? 'away' : 'home';
      return {
        timestamp: this.state.time,
        tick: this.tick,
        type: EVENT_TYPES.TACKLE,
        actorId: tackler.playerId,
        actorName: tackler.name,
        targetId: target.playerId,
        targetName: target.name,
        metadata: { successful: true },
      };
    }

    return null;
  }

  private resolveFoul(team: TeamState, opponent: TeamState): SimulationEvent | null {
    const fouler = this.getRandomActivePlayer(opponent);
    const victim = this.getRandomActivePlayer(team);
    
    if (!fouler || !victim) return null;

    const cardProb = (fouler.stats.physical - fouler.stats.defending) / 100;
    const card = this.rng.bool(cardProb * 0.3);

    return {
      timestamp: this.state.time,
      tick: this.tick,
      type: EVENT_TYPES.FOUL,
      actorId: fouler.playerId,
      actorName: fouler.name,
      targetId: victim.playerId,
      targetName: victim.name,
      metadata: { card: card ? 'yellow' : null },
    };
  }

  private applyEvent(event: SimulationEvent, stats: SimulationResult['playerStats']): void {
    const updateStats = (playerId: string, updates: Partial<typeof stats[string]>) => {
      if (stats[playerId]) {
        Object.assign(stats[playerId], updates);
      }
    };

    switch (event.type) {
      case EVENT_TYPES.GOAL:
        if (event.actorId) {
          updateStats(event.actorId, { goals: (stats[event.actorId]?.goals || 0) + 1 });
        }
        break;
      case EVENT_TYPES.SHOT:
        if (event.actorId) {
          updateStats(event.actorId, { shots: (stats[event.actorId]?.shots || 0) + 1 });
        }
        break;
      case EVENT_TYPES.SAVE:
        if (event.actorId) {
          updateStats(event.actorId, { saves: (stats[event.actorId]?.saves || 0) + 1 });
        }
        if (event.targetId) {
          updateStats(event.targetId, { shots: (stats[event.targetId]?.shots || 0) + 1, shotsOnTarget: (stats[event.targetId]?.shotsOnTarget || 0) + 1 });
        }
        break;
      case EVENT_TYPES.PASS:
        if (event.actorId) {
          updateStats(event.actorId, { passes: (stats[event.actorId]?.passes || 0) + 1 });
        }
        break;
      case EVENT_TYPES.TACKLE:
        if (event.actorId) {
          updateStats(event.actorId, { tackles: (stats[event.actorId]?.tackles || 0) + 1 });
        }
        break;
    }
  }

  private updateFatigue(): void {
    for (const player of [...this.state.homeTeam.players, ...this.state.awayTeam.players]) {
      if (player.isActive) {
        player.condition = Math.max(0, player.condition - 0.02);
      }
    }
  }

  private calculateFinalRatings(stats: SimulationResult['playerStats']): void {
    for (const [playerId, playerStats] of Object.entries(stats)) {
      let rating = 6.0;
      rating += playerStats.goals * 1.5;
      rating += playerStats.assists * 1.0;
      rating += playerStats.shotsOnTarget * 0.2;
      rating += playerStats.passes * 0.05;
      rating += playerStats.tackles * 0.3;
      rating += playerStats.saves * 0.5;
      rating = Math.min(10, Math.max(1, rating));
      stats[playerId].rating = Math.round(rating * 10) / 10;
    }
  }

  private addEvent(type: string, metadata?: Record<string, any>): void {
    this.state.events.push({
      timestamp: this.state.time,
      tick: this.tick,
      type,
      metadata,
    });
  }

  private getRandomActivePlayer(team: TeamState): PlayerState | undefined {
    const active = team.players.filter(p => p.isActive);
    return active.length > 0 ? this.rng.choice(active) : undefined;
  }

  private getBestShooter(team: TeamState): PlayerState | undefined {
    const active = team.players.filter(p => p.isActive && p.position !== 'GK');
    return active.sort((a, b) => b.stats.shooting - a.stats.shooting)[0];
  }

  private getTeamPassingQuality(team: TeamState): number {
    return team.players
      .filter(p => p.isActive)
      .reduce((sum, p) => sum + p.stats.passing * (p.condition / 100), 0) / 11;
  }

  private getTeamPressingQuality(team: TeamState): number {
    return team.players
      .filter(p => p.isActive)
      .reduce((sum, p) => sum + p.stats.defending * (p.condition / 100), 0) / 11;
  }

  private getTeamAttackQuality(team: TeamState): number {
    return team.players
      .filter(p => p.isActive)
      .reduce((sum, p) => sum + (p.stats.shooting + p.stats.dribbling) * (p.condition / 100), 0) / 11;
  }

  private getTeamDefenseQuality(team: TeamState): number {
    return team.players
      .filter(p => p.isActive)
      .reduce((sum, p) => sum + p.stats.defending * (p.condition / 100), 0) / 11;
  }
}

export async function runMatchSimulation(
  matchId: string,
  seed: string,
  homeTeam: TeamState,
  awayTeam: TeamState
): Promise<SimulationResult> {
  const simulator = new SoccerSimulator(seed, homeTeam, awayTeam);
  const result = simulator.simulate();
  result.seed = seed;
  return result;
}
