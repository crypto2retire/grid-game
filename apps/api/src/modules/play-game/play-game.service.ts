import { prisma } from '../../config/database';
import { SeededRNG } from '../../utils/rng';

// ─── Game Constants ───
const QUARTER_LENGTH = 900; // 15 minutes in seconds
const PLAY_CLOCK_DRAIN = 15; // seconds per play (average)
const RUNOFF_SECONDS = 5; // extra time for runs
const PASS_CLOCK_DRAIN = 10; // shorter for pass plays (incomplete stops clock)

// ─── Play Types ───
const OFFENSIVE_PLAYS = [
  { type: 'RUN_LEFT', category: 'RUN', baseYards: 4, variance: 6, risk: 0.05 },
  { type: 'RUN_MIDDLE', category: 'RUN', baseYards: 3, variance: 5, risk: 0.04 },
  { type: 'RUN_RIGHT', category: 'RUN', baseYards: 4, variance: 6, risk: 0.05 },
  { type: 'QB_DRAW', category: 'RUN', baseYards: 5, variance: 8, risk: 0.06 },
  { type: 'SHORT_PASS', category: 'PASS', baseYards: 6, variance: 5, risk: 0.08 },
  { type: 'MEDIUM_PASS', category: 'PASS', baseYards: 12, variance: 10, risk: 0.15 },
  { type: 'DEEP_BALL', category: 'PASS', baseYards: 25, variance: 20, risk: 0.25 },
  { type: 'SCREEN', category: 'PASS', baseYards: 8, variance: 8, risk: 0.06 },
  { type: 'PUNT', category: 'SPECIAL_TEAMS', baseYards: 40, variance: 15, risk: 0.02 },
  { type: 'FIELD_GOAL', category: 'SPECIAL_TEAMS', baseYards: 0, variance: 0, risk: 0.10 },
];

const DEFENSIVE_PLAYS = [
  { type: 'COVER_2', runPenalty: 0, passPenalty: -2, bigPlayPenalty: -3 },
  { type: 'COVER_3', runPenalty: 1, passPenalty: -1, bigPlayPenalty: -2 },
  { type: 'MAN_COVERAGE', runPenalty: 2, passPenalty: 0, bigPlayPenalty: -1 },
  { type: 'BLITZ', runPenalty: 3, passPenalty: 2, bigPlayPenalty: 3 },
  { type: 'PREVENT', runPenalty: -1, passPenalty: -3, bigPlayPenalty: -5 },
];

interface LineupPlayer {
  playerId: string;
  position: string;
  name: string;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

/**
 * Get a team's roster with stats for gameplay.
 */
export async function getTeamRosterForGame(teamId: string): Promise<LineupPlayer[]> {
  const teamPlayers = await prisma.teamPlayer.findMany({
    where: { teamId },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          position: true,
          overall: true,
          pace: true,
          shooting: true,
          passing: true,
          dribbling: true,
          defending: true,
          physical: true,
        },
      },
    },
  });

  return teamPlayers.map((tp) => ({
    playerId: tp.player.id,
    position: tp.player.position,
    name: tp.player.name,
    overall: tp.player.overall,
    pace: tp.player.pace,
    shooting: tp.player.shooting,
    passing: tp.player.passing,
    dribbling: tp.player.dribbling,
    defending: tp.player.defending,
    physical: tp.player.physical,
  }));
}

/**
 * Initialize a match as playable. Called when user clicks "Play Game".
 */
export async function initializePlayableMatch(matchId: string, userTeamId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { include: { teamPlayers: { include: { player: true } } } },
      awayTeam: { include: { teamPlayers: { include: { player: true } } } },
    },
  });

  if (!match) {
    throw new Error('Match not found');
  }

  if (match.status !== 'SCHEDULED') {
    throw new Error('Match is not scheduled');
  }

  // Default starters: first 11 players
  const homeStarters = match.homeTeam.teamPlayers.slice(0, 11).map((tp) => tp.player.id);
  const awayStarters = match.awayTeam.teamPlayers.slice(0, 11).map((tp) => tp.player.id);

  const homeRoster = await getTeamRosterForGame(match.homeTeamId);
  const awayRoster = await getTeamRosterForGame(match.awayTeamId);

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      isPlayable: true,
      gamePhase: 'PREGAME',
      possessionTeamId: match.homeTeamId,
      ballPosition: 25,
      down: 1,
      yardsToGo: 10,
      currentQuarter: 1,
      gameClock: QUARTER_LENGTH,
      homeScore: 0,
      awayScore: 0,
      offensiveLineup: homeStarters as any,
      defensiveLineup: awayStarters as any,
      userTeamId,
      playHistory: [] as any,
    },
  });

  return {
    match: updated,
    homeRoster,
    awayRoster,
  };
}

/**
 * Set lineups and playbook styles before the game starts.
 */
export async function setLineupAndStyles(
  matchId: string,
  _userTeamId: string,
  offensiveLineup: string[],
  defensiveLineup: string[],
  offensiveStyle: string,
  defensiveStyle: string
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || !match.isPlayable) {
    throw new Error('Match is not playable');
  }
  if (match.gamePhase !== 'PREGAME') {
    throw new Error('Lineup can only be set during pregame');
  }

  return prisma.match.update({
    where: { id: matchId },
    data: {
      gamePhase: 'IN_PROGRESS',
      startedAt: new Date(),
      offensiveLineup: offensiveLineup as any,
      defensiveLineup: defensiveLineup as any,
      offensiveStyle,
      defensiveStyle,
    },
  });
}

/**
 * Resolve a single play. The core game engine.
 */
export async function resolvePlay(
  matchId: string,
  playType: string,
  direction?: string
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { include: { teamPlayers: { include: { player: true } } } },
      awayTeam: { include: { teamPlayers: { include: { player: true } } } },
    },
  });

  if (!match || !match.isPlayable) {
    throw new Error('Match not playable');
  }
  if (match.gamePhase !== 'IN_PROGRESS') {
    throw new Error('Game is not in progress');
  }

  const seed = match.seed || match.id;
  const rng = new SeededRNG(seed + (match.playHistory as any[]).length);
  const roll = () => rng.next();

  const playDef = OFFENSIVE_PLAYS.find((p) => p.type === playType);
  if (!playDef) {
    throw new Error('Invalid play type');
  }

  const isHomePossession = match.possessionTeamId === match.homeTeamId;
  const offenseTeam = isHomePossession ? match.homeTeam : match.awayTeam;
  const defenseTeam = isHomePossession ? match.awayTeam : match.homeTeam;

  const offenseLineupIds = (match.offensiveLineup as string[]) || [];
  const defenseLineupIds = (match.defensiveLineup as string[]) || [];

  const offensePlayers = offenseTeam.teamPlayers
    .filter((tp) => offenseLineupIds.includes(tp.player.id))
    .map((tp) => tp.player);
  const defensePlayers = defenseTeam.teamPlayers
    .filter((tp) => defenseLineupIds.includes(tp.player.id))
    .map((tp) => tp.player);

  const qb = offensePlayers.find((p) => p.position === 'QB') || offensePlayers[0];
  const rb = offensePlayers.find((p) => p.position === 'RB') || offensePlayers[1];
  const wr = offensePlayers.find((p) => p.position === 'WR') || offensePlayers[2];
  const ol = offensePlayers.filter((p) => p.position === 'OL');

  const dl = defensePlayers.find((p) => p.position === 'DL') || defensePlayers[0];
  const lb = defensePlayers.find((p) => p.position === 'LB') || defensePlayers[1];
  const cb = defensePlayers.find((p) => p.position === 'CB') || defensePlayers[2];

  const aiDefPlay = DEFENSIVE_PLAYS[Math.floor(roll() * DEFENSIVE_PLAYS.length)];

  let offPower = 0;
  let yards = 0;
  let result = 'GAIN';
  let description = '';
  let primaryPlayer = qb;
  let targetPlayer = rb;
  let scoreChange = 0;
  let firstDown = false;
  let newBallPosition = match.ballPosition;
  let newDown = match.down + 1;
  let newYardsToGo = match.yardsToGo;
  let newPossession = match.possessionTeamId;
  let newHomeScore = match.homeScore;
  let newAwayScore = match.awayScore;
  let newQuarter = match.currentQuarter;
  let newGameClock = match.gameClock;
  let gameOver = false;

  // ─── Special Teams: PUNT ───
  if (playType === 'PUNT') {
    const puntDistance = Math.floor(35 + roll() * 25); // 35-60 yards
    const returnYards = Math.floor(roll() * 15); // 0-15 return
    const netYards = puntDistance - returnYards;
    const kicker = offensePlayers.find((p) => p.position === 'K') || offensePlayers[0];
    const returner = defensePlayers.find((p) => p.position === 'CB') || defensePlayers[0];

    yards = netYards;
    result = 'PUNT';
    description = `${kicker.name} punts ${puntDistance} yards! ${returner.name} returns it ${returnYards} yards.`;
    primaryPlayer = kicker;
    targetPlayer = returner;

    newBallPosition = match.ballPosition + (isHomePossession ? netYards : -netYards);
    // Clamp to field limits
    if (newBallPosition > 100) newBallPosition = 100;
    if (newBallPosition < 0) newBallPosition = 0;
    // Check for touchback
    if (newBallPosition >= 100) {
      newBallPosition = 75; // Touchback, opponent gets ball at 25
      description = `${kicker.name} punts... TOUCHBACK! Ball placed at the 25-yard line.`;
    }
    newPossession = isHomePossession ? match.awayTeamId : match.homeTeamId;
    newDown = 1;
    newYardsToGo = 10;
    newGameClock = Math.max(0, match.gameClock - PLAY_CLOCK_DRAIN);

  // ─── Special Teams: FIELD GOAL ───
  } else if (playType === 'FIELD_GOAL') {
    const kicker = offensePlayers.find((p) => p.position === 'K') || offensePlayers[0];
    const distanceToGoal = isHomePossession ? 100 - match.ballPosition : match.ballPosition;
    // Field goal range: 55 yards max (roughly midfield). Gets harder with distance.
    const maxRange = 55;
    const difficulty = distanceToGoal / maxRange;
    const kickPower = (kicker?.physical || 50) * 0.5 + (kicker?.shooting || 50) * 0.5;
    const successChance = Math.max(0.1, Math.min(0.95, (kickPower / 100) * (1 - difficulty * 0.5)));
    const isGood = roll() < successChance;

    if (isGood) {
      result = 'FIELD_GOAL';
      scoreChange = 3;
      description = `${kicker.name} lines up... the kick is GOOD from ${distanceToGoal} yards out! 3 points!`;
      if (isHomePossession) newHomeScore += 3; else newAwayScore += 3;
      // Kickoff after FG
      newBallPosition = 25;
      newPossession = isHomePossession ? match.awayTeamId : match.homeTeamId;
      newDown = 1;
      newYardsToGo = 10;
    } else {
      result = 'MISSED_FG';
      description = `${kicker.name} attempts a ${distanceToGoal}-yard field goal... it's NO GOOD!`;
      newBallPosition = match.ballPosition; // Ball goes to opponent at spot of kick
      newPossession = isHomePossession ? match.awayTeamId : match.homeTeamId;
      newDown = 1;
      newYardsToGo = 10;
    }
    newGameClock = Math.max(0, match.gameClock - PLAY_CLOCK_DRAIN);
    primaryPlayer = kicker;

  // ─── Normal Run/Pass Plays ───
  } else {
    if (playDef.category === 'RUN') {
      offPower = (rb?.physical || 50) * 0.4 + (rb?.pace || 50) * 0.3 + (ol[0]?.defending || 50) * 0.2 + (qb?.physical || 50) * 0.1;
    } else {
      offPower = (qb?.passing || 50) * 0.35 + (wr?.shooting || 50) * 0.25 + (wr?.pace || 50) * 0.2 + (qb?.physical || 50) * 0.1 + (ol[0]?.defending || 50) * 0.1;
    }

    let defPower = 0;
    if (playDef.category === 'RUN') {
      defPower = (dl?.defending || 50) * 0.4 + (lb?.defending || 50) * 0.3 + (dl?.physical || 50) * 0.2 + (cb?.defending || 50) * 0.1;
      defPower += aiDefPlay.runPenalty * 2;
    } else {
      defPower = (cb?.defending || 50) * 0.35 + (lb?.defending || 50) * 0.25 + (dl?.defending || 50) * 0.2 + (cb?.pace || 50) * 0.2;
      defPower += aiDefPlay.passPenalty * 2;
    }

    const differential = offPower - defPower + 50;
    const normalizedDiff = (differential - 50) / 50;

    const turnoverThreshold = playDef.risk + (normalizedDiff < -0.3 ? 0.1 : 0);
    const isTurnover = roll() < turnoverThreshold;

    const bigPlayChance = Math.max(0, normalizedDiff * 0.15);
    const isBigPlay = roll() < bigPlayChance;

    if (isTurnover) {
      const turnoverType = roll() < 0.5 ? 'INTERCEPTION' : 'FUMBLE';
      result = turnoverType;
      yards = 0;
      if (turnoverType === 'INTERCEPTION') {
        const returnYards = Math.floor(roll() * 30);
        yards = -returnYards;
        description = `${qb.name} throws... INTERCEPTED by ${cb?.name || 'defender'}! Returned ${returnYards} yards.`;
        primaryPlayer = cb || defensePlayers[0];
        targetPlayer = qb;
      } else {
        description = `${rb?.name || 'Running back'} fumbles! ${dl?.name || 'Defensive lineman'} recovers!`;
        primaryPlayer = dl || defensePlayers[0];
        targetPlayer = rb || offensePlayers[0];
      }
    } else {
      const base = playDef.baseYards + (normalizedDiff * playDef.variance);
      const variance = roll() * playDef.variance - playDef.variance / 2;
      yards = Math.max(-5, Math.floor(base + variance + (isBigPlay ? playDef.baseYards * 1.5 : 0)));

      if (yards < 0) {
        result = 'SACK';
        yards = Math.max(-10, yards);
        description = `${dl?.name || 'Defender'} gets to the QB! Sacked for a loss of ${Math.abs(yards)} yards.`;
        primaryPlayer = dl || defensePlayers[0];
        targetPlayer = qb;
      } else if (yards === 0) {
        result = 'NO_GAIN';
        description = playDef.category === 'RUN'
          ? `${rb?.name} is stopped at the line of scrimmage. No gain.`
          : `${qb?.name} throws... incomplete. Tight coverage by the defense.`;
        primaryPlayer = playDef.category === 'RUN' ? rb : qb;
      } else if (isBigPlay) {
        const distanceToEndzone = isHomePossession ? 100 - match.ballPosition : match.ballPosition;
        if (yards >= distanceToEndzone) {
          result = 'TOUCHDOWN';
          yards = distanceToEndzone;
          description = playDef.category === 'RUN'
            ? `${rb?.name} breaks free! TOUCHDOWN! A ${yards}-yard run!`
            : `${qb?.name} throws deep... ${wr?.name} is WIDE OPEN! TOUCHDOWN! A ${yards}-yard bomb!`;
          primaryPlayer = playDef.category === 'RUN' ? rb : wr;
        } else {
          result = 'BIG_PLAY';
          description = playDef.category === 'RUN'
            ? `${rb?.name} breaks through the line! Huge gain of ${yards} yards!`
            : `${qb?.name} finds ${wr?.name} open downfield! Big gain of ${yards} yards!`;
          primaryPlayer = playDef.category === 'RUN' ? rb : wr;
        }
      } else {
        const distanceToEndzone = isHomePossession ? 100 - match.ballPosition : match.ballPosition;
        if (yards >= distanceToEndzone) {
          result = 'TOUCHDOWN';
          yards = distanceToEndzone;
          description = playDef.category === 'RUN'
            ? `${rb?.name} punches it in! TOUCHDOWN!`
            : `${qb?.name} throws a strike to ${wr?.name}! TOUCHDOWN!`;
          primaryPlayer = playDef.category === 'RUN' ? rb : wr;
        } else {
          result = 'GAIN';
          description = playDef.category === 'RUN'
            ? `${rb?.name} takes the handoff and gains ${yards} yards.`
            : `${qb?.name} throws to ${wr?.name} for a ${yards}-yard gain.`;
          primaryPlayer = playDef.category === 'RUN' ? rb : wr;
        }
      }
    }

    // Normal game state updates for run/pass
    newBallPosition = match.ballPosition + (isHomePossession ? yards : -yards);
    newDown = result === 'TOUCHDOWN' || result === 'INTERCEPTION' || result === 'FUMBLE' ? 1 : match.down + 1;
    newYardsToGo = result === 'TOUCHDOWN' || result === 'INTERCEPTION' || result === 'FUMBLE' ? 10 : Math.max(0, match.yardsToGo - yards);
    firstDown = newYardsToGo <= 0 && result !== 'TOUCHDOWN' && result !== 'INTERCEPTION' && result !== 'FUMBLE';

    if (result === 'TOUCHDOWN') {
      scoreChange = 6;
      if (isHomePossession) newHomeScore += 6; else newAwayScore += 6;
      // Kickoff after touchdown — switch possession, reset ball to 25
      newPossession = isHomePossession ? match.awayTeamId : match.homeTeamId;
      newBallPosition = 25;
      newDown = 1;
      newYardsToGo = 10;
    }

    const turnoverOnDowns = newDown > 4 && result !== 'TOUCHDOWN';
    if (result === 'INTERCEPTION' || result === 'FUMBLE' || turnoverOnDowns) {
      newPossession = isHomePossession ? match.awayTeamId : match.homeTeamId;
      newBallPosition = 100 - newBallPosition;
      newDown = 1;
      newYardsToGo = 10;
      if (turnoverOnDowns) {
        result = 'TURNOVER_ON_DOWNS';
        description = `Fourth down... ${description.split('!')[0] || 'No gain'}! Turnover on downs.`;
      }
    }

    const clockDrain = result === 'NO_GAIN' || result === 'INTERCEPTION' || result === 'FUMBLE'
      ? PASS_CLOCK_DRAIN
      : playDef.category === 'RUN' ? PLAY_CLOCK_DRAIN + RUNOFF_SECONDS : PLAY_CLOCK_DRAIN;

    newGameClock = Math.max(0, match.gameClock - clockDrain);
  }

  if (newGameClock <= 0) {
    if (newQuarter < 4) {
      newQuarter += 1;
      newGameClock = QUARTER_LENGTH;
      if (newQuarter === 3) {
        newPossession = match.possessionTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
        newBallPosition = 25;
        newDown = 1;
        newYardsToGo = 10;
      }
    } else {
      newGameClock = 0;
      newQuarter = 4;
    }
  }

  gameOver = newQuarter >= 4 && newGameClock <= 0;

  const playResult = {
    playType,
    direction,
    result,
    yards,
    firstDown,
    turnover: result === 'INTERCEPTION' || result === 'FUMBLE' || result === 'TURNOVER_ON_DOWNS',
    touchdown: result === 'TOUCHDOWN',
    fieldGoal: result === 'FIELD_GOAL',
    missedFg: result === 'MISSED_FG',
    punt: result === 'PUNT',
    scoreChange,
    description,
    defensivePlay: aiDefPlay.type,
    primaryPlayer: { id: primaryPlayer?.id, name: primaryPlayer?.name, position: primaryPlayer?.position },
    targetPlayer: targetPlayer ? { id: targetPlayer.id, name: targetPlayer.name, position: targetPlayer.position } : null,
  };

  const updatedMatch = await prisma.$transaction(async (tx: any) => {
    await tx.matchPlay.create({
      data: {
        matchId,
        quarter: match.currentQuarter,
        gameClock: match.gameClock,
        down: match.down,
        yardsToGo: match.yardsToGo,
        ballPosition: match.ballPosition,
        playType,
        direction,
        result,
        yardsGained: yards,
        playerId: primaryPlayer?.id,
        targetId: targetPlayer?.id,
        description,
      },
    });

    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        possessionTeamId: newPossession,
        ballPosition: newBallPosition,
        down: newDown,
        yardsToGo: newYardsToGo,
        currentQuarter: newQuarter,
        gameClock: newGameClock,
        gamePhase: gameOver ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: gameOver ? new Date() : undefined,
        lastPlayResult: playResult as any,
      },
    });

    return updated;
  });

  return {
    match: updatedMatch,
    playResult,
    gameOver,
  };
}


/**
 * Simulate the remainder of the game (AI plays both sides).
 */
export async function simulateRemainder(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || !match.isPlayable) {
    throw new Error('Match not playable');
  }
  if (match.gamePhase === 'COMPLETED') {
    return { match, gameOver: true };
  }

  const plays = [];
  let currentMatch = match;

  while (currentMatch.gamePhase !== 'COMPLETED' && plays.length < 200) {
    const playType = OFFENSIVE_PLAYS[Math.floor(Math.random() * OFFENSIVE_PLAYS.length)].type;
    const result = await resolvePlay(matchId, playType);
    plays.push(result.playResult);
    currentMatch = result.match;

    if (result.gameOver) break;
  }

  return { match: currentMatch, plays, gameOver: true };
}

/**
 * Complete the game and calculate player development.
 */
export async function completeGame(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      matchPlays: true,
      homeTeam: { include: { teamPlayers: { include: { player: true } } } },
      awayTeam: { include: { teamPlayers: { include: { player: true } } } },
    },
  });

  if (!match) {
    throw new Error('Match not found');
  }

  if (match.status === 'COMPLETED') {
    throw new Error('Match already completed');
  }

  const playerStats: Record<string, { yards: number; td: number; bigPlays: number; plays: number }> = {};

  for (const play of match.matchPlays) {
    if (play.playerId) {
      if (!playerStats[play.playerId]) {
        playerStats[play.playerId] = { yards: 0, td: 0, bigPlays: 0, plays: 0 };
      }
      playerStats[play.playerId].plays += 1;
      playerStats[play.playerId].yards += Math.max(0, play.yardsGained);
      if (play.result === 'TOUCHDOWN') playerStats[play.playerId].td += 1;
      if (play.result === 'BIG_PLAY') playerStats[play.playerId].bigPlays += 1;
    }
  }

  const developmentLogs = [];
  const rng = new SeededRNG(match.id + 'development');

  for (const [playerId, stats] of Object.entries(playerStats)) {
    if (stats.plays < 3) continue;

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) continue;

    let statToImprove: 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' = 'pace';
    const position = player.position;

    if (position === 'QB') statToImprove = stats.td > 0 ? 'passing' : 'physical';
    else if (position === 'RB') statToImprove = stats.yards > 50 ? 'pace' : 'physical';
    else if (position === 'WR') statToImprove = stats.td > 0 ? 'shooting' : 'pace';
    else if (position === 'TE') statToImprove = 'physical';
    else if (position === 'OL') statToImprove = 'defending';
    else if (position === 'DL' || position === 'LB') statToImprove = 'defending';
    else if (position === 'CB' || position === 'S') statToImprove = 'pace';

    let amount = 0;
    let reason = 'PLAYED_WELL';

    if (stats.td >= 2) {
      amount = 2 + Math.floor(rng.next() * 2);
      reason = 'BREAKOUT_GAME';
    } else if (stats.td >= 1 || stats.yards >= 100) {
      amount = 1 + Math.floor(rng.next() * 2);
      reason = 'BIG_PLAY';
    } else if (stats.plays >= 5) {
      amount = 1;
      reason = 'PLAYED_WELL';
    }

    const currentStat = player[statToImprove] || 50;
    if (amount > 0 && currentStat < 99) {
      const actualGain = Math.min(amount, 99 - currentStat);

      await prisma.player.update({
        where: { id: playerId },
        data: {
          [statToImprove]: { increment: actualGain },
        },
      });

      const updatedPlayer = await prisma.player.findUnique({ where: { id: playerId } });
      if (updatedPlayer) {
        const newOverall = Math.round(
          (updatedPlayer.pace + updatedPlayer.shooting + updatedPlayer.passing + updatedPlayer.dribbling + updatedPlayer.defending + updatedPlayer.physical) / 6
        );
        await prisma.player.update({
          where: { id: playerId },
          data: { overall: newOverall },
        });
      }

      const log = await prisma.playerDevelopmentLog.create({
        data: {
          playerId,
          matchId,
          statGained: statToImprove,
          amount: actualGain,
          reason,
        },
      });

      developmentLogs.push(log);
    }
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: 'COMPLETED',
        gamePhase: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    const homeWins = match.homeScore > match.awayScore ? 1 : 0;
    const homeLosses = match.homeScore < match.awayScore ? 1 : 0;
    const awayWins = match.awayScore > match.homeScore ? 1 : 0;
    const awayLosses = match.awayScore < match.homeScore ? 1 : 0;
    const isDraw = match.homeScore === match.awayScore ? 1 : 0;
    const homePoints = homeWins * 3 + isDraw * 1;
    const awayPoints = awayWins * 3 + isDraw * 1;

    await tx.team.update({
      where: { id: match.homeTeamId },
      data: {
        wins: { increment: homeWins },
        draws: { increment: isDraw },
        losses: { increment: homeLosses },
        goalsFor: { increment: match.homeScore },
        goalsAgainst: { increment: match.awayScore },
        points: { increment: homePoints },
      },
    });

    await tx.team.update({
      where: { id: match.awayTeamId },
      data: {
        wins: { increment: awayWins },
        draws: { increment: isDraw },
        losses: { increment: awayLosses },
        goalsFor: { increment: match.awayScore },
        goalsAgainst: { increment: match.homeScore },
        points: { increment: awayPoints },
      },
    });
  });

  return {
    match,
    developmentLogs,
    playerStats,
  };
}

/**
 * Get the current game state for the frontend.
 */
export async function getGameState(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { include: { owner: { select: { id: true, username: true } }, venue: true } },
      awayTeam: { include: { owner: { select: { id: true, username: true } }, venue: true } },
      matchPlays: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!match) {
    throw new Error('Match not found');
  }

  const homeRoster = await getTeamRosterForGame(match.homeTeamId);
  const awayRoster = await getTeamRosterForGame(match.awayTeamId);

  return {
    match,
    homeRoster,
    awayRoster,
  };
}
