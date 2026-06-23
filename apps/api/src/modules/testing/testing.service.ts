import { prisma } from '../../config/database';
import { runMatchSimulation } from '../matches/simulator';
import { applyPostGameProgression, agePlayers } from '../matches/progression';
import { calculateGameEconomics } from '../economy/gameEconomics';
import { processTreasuryInflow } from '../treasury/treasury.service';
import { env } from '../../config/env';

// ─── Comprehensive Test Season Runner ───

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
  injuries: InjurySummary[];
  ageProgression: AgeProgressionSummary;
  marketplaceActivity: MarketplaceSummary;
  issues: string[];
}

interface PlayerDevSummary {
  playerId: string;
  playerName: string;
  teamName: string;
  position: string;
  age: number;
  ageAfter: number;
  gamesPlayed: number;
  beforeOverall: number;
  afterOverall: number;
  statChanges: Record<string, number>;
  health: number;
  injuryStatus: string | null;
  injuryType: string | null;
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
  totalWeeklyCosts: number;
  weeklyCostRuns: number;
  totalSolPurchases: number;
  totalSolRevenue: number;
  totalMarketplaceVolume: number;
  totalMarketplaceTax: number;
  totalMarketplaceBurn: number;
  avgRevenuePerHomeGame: number;
  avgRevenuePerAwayGame: number;
  balanceCheck: boolean;
  pumpfunRevenue: {
    tokenSymbol: string;
    tokenAddress: string | null;
    estimatedDailyVolume: number;
    tradingFeePct: number;
    creatorSharePct: number;
    projectedDailyRevenue: number;
    projectedMonthlyRevenue: number;
    projectedYearlyRevenue: number;
  } | null;
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

interface InjurySummary {
  playerId: string;
  playerName: string;
  type: string;
  severity: string;
  weeks: number;
  healthLoss: number;
}

interface AgeProgressionSummary {
  playersAged: number;
  agesChanged: Array<{ playerId: string; name: string; before: number; after: number }>;
}

interface MarketplaceSummary {
  venuePurchases: number;
  venueSolPurchases: number;
  transportPurchases: number;
  transportSolPurchases: number;
  teamMarketplaceSales: number;
  playerMarketplaceSales: number;
  totalSolSpent: number;
  totalCashSpent: number;
  totalGridSpent: number;
}

/**
 * Run a comprehensive test season: simulate games, purchases, marketplace activity,
 * and return an audit report of all economic activity.
 */
export async function runTestSeason(gameCount: number = 100): Promise<SeasonResult> {
  const issues: string[] = [];

  // 1. Get AI teams with rosters — need many more to simulate real user base
  const aiTeams = await prisma.team.findMany({
    where: { isAI: true },
    include: {
      teamPlayers: { include: { player: true } },
      venue: true,
      transportationAssets: true,
      leagueMemberships: { include: { league: true } },
      sponsorships: true,
    },
    take: 100,
  });

  if (aiTeams.length < 2) {
    throw new Error('Need at least 2 AI teams to run a test season');
  }

  // 2. Snapshot player stats before season
  const beforeStats = new Map<string, { overall: number; age: number }>();
  for (const team of aiTeams) {
    for (const tp of team.teamPlayers) {
      const p = tp.player as any;
      beforeStats.set(p.id, { overall: p.overall, age: p.age || 20 });
    }
  }

  // 3. Snapshot treasury before
  const beforeTreasury = await prisma.gameTreasury.findMany({
    where: { currency: 'CASH' },
  });
  const beforeTreasuryBalance = beforeTreasury[0]?.balance || 0;
  const beforeSolTreasury = await prisma.gameTreasury.findFirst({ where: { currency: 'SOL' } });
  const beforeSolBalance = beforeSolTreasury?.balance || 0;

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
  let totalWeeklyCosts = 0, weeklyCostRuns = 0;
  let totalSolPurchases = 0, totalSolRevenue = 0;
  let totalMarketplaceVolume = 0, totalMarketplaceTax = 0, totalMarketplaceBurn = 0;
  let totalCashSpent = 0, totalGridSpent = 0;

  const matchResults: Array<{ homeScore: number; awayScore: number; homeNet: number; awayNet: number }> = [];
  const marketplaceActivity: MarketplaceSummary = {
    venuePurchases: 0, venueSolPurchases: 0,
    transportPurchases: 0, transportSolPurchases: 0,
    teamMarketplaceSales: 0, playerMarketplaceSales: 0,
    totalSolSpent: 0, totalCashSpent: 0, totalGridSpent: 0,
  };

  // 5. Pre-season: Simulate purchases and marketplace activity
  // 20% of teams buy their venue with SOL (real-world revenue)
  const venueBuyers = aiTeams.filter((_, i) => i % 5 === 0);
  for (const team of venueBuyers) {
    const venue = team.venue as any;
    if (venue && venue.solPrice) {
      try {
        await prisma.$transaction(async (tx: any) => {
          await tx.venue.update({
            where: { id: venue.id },
            data: { ownerId: team.ownerId, leaseRate: 0 },
          });
          await tx.gameTreasury.upsert({
            where: { currency: 'SOL' },
            create: { currency: 'SOL', balance: venue.solPrice, totalInflows: venue.solPrice },
            update: { balance: { increment: venue.solPrice }, totalInflows: { increment: venue.solPrice } },
          });
        });
        totalSolRevenue += venue.solPrice;
        totalSolPurchases++;
        marketplaceActivity.venueSolPurchases++;
        marketplaceActivity.totalSolSpent += venue.solPrice;
      } catch (err: any) {
        issues.push(`Venue purchase failed: ${err.message}`);
      }
    }
  }

  // 15% of teams buy their transport with SOL
  const transportBuyers = aiTeams.filter((_, i) => i % 7 === 0);
  for (const team of transportBuyers) {
    const transport = team.transportationAssets[0];
    if (transport && transport.solPrice) {
      try {
        await prisma.$transaction(async (tx: any) => {
          await tx.transportationAsset.update({
            where: { id: transport.id },
            data: { ownerId: team.ownerId },
          });
          await tx.gameTreasury.upsert({
            where: { currency: 'SOL' },
            create: { currency: 'SOL', balance: transport.solPrice, totalInflows: transport.solPrice },
            update: { balance: { increment: transport.solPrice }, totalInflows: { increment: transport.solPrice } },
          });
        });
        totalSolRevenue += transport.solPrice;
        totalSolPurchases++;
        marketplaceActivity.transportSolPurchases++;
        marketplaceActivity.totalSolSpent += transport.solPrice;
      } catch (err: any) {
        issues.push(`Transport purchase failed: ${err.message}`);
      }
    }
  }

  // 30% of teams list players on marketplace (simulate user-to-user trading)
  const playerTraders = aiTeams.filter((_, i) => i % 3 === 0);
  for (const team of playerTraders) {
    const tradablePlayers = team.teamPlayers.filter((tp: any) => {
      const p = tp.player as any;
      return p.overall >= 70 && p.overall <= 85; // Mid-tier players get traded
    });
    if (tradablePlayers.length > 0) {
      // List 1-2 players per team
      const listings = tradablePlayers.slice(0, 2);
      for (const tp of listings) {
        const p = tp.player as any;
        const price = p.overall * 150; // CASH pricing for player trades
        try {
          await prisma.marketplaceListing.create({
            data: {
              sellerId: team.ownerId || 'ai-system-owner-001',
              playerId: p.id,
              price,
              status: 'ACTIVE',
            },
          });
          marketplaceActivity.playerMarketplaceSales++;
          totalMarketplaceVolume += price;
          totalCashSpent += price;
        } catch (err: any) {
          // Ignore duplicate listings
        }
      }
    }
  }

  // 10% of teams list themselves for sale on team marketplace (user-to-user)
  const teamSellers = aiTeams.filter((_, i) => i % 10 === 0);
  for (const team of teamSellers) {
    if (team.purchasePrice && team.purchasePrice > 0) {
      const salePrice = Math.round(team.purchasePrice * 1.2); // 20% markup
      const currency = Math.random() > 0.5 ? 'GRID' : 'CASH';
      try {
        await prisma.teamMarketplaceListing.create({
          data: {
            sellerId: team.ownerId || 'ai-system-owner-001',
            teamId: team.id,
            price: salePrice,
            currency,
            foundationTaxPaid: Math.round(salePrice * 0.15),
            burnAmount: Math.round(salePrice * 0.05),
            sellerReceives: Math.round(salePrice * 0.8),
            daysHeld: 30,
            status: 'ACTIVE',
          },
        });
        marketplaceActivity.teamMarketplaceSales++;
        totalMarketplaceVolume += salePrice;
        if (currency === 'GRID') totalGridSpent += salePrice;
        else totalCashSpent += salePrice;
      } catch (err: any) {
        // Ignore
      }
    }
  }

  // 6. Run games
  for (let i = 0; i < gameCount; i++) {
    // Weekly operating costs every 7 games
    if (i > 0 && i % 7 === 0) {
      try {
        const weeklyResult = await processWeeklyOperatingCosts();
        weeklyCostRuns++;
        for (const r of weeklyResult.results) {
          totalWeeklyCosts += r.totalCost;
        }
      } catch (err: any) {
        issues.push(`Weekly costs at week ${Math.floor(i / 7)} failed: ${err.message}`);
      }
    }

    const homeTeam = aiTeams[i % aiTeams.length] as any;
    const awayTeam = aiTeams[(i + 1) % aiTeams.length] as any;
    if (homeTeam.id === awayTeam.id) continue;

    const matchId = `test-match-${i}-${Date.now()}`;

    try {
      const result = await runMatchSimulation(
        'american-football', matchId, Math.random().toString(36).substring(2),
        buildTeamState(homeTeam), buildTeamState(awayTeam)
      );

      const homeWon = result.homeScore > result.awayScore;
      const awayWon = result.awayScore > result.homeScore;
      const draw = result.homeScore === result.awayScore;

      if (homeWon) totalHomeWins++; else if (awayWon) totalAwayWins++; else totalDraws++;
      totalHomeScore += result.homeScore;
      totalAwayScore += result.awayScore;

      const playerInputs = buildProgressionInputs(result, homeTeam, awayTeam);
      const homeLeagueTier = (homeTeam.leagueMemberships[0]?.league?.tier || 'LOCAL_REC') as any;
      const awayLeagueTier = (awayTeam.leagueMemberships[0]?.league?.tier || 'LOCAL_REC') as any;

      const homeEcon = calculateGameEconomics({
        team: homeTeam, opponent: awayTeam,
        venue: homeTeam.venue, transport: homeTeam.transportationAssets[0] as any,
        sponsorships: homeTeam.sponsorships,
        isHome: true, didWin: homeWon, didTie: draw,
        scoreFor: result.homeScore, scoreAgainst: result.awayScore,
        leagueTier: homeLeagueTier,
      });

      const awayEcon = calculateGameEconomics({
        team: awayTeam, opponent: homeTeam,
        venue: null, transport: awayTeam.transportationAssets[0] as any,
        sponsorships: awayTeam.sponsorships,
        isHome: false, didWin: awayWon, didTie: draw,
        scoreFor: result.awayScore, scoreAgainst: result.homeScore,
        leagueTier: awayLeagueTier,
      });

      const homeVenue = homeTeam.venue as any;
      let ticketRevenue = 0, leaseFee = 0, homeTeamRevenue = 0, entryFee = 0;
      if (homeVenue) {
        const attendanceRate = 0.5 + (homeVenue.prestige / 100) * 0.4;
        const attendance = Math.round(homeVenue.capacity * attendanceRate);
        ticketRevenue = attendance * homeVenue.ticketPrice;
        leaseFee = Math.round(ticketRevenue * homeVenue.leaseRate);
        homeTeamRevenue = ticketRevenue - leaseFee;
        const entryFeeTierMult: Record<string, number> = { PARK_FIELD: 1, COMMUNITY: 2, SMALL_STADIUM: 3, REGIONAL: 5, PRO: 8, ELITE: 12 };
        entryFee = 1000 * (entryFeeTierMult[homeVenue.tier] || 1);
      }

      totalTicketRevenue += ticketRevenue;
      totalVenueLeaseFees += leaseFee;
      totalEntryFees += entryFee;
      if (homeTeamRevenue > 0) totalPlayerPayouts += homeTeamRevenue;

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
            wins: { increment: homeWon ? 1 : 0 }, draws: { increment: draw ? 1 : 0 },
            losses: { increment: awayWon ? 1 : 0 },
            goalsFor: { increment: result.homeScore }, goalsAgainst: { increment: result.awayScore },
            points: { increment: homeWon ? 3 : draw ? 1 : 0 },
          },
        });
        await tx.team.update({
          where: { id: awayTeam.id },
          data: {
            wins: { increment: awayWon ? 1 : 0 }, draws: { increment: draw ? 1 : 0 },
            losses: { increment: homeWon ? 1 : 0 },
            goalsFor: { increment: result.awayScore }, goalsAgainst: { increment: result.homeScore },
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

  // 7. Collect after-season player stats
  const afterStats = new Map<string, { overall: number; age: number; health: number; injuryStatus: string | null; injuryType: string | null }>();
  for (const team of aiTeams) {
    for (const tp of team.teamPlayers) {
      const p = await prisma.player.findUnique({ where: { id: (tp.player as any).id } });
      if (p) afterStats.set(p.id, { overall: p.overall, age: p.age, health: p.health, injuryStatus: p.injuryStatus, injuryType: p.injuryType });
    }
  }

  // 8. Build player development summary
  const playerDevelopment: PlayerDevSummary[] = [];
  const injuries: InjurySummary[] = [];
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
      age: before.age || player.age,
      ageAfter: after.age,
      gamesPlayed: seasonStats?.gamesPlayed || 0,
      beforeOverall: before.overall,
      afterOverall: after.overall,
      statChanges: { overall: after.overall - before.overall },
      health: after.health,
      injuryStatus: after.injuryStatus,
      injuryType: after.injuryType,
      mvpScore: seasonStats?.mvpScore || 0,
      ratingAverage: seasonStats?.ratingAverage || 0,
    });

    if (after.injuryStatus && after.injuryStatus !== 'HEALTHY') {
      injuries.push({
        playerId, playerName: player.name,
        type: after.injuryType || 'Unknown',
        severity: after.injuryStatus,
        weeks: player.injuryWeeks || 0,
        healthLoss: 100 - after.health,
      });
    }
  }

  // 9. Age progression
  let ageProgression: AgeProgressionSummary = { playersAged: 0, agesChanged: [] };
  try {
    await agePlayers(prisma);
    const agedPlayers = await prisma.player.findMany({
      where: { id: { in: Array.from(afterStats.keys()) } },
      select: { id: true, name: true, age: true },
    });
    ageProgression = {
      playersAged: agedPlayers.length,
      agesChanged: agedPlayers.map((p) => {
        const beforeAge = afterStats.get(p.id)?.age || p.age - 1;
        return { playerId: p.id, name: p.name, before: beforeAge, after: p.age };
      }).filter((c) => c.before !== c.after),
    };
  } catch (err: any) {
    issues.push(`Age progression failed: ${err.message}`);
  }

  // 10. Team standings
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

  // 11. Balance checks
  const afterTreasury = await prisma.gameTreasury.findMany({ where: { currency: 'CASH' } });
  const afterTreasuryBalance = afterTreasury[0]?.balance || 0;
  const balanceCheck = (afterTreasuryBalance - beforeTreasuryBalance) === totalTreasuryInflow;
  if (!balanceCheck) {
    issues.push(`Treasury mismatch: expected +${totalTreasuryInflow}, got +${afterTreasuryBalance - beforeTreasuryBalance}`);
  }

  const afterSolTreasury = await prisma.gameTreasury.findFirst({ where: { currency: 'SOL' } });
  const solBalanceCheck = (afterSolTreasury?.balance || 0) - beforeSolBalance === totalSolRevenue;
  if (!solBalanceCheck) {
    issues.push(`SOL treasury mismatch: expected +${totalSolRevenue}, got +${(afterSolTreasury?.balance || 0) - beforeSolBalance}`);
  }

  const avgHomeScore = totalHomeScore / (matchResults.length || 1);
  const avgAwayScore = totalAwayScore / (matchResults.length || 1);
  if (avgHomeScore > 45 || avgAwayScore > 45) issues.push(`Scores too high`);
  if (avgHomeScore < 7 || avgAwayScore < 7) issues.push(`Scores too low`);
  if (totalHomeWins === 0 || totalAwayWins === 0) issues.push('Home or away teams never won');

  const avgHomeNet = matchResults.reduce((s, m) => s + m.homeNet, 0) / (matchResults.length || 1);
  const avgAwayNet = matchResults.reduce((s, m) => s + m.awayNet, 0) / (matchResults.length || 1);
  const pumpfunProjection = calculatePumpfunRevenueProjection();

  return {
    matchesPlayed: matchResults.length,
    totalHomeWins, totalAwayWins, totalDraws,
    avgHomeScore, avgAwayScore,
    playerDevelopment: playerDevelopment.sort((a, b) => b.mvpScore - a.mvpScore).slice(0, 50),
    economicFlow: {
      totalTicketRevenue, totalVenueLeaseFees, totalEntryFees,
      totalTreasuryInflow, totalPlayerPayouts, totalGameOwnerRevenue,
      totalWeeklyCosts, weeklyCostRuns,
      totalSolPurchases, totalSolRevenue,
      totalMarketplaceVolume, totalMarketplaceTax, totalMarketplaceBurn,
      avgRevenuePerHomeGame: avgHomeNet, avgRevenuePerAwayGame: avgAwayNet,
      balanceCheck,
      pumpfunRevenue: pumpfunProjection,
    },
    teamStandings,
    injuries: injuries.slice(0, 20),
    ageProgression,
    marketplaceActivity,
    issues,
  };
}

// ─── Helpers ───

function buildTeamState(team: any) {
  return {
    teamId: team.id,
    name: team.name,
    players: team.teamPlayers.map((tp: any) => ({
      playerId: tp.player.id,
      name: tp.player.name,
      position: tp.player.position,
      stats: {
        pace: tp.player.pace || 50,
        shooting: tp.player.shooting || 50,
        passing: tp.player.passing || 50,
        dribbling: tp.player.dribbling || 50,
        defending: tp.player.defending || 50,
        physical: tp.player.physical || 50,
        goalkeeping: tp.player.goalkeeping || 50,
      },
      condition: tp.player.form || 80,
      morale: tp.player.morale || 75,
      isActive: true,
    })),
    formation: team.formation || '4-3-3',
    style: team.style || 'balanced',
    pressing: team.pressing || 'medium',
    mentality: team.mentality || 'balanced',
    morale: 75,
    fatigue: 0,
    possession: 50,
  };
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
  const solTreasury = await prisma.gameTreasury.findFirst({ where: { currency: 'SOL' } });
  const solTransactions = await prisma.treasuryTransaction.findMany({
    where: { currency: 'SOL' }, orderBy: { createdAt: 'desc' }, take: 10,
  });
  const marketplaceListings = await prisma.teamMarketplaceListing.count({ where: { status: 'ACTIVE' } });
  const marketplaceSold = await prisma.teamMarketplaceListing.count({ where: { status: 'SOLD' } });
  const playerListings = await prisma.marketplaceListing.count({ where: { status: 'ACTIVE' } });

  const tokenTreasury = env.PUMPFUN_TOKEN_ADDRESS
    ? await prisma.tokenTreasury.findUnique({ where: { token: env.PUMPFUN_TOKEN_SYMBOL } })
    : null;
  const recentTokenRevenue = await prisma.tokenRevenue.findMany({
    orderBy: { createdAt: 'desc' }, take: 10,
  });
  const latestTokenPrice = await prisma.tokenPriceHistory.findFirst({
    where: { token: env.PUMPFUN_TOKEN_SYMBOL },
    orderBy: { recordedAt: 'desc' },
  });

  const pumpfunProjection = calculatePumpfunRevenueProjection();

  return {
    treasuryBalance: treasury?.balance || 0,
    totalPlayerCash: totalPlayerCash._sum.cash || 0,
    totalPlayerGrid: totalPlayerGrid._sum.gridTokens || 0,
    gameOwnerCash: gameOwnerWallet?.cash || 0,
    gameOwnerGrid: gameOwnerWallet?.gridTokens || 0,
    aiOwnerCash: aiOwnerWallet?.cash || 0,
    aiOwnerGrid: aiOwnerWallet?.gridTokens || 0,
    solTreasuryBalance: solTreasury?.balance || 0,
    totalSolInflows: solTreasury?.totalInflows || 0,
    topWallets: allWallets.map((w) => ({ username: w.user?.username || w.userId, cash: w.cash, gridTokens: w.gridTokens })),
    recentTreasuryTransactions: recentTransactions,
    recentFinanceSnapshots: recentFinance,
    solTransactions,
    marketplaceStats: { activeTeamListings: marketplaceListings, soldTeamListings: marketplaceSold, activePlayerListings: playerListings },
    tokenData: {
      tokenSymbol: env.PUMPFUN_TOKEN_SYMBOL,
      tokenAddress: env.PUMPFUN_TOKEN_ADDRESS || null,
      tokenTreasuryBalance: tokenTreasury?.balance || 0,
      totalFeesEarned: tokenTreasury?.totalFeesEarned || 0,
      latestPrice: latestTokenPrice?.priceUsd || null,
      latestMarketCap: latestTokenPrice?.marketCap || null,
      latestVolume24h: latestTokenPrice?.volume24h || null,
      recentTokenRevenue,
      pumpfunProjection,
    },
  };
}

export async function getPlayerDevelopmentAudit() {
  const seasonStats = await prisma.playerSeasonStats.findMany({
    where: { season: 'beta' },
    include: { player: { select: { name: true, position: true, overall: true } } },
    orderBy: { mvpScore: 'desc' }, take: 50,
  });

  const totalGamesPlayed = await prisma.playerSeasonStats.aggregate({
    _sum: { gamesPlayed: true },
  });

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
  await prisma.marketplaceListing.deleteMany({});
  await prisma.teamMarketplaceListing.deleteMany({});

  return { deletedMatches: testMatches.length };
}

export async function resetEconomy() {
  const aiOwnerId = 'ai-system-owner-001';
  await prisma.wallet.updateMany({
    where: { userId: aiOwnerId },
    data: { cash: 0, gridTokens: 0, solBalance: 0 },
  });
  await prisma.wallet.updateMany({
    where: { userId: { not: aiOwnerId } },
    data: { cash: 1000, gridTokens: 0 },
  });
  await prisma.gameTreasury.updateMany({
    where: { currency: 'CASH' },
    data: { balance: 0, totalInflows: 0, totalOutflows: 0, totalBurned: 0 },
  });
  await prisma.gameTreasury.updateMany({
    where: { currency: 'SOL' },
    data: { balance: 0, totalInflows: 0, totalOutflows: 0, totalBurned: 0 },
  });
  await prisma.treasuryTransaction.deleteMany({});
  await prisma.teamFinanceSnapshot.deleteMany({});

  const walletCount = await prisma.wallet.count({ where: { userId: { not: aiOwnerId } } });
  return { resetWallets: walletCount, aiOwnerReset: true, treasuryReset: true };
}

export async function processWeeklyOperatingCosts() {
  const teams = await prisma.team.findMany({
    where: { isAI: false },
    include: { venue: true, transportationAssets: true },
  }) as any[];

  const results = [];
  for (const team of teams) {
    if (!team.ownerId) continue;
    const ownerWallet = await prisma.wallet.findUnique({ where: { userId: team.ownerId } });
    if (!ownerWallet) continue;

    let totalCost = 0;
    const costs = [];

    if (team.venue) {
      const maintenanceCost = Math.round(team.venue.capacity * 0.1);
      totalCost += maintenanceCost;
      costs.push({ type: 'VENUE_MAINTENANCE', amount: maintenanceCost });
    }

    for (const transport of team.transportationAssets || []) {
      const opCost = transport.operatingCost || 0;
      totalCost += opCost;
      costs.push({ type: 'TRANSPORT_OPERATING', amount: opCost, name: transport.name });
    }

    const playerCount = await prisma.teamPlayer.count({ where: { teamId: team.id } });
    const wageMap: Record<string, number> = { STATE_COLLEGE: 50, MID_COLLEGE: 100, TOP_COLLEGE: 200, REGIONAL_PRO: 500, PRO_ENTRY: 1000, PRO_ELITE: 2500 };
    const wagePerPlayer = wageMap[team.tier] || 50;
    const totalWages = playerCount * wagePerPlayer;
    totalCost += totalWages;
    costs.push({ type: 'PLAYER_WAGES', amount: totalWages, playerCount });

    const canAfford = ownerWallet.cash >= totalCost;
    await prisma.wallet.update({
      where: { userId: team.ownerId },
      data: { cash: canAfford ? { decrement: totalCost } : 0 },
    });

    if (!canAfford) {
      costs.push({ type: 'BANKRUPTCY_PENALTY', amount: ownerWallet.cash });
    }

    results.push({
      teamId: team.id, teamName: team.name,
      totalCost, costs,
      walletAfter: canAfford ? ownerWallet.cash - totalCost : 0,
    });
  }

  return { processedTeams: results.length, results };
}

// ─── Pump.fun Revenue Projection ───

function calculatePumpfunRevenueProjection() {
  const tokenAddress = env.PUMPFUN_TOKEN_ADDRESS;
  const tokenSymbol = env.PUMPFUN_TOKEN_SYMBOL;
  const feePct = env.PUMPFUN_TRADING_FEE_PCT;
  const creatorShare = env.PUMPFUN_CREATOR_SHARE_PCT;

  if (!tokenAddress) return null;

  const activeUserCount = 300; // target DAU
  const estimatedDailyVolume = activeUserCount * 50; // $50 per user
  const dailyFees = estimatedDailyVolume * feePct;
  const creatorDailyRevenue = dailyFees * creatorShare;

  return {
    tokenSymbol,
    tokenAddress,
    estimatedDailyVolume,
    tradingFeePct: feePct,
    creatorSharePct: creatorShare,
    projectedDailyRevenue: Math.round(creatorDailyRevenue),
    projectedMonthlyRevenue: Math.round(creatorDailyRevenue * 30),
    projectedYearlyRevenue: Math.round(creatorDailyRevenue * 365),
  };
}
