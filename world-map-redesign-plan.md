# Grid-Game World Map MMO Redesign — Implementation Plan

## Overview

Transform the static single-player SVG world map into a living community MMO hub where:
- **Community buildings** are shared by all players (fixed, always visible, "public" aesthetic)
- **Each player's stadium** is rendered dynamically based on their real venue data (capacity, tier, condition, upgrades)
- **Other online players** appear as avatars that move between buildings in real time
- **Live matches** show crowd animations, scoreboards, spotlights, and "LIVE" badges

---

## Phase 1: Architecture & Data Contracts

### Shared Contracts (agreed before any implementation)

```typescript
// ─── Socket.IO Events ───

// Client → Server
"world:join"       → { userId: string, username: string, avatar?: string, teamId?: string }
"world:move"       → { targetBuildingId: string }  // player clicked a building
"world:heartbeat"  → {}  // every 15s to keep presence alive
"match:subscribe"  → { matchId: string }  // already exists

// Server → Client (broadcast)
"world:players"    → { players: WorldPlayer[] }  // full player list snapshot
"world:player:joined"  → WorldPlayer
"world:player:left"    → { userId: string }
"world:player:moved"   → { userId: string, fromX: number, fromY: number, toX: number, toY: number, targetBuildingId: string, progress: number }
"world:matches"    → { matches: LiveMatch[] }  // all live/upcoming matches snapshot
"world:match:updated"  → LiveMatch

// ─── Data Shapes ───

interface WorldPlayer {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  teamName?: string;
  x: number;
  y: number;
  targetBuildingId?: string;
  isMoving: boolean;
  lastSeen: number; // epoch ms
}

interface LiveMatch {
  matchId: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  venueId: string;
  venueName: string;
  venueCapacity: number;
  status: 'SCHEDULED' | 'PLAYING' | 'COMPLETED';
  scheduledAt: string;
  startedAt?: string;
  elapsedSeconds?: number;
  attendancePct: number; // 0-1
}

interface MapStadium {
  userId: string;
  teamId: string;
  teamName: string;
  venueId: string;
  venueName: string;
  tier: string;
  capacity: number;
  condition: number;
  prestige: number;
  x: number; // assigned by server on join
  y: number;
  hasActiveMatch: boolean;
  activeMatch?: LiveMatch;
  upcomingMatch?: LiveMatch;
}

interface CommunityBuilding {
  id: string;
  label: string;
  route: string;
  icon: string; // lucide icon name
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  accent: string;
  type: 'hq' | 'marketplace' | 'training' | 'leaderboard' | 'bank' | 'travel' | 'locker';
}
```

---

## Phase 2: Backend APIs & Socket.IO

### 2.1 New Files to Create

#### `apps/api/src/modules/world/world.routes.ts`
```typescript
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { prisma } from '../../config/database';

const router = Router();

// GET /api/world/players — list currently online players (last 5 min)
router.get('/players', authMiddleware, asyncHandler(async (_req, res) => {
  // In Phase 2, this is a stub. In Phase 3, it reads from Redis presence.
  res.json({ status: 'success', data: { players: [] } });
}));

// GET /api/world/stadiums — list all player stadiums for the map
router.get('/stadiums', authMiddleware, asyncHandler(async (_req, res) => {
  const stadiums = await prisma.team.findMany({
    where: { isAI: false },
    include: {
      owner: { select: { id: true, username: true, displayName: true } },
      venue: true,
      matchesHome: {
        where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
        orderBy: { scheduledAt: 'asc' },
        take: 1,
        include: {
          awayTeam: { select: { id: true, name: true } },
        },
      },
    },
    take: 50, // max visible stadiums on map
    orderBy: { createdAt: 'desc' },
  });

  const data = stadiums.map((team, index) => {
    const match = team.matchesHome[0];
    return {
      userId: team.ownerId,
      teamId: team.id,
      teamName: team.name,
      venueId: team.venue?.id,
      venueName: team.venue?.name || `${team.name} Stadium`,
      tier: team.venue?.tier || 'PARK_FIELD',
      capacity: team.venue?.capacity || 250,
      condition: team.venue?.condition || 70,
      prestige: team.venue?.prestige || 10,
      // Stadiums arranged in a grid on the right/bottom periphery
      x: 650 + (index % 4) * 80,
      y: 520 + Math.floor(index / 4) * 70,
      hasActiveMatch: match?.status === 'IN_PROGRESS',
      activeMatch: match?.status === 'IN_PROGRESS' ? {
        matchId: match.id,
        homeTeamId: match.homeTeamId,
        homeTeamName: team.name,
        awayTeamId: match.awayTeamId,
        awayTeamName: match.awayTeam.name,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        status: match.status,
      } : undefined,
      upcomingMatch: match?.status === 'SCHEDULED' ? {
        matchId: match.id,
        homeTeamId: match.homeTeamId,
        homeTeamName: team.name,
        awayTeamId: match.awayTeamId,
        awayTeamName: match.awayTeam.name,
        status: match.status,
        scheduledAt: match.scheduledAt.toISOString(),
      } : undefined,
    };
  });

  res.json({ status: 'success', data: { stadiums: data } });
}));

// GET /api/world/matches — all live or upcoming matches visible on the map
router.get('/matches', authMiddleware, asyncHandler(async (_req, res) => {
  const matches = await prisma.match.findMany({
    where: {
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      scheduledAt: { gte: new Date(Date.now() - 1000 * 60 * 60) }, // started within last hour
    },
    include: {
      homeTeam: { select: { id: true, name: true, ownerId: true } },
      awayTeam: { select: { id: true, name: true } },
      homeTeam: { include: { venue: true } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
  });

  const data = matches.map((m) => ({
    matchId: m.id,
    homeTeamId: m.homeTeamId,
    homeTeamName: m.homeTeam.name,
    awayTeamId: m.awayTeamId,
    awayTeamName: m.awayTeam.name,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    venueId: m.homeTeam.venue?.id,
    venueName: m.homeTeam.venue?.name,
    venueCapacity: m.homeTeam.venue?.capacity || 5000,
    status: m.status,
    scheduledAt: m.scheduledAt.toISOString(),
    startedAt: m.startedAt?.toISOString(),
    elapsedSeconds: m.startedAt ? Math.floor((Date.now() - m.startedAt.getTime()) / 1000) : 0,
    attendancePct: m.status === 'IN_PROGRESS' ? 0.75 : 0,
  }));

  res.json({ status: 'success', data: { matches: data } });
}));

export const worldRouter = router;
```

#### `apps/api/src/websocket/world.handlers.ts`
```typescript
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../config/database';

// In-memory presence store (Phase 2). Replace with Redis in Phase 3.
interface PresenceEntry {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  teamName?: string;
  x: number;
  y: number;
  targetBuildingId?: string;
  isMoving: boolean;
  lastSeen: number;
  socketId: string;
}

const presence = new Map<string, PresenceEntry>(); // userId -> entry

function getBuildingPosition(buildingId: string): { x: number; y: number } {
  // Community building positions (must match frontend)
  const positions: Record<string, { x: number; y: number }> = {
    'dashboard': { x: 140, y: 105 },
    'stadium':   { x: 500, y: 120 },
    'market':    { x: 140, y: 470 },
    'team':      { x: 500, y: 470 },
    'wallet':    { x: 850, y: 470 },
    'transport': { x: 140, y: 290 },
    'training':  { x: 850, y: 290 },
    'leaderboard': { x: 500, y: 290 },
    'world':     { x: 880, y: 105 },
    'locker':    { x: 310, y: 290 },
  };
  return positions[buildingId] || { x: 500, y: 350 };
}

export function initializeWorldSocketHandlers(io: SocketIOServer): void {
  // Presence cleanup interval (every 30s, remove idle > 60s)
  setInterval(() => {
    const now = Date.now();
    const stale = Array.from(presence.values()).filter(p => now - p.lastSeen > 60000);
    for (const p of stale) {
      presence.delete(p.userId);
      io.emit('world:player:left', { userId: p.userId });
    }
  }, 30000);

  io.on('connection', (socket: Socket) => {
    // ─── World Join ───
    socket.on('world:join', async (data: { userId: string; username: string; avatar?: string; teamId?: string }) => {
      const team = data.teamId ? await prisma.team.findUnique({
        where: { id: data.teamId },
        select: { name: true },
      }) : null;

      const entry: PresenceEntry = {
        userId: data.userId,
        username: data.username,
        displayName: data.username,
        avatar: data.avatar,
        teamName: team?.name,
        x: 140, // start at HQ
        y: 105,
        isMoving: false,
        lastSeen: Date.now(),
        socketId: socket.id,
      };

      presence.set(data.userId, entry);
      socket.join('world:global');

      // Notify all players of new arrival
      io.emit('world:player:joined', {
        userId: entry.userId,
        username: entry.username,
        displayName: entry.displayName,
        avatar: entry.avatar,
        teamName: entry.teamName,
        x: entry.x,
        y: entry.y,
        isMoving: false,
      });

      // Send current player list to the new joiner
      const allPlayers = Array.from(presence.values()).map(p => ({
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
        avatar: p.avatar,
        teamName: p.teamName,
        x: p.x,
        y: p.y,
        isMoving: p.isMoving,
        targetBuildingId: p.targetBuildingId,
      }));
      socket.emit('world:players', { players: allPlayers });
    });

    // ─── World Move ───
    socket.on('world:move', (data: { targetBuildingId: string }) => {
      const entry = Array.from(presence.values()).find(p => p.socketId === socket.id);
      if (!entry) return;

      const target = getBuildingPosition(data.targetBuildingId);
      const fromX = entry.x;
      const fromY = entry.y;

      entry.isMoving = true;
      entry.targetBuildingId = data.targetBuildingId;
      entry.lastSeen = Date.now();

      // Broadcast start of movement
      io.emit('world:player:moved', {
        userId: entry.userId,
        fromX,
        fromY,
        toX: target.x,
        toY: target.y,
        targetBuildingId: data.targetBuildingId,
        progress: 0,
      });

      // Simulate movement completion after 800ms (server-side)
      setTimeout(() => {
        entry.x = target.x;
        entry.y = target.y;
        entry.isMoving = false;
        entry.lastSeen = Date.now();

        io.emit('world:player:moved', {
          userId: entry.userId,
          fromX,
          fromY,
          toX: target.x,
          toY: target.y,
          targetBuildingId: data.targetBuildingId,
          progress: 1,
        });
      }, 800);
    });

    // ─── Heartbeat ───
    socket.on('world:heartbeat', () => {
      const entry = Array.from(presence.values()).find(p => p.socketId === socket.id);
      if (entry) {
        entry.lastSeen = Date.now();
      }
    });

    // ─── Disconnect ───
    socket.on('disconnect', () => {
      const entry = Array.from(presence.values()).find(p => p.socketId === socket.id);
      if (entry) {
        presence.delete(entry.userId);
        io.emit('world:player:left', { userId: entry.userId });
      }
    });
  });
}

// ─── Broadcast Helpers ───

export function broadcastMatchUpdate(io: SocketIOServer, match: any): void {
  io.to('world:global').emit('world:match:updated', {
    matchId: match.id,
    homeTeamId: match.homeTeamId,
    homeTeamName: match.homeTeam?.name,
    awayTeamId: match.awayTeamId,
    awayTeamName: match.awayTeam?.name,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    venueId: match.homeTeam?.venue?.id,
    venueName: match.homeTeam?.venue?.name,
    venueCapacity: match.homeTeam?.venue?.capacity,
    elapsedSeconds: match.startedAt ? Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0,
    attendancePct: match.status === 'IN_PROGRESS' ? 0.75 : 0,
  });
}
```

#### `apps/api/src/modules/world/world.service.ts`
```typescript
import { prisma } from '../../config/database';

export async function getOnlinePlayers() {
  // Phase 2: empty. Phase 3: read from Redis.
  return [];
}

export async function getMapStadiums() {
  return prisma.team.findMany({
    where: { isAI: false },
    include: { owner: { select: { id: true, username: true } }, venue: true },
    take: 50,
  });
}
```

### 2.2 Files to Modify

#### `apps/api/src/server.ts`
```typescript
// Add import
import { worldRouter } from './modules/world/world.routes';
import { initializeWorldSocketHandlers } from './websocket/world.handlers';

// Add route
app.use('/api/world', worldRouter);

// Add socket init
initializeWorldSocketHandlers(io); // call alongside initializeSocketHandlers
```

#### `apps/api/src/websocket/socket.handlers.ts`
```typescript
// Add to existing handlers to broadcast match state changes to the world
// In match:subscribe handler, after subscription success:
// io.to('world:global').emit('world:match:updated', ...);
```

---

## Phase 3: Frontend — Socket.IO Client Hook

### New File: `apps/web/src/hooks/useWorldSocket.ts`
```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export interface OnlinePlayer {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  teamName?: string;
  x: number;
  y: number;
  isMoving: boolean;
  targetBuildingId?: string;
}

export interface LiveMatchUpdate {
  matchId: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  status: string;
  venueId: string;
  venueName: string;
  venueCapacity: number;
  elapsedSeconds: number;
  attendancePct: number;
}

export function useWorldSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatchUpdate[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const socket = io(window.location.origin, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Join world room with user data
      socket.emit('world:join', {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('world:players', ({ players }: { players: OnlinePlayer[] }) => {
      setPlayers(players.filter(p => p.userId !== user.id)); // exclude self
    });

    socket.on('world:player:joined', (player: OnlinePlayer) => {
      if (player.userId === user.id) return;
      setPlayers(prev => {
        if (prev.find(p => p.userId === player.userId)) return prev;
        return [...prev, player];
      });
    });

    socket.on('world:player:left', ({ userId }: { userId: string }) => {
      setPlayers(prev => prev.filter(p => p.userId !== userId));
    });

    socket.on('world:player:moved', (data: {
      userId: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      targetBuildingId: string;
      progress: number;
    }) => {
      if (data.userId === user.id) return;
      setPlayers(prev => prev.map(p => {
        if (p.userId !== data.userId) return p;
        if (data.progress === 1) {
          return { ...p, x: data.toX, y: data.toY, isMoving: false, targetBuildingId: undefined };
        }
        return { ...p, isMoving: true, targetBuildingId: data.targetBuildingId };
      }));
    });

    socket.on('world:matches', ({ matches }: { matches: LiveMatchUpdate[] }) => {
      setLiveMatches(matches);
    });

    socket.on('world:match:updated', (match: LiveMatchUpdate) => {
      setLiveMatches(prev => {
        const existing = prev.findIndex(m => m.matchId === match.matchId);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = match;
          return next;
        }
        return [...prev, match];
      });
    });

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      if (socket.connected) socket.emit('world:heartbeat');
    }, 15000);

    return () => {
      clearInterval(heartbeat);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.id]);

  const moveToBuilding = useCallback((targetBuildingId: string) => {
    socketRef.current?.emit('world:move', { targetBuildingId });
  }, []);

  return { players, liveMatches, connected, moveToBuilding, socket: socketRef.current };
}
```

---

## Phase 4: Frontend — World Map Component Redesign

### New File: `apps/web/src/components/world/CommunityBuildingSVG.tsx`
```typescript
import React from 'react';

export interface CommunityBuilding {
  id: string;
  label: string;
  route: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  accent: string;
  type: 'hq' | 'marketplace' | 'training' | 'leaderboard' | 'bank' | 'travel' | 'locker';
}

export const COMMUNITY_BUILDINGS: CommunityBuilding[] = [
  { id: 'dashboard', label: 'HQ',        route: '/dashboard',    x: 60,  y: 40,  width: 100, height: 80,  color: '#e2e8f0', accent: '#64748b', type: 'hq' },
  { id: 'market',    label: 'Marketplace', route: '/marketplace', x: 200, y: 40,  width: 110, height: 80,  color: '#fef3c7', accent: '#d97706', type: 'marketplace' },
  { id: 'training',  label: 'Training Center', route: '/training', x: 340, y: 40, width: 120, height: 80,  color: '#f3e8ff', accent: '#7c3aed', type: 'training' },
  { id: 'leaderboard', label: 'Leaderboard', route: '/leaderboard', x: 490, y: 40, width: 110, height: 80,  color: '#ffedd5', accent: '#ea580c', type: 'leaderboard' },
  { id: 'bank',      label: 'Bank',      route: '/wallet',       x: 630, y: 40,  width: 100, height: 80,  color: '#ecfccb', accent: '#65a30d', type: 'bank' },
  { id: 'travel',    label: 'Travel Hub', route: '/world-map',   x: 770, y: 40,  width: 110, height: 80,  color: '#cffafe', accent: '#0891b2', type: 'travel' },
  { id: 'locker',    label: 'Locker Room', route: '/locker',    x: 890, y: 40,  width: 100, height: 80,  color: '#f1f5f9', accent: '#475569', type: 'locker' },
];

// ─── Public Building SVG Styles ───
// Lighter colors, rounded friendly shapes, small flag/signs to show "public"

export function CommunityBuildingSVG({ building, isHovered, isTraining }: {
  building: CommunityBuilding;
  isHovered: boolean;
  isTraining?: boolean;
}) {
  const { color, accent, x, y, width: w, height: h, type } = building;
  const glow = isHovered || (type === 'training' && isTraining) ? 1 : 0.5;

  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      {/* Glow halo */}
      <rect x="-4" y="-4" width={w + 8} height={h + 8} rx="14" fill={accent} opacity={glow * 0.12} />

      {/* Main building — lighter, more modern shape */}
      <rect x="0" y="12" width={w} height={h - 12} rx="10" fill={color} stroke={accent} strokeWidth="1.5" opacity="0.95" />

      {/* Roof / awning */}
      <path d={`M 0 30 Q ${w / 2} 8 ${w} 30`} fill="none" stroke={accent} strokeWidth="1.5" opacity="0.6" />

      {/* Public flag indicator */}
      <line x1={w - 12} y1="12" x2={w - 12} y2="-4" stroke={accent} strokeWidth="1.2" opacity="0.6" />
      <rect x={w - 12} y="-8" width="10" height="7" rx="1" fill={accent} opacity="0.7" />

      {/* Type-specific iconography */}
      {type === 'hq' && <>
        <rect x={w / 2 - 15} y={28} width="30" height="22" rx="3" fill="#cbd5e1" opacity="0.5" />
        <rect x={w / 2 - 10} y={32} width="20" height="3" rx="1" fill={accent} opacity="0.5" />
        <rect x={w / 2 - 10} y={38} width="14" height="3" rx="1" fill={accent} opacity="0.35" />
      </>}
      {type === 'marketplace' && <>
        <rect x="12" y={28} width="18" height="20" rx="2" fill="#cbd5e1" opacity="0.4" />
        <rect x="36" y={28} width="18" height="20" rx="2" fill="#cbd5e1" opacity="0.4" />
        <rect x="60" y={28} width="18" height="20" rx="2" fill="#cbd5e1" opacity="0.4" />
        <circle cx="21" cy="38" r="3" fill="#fbbf24" opacity="0.5" />
        <circle cx="45" cy="38" r="3" fill="#22c55e" opacity="0.5" />
        <circle cx="69" cy="38" r="3" fill="#3b82f6" opacity="0.5" />
      </>}
      {type === 'training' && <>
        <rect x={w / 2 - 12} y={30} width="24" height="20" rx="3" fill="#cbd5e1" opacity="0.4" />
        <rect x={w / 2 - 8} y={34} width="16" height="3" rx="1" fill={accent} opacity="0.5" />
        {isTraining && (
          <circle cx={w / 2} cy="18" r="4" fill="#22c55e" opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="indefinite" />
          </circle>
        )}
      </>}
      {type === 'leaderboard' && <>
        <rect x={w / 2 - 4} y={26} width="8" height="28" rx="1" fill="#cbd5e1" opacity="0.4" />
        <rect x={w / 2 - 14} y={40} width="10" height="14" rx="1" fill={accent} opacity="0.4" />
        <rect x={w / 2 + 4} y={34} width="10" height="20" rx="1" fill={accent} opacity="0.3" />
      </>}
      {type === 'bank' && <>
        <rect x="18" y={30} width="12" height="22" rx="1" fill="#cbd5e1" opacity="0.3" />
        <rect x="38" y={30} width="12" height="22" rx="1" fill="#cbd5e1" opacity="0.3" />
        <rect x="58" y={30} width="12" height="22" rx="1" fill="#cbd5e1" opacity="0.3" />
        <circle cx={w / 2} cy="20" r="5" fill="#eab308" opacity="0.5" />
      </>}
      {type === 'travel' && <>
        <circle cx={w / 2} cy="40" r="14" fill="#cbd5e1" opacity="0.3" />
        <ellipse cx={w / 2} cy="40" rx="6" ry="14" fill="none" stroke={accent} strokeWidth="1" opacity="0.4" />
        <line x1={w / 2 - 14} y1="40" x2={w / 2 + 14} y2="40" stroke={accent} strokeWidth="1" opacity="0.4" />
      </>}
      {type === 'locker' && <>
        <rect x="10" y={30} width="16" height="22" rx="2" fill="#cbd5e1" opacity="0.3" />
        <rect x="32" y={30} width="16" height="22" rx="2" fill="#cbd5e1" opacity="0.3" />
        <rect x="54" y={30} width="16" height="22" rx="2" fill="#cbd5e1" opacity="0.3" />
        <circle cx="18" cy="38" r="2" fill={accent} opacity="0.5" />
        <circle cx="40" cy="38" r="2" fill={accent} opacity="0.5" />
        <circle cx="62" cy="38" r="2" fill={accent} opacity="0.5" />
      </>}

      {/* Label bar */}
      <rect x="6" y={h - 16} width={w - 12} height="14" rx="5" fill="#0f172a" opacity="0.75" />
      <text x={w / 2} y={h - 5} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">{building.label}</text>
    </g>
  );
}
```

### New File: `apps/web/src/components/world/PlayerStadiumSVG.tsx`
```typescript
import React from 'react';
import type { LiveMatchUpdate } from '../../hooks/useWorldSocket';

export interface PlayerStadium {
  userId: string;
  teamId: string;
  teamName: string;
  venueId: string;
  venueName: string;
  tier: string;
  capacity: number;
  condition: number;
  prestige: number;
  x: number;
  y: number;
  hasActiveMatch: boolean;
  activeMatch?: LiveMatchUpdate;
  upcomingMatch?: LiveMatchUpdate;
}

const TIER_COLORS: Record<string, string> = {
  PARK_FIELD: '#94a3b8',
  COMMUNITY: '#22c55e',
  COMMUNITY_FIELD: '#22c55e',
  SMALL_STADIUM: '#3b82f6',
  REGIONAL: '#8b5cf6',
  REGIONAL_STADIUM: '#8b5cf6',
  PRO: '#E94560',
  PRO_STADIUM: '#E94560',
  ELITE: '#fbbf24',
};

function getStadiumSize(tier: string, capacity: number): { w: number; h: number } {
  const base = { w: 80, h: 60 };
  if (tier === 'ELITE') return { w: 140, h: 100 };
  if (tier === 'PRO' || tier === 'PRO_STADIUM') return { w: 120, h: 90 };
  if (tier === 'REGIONAL' || tier === 'REGIONAL_STADIUM') return { w: 110, h: 80 };
  if (tier === 'SMALL_STADIUM') return { w: 100, h: 70 };
  if (tier === 'COMMUNITY' || tier === 'COMMUNITY_FIELD') return { w: 90, h: 65 };
  // Scale slightly by capacity
  const scale = Math.min(1.3, 1 + (capacity / 100000));
  return { w: Math.round(base.w * scale), h: Math.round(base.h * scale) };
}

export function PlayerStadiumSVG({ stadium, isHovered }: { stadium: PlayerStadium; isHovered: boolean }) {
  const { x, y, tier, capacity, condition, teamName, hasActiveMatch, activeMatch, upcomingMatch } = stadium;
  const accent = TIER_COLORS[tier] || '#94a3b8';
  const { w, h } = getStadiumSize(tier, capacity);
  const glow = isHovered || hasActiveMatch ? 1 : 0.5;
  const crowdOpacity = hasActiveMatch ? 0.85 : 0.15;

  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      {/* Glow / spotlight effect for active match */}
      {hasActiveMatch && (
        <>
          <ellipse cx={w / 2} cy={h / 2} rx={w * 0.8} ry={h * 0.8} fill={accent} opacity="0.08">
            <animate attributeName="opacity" values="0.08;0.15;0.08" dur="2s" repeatCount="indefinite" />
          </ellipse>
          <line x1="0" y1="0" x2="-10" y2="-25" stroke={accent} strokeWidth="1.5" opacity="0.5" />
          <line x1={w} y1="0" x2={w + 10} y2="-25" stroke={accent} strokeWidth="1.5" opacity="0.5" />
        </>
      )}

      {/* Building shadow */}
      <rect x="3" y="3" width={w} height={h} rx="10" fill="#000" opacity="0.15" />

      {/* Main stadium body */}
      <rect x="0" y="8" width={w} height={h - 8} rx="10" fill="#0f172a" stroke={accent} strokeWidth={hasActiveMatch ? 2 : 1} opacity="0.95" />

      {/* Roof tiers */}
      <rect x="8" y="4" width={w - 16} height="12" rx="4" fill="#0f172a" stroke={accent} strokeWidth="1" opacity="0.85" />
      <rect x="18" y="-2" width={w - 36} height="10" rx="3" fill="#0f172a" stroke={accent} strokeWidth="0.8" opacity="0.7" />

      {/* Field */}
      <rect x="12" y={h - 28} width={w - 24} height="18" rx="3" fill="#14532d" opacity="0.5" />
      <line x1={w / 2} y1={h - 28} x2={w / 2} y2={h - 10} stroke="#fff" strokeWidth="0.8" opacity="0.25" />

      {/* Crowd dots — dynamic based on capacity */}
      {Array.from({ length: Math.min(24, Math.floor(capacity / 2000) + 4) }).map((_, i) => {
        const cx = 10 + (i % 8) * ((w - 20) / 7);
        const cy = 12 + Math.floor(i / 8) * ((h - 36) / 2);
        return (
          <circle key={i} cx={cx} cy={cy} r="1.2" fill="#fbbf24" opacity={crowdOpacity}>
            {hasActiveMatch && (
              <animate attributeName="opacity" values={`${crowdOpacity};${crowdOpacity * 0.3};${crowdOpacity}`} dur={`${1.2 + Math.random()}s`} repeatCount="indefinite" />
            )}
          </circle>
        );
      })}

      {/* Spotlights on roof */}
      <line x1="12" y1="4" x2="12" y2="-10" stroke={accent} strokeWidth="1" opacity="0.4" />
      <circle cx="12" cy="-10" r="2.5" fill="#fbbf24" opacity={hasActiveMatch ? 0.9 : 0.25}>
        {hasActiveMatch && <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />}
      </circle>
      <line x1={w - 12} y1="4" x2={w - 12} y2="-10" stroke={accent} strokeWidth="1" opacity="0.4" />
      <circle cx={w - 12} cy="-10" r="2.5" fill="#fbbf24" opacity={hasActiveMatch ? 0.9 : 0.25}>
        {hasActiveMatch && <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2.2s" repeatCount="indefinite" />}
      </circle>

      {/* Scoreboard for live match */}
      {hasActiveMatch && activeMatch && (
        <g>
          <rect x={w / 2 - 32} y={-28} width="64" height="16" rx="4" fill="#0f172a" opacity="0.95" stroke={accent} strokeWidth="0.5" />
          <text x={w / 2} y={-17} textAnchor="middle" fill="#fff" fontSize="7" fontWeight="900">
            {activeMatch.homeScore} - {activeMatch.awayScore}
          </text>
        </g>
      )}

      {/* LIVE badge */}
      {hasActiveMatch && (
        <g>
          <rect x={w / 2 - 18} y={-44} width="36" height="12" rx="4" fill="#E94560" opacity="0.95" />
          <text x={w / 2} y={-35} textAnchor="middle" fill="#fff" fontSize="7" fontWeight="900">LIVE</text>
          <circle cx={w / 2 - 10} cy={-38} r="2" fill="#fff" opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* UPCOMING badge */}
      {!hasActiveMatch && upcomingMatch && (
        <g>
          <rect x={w / 2 - 28} y={-28} width="56" height="12" rx="4" fill="#3b82f6" opacity="0.9" />
          <text x={w / 2} y={-19} textAnchor="middle" fill="#fff" fontSize="6" fontWeight="900">UPCOMING</text>
        </g>
      )}

      {/* Team name label */}
      <rect x="4" y={h - 14} width={w - 8} height="12" rx="4" fill="#0f172a" opacity="0.85" />
      <text x={w / 2} y={h - 5} textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700">{teamName}</text>

      {/* Capacity indicator */}
      <text x={w - 4} y="8" textAnchor="end" fill={accent} fontSize="6" fontWeight="700" opacity="0.8">
        {(capacity / 1000).toFixed(1)}K
      </text>

      {/* Condition bar */}
      <rect x="6" y={h - 2} width={w - 12} height="3" rx="1.5" fill="#1e293b" opacity="0.6" />
      <rect x="6" y={h - 2} width={(w - 12) * (condition / 100)} height="3" rx="1.5" fill={condition > 70 ? '#22c55e' : condition > 40 ? '#eab308' : '#ef4444'} opacity="0.8" />
    </g>
  );
}
```

### New File: `apps/web/src/components/world/PlayerAvatarSVG.tsx`
```typescript
import React, { useMemo } from 'react';
import type { OnlinePlayer } from '../../hooks/useWorldSocket';

export function PlayerAvatarSVG({ player, localX, localY }: {
  player: OnlinePlayer;
  localX: number; // interpolated x for animation
  localY: number; // interpolated y for animation
}) {
  const color = useMemo(() => {
    const colors = ['#E94560', '#3b82f6', '#22c55e', '#fbbf24', '#a855f7', '#06b6d4', '#f97316'];
    const h = player.userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[h % colors.length];
  }, [player.userId]);

  return (
    <g transform={`translate(${localX - 12}, ${localY - 24})`}>
      {/* Name tooltip above avatar */}
      <rect x="-30" y="-32" width="60" height="12" rx="4" fill="#0f172a" opacity="0.85" stroke={color} strokeWidth="0.5" />
      <text x="0" y="-23" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700">
        {player.displayName || player.username}
      </text>

      {/* Body */}
      <circle cx="12" cy="6" r="7" fill={color} opacity="0.9" />
      <rect x="6" y="13" width="12" height="14" rx="3" fill={color} opacity="0.8" />

      {/* Arms */}
      <rect x="2" y="15" width="4" height="10" rx="2" fill={color} opacity="0.7" />
      <rect x="18" y="15" width="4" height="10" rx="2" fill={color} opacity="0.7" />

      {/* Legs */}
      <rect x="7" y="26" width="4" height="10" rx="2" fill="#1e293b" opacity="0.9" />
      <rect x="13" y="26" width="4" height="10" rx="2" fill="#1e293b" opacity="0.9" />

      {/* Movement indicator dots */}
      {player.isMoving && (
        <>
          <circle cx="12" cy="-4" r="1.5" fill="#fff" opacity="0.5">
            <animate attributeName="cy" values="-4;-10;-4" dur="0.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="0.6s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Shadow */}
      <ellipse cx="12" cy="38" rx="9" ry="2.5" fill="#000" opacity="0.15" />
    </g>
  );
}
```

---

## Phase 5: Refactor GameShell.tsx

### `apps/web/src/components/world/GameShell.tsx` — Major Refactor

The new `GameShell` has this layout:
```
┌─────────────────────────────────────────────────────────────────┐
│  [HQ] [Market] [Training] [Leaderboard] [Bank] [Travel] [Locker] │  ← Community row (top, y=40)
│                                                                  │
│        ┌── Roads connecting community buildings ──┐             │
│                                                                  │
│  ┌──────────────┐                    ┌──────────────┐           │
│  │  MY STADIUM  │  ← Center stage    │  Other player│           │
│  │  (dynamic)   │                    │  stadiums... │           │
│  └──────────────┘                    └──────────────┘           │
│                                                                  │
│  ═══════════════════════════════════════════════════              │
│  Player Stadium Row (periphery, y=520+)                         │
│  [Stadium] [Stadium] [Stadium] [Stadium] ...                    │
│                                                                  │
│  ~ ~ ~ Other player avatars moving around ~ ~ ~                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Key changes to `GameShell`:

1. **Replace `BUILDINGS`** with two arrays: `COMMUNITY_BUILDINGS` (top row) and a dynamically loaded `playerStadiums` array.
2. **Remove the old `StadiumSVG` building** from community buildings — the stadium is now the player's own property shown prominently.
3. **Add `useWorldSocket()`** to get real-time players and matches.
4. **Add `useEffect`** to fetch `/api/world/stadiums` on mount.
5. **Render order**:
   - Background / roads
   - Community buildings (top row)
   - Player's own stadium (center-left, larger)
   - Other player stadiums (bottom row, smaller)
   - Other player avatars (animated)
   - My own avatar (on top)
6. **Click handling**:
   - Community buildings → open panel (existing behavior)
   - Player stadiums → open a "Spectate Match" panel or "Scout Stadium" panel
   - My own stadium → open `/stadium/interior` panel
7. **Avatar movement**: When clicking a building, call `moveToBuilding(buildingId)` and animate local avatar position toward the target with `requestAnimationFrame` over 800ms.

### Pseudocode for the new GameShell render:

```tsx
export default function GameShell() {
  const { openPanel } = usePanels();
  const { players, liveMatches, moveToBuilding } = useWorldSocket();
  const [playerStadiums, setPlayerStadiums] = useState<PlayerStadium[]>([]);
  const [myStadium, setMyStadium] = useState<PlayerStadium | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [myAvatar, setMyAvatar] = useState({ x: 110, y: 80, isMoving: false });

  // Fetch stadiums on mount
  useEffect(() => {
    fetch('/api/world/stadiums', { headers: authHeaders })
      .then(r => r.json())
      .then(json => {
        const all = json.data.stadiums;
        const mine = all.find((s: PlayerStadium) => s.userId === user?.id);
        setMyStadium(mine || null);
        setPlayerStadiums(all.filter((s: PlayerStadium) => s.userId !== user?.id));
      });
  }, []);

  // Animate my avatar locally
  const handleBuildingClick = (building: CommunityBuilding | PlayerStadium) => {
    if (myAvatar.isMoving) return;
    const targetX = 'route' in building ? building.x + building.width / 2 : building.x + 40;
    const targetY = 'route' in building ? building.y + building.height - 5 : building.y + 30;
    
    // Start socket movement
    if ('route' in building) moveToBuilding(building.id);
    
    // Local animation
    setMyAvatar(prev => ({ ...prev, isMoving: true }));
    animateAvatar(myAvatar.x, myAvatar.y, targetX, targetY, 800, (x, y, done) => {
      setMyAvatar({ x, y, isMoving: !done });
      if (done) openPanelForBuilding(building);
    });
  };

  return (
    <svg viewBox="0 0 1000 700" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Background, roads, skyline — same as before */}
      
      {/* Community buildings (top row) */}
      {COMMUNITY_BUILDINGS.map(b => (
        <g key={b.id} onMouseEnter={() => setHoveredId(b.id)} onMouseLeave={() => setHoveredId(null)} onClick={() => handleBuildingClick(b)}>
          <CommunityBuildingSVG building={b} isHovered={hoveredId === b.id} isTraining={isTraining} />
        </g>
      ))}
      
      {/* My stadium — center-left, larger */}
      {myStadium && (
        <g onMouseEnter={() => setHoveredId(myStadium.venueId)} onMouseLeave={() => setHoveredId(null)} onClick={() => handleBuildingClick(myStadium)}>
          <PlayerStadiumSVG stadium={{ ...myStadium, x: 350, y: 200, capacity: myStadium.capacity * 1.2 }} isHovered={hoveredId === myStadium.venueId} />
        </g>
      )}
      
      {/* Other player stadiums — bottom row */}
      {playerStadiums.map(s => (
        <g key={s.venueId} onMouseEnter={() => setHoveredId(s.venueId)} onMouseLeave={() => setHoveredId(null)} onClick={() => handleBuildingClick(s)}>
          <PlayerStadiumSVG stadium={s} isHovered={hoveredId === s.venueId} />
        </g>
      ))}
      
      {/* Other player avatars */}
      {players.map(p => (
        <PlayerAvatarSVG key={p.userId} player={p} localX={p.x} localY={p.y} />
      ))}
      
      {/* My avatar */}
      <AvatarSVG x={myAvatar.x} y={myAvatar.y} color={myColor} isMoving={myAvatar.isMoving} />
    </svg>
  );
}
```

---

## Phase 6: Match Live-State Integration

### Update `apps/api/src/modules/matches/match.routes.ts`

After a match is created or its status changes, broadcast to the world:

```typescript
// After match creation (POST /)
// io.to('world:global').emit('world:match:updated', { ... });

// After match simulation (POST /:id/simulate) 
// io.to('world:global').emit('world:match:updated', { ... });
```

Import `io` from `server.ts` or use an event emitter pattern:

```typescript
// apps/api/src/modules/matches/match.routes.ts
import { io } from '../../server';
import { broadcastMatchUpdate } from '../../websocket/world.handlers';

// In the simulate route, after the transaction completes:
broadcastMatchUpdate(io, match);
```

> **Note:** `io` needs to be exported from `server.ts` or a shared module. Currently it's instantiated locally. Create a shared emitter or export `io`.

### Update `apps/api/src/modules/matches/matches-list.routes.ts`

Add a `?status=IN_PROGRESS` filter that returns matches with home team venue data included (already done in the existing include — just ensure venue is included).

---

## Phase 7: Stadium Detail Panel (Clicking Other Player Stadiums)

### New File: `apps/web/src/components/world/StadiumSpectatePanel.tsx`
```typescript
// A lightweight panel that opens when clicking another player's stadium
// Shows: team name, stadium tier, capacity, prestige, condition
// If live match: shows score, elapsed time, "Spectate" button → subscribes to match:subscribe
// If upcoming: shows countdown, scheduled time
// If no match: shows "Challenge to Match" button
```

---

## Phase 8: Animation & Interpolation

### New File: `apps/web/src/lib/animate.ts`
```typescript
export function animateAvatar(
  fromX: number, fromY: number,
  toX: number, toY: number,
  durationMs: number,
  onFrame: (x: number, y: number, done: boolean) => void
): void {
  const start = performance.now();
  
  function tick(now: number) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    // ease-out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const x = fromX + (toX - fromX) * ease;
    const y = fromY + (toY - fromY) * ease;
    onFrame(x, y, progress >= 1);
    if (progress < 1) requestAnimationFrame(tick);
  }
  
  requestAnimationFrame(tick);
}
```

---

## Phase 9: Redis Presence (Scaling Beyond 1 Server)

### New File: `apps/api/src/config/presence.ts`
```typescript
import { redis } from './redis';

const PRESENCE_KEY = 'world:presence';
const PRESENCE_TTL = 90; // seconds

export async function setPresence(userId: string, data: object) {
  await redis.hSet(PRESENCE_KEY, userId, JSON.stringify(data));
  await redis.expire(PRESENCE_KEY, PRESENCE_TTL);
}

export async function getAllPresence(): Promise<Record<string, any>> {
  const all = await redis.hGetAll(PRESENCE_KEY);
  return Object.fromEntries(
    Object.entries(all).map(([k, v]) => [k, JSON.parse(v)])
  );
}

export async function removePresence(userId: string) {
  await redis.hDel(PRESENCE_KEY, userId);
}
```

Replace in-memory `presence` Map with Redis calls in `world.handlers.ts`.

---

## Phase 10: Polish & Performance

### Optimizations:
1. **Virtualize stadiums**: If > 50 stadiums, only render visible ones (though 50 SVG groups is fine for modern browsers).
2. **Avatar culling**: Only render avatars within viewport bounds (or all, since viewBox is fixed 1000x700).
3. **Debounce socket movement**: Don't emit every pixel; only emit start/end.
4. **SVG `will-change`**: Add `will-change: transform` to moving avatar groups.

### Tooltip system:
```typescript
// On hover over any building, show a floating HTML tooltip with name + quick stats
// This is already partially implemented in GameShell for buildings
// Extend to show stadium info on hover
```

---

## Summary of File Changes

### New Files
| Path | Purpose |
|------|---------|
| `apps/api/src/modules/world/world.routes.ts` | REST API for stadiums, matches, players |
| `apps/api/src/modules/world/world.service.ts` | DB queries for world data |
| `apps/api/src/websocket/world.handlers.ts` | Socket.IO presence + movement + match broadcasts |
| `apps/web/src/hooks/useWorldSocket.ts` | Frontend socket client + state |
| `apps/web/src/components/world/CommunityBuildingSVG.tsx` | SVG for public buildings |
| `apps/web/src/components/world/PlayerStadiumSVG.tsx` | SVG for dynamic player stadiums |
| `apps/web/src/components/world/PlayerAvatarSVG.tsx` | SVG for online player avatars |
| `apps/web/src/components/world/StadiumSpectatePanel.tsx` | Panel when clicking another player's stadium |
| `apps/web/src/lib/animate.ts` | Avatar movement interpolation |
| `apps/api/src/config/presence.ts` | Redis-backed presence store (Phase 9) |

### Modified Files
| Path | Changes |
|------|---------|
| `apps/api/src/server.ts` | Add `worldRouter`, call `initializeWorldSocketHandlers(io)` |
| `apps/api/src/websocket/socket.handlers.ts` | Import `broadcastMatchUpdate`, emit on match events |
| `apps/api/src/modules/matches/match.routes.ts` | Broadcast match updates after create/simulate |
| `apps/web/src/components/world/GameShell.tsx` | Full refactor to new layout + socket integration |
| `apps/web/src/App.tsx` | Wrap routes with `WorldSocketProvider` if needed (optional, hook is self-contained) |

### No Changes Needed (unchanged)
- `PanelSystem.tsx` — works as-is
- `TravelSystem.tsx` — still works, can overlay on top
- `MatchScheduleSystem.tsx` / `MatchDaySystem.tsx` — still provide match data, but GameShell now also uses socket live matches
- All existing page components (`CityPage`, `TeamPage`, etc.) — unchanged

---

## Implementation Order (Recommended)

1. **Backend scaffold** — create `world.routes.ts`, `world.service.ts`, `world.handlers.ts`, wire into `server.ts`
2. **Frontend hook** — `useWorldSocket.ts`, test connection with simple console logging
3. **Community building SVGs** — create `CommunityBuildingSVG.tsx`, verify they render in a test page
4. **Player stadium SVG** — create `PlayerStadiumSVG.tsx` with all live match states
5. **Refactor GameShell** — rewrite layout, integrate community buildings + stadiums + socket players
6. **Avatar movement** — add `animate.ts`, make local avatar move smoothly
7. **Match broadcasts** — wire `broadcastMatchUpdate` into match routes
8. **Stadium spectate panel** — create panel for clicking other players' stadiums
9. **Redis presence** — replace in-memory Map with Redis for production scaling
10. **Polish** — tooltips, hover states, performance passes

---

## Visual Design Reference

### Community Building Palette (lighter, "public")
| Building | Base Color | Accent | Notes |
|----------|------------|--------|-------|
| HQ | `#e2e8f0` (slate-200) | `#64748b` (slate-500) | Clean, corporate |
| Marketplace | `#fef3c7` (amber-100) | `#d97706` (amber-600) | Warm, inviting |
| Training | `#f3e8ff` (purple-100) | `#7c3aed` (purple-600) | Energetic |
| Leaderboard | `#ffedd5` (orange-100) | `#ea580c` (orange-600) | Trophy vibe |
| Bank | `#ecfccb` (lime-100) | `#65a30d` (lime-600) | Money green |
| Travel | `#cffafe` (cyan-100) | `#0891b2` (cyan-600) | Sky/transport |
| Locker | `#f1f5f9` (slate-100) | `#475569` (slate-600) | Neutral |

### Player Stadium Palette (darker, "owned")
| Tier | Accent | Size Multiplier |
|------|--------|-----------------|
| PARK_FIELD | `#94a3b8` | 1.0x |
| COMMUNITY | `#22c55e` | 1.1x |
| SMALL_STADIUM | `#3b82f6` | 1.2x |
| REGIONAL | `#8b5cf6` | 1.3x |
| PRO | `#E94560` | 1.4x |
| ELITE | `#fbbf24` | 1.5x |

### Live Match Indicator States
| State | Visual |
|-------|--------|
| No match | Dim spotlights, no crowd animation, small crowd dots |
| UPCOMING | Blue "UPCOMING" badge, no spotlights, small crowd |
| LIVE | Red "LIVE" badge with pulsing dot, animated crowd dots (opacity oscillation), scoreboard showing current score, spotlights with glow animation, revenue counter optional |

### Map Layout Coordinates
```
Community Row:    y = 40,  buildings spaced x = 60, 200, 340, 490, 630, 770, 890
My Stadium:       x = 350, y = 200, size = 1.5x normal
Other Stadiums:   y = 520 + row * 70, x = 60 + col * 180, max 4 per row
Roads:            Connect all community buildings in a horizontal arc
                  Connect my stadium to community arc
                  Connect stadium row to community arc via vertical roads
Avatar start:     HQ center (x=110, y=80)
```
