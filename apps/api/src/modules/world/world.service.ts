import { prisma } from '../../config/database';

export async function getMyStadium(userId: string) {
  const team = await prisma.team.findFirst({
    where: { ownerId: userId },
    include: {
      venue: { include: { upgrades: true } },
    },
  });

  if (!team || !team.venue) return null;

  const venue = team.venue;
  
  // Get live or upcoming match for this stadium
  const liveMatch = await prisma.match.findFirst({
    where: {
      homeTeamId: team.id,
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
    },
    orderBy: { scheduledAt: 'asc' },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  // Determine tier from capacity
  const capacity = venue.capacity || 5000;
  let tier = 'shack';
  if (capacity >= 100000) tier = 'legendary';
  else if (capacity >= 60000) tier = 'elite';
  else if (capacity >= 30000) tier = 'premium';
  else if (capacity >= 15000) tier = 'standard';
  else if (capacity >= 5000) tier = 'basic';

  return {
    venueId: venue.id,
    venueName: venue.name || `${team.name} Stadium`,
    capacity: venue.capacity || 5000,
    condition: venue.condition || 50,
    tier,
    upgrades: venue.upgrades?.length || 0,
    ticketPrice: venue.ticketPrice || 10,
    liveMatch: liveMatch ? {
      matchId: liveMatch.id,
      homeTeamId: liveMatch.homeTeamId,
      homeTeamName: liveMatch.homeTeam?.name || 'Home',
      awayTeamId: liveMatch.awayTeamId,
      awayTeamName: liveMatch.awayTeam?.name || 'Away',
      homeScore: liveMatch.homeScore || 0,
      awayScore: liveMatch.awayScore || 0,
      venueId: venue.id,
      venueName: venue.name,
      status: liveMatch.status,
      phase: liveMatch.gamePhase || 'SCHEDULED',
      elapsedSeconds: liveMatch.currentQuarter ? (4 - liveMatch.currentQuarter) * 900 + (900 - (liveMatch.gameClock || 0)) : 0,
      totalRevenue: 0,
      attendance: 0,
      capacity: venue.capacity || 5000,
      ticketPrice: venue.ticketPrice || 10,
    } : undefined,
  };
}

export async function getOtherStadiums(excludeUserId: string) {
  const teams = await prisma.team.findMany({
    where: {
      ownerId: { not: excludeUserId },
      venue: { isNot: null },
    },
    include: {
      venue: { include: { upgrades: true } },
      owner: { select: { id: true, username: true } },
    },
    take: 20,
  });

  return teams.map((team) => {
    const venue = team.venue;
    if (!venue) return null;

    const capacity = venue.capacity || 5000;
    let tier = 'shack';
    if (capacity >= 100000) tier = 'legendary';
    else if (capacity >= 60000) tier = 'elite';
    else if (capacity >= 30000) tier = 'premium';
    else if (capacity >= 15000) tier = 'standard';
    else if (capacity >= 5000) tier = 'basic';

    return {
      venueId: venue.id,
      venueName: venue.name || `${team.name} Stadium`,
      ownerId: team.ownerId,
      ownerUsername: team.owner?.username || 'Unknown',
      capacity: venue.capacity || 5000,
      condition: venue.condition || 50,
      tier,
      upgrades: venue.upgrades?.length || 0,
      ticketPrice: venue.ticketPrice || 10,
      liveMatch: undefined, // Will be populated by getLiveMatches
    };
  }).filter(Boolean);
}

export async function getLiveMatches() {
  const matches = await prisma.match.findMany({
    where: {
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
    },
    orderBy: { scheduledAt: 'asc' },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
    take: 50,
  });

  return matches.map((match) => ({
    matchId: match.id,
    homeTeamId: match.homeTeamId,
    homeTeamName: match.homeTeam?.name || 'Home',
    awayTeamId: match.awayTeamId,
    awayTeamName: match.awayTeam?.name || 'Away',
    homeScore: match.homeScore || 0,
    awayScore: match.awayScore || 0,
    venueId: '', // Will be looked up from homeTeam's venue
    venueName: 'Stadium',
    status: match.status,
    phase: match.gamePhase || 'SCHEDULED',
    elapsedSeconds: match.currentQuarter ? (4 - match.currentQuarter) * 900 + (900 - (match.gameClock || 0)) : 0,
    totalRevenue: 0,
    attendance: 0,
    capacity: 5000,
    ticketPrice: 10,
  }));
}
