import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface ActiveMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  status: 'SCHEDULED' | 'PLAYING' | 'COMPLETED';
  venueId: string;
  ticketPrice: number;
  capacity: number;
  attendance: number;
  revenuePerTick: number;
  totalRevenue: number;
  elapsedSeconds: number;
  isHome: boolean;
}

interface MatchDayContextValue {
  activeMatches: ActiveMatch[];
  myHomeMatches: ActiveMatch[];
  totalLiveRevenue: number;
  scheduleMatch: (awayTeamId: string) => Promise<void>;
  refreshMatches: () => Promise<void>;
  loading: boolean;
}

const MatchDayContext = createContext<MatchDayContextValue | null>(null);

export function useMatchDay() {
  const ctx = useContext(MatchDayContext);
  if (!ctx) throw new Error('useMatchDay must be inside MatchDayProvider');
  return ctx;
}

// Simulate match progression and revenue generation
const MATCH_DURATION_SECONDS = 90; // 90 second match for real-time feel
const TICK_INTERVAL = 1000; // 1 second per tick

export function MatchDayProvider({ children }: { children: ReactNode }) {
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshMatches = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    setLoading(true);
    try {
      // Fetch matches where my team is home team and status is SCHEDULED or PLAYING
      const res = await fetch('/api/matches?status=PLAYING&limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      
      if (json.status === 'success') {
        const matchRows = Array.isArray(json.data) ? json.data : (json.data?.matches || []);
        const matches = matchRows.map((m: any) => ({
          id: m.id,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeTeamName: m.homeTeam?.name || 'Home',
          awayTeamName: m.awayTeam?.name || 'Away',
          status: m.status || 'PLAYING',
          venueId: m.homeTeam?.venue?.id || '',
          ticketPrice: m.homeTeam?.venue?.ticketPrice || 10,
          capacity: m.homeTeam?.venue?.capacity || 5000,
          attendance: Math.floor((m.homeTeam?.venue?.capacity || 5000) * 0.7),
          revenuePerTick: Math.floor((m.homeTeam?.venue?.ticketPrice || 10) * (m.homeTeam?.venue?.capacity || 5000) * 0.7 / MATCH_DURATION_SECONDS),
          totalRevenue: 0,
          elapsedSeconds: 0,
          isHome: true,
        }));
        
        setActiveMatches((prev) => {
          // Merge with existing, preserving revenue/elapsed
          const merged = matches.map((newMatch: ActiveMatch) => {
            const existing = prev.find((p) => p.id === newMatch.id);
            if (existing) {
              return { ...newMatch, totalRevenue: existing.totalRevenue, elapsedSeconds: existing.elapsedSeconds };
            }
            return newMatch;
          });
          return merged;
        });
      }
    } catch (e) {
      console.error('Failed to fetch matches', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Revenue tick effect
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMatches((prev) =>
        prev
          .filter((m) => m.status === 'PLAYING')
          .map((m) => {
            const newElapsed = m.elapsedSeconds + 1;
            const newRevenue = m.totalRevenue + m.revenuePerTick;
            const newStatus = newElapsed >= MATCH_DURATION_SECONDS ? 'COMPLETED' : m.status;
            return {
              ...m,
              elapsedSeconds: newElapsed,
              totalRevenue: newRevenue,
              status: newStatus as ActiveMatch['status'],
            };
          })
      );
    }, TICK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Initial fetch + poll every 10s
  useEffect(() => {
    refreshMatches();
    const poll = setInterval(refreshMatches, 10000);
    return () => clearInterval(poll);
  }, [refreshMatches]);

  const myHomeMatches = activeMatches.filter((m) => m.isHome);
  const totalLiveRevenue = activeMatches.reduce((sum, m) => sum + m.totalRevenue, 0);

  const scheduleMatch = useCallback(async (awayTeamId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const res = await fetch('/api/teams/mine', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      const teams = json.data || [];
      if (teams.length === 0) return;
      
      const homeTeamId = teams[0].id;
      
      const scheduleRes = await fetch('/api/matches', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeamId, awayTeamId }),
      });
      
      if (scheduleRes.ok) {
        await refreshMatches();
      }
    } catch (e) {
      console.error('Failed to schedule match', e);
    }
  }, [refreshMatches]);

  return (
    <MatchDayContext.Provider
      value={{ activeMatches, myHomeMatches, totalLiveRevenue, scheduleMatch, refreshMatches, loading }}
    >
      {children}
    </MatchDayContext.Provider>
  );
}
