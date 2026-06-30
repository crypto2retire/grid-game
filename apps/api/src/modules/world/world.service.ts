import { prisma } from '../../config/database';

const WORLD_ID = 'grid-city';
const ONLINE_TTL_MS = 5 * 60 * 1000;
const AVATAR_COLORS = ['#2563eb', '#ef4444', '#22c55e', '#f97316', '#8b5cf6', '#14b8a6', '#eab308', '#ec4899'];

const WORLD_BOUNDS = {
  topY: -430,
  centerY: -90,
  bottomY: 350,
  halfWidth: 690,
  avatarMargin: 34,
};

function islandHalfWidthAtY(y: number) {
  if (y <= WORLD_BOUNDS.centerY) {
    return Math.max(0, ((y - WORLD_BOUNDS.topY) / (WORLD_BOUNDS.centerY - WORLD_BOUNDS.topY)) * WORLD_BOUNDS.halfWidth);
  }
  return Math.max(0, ((WORLD_BOUNDS.bottomY - y) / (WORLD_BOUNDS.bottomY - WORLD_BOUNDS.centerY)) * WORLD_BOUNDS.halfWidth);
}

export function clampWorldPosition(point: { x?: number; y?: number }) {
  const safeY = Number.isFinite(point.y) ? Number(point.y) : 95;
  const y = Math.max(WORLD_BOUNDS.topY, Math.min(WORLD_BOUNDS.bottomY, safeY));
  const halfWidth = Math.max(WORLD_BOUNDS.avatarMargin, islandHalfWidthAtY(y));
  const minX = -halfWidth + WORLD_BOUNDS.avatarMargin;
  const maxX = halfWidth - WORLD_BOUNDS.avatarMargin;
  const safeX = Number.isFinite(point.x) ? Number(point.x) : 0;
  const x = Math.max(minX, Math.min(maxX, safeX));
  return { x, y };
}

// Map Prisma MatchStatus enum to frontend-friendly strings
export function mapMatchStatus(status: string): string {
  return status === 'IN_PROGRESS' ? 'PLAYING' : status;
}

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
      status: mapMatchStatus(liveMatch.status),
      phase: liveMatch.gamePhase === 'IN_PROGRESS' ? 'PLAYING' : (liveMatch.gamePhase || 'SCHEDULED'),
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

function avatarColorForUser(userId: string): string {
  const sum = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function facingFromDelta(x: number, y: number, targetX: number, targetY: number): 'left' | 'right' | 'up' | 'down' {
  const dx = targetX - x;
  const dy = targetY - y;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

export function formatWorldPlayer(presence: any) {
  return {
    userId: presence.userId,
    username: presence.usernameSnapshot,
    x: presence.x,
    y: presence.y,
    targetX: presence.targetX,
    targetY: presence.targetY,
    isMoving: Math.hypot(presence.targetX - presence.x, presence.targetY - presence.y) > 1,
    facing: presence.facing,
    avatarColor: presence.avatarColor,
    lastSeen: presence.lastSeen instanceof Date ? presence.lastSeen.getTime() : Date.now(),
  };
}

export async function upsertAvatarPresence(input: {
  userId: string;
  username: string;
  x?: number;
  y?: number;
  targetX?: number;
  targetY?: number;
  facing?: 'left' | 'right' | 'up' | 'down';
}) {
  const existing = await prisma.worldAvatarPresence.findUnique({ where: { userId: input.userId } });
  const current = clampWorldPosition({
    x: input.x ?? existing?.targetX ?? 0,
    y: input.y ?? existing?.targetY ?? 95,
  });
  const target = clampWorldPosition({
    x: input.targetX ?? current.x,
    y: input.targetY ?? current.y,
  });
  const x = current.x;
  const y = current.y;
  const targetX = target.x;
  const targetY = target.y;
  const facing = input.facing ?? facingFromDelta(x, y, targetX, targetY);
  const presence = await prisma.worldAvatarPresence.upsert({
    where: { userId: input.userId },
    update: {
      usernameSnapshot: input.username,
      x,
      y,
      targetX,
      targetY,
      facing,
      status: 'ONLINE',
      lastSeen: new Date(),
    },
    create: {
      userId: input.userId,
      usernameSnapshot: input.username,
      worldId: WORLD_ID,
      x,
      y,
      targetX,
      targetY,
      facing,
      avatarColor: avatarColorForUser(input.userId),
      status: 'ONLINE',
      lastSeen: new Date(),
    },
  });
  return formatWorldPlayer(presence);
}

export async function markAvatarOffline(userId: string) {
  await prisma.worldAvatarPresence.updateMany({
    where: { userId },
    data: { status: 'OFFLINE', lastSeen: new Date() },
  });
}

export async function getOnlinePlayers(excludeUserId?: string) {
  const since = new Date(Date.now() - ONLINE_TTL_MS);
  const players = await prisma.worldAvatarPresence.findMany({
    where: {
      worldId: WORLD_ID,
      status: 'ONLINE',
      lastSeen: { gte: since },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    orderBy: { lastSeen: 'desc' },
    take: 60,
  });
  return players.map(formatWorldPlayer);
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
    status: mapMatchStatus(match.status),
    phase: match.gamePhase === 'IN_PROGRESS' ? 'PLAYING' : (match.gamePhase || 'SCHEDULED'),
    elapsedSeconds: match.currentQuarter ? (4 - match.currentQuarter) * 900 + (900 - (match.gameClock || 0)) : 0,
    totalRevenue: 0,
    attendance: 0,
    capacity: 5000,
    ticketPrice: 10,
  }));
}
