import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { fetchApi } from '../../lib/api';
import { connectSocket, disconnectSocket, sendAvatarMove, socket } from '../../lib/socket';
import { useAuthStore } from '../../store/authStore';

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

function filterSelf(players: WorldPlayer[], userId?: string) {
  return userId ? players.filter((player) => player.userId !== userId) : players;
}

export function WorldProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuthStore();
  const [onlinePlayers, setOnlinePlayers] = useState<WorldPlayer[]>([]);
  const [myStadium, setMyStadium] = useState<MyStadium | null>(null);
  const [otherStadiums, setOtherStadiums] = useState<OtherStadium[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const animationRef = useRef<number | null>(null);

  const refreshWorld = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setOnlinePlayers([]);
      return;
    }

    setLoading(true);
    try {
      const [stadiumData, venuesData, matchesData, playersData] = await Promise.all([
        fetchApi('/api/world/my-stadium').catch(() => null),
        fetchApi('/api/world/stadiums').catch(() => null),
        fetchApi('/api/world/matches').catch(() => null),
        fetchApi('/api/world/players').catch(() => null),
      ]);

      if (stadiumData?.data !== undefined) setMyStadium(stadiumData.data || null);
      if (venuesData?.data !== undefined) setOtherStadiums(venuesData.data || []);
      if (matchesData?.data !== undefined) setLiveMatches(matchesData.data || []);
      if (playersData?.data !== undefined) setOnlinePlayers(filterSelf(playersData.data || [], user?.id));
    } catch (e) {
      console.error('Failed to refresh world:', e);
    } finally {
      setLoading(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    if (!token) return undefined;

    connectSocket(token);

    const handlePlayers = (players: WorldPlayer[]) => setOnlinePlayers(filterSelf(players, user?.id));
    const handleJoinOrMove = (player: WorldPlayer) => {
      if (player.userId === user?.id) return;
      setOnlinePlayers((prev) => {
        const without = prev.filter((p) => p.userId !== player.userId);
        return [...without, player];
      });
    };
    const handleLeft = ({ userId }: { userId: string }) => {
      setOnlinePlayers((prev) => prev.filter((player) => player.userId !== userId));
    };

    socket.on('world:players', handlePlayers);
    socket.on('world:avatar:joined', handleJoinOrMove);
    socket.on('world:avatar:move', handleJoinOrMove);
    socket.on('world:avatar:left', handleLeft);

    return () => {
      socket.off('world:players', handlePlayers);
      socket.off('world:avatar:joined', handleJoinOrMove);
      socket.off('world:avatar:move', handleJoinOrMove);
      socket.off('world:avatar:left', handleLeft);
      disconnectSocket();
    };
  }, [token, user?.id]);

  // Smoothly animate remote avatars toward their server-authoritative targets.
  useEffect(() => {
    const animate = () => {
      setOnlinePlayers((prev) =>
        prev.map((p) => {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) return { ...p, x: p.targetX, y: p.targetY, isMoving: false };
          const speed = 3;
          const x = p.x + (dx / dist) * speed;
          const y = p.y + (dy / dist) * speed;
          const facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          return { ...p, x, y, facing, isMoving: true };
        })
      );
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    refreshWorld();
    const poll = setInterval(refreshWorld, 15000);
    return () => clearInterval(poll);
  }, [refreshWorld]);

  const moveAvatar = useCallback((targetX: number, targetY: number) => {
    if (socket.connected) {
      sendAvatarMove(targetX, targetY);
      return;
    }

    fetchApi('/api/world/avatar', {
      method: 'POST',
      body: JSON.stringify({ x: targetX, y: targetY, targetX, targetY }),
    }).catch(() => undefined);
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
