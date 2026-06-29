import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export interface WorldPlayer {
  userId: string;
  username: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isMoving: boolean;
  facing: 'left' | 'right' | 'up' | 'down';
  avatarColor: string;
  teamId?: string;
  lastSeen: number;
}

export interface LiveMatch {
  matchId: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  venueId: string;
  venueName: string;
  status: 'SCHEDULED' | 'TRAVELING' | 'PREGAME' | 'PLAYING' | 'COMPLETED';
  phase: string;
  elapsedSeconds: number;
  totalRevenue: number;
  attendance: number;
  capacity: number;
  ticketPrice: number;
}

export interface OtherStadium {
  venueId: string;
  venueName: string;
  ownerId: string;
  ownerUsername: string;
  capacity: number;
  condition: number; // 0-100
  tier: 'shack' | 'basic' | 'standard' | 'premium' | 'elite' | 'legendary';
  upgrades: number;
  ticketPrice: number;
  liveMatch?: LiveMatch;
  x: number;
  y: number;
}

export interface MyStadium {
  venueId: string;
  venueName: string;
  capacity: number;
  condition: number;
  tier: string;
  upgrades: number;
  ticketPrice: number;
  liveMatch?: LiveMatch;
  nextMatch?: { opponentName: string; scheduledAt: string };
}

interface WorldContextValue {
  onlinePlayers: WorldPlayer[];
  myStadium: MyStadium | null;
  otherStadiums: OtherStadium[];
  liveMatches: LiveMatch[];
  loading: boolean;
  refreshWorld: () => Promise<void>;
  moveAvatar: (targetX: number, targetY: number) => void;
}

const WorldContext = createContext<WorldContextValue | null>(null);

export const useWorld = () => {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error('useWorld must be inside WorldProvider');
  return ctx;
};

export function WorldProvider({ children }: { children: React.ReactNode }) {
  const [onlinePlayers, setOnlinePlayers] = useState<WorldPlayer[]>([]);
  const [myStadium, setMyStadium] = useState<MyStadium | null>(null);
  const [otherStadiums, setOtherStadiums] = useState<OtherStadium[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const animationRef = useRef<number | null>(null);

  const refreshWorld = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const [stadiumRes, venuesRes, matchesRes] = await Promise.all([
        fetch('/api/world/my-stadium', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/world/stadiums', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/world/matches', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);

      if (stadiumRes?.ok) {
        const data = await stadiumRes.json();
        setMyStadium(data.data || null);
      }

      if (venuesRes?.ok) {
        const data = await venuesRes.json();
        const stadiums = (data.data || []).map((s: any, i: number) => ({
          ...s,
          x: 60 + (i % 4) * 230,
          y: 520 + Math.floor(i / 4) * 140,
        }));
        setOtherStadiums(stadiums);
      }

      if (matchesRes?.ok) {
        const data = await matchesRes.json();
        setLiveMatches(data.data || []);
      }

      // Simulate other players for now (until backend socket is ready)
      setOnlinePlayers((prev) => {
        if (prev.length > 0) return prev;
        return [
          { userId: 'player-1', username: 'GridKing', x: 200, y: 300, targetX: 200, targetY: 300, isMoving: false, facing: 'right', avatarColor: '#E94560', lastSeen: Date.now() },
          { userId: 'player-2', username: 'TouchdownTom', x: 500, y: 400, targetX: 500, targetY: 400, isMoving: false, facing: 'left', avatarColor: '#22c55e', lastSeen: Date.now() },
          { userId: 'player-3', username: 'StadiumBoss', x: 700, y: 200, targetX: 700, targetY: 200, isMoving: false, facing: 'down', avatarColor: '#3b82f6', lastSeen: Date.now() },
        ];
      });
    } catch (e) {
      console.error('Failed to refresh world:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Animate player avatars
  useEffect(() => {
    const animate = () => {
      setOnlinePlayers((prev) =>
        prev.map((p) => {
          if (!p.isMoving) return p;
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) {
            return { ...p, x: p.targetX, y: p.targetY, isMoving: false };
          }
          const speed = 2;
          const newX = p.x + (dx / dist) * speed;
          const newY = p.y + (dy / dist) * speed;
          const facing = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
          return {
            ...p,
            x: newX,
            y: newY,
            facing,
          };
        })
      );
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Periodic player movement simulation (random wandering)
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlinePlayers((prev) =>
        prev.map((p) => {
          if (p.isMoving || Math.random() > 0.3) return p;
          // Pick a random building position to wander to
          const targets = [
            { x: 140, y: 105 }, // HQ
            { x: 500, y: 120 }, // Stadium
            { x: 880, y: 105 }, // World
            { x: 150, y: 290 }, // Garage
            { x: 850, y: 290 }, // Training
            { x: 150, y: 470 }, // Market
            { x: 500, y: 470 }, // Team
            { x: 850, y: 470 }, // Bank
            { x: 500, y: 290 }, // Leaderboard
            { x: 310, y: 290 }, // Locker
          ];
          const target = targets[Math.floor(Math.random() * targets.length)];
          return { ...p, targetX: target.x + (Math.random() - 0.5) * 40, targetY: target.y + 20, isMoving: true };
        })
      );
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Initial load + poll every 15s
  useEffect(() => {
    refreshWorld();
    const poll = setInterval(refreshWorld, 15000);
    return () => clearInterval(poll);
  }, [refreshWorld]);

  const moveAvatar = useCallback((_targetX: number, _targetY: number) => {
    // This would be called when the current player moves
    // For now, just a placeholder for the socket emission
  }, []);

  const value: WorldContextValue = {
    onlinePlayers,
    myStadium,
    otherStadiums,
    liveMatches,
    loading,
    refreshWorld,
    moveAvatar,
  };

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}
