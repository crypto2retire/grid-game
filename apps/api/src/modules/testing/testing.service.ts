import { prisma } from '../../config/database';
import { runMatchSimulation } from '../matches/simulator';
import { applyPostGameProgression } from '../matches/progression';
import { calculateGameEconomics } from '../economy/gameEconomics';
import { processTreasuryInflow } from '../treasury/treasury.service';
import { env } from '../../config/env';

// ─── Test Season Runner ───

interface SeasonResult {
  matchesPlayed: number;
  totalHomeWins: number;
  totalAwayWins: number;
  totalDraws: number;
  avgHomeScore: number;
  avgAwayScore: number;
  playerDevelopment: PlayerDevSummary[];
  economicFlow: EconomicSummary;
  teamStandings: TeamStanding[];
  issues: string[];
}

interface PlayerDevSummary {
  playerId: string;
  playerName: string;
  teamName: string;
  position: string;
  gamesPlayed: number;
  beforeOverall: number;
  afterOverall: number;
  statChanges: Record<string, number>;
  mvpScore: number;
  ratingAverage: number;
}

interface EconomicSummary {
  totalTicketRevenue: number;
  totalVenueLeaseFees: number;
  totalEntryFees: number;
  totalTreasuryInflow: number;
  totalPlayerPayouts: number;
  totalGameOwnerRevenue: number;
  avgRevenuePerHomeGame: number;
  avgRevenuePerAwayGame: number;
  balanceCheck: boolean;
}

interface TeamStanding {
  teamId: string;
  teamName: string;
  tier: string;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  netRevenue: number;
}

/**
 * Run a full test season: simulate N games between AI teams,
 * apply progression, track economics, and return an audit report.
 */
export async function runTestSeason(gameCount: number = 20): Promise<SeasonResult> {
  const issues: string[] = [];

  // 1. Get AI teams with rosters
  const aiTeams = await prisma.team.findMany({
    where: { isAI: true },
    include: {
      teamPlayers: { include: { player: true } },
      venue: true,
      transportationAssets: true,
      leagueMemberships: { include: { league: true } },
      sponsorships: true,
    },
    take: 20,
  });

  if (aiTeams.length < 2) {
    throw new Error('Need at least 2 AI teams to run a test season');
  }

  // 2. Snapshot player stats before season
  const beforeStats = new Map<string, { overall: number }>();
  for (const team of aiTeams) {
    for (const tp of team.teamPlayers) {
      const p = tp.player as any;
      beforeStats.set(p.id, { overall: p.overall });
    }
  }

  // 3. Snapshot treasury before
  const beforeTreasury = await prisma.gameTreasury.findMany({
    where: { currency: 'CASH' },
  });
  const beforeTreasuryBalance = beforeTreasury[0]?.balance || 0;

  // 4. Snapshot team records before
  const beforeRecords = new Map<string, { wins: number; draws: number; losses: number; points: number; goalsFor: number; goalsAgainst: number }>();
  for (const team of aiTeams) {
    beforeRecords.set(team.id, {
      wins: team.wins, draws: team.draws, losses: team.losses,
      points: team.points, goalsFor: team.goalsFor, goalsAgainst: team.goalsAgainst,
    });
  }

  let totalHomeScore = 0, totalAwayScore = 0;
  let totalHomeWins = 0, totalAwayWins = 0, totalDraws = 0;
  let totalTicketRevenue = 0, totalVenueLeaseFees = 0, totalEntryFees = 0;
  let totalTreasuryInflow = 0, totalPlayerPayouts = 0, totalGameOwnerRevenue = 0;

  const matchResults: Array<{ homeScore: number; awayScore: number; homeNet: number; awayNet: number }> = [];

  // 5. Run games
  for (let i = 0; i < gameCount; i++) {
    const homeTeam = aiTeams[i % aiTeams.length] as any;
    const awayTeam = aiTeams[(i + 1) % aiTeams.length] as any;

    if (homeTeam.id === awayTeam.id) continue;

    const seed = Math.random().toString(36).substring(2);
    const matchId = `test-match-${i}-${Date.now()}`;

    try {
      const result = await runMatchSimulation(
        'american-football', matchId, seed,
        buildTeamState(homeTeam), buildTeamState(awayTeam)
      );

      const homeWon = result.homeScore > result.awayScore;
      const awayWon = result.awayScore > result.homeScore;
      const draw = result.homeScore === result.awayScore;

      if (homeWon) totalHomeWins++; else if (awayWon) totalAwayWins++; else totalDraws++;
      totalHomeScore += result.homeScore;
      totalAwayScore += result.awayScore;

      // Build player stats for progression
      const playerInputs = buildProgressionInputs(result, homeTeam, awayTeam);

      // Calculate economics
      const homeLeagueTier = (homeTeam.leagueMemberships[0]?.league?.tier || 'LOCAL_REC') as any;
      const awayLeagueTier = (awayTeam.leagueMemberships[0]?.league?.tier || 'LOCAL_REC') as any;

      const homeTransport = homeTeam.transportationAssets[0] || null;
      const awayTransport = awayTeam.transportationAssets[0] || null;

      const homeTransportAdjusted = homeTransport
        ? { ...homeTransport, operatingCost: homeTransport.ownerId === homeTeam.ownerId ? Math.round(homeTransport.operatingCost * 0.5) : homeTransport.operatingCost }
        : null;
      const awayTransportAdjusted = awayTransport
        ? { ...awayTransport, operatingCost: awayTransport.ownerId === awayTeam.ownerId ? Math.round(awayTransport.operatingCost * 0.5) : awayTransport.operatingCost }
        : null;

      const homeEcon = calculateGameEconomics({
        team: homeTeam, opponent: awayTeam,
        venue: homeTeam.venue as any, transport: homeTransportAdjusted as any,
        sponsorships: homeTeam.sponsorships,
        isHome: true, didWin: homeWon, didTie: draw,
        scoreFor: result.homeScore, scoreAgainst: result.awayScore,
        leagueTier: homeLeagueTier,
      });

      const awayEcon = calculateGameEconomics({
        team: awayTeam, opponent: homeTeam,
        venue: null, transport: awayTransportAdjusted as any,
        sponsorships: awayTeam.sponsorships,
        isHome: false, didWin: awayWon, didTie: draw,
        scoreFor: result.awayScore, scoreAgainst: result.homeScore,
        leagueTier: awayLeagueTier,
      });

      // Calculate venue revenue
      const homeVenue = homeTeam.venue as any;
      let ticketRevenue = 0, leaseFee = 0, homeTeamRevenue = 0, entryFee = 0;
      if (homeVenue) {
        const attendanceRate = 0.5 + (homeVenue.prestige / 100) * 0.4;
        const attendance = Math.round(homeVenue.capacity * attendanceRate);
        ticketRevenue = attendance * homeVenue.ticketPrice;
        leaseFee = Math.round(ticketRevenue * homeVenue.leaseRate);
        homeTeamRevenue = ticketRevenue - leaseFee;

        const entryFeeTierMult: Record<string, number> = {
          PARK_FIELD: 1, COMMUNITY: 2, SMALL_STADIUM: 3, REGIONAL: 5, PRO: 8, ELITE: 12,
        };
        entryFee = 1000 * (entryFeeTierMult[homeVenue.tier] || 1);
      }

      totalTicketRevenue += ticketRevenue;
      totalVenueLeaseFees += leaseFee;
      totalEntryFees += entryFee;
      if (homeTeamRevenue > 0) totalPlayerPayouts += homeTeamRevenue;

      // Record match and apply everything in a transaction
      await prisma.$transaction(async (tx: any) => {
        const dbMatch = await tx.match.create({
          data: {
            id: matchId, sportId: 'american-football',
            homeTeamId: homeTeam.id, awayTeamId: awayTeam.id,
            status: 'COMPLETED',
            homeScore: result.homeScore, awayScore: result.awayScore,
            startedAt: new Date(), completedAt: new Date(), scheduledAt: new Date(),
          },
        });

        await tx.team.update({
          where: { id: homeTeam.id },
          data: {
            wins: { increment: homeWon ? 1 : 0 },
            draws: { increment: draw ? 1 : 0 },
            losses: { increment: awayWon ? 1 : 0 },
            goalsFor: { increment: result.homeScore },
            goalsAgainst: { increment: result.awayScore },
            points: { increment: homeWon ? 3 : draw ? 1 : 0 },
          },
        });

        await tx.team.update({
          where: { id: awayTeam.id },
          data: {
            wins: { increment: awayWon ? 1 : 0 },
            draws: { increment: draw ? 1 : 0 },
            losses: { increment: homeWon ? 1 : 0 },
            goalsFor: { increment: result.awayScore },
            goalsAgainst: { increment: result.homeScore },
            points: { increment: awayWon ? 3 : draw ? 1 : 0 },
          },
        });

        await applyPostGameProgression(tx, {
          sportId: 'american-football', matchId: dbMatch.id, players: playerInputs,
        });

        if (homeVenue) {
          const totalVenueRevenue = leaseFee + entryFee;
          const venueOwnerId = homeVenue.ownerId || 'ai-system-owner-001';

          if (venueOwnerId === 'ai-system-owner-001') {
            await processTreasuryInflow(tx, 'CASH', totalVenueRevenue, 'GAME_DAY_REVENUE', dbMatch.id);
            totalTreasuryInflow += totalVenueRevenue;
          } else {
            totalPlayerPayouts += totalVenueRevenue;
          }

          await tx.teamFinanceSnapshot.create({
            data: {
              teamId: homeTeam.id, matchId: dbMatch.id, category: 'GAME_DAY',
              revenue: homeTeamRevenue + homeEcon.revenue,
              expense: homeEcon.expenses,
              net: homeTeamRevenue + homeEcon.net,
              metadata: { attendance: Math.round(homeVenue.capacity * (0.5 + (homeVenue.prestige / 100) * 0.4)), ticketRevenue, leaseFee, entryFee },
            },
          });

          await tx.teamFinanceSnapshot.create({
            data: {
              teamId: awayTeam.id, matchId: dbMatch.id, category: 'GAME_DAY',
              revenue: awayEcon.revenue,
              expense: awayEcon.expenses + entryFee,
              net: awayEcon.net - entryFee,
              metadata: { entryFee, awayTeam: true },
            },
          });
        }

        const gameOwnerId = env.GAME_OWNER_USER_ID;
        const gameOwnerWallet = await tx.wallet.findUnique({ where: { userId: gameOwnerId } });
        if (gameOwnerWallet) {
          const leagueRevenue = homeEcon.revenue
            - (homeEcon.breakdown['Ticket Sales'] || 0)
            - (homeEcon.breakdown['Concessions'] || 0)
            - (homeEcon.breakdown['Merchandise'] || 0)
            - (homeEcon.breakdown['Sponsor Revenue'] || 0);
          if (leagueRevenue > 0) {
            await tx.wallet.update({
              where: { userId: gameOwnerId },
              data: { cash: { increment: leagueRevenue } },
            });
            totalGameOwnerRevenue += leagueRevenue;
          }
        }
      });

      matchResults.push({
        homeScore: result.homeScore, awayScore: result.awayScore,
        homeNet: homeEcon.net + homeTeamRevenue,
        awayNet: awayEcon.net - entryFee,
      });
    } catch (err: any) {
      issues.push(`Match ${i} failed: ${err.message}`);
    }
  }

  // 6. Collect after-season player stats
  const afterStats = new Map<string, { overall: number }>();
  for (const team of aiTeams) {
    for (const tp of team.teamPlayers) {
      const p = await prisma.player.findUnique({ where: { id: (tp.player as any).id } });
      if (p) afterStats.set(p.id, { overall: p.overall });
    }
  }

  // 7. Build player development summary
  const playerDevelopment: PlayerDevSummary[] = [];
  for (const [playerId, before] of beforeStats) {
    const after = afterStats.get(playerId);
    if (!after) continue;

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: { teamPlayers: { include: { team: true } } },
    });
    if (!player) continue;

    const seasonStats = await prisma.playerSeasonStats.findUnique({
      where: { playerId_sportId_season: { playerId, sportId: 'american-football', season: 'beta' } },
    });

    const teamName = player.teamPlayers[0]?.team?.name || 'Unknown';

    playerDevelopment.push({
      playerId, playerName: player.name, teamName,
      position: player.position,
      gamesPlayed: seasonStats?.gamesPlayed || 0,
      beforeOverall: before.overall,
      afterOverall: after.overall,
      statChanges: { overall: after.overall - before.overall },
      mvpScore: seasonStats?.mvpScore || 0,
      ratingAverage: seasonStats?.ratingAverage || 0,
    });
  }

  // 8. Build team standings
  const updatedTeams = await prisma.team.findMany({
    where: { id: { in: aiTeams.map((t) => t.id) } },
    include: { financeSnapshots: true },
  });

  const teamStandings: TeamStanding[] = updatedTeams.map((team) => {
    const before = beforeRecords.get(team.id)!;
    const netRevenue = (team as any).financeSnapshots.reduce((sum: number, fs: any) => sum + fs.net, 0);
    return {
      teamId: team.id, teamName: team.name, tier: team.tier,
      wins: team.wins - before.wins, draws: team.draws - before.draws,
      losses: team.losses - before.losses, points: team.points - before.points,
      goalsFor: team.goalsFor - before.goalsFor,
      goalsAgainst: team.goalsAgainst - before.goalsAgainst,
      netRevenue,
    };
  }).sort((a, b) => b.points - a.points);

  // 9. Check treasury balance
  const afterTreasury = await prisma.gameTreasury.findMany({ where: { currency: 'CASH' } });
  const afterTreasuryBalance = afterTreasury[0]?.balance || 0;
  const balanceCheck = (afterTreasuryBalance - beforeTreasuryBalance) === totalTreasuryInflow;
  if (!balanceCheck) {
    issues.push(`Treasury mismatch: expected +${totalTreasuryInflow}, got +${afterTreasuryBalance - beforeTreasuryBalance}`);
  }

  // 10. Check game balance
  const avgHomeScore = totalHomeScore / (matchResults.length || 1);
  const avgAwayScore = totalAwayScore / (matchResults.length || 1);
  if (avgHomeScore > 45 || avgAwayScore > 45) {
    issues.push(`Scores too high: avg home ${avgHomeScore.toFixed(1)}, avg away ${avgAwayScore.toFixed(1)}`);
  }
  if (avgHomeScore < 7 || avgAwayScore < 7) {
    issues.push(`Scores too low: avg home ${avgHomeScore.toFixed(1)}, avg away ${avgAwayScore.toFixed(1)}`);
  }
  if (totalHomeWins === 0 || totalAwayWins === 0) {
    issues.push('Home or away teams never won');
  }

  const avgHomeNet = matchResults.reduce((s, m) => s + m.homeNet, 0) / (matchResults.length || 1);
  const avgAwayNet = matchResults.reduce((s, m) => s + m.awayNet, 0) / (matchResults.length || 1);

  return {
    matchesPlayed: matchResults.length,
    totalHomeWins, totalAwayWins, totalDraws,
    avgHomeScore, avgAwayScore,
    playerDevelopment: playerDevelopment.sort((a, b) => b.mvpScore - a.mvpScore).slice(0, 50),
    economicFlow: {
      totalTicketRevenue, totalVenueLeaseFees, totalEntryFees,
      totalTreasuryInflow, totalPlayerPayouts, totalGameOwnerRevenue,
      avgRevenuePerHomeGame: avgHomeNet, avgRevenuePerAwayGame: avgAwayNet,
      balanceCheck,
    },
    teamStandings,
    issues,
  };
}

// ─── Helpers ───

function buildTeamState(team: any) {
  return {
    id: team.id, name: team.name, sportId: team.sportId,
    teamId: team.id, formation: team.formation || '4-3-3',
    style: team.style || 'balanced', pressing: team.pressing || 'medium',
    mentality: team.mentality || 'balanced', tactics: team.tactics || {},
    players: team.teamPlayers.map((tp: any) => ({
      id: tp.player.id, name: tp.player.name, position: tp.player.position,
      overall: tp.player.overall, pace: tp.player.pace, shooting: tp.player.shooting,
      passing: tp.player.passing, dribbling: tp.player.dribbling,
      defending: tp.player.defending, physical: tp.player.physical,
      form: tp.player.form, fatigue: tp.player.fatigue, morale: tp.player.morale,
    })),
  } as any;
}

function buildProgressionInputs(result: any, homeTeam: any, awayTeam: any) {
  const playerStats: Record<string, any> = {};
  for (const event of result.events || []) {
    if (event.actorId) {
      if (!playerStats[event.actorId]) {
        playerStats[event.actorId] = { goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0, tackles: 0, saves: 0, rating: 6.0 };
      }
      if (event.type === 'GOAL') playerStats[event.actorId].goals++;
      if (event.type === 'ASSIST') playerStats[event.actorId].assists++;
      if (event.type === 'SHOT') playerStats[event.actorId].shots++;
      if (event.type === 'SHOT_ON_TARGET') playerStats[event.actorId].shotsOnTarget++;
      if (event.type === 'PASS') playerStats[event.actorId].passes++;
      if (event.type === 'TACKLE') playerStats[event.actorId].tackles++;
      if (event.type === 'SAVE') playerStats[event.actorId].saves++;
    }
  }

  const allPlayers = [...homeTeam.teamPlayers, ...awayTeam.teamPlayers];
  return allPlayers.map((tp: any) => {
    const stats = playerStats[tp.player.id] || { goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0, tackles: 0, saves: 0, rating: 5.0 };
    return { playerId: tp.player.id, teamId: tp.teamId, position: tp.player.position, stats };
  });
}

// ─── Audit Tools ───

export async function getEconomicAudit() {
  const treasury = await prisma.gameTreasury.findFirst({ where: { currency: 'CASH' } });
  const allWallets = await prisma.wallet.findMany({
    include: { user: { select: { username: true, displayName: true } } },
    orderBy: { cash: 'desc' }, take: 20,
  });
  const totalPlayerCash = await prisma.wallet.aggregate({ _sum: { cash: true } });
  const totalPlayerGrid = await prisma.wallet.aggregate({ _sum: { gridTokens: true } });
  const gameOwnerWallet = await prisma.wallet.findUnique({ where: { userId: env.GAME_OWNER_USER_ID } });
  const aiOwnerWallet = await prisma.wallet.findUnique({ where: { userId: 'ai-system-owner-001' } });
  const recentTransactions = await prisma.treasuryTransaction.findMany({
    where: { currency: 'CASH' }, orderBy: { createdAt: 'desc' }, take: 20,
  });
  const recentFinance = await prisma.teamFinanceSnapshot.findMany({
    orderBy: { createdAt: 'desc' }, take: 20,
    include: { team: { select: { name: true } } },
  });

  return {
    treasuryBalance: treasury?.balance || 0,
    totalPlayerCash: totalPlayerCash._sum.cash || 0,
    totalPlayerGrid: totalPlayerGrid._sum.gridTokens || 0,
    gameOwnerCash: gameOwnerWallet?.cash || 0,
    gameOwnerGrid: gameOwnerWallet?.gridTokens || 0,
    aiOwnerCash: aiOwnerWallet?.cash || 0,
    aiOwnerGrid: aiOwnerWallet?.gridTokens || 0,
    topWallets: allWallets.map((w) => ({ username: w.user?.username || w.userId, cash: w.cash, gridTokens: w.gridTokens })),
    recentTreasuryTransactions: recentTransactions,
    recentFinanceSnapshots: recentFinance,
  };
}

export async function getPlayerDevelopmentAudit() {
  const seasonStats = await prisma.playerSeasonStats.findMany({
    where: { season: 'beta' },
    include: { player: { select: { name: true, position: true, overall: true } } },
    orderBy: { mvpScore: 'desc' }, take: 50,
  });

  const totalGamesPlayed = await prisma.playerSeasonStats.aggregate({ _sum: { gamesPlayed: true } });

  return {
    totalGamesPlayed: totalGamesPlayed._sum.gamesPlayed || 0,
    topPlayers: seasonStats.map((s) => ({
      name: s.player.name, position: s.player.position, overall: s.player.overall,
      gamesPlayed: s.gamesPlayed, touchdowns: s.touchdowns, yards: s.yards,
      tackles: s.tackles, ratingAverage: s.ratingAverage, mvpScore: s.mvpScore,
    })),
  };
}

export async function resetTestSeason() {
  const testMatches = await prisma.match.findMany({ where: { id: { startsWith: 'test-match-' } } });

  for (const match of testMatches) {
    await prisma.matchEvent.deleteMany({ where: { matchId: match.id } });
    await prisma.playerMatchStats.deleteMany({ where: { matchId: match.id } });
    await prisma.matchParticipant.deleteMany({ where: { matchId: match.id } });
    await prisma.matchPlay.deleteMany({ where: { matchId: match.id } });
    await prisma.playerDevelopmentLog.deleteMany({ where: { matchId: match.id } });
    await prisma.teamFinanceSnapshot.deleteMany({ where: { matchId: match.id } });
    await prisma.treasuryTransaction.deleteMany({ where: { sourceId: match.id } });
  }

  await prisma.match.deleteMany({ where: { id: { startsWith: 'test-match-' } } });

  await prisma.team.updateMany({
    where: { isAI: true },
    data: { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  });

  await prisma.playerSeasonStats.deleteMany({ where: { season: 'beta' } });

  return { deletedMatches: testMatches.length };
}
