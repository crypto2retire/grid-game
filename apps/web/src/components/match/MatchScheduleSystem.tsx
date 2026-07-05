import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { fetchApi } from '../../lib/api';
import { usePlayerProgression } from '../player/PlayerProgressionSystem';

export type MatchPhase = 'SCHEDULING' | 'SCHEDULED' | 'TRAVELING' | 'PREGAME' | 'PLAYING' | 'COMPLETED';
export type VehicleType = 'van' | 'bus' | 'coach' | 'team-bus' | 'jet';

export interface AIOpponent {
  id: string;
  name: string;
  ownerUsername: string;
  venueName: string;
  venueCapacity: number;
  venueTicketPrice: number;
  teamOverall: number;
  record: { wins: number; losses: number };
  homeCity: string;
  distanceKm: number;
  aiDifficulty: string;
}

export interface ScheduledMatch {
  id: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  venueId: string;
  venueName: string;
  scheduledAt: number;
  travelDepartureAt: number;
  phase: MatchPhase;
  isHome: boolean;
  ticketPrice: number;
  capacity: number;
  estimatedRevenue: number;
  venueOwnerShare: number;
  ticketSales: number;
  selectedVehicle: VehicleType;
  travelDurationMs: number;
  progress: number;
  homeScore: number;
  awayScore: number;
  result: 'WIN' | 'LOSS' | 'TIE' | null;
  crowdAttendance: number;
  revenueGenerated: number;
  backendMatchId?: string;
  events?: any[];
  playerStats?: any[];
  homeEconomics?: any;
  awayEconomics?: any;
  formationId?: string;
  formationName?: string;
}

interface MatchScheduleContextValue {
  scheduledMatches: ScheduledMatch[];
  availableOpponents: AIOpponent[];
  loading: boolean;
  scheduleMatch: (opponent: AIOpponent, isHome: boolean, vehicle: VehicleType, userTeamId: string, formationId?: string, formationName?: string) => Promise<ScheduledMatch | null>;
  cancelMatch: (matchId: string) => void;
  refreshOpponents: (teamId: string) => Promise<void>;
  refreshMatches: () => Promise<void>;
  simulateMatch: (matchId: string) => Promise<any>;
  getUpcomingMatches: () => ScheduledMatch[];
  getMatchHistory: () => ScheduledMatch[];
  getActiveMatch: () => ScheduledMatch | null;
}

const MatchScheduleContext = createContext<MatchScheduleContextValue | null>(null);

export const useMatchSchedule = () => {
  const ctx = useContext(MatchScheduleContext);
  if (!ctx) throw new Error('useMatchSchedule must be inside MatchScheduleProvider');
  return ctx;
};

function determineResult(isHome: boolean, homeScore: number, awayScore: number): 'WIN' | 'LOSS' | 'TIE' {
  if (homeScore === awayScore) return 'TIE';
  const myScore = isHome ? homeScore : awayScore;
  const oppScore = isHome ? awayScore : homeScore;
  return myScore > oppScore ? 'WIN' : 'LOSS';
}

const VEHICLE_SPEEDS: Record<VehicleType, number> = {
  van: 80,
  bus: 85,
  coach: 95,
  'team-bus': 110,
  jet: 800,
};

function calculateTravelTime(distanceKm: number, vehicle: VehicleType): number {
  const speed = VEHICLE_SPEEDS[vehicle];
  const hours = distanceKm / speed;
  return Math.max(5000, Math.round(hours * 60 * 60 * 1000));
}

export function MatchScheduleProvider({ children }: { children: React.ReactNode }) {
  const { addXP, getXPGainFromMatch } = usePlayerProgression();
  const [scheduledMatches, setScheduledMatches] = useState<ScheduledMatch[]>([]);
  const [availableOpponents, setAvailableOpponents] = useState<AIOpponent[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshOpponents = useCallback(async (teamId: string) => {
    setLoading(true);
    try {
      const res = await fetchApi(`/ai-teams/matchmaking/${teamId}`);
      // Map backend AI teams to frontend AIOpponent format
      const opponents: AIOpponent[] = (res.data?.opponents || res.data || []).map((team: any) => ({
        id: team.id,
        name: team.name,
        ownerUsername: team.owner?.username || 'AI',
        venueName: team.venue?.name || `${team.name} Stadium`,
        venueCapacity: team.venue?.capacity || 5000,
        venueTicketPrice: team.venue?.ticketPrice || 15,
        teamOverall: team.teamOverall || 70,
        record: { wins: team.wins || 0, losses: team.losses || 0 },
        homeCity: team.venue?.name?.split(' ')[0] || 'Unknown',
        distanceKm: 50 + Math.floor(Math.random() * 2000),
        aiDifficulty: team.aiDifficulty || 'rookie',
      }));
      setAvailableOpponents(opponents);
    } catch (e) {
      console.error('Failed to load opponents:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMatches = useCallback(async () => {
    try {
      const res = await fetchApi('/matches?status=SCHEDULED');
      const scheduled = res.data?.matches || [];
      
      const completedRes = await fetchApi('/matches?status=COMPLETED');
      const completed = completedRes.data?.matches || [];
      
      const allMatches: ScheduledMatch[] = [
        ...scheduled.map((m: any) => mapBackendMatch(m, 'SCHEDULED')),
        ...completed.map((m: any) => mapBackendMatch(m, 'COMPLETED')),
      ];
      
      setScheduledMatches(allMatches);
    } catch (e) {
      console.error('Failed to load matches:', e);
    }
  }, []);

  const mapBackendMatch = (m: any, phase: MatchPhase): ScheduledMatch => ({
    id: m.id,
    homeTeamId: m.homeTeamId,
    homeTeamName: m.homeTeam?.name || 'Home',
    awayTeamId: m.awayTeamId,
    awayTeamName: m.awayTeam?.name || 'Away',
    venueId: m.homeTeamId,
    venueName: m.homeTeam?.name + ' Stadium' || 'Stadium',
    scheduledAt: new Date(m.scheduledAt).getTime(),
    travelDepartureAt: Date.now(),
    phase,
    isHome: true, // Will be determined by user context
    ticketPrice: 15,
    capacity: 5000,
    estimatedRevenue: 0,
    venueOwnerShare: 0,
    ticketSales: 0,
    selectedVehicle: 'bus',
    travelDurationMs: 10000,
    progress: phase === 'COMPLETED' ? 100 : 0,
    homeScore: m.homeScore || 0,
    awayScore: m.awayScore || 0,
    result: m.homeScore > m.awayScore ? 'WIN' : m.homeScore < m.awayScore ? 'LOSS' : 'TIE',
    crowdAttendance: 0,
    revenueGenerated: 0,
    backendMatchId: m.id,
  });

  const scheduleMatch = useCallback(async (
    opponent: AIOpponent,
    isHome: boolean,
    vehicle: VehicleType,
    userTeamId: string,
    formationId?: string,
    formationName?: string
  ): Promise<ScheduledMatch | null> => {
    const travelDuration = calculateTravelTime(opponent.distanceKm, vehicle);

    try {
      // Schedule against AI opponent via backend
      const res = await fetchApi('/ai-teams/schedule/ai', {
        method: 'POST',
        body: JSON.stringify({
          userTeamId,
          aiTeamId: opponent.id,
          formation: formationId,
        }),
      });

      const match = res.data?.match;
      if (!match) return null;

      const newMatch: ScheduledMatch = {
        id: match.id,
        homeTeamId: match.homeTeamId,
        homeTeamName: match.homeTeam?.name || 'Home',
        awayTeamId: match.awayTeamId,
        awayTeamName: match.awayTeam?.name || 'Away',
        venueId: opponent.id,
        venueName: isHome ? 'My Stadium' : opponent.venueName,
        scheduledAt: new Date(match.scheduledAt).getTime(),
        travelDepartureAt: Date.now(),
        phase: 'SCHEDULED',
        isHome,
        ticketPrice: isHome ? 15 : opponent.venueTicketPrice,
        capacity: isHome ? 5000 : opponent.venueCapacity,
        estimatedRevenue: Math.floor((isHome ? 5000 : opponent.venueCapacity) * (isHome ? 15 : opponent.venueTicketPrice) * 0.75),
        venueOwnerShare: isHome ? 0 : Math.floor((opponent.venueCapacity * opponent.venueTicketPrice * 0.75) * 0.10),
        ticketSales: 0,
        selectedVehicle: vehicle,
        travelDurationMs: travelDuration,
        progress: 0,
        homeScore: 0,
        awayScore: 0,
        result: null,
        crowdAttendance: 0,
        revenueGenerated: 0,
        backendMatchId: match.id,
        formationId,
        formationName,
      };

      setScheduledMatches(prev => [newMatch, ...prev]);

      // Start travel simulation countdown
      startMatchLifecycle(newMatch);

      return newMatch;
    } catch (err: any) {
      console.error('Failed to schedule match:', err);
      return null;
    }
  }, []);

  const simulateMatch = useCallback(async (matchId: string): Promise<any> => {
    try {
      const res = await fetchApi(`/matches/${matchId}/simulate`, { method: 'POST' });
      return res.data;
    } catch (err: any) {
      console.error('Failed to simulate match:', err);
      throw err;
    }
  }, []);

  const startMatchLifecycle = useCallback((match: ScheduledMatch) => {
    const startTime = Date.now();
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      setScheduledMatches(currentMatches => {
        const matchIndex = currentMatches.findIndex(m => m.id === match.id);
        if (matchIndex === -1) return currentMatches;
        
        const currentMatch = currentMatches[matchIndex];
        const elapsed = Date.now() - startTime;
        
        let phase: MatchPhase = currentMatch.phase;
        let progress = 0;
        
        if (elapsed < currentMatch.travelDurationMs) {
          phase = 'TRAVELING';
          progress = (elapsed / currentMatch.travelDurationMs) * 100;
        } else if (elapsed < currentMatch.travelDurationMs + 3000) {
          phase = 'PREGAME';
          progress = ((elapsed - currentMatch.travelDurationMs) / 3000) * 100;
        } else if (elapsed < currentMatch.travelDurationMs + 3000 + 15000) {
          phase = 'PLAYING';
          const playElapsed = elapsed - currentMatch.travelDurationMs - 3000;
          progress = (playElapsed / 15000) * 100;
        } else {
          phase = 'COMPLETED';
          progress = 100;
          
          // Auto-simulate when reaching COMPLETED
          if (currentMatch.phase !== 'COMPLETED' && currentMatch.backendMatchId) {
            simulateMatch(currentMatch.backendMatchId).then((result) => {
              const playerStats = result?.result?.playerStats || {};
              // Award XP to players based on their match performance
              Object.entries(playerStats).forEach(([playerId, stats]: [string, any]) => {
                const xpGain = getXPGainFromMatch(stats);
                addXP(playerId, xpGain, 'MATCH', `Match vs ${currentMatch.awayTeamName}`);
              });
              
              setScheduledMatches(prev => prev.map(m => 
                m.id === match.id 
                  ? { ...m, 
                      phase: 'COMPLETED', 
                      progress: 100, 
                      homeScore: result?.result?.homeScore || m.homeScore,
                      awayScore: result?.result?.awayScore || m.awayScore,
                      result: determineResult(m.isHome, result?.result?.homeScore || 0, result?.result?.awayScore || 0),
                      events: result?.result?.events || [],
                      playerStats: result?.result?.playerStats,
                      homeEconomics: result?.result?.homeEconomics,
                      awayEconomics: result?.result?.awayEconomics,
                    }
                  : m
              ));
            }).catch(() => {
              // Fallback to random result if simulation fails
              const homeScore = Math.floor(Math.random() * 35);
              const awayScore = Math.floor(Math.random() * 35);
              setScheduledMatches(prev => prev.map(m => 
                m.id === match.id 
                  ? { ...m, phase: 'COMPLETED', progress: 100, homeScore, awayScore, result: determineResult(m.isHome, homeScore, awayScore) }
                  : m
              ));
            });
          }
        }
        
        return currentMatches.map(m => 
          m.id === match.id 
            ? { ...m, phase, progress }
            : m
        );
      });
    }, 1000);
  }, [simulateMatch]);

  const cancelMatch = useCallback((matchId: string) => {
    setScheduledMatches(prev => prev.filter(m => m.id !== matchId));
  }, []);

  const getUpcomingMatches = useCallback(() => {
    return scheduledMatches.filter(m => m.phase !== 'COMPLETED');
  }, [scheduledMatches]);

  const getMatchHistory = useCallback(() => {
    return scheduledMatches.filter(m => m.phase === 'COMPLETED');
  }, [scheduledMatches]);

  const getActiveMatch = useCallback(() => {
    return scheduledMatches.find(m => m.phase === 'TRAVELING' || m.phase === 'PREGAME' || m.phase === 'PLAYING') || null;
  }, [scheduledMatches]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const value: MatchScheduleContextValue = {
    scheduledMatches,
    availableOpponents,
    loading,
    scheduleMatch,
    cancelMatch,
    refreshOpponents,
    refreshMatches,
    simulateMatch,
    getUpcomingMatches,
    getMatchHistory,
    getActiveMatch,
  };

  return (
    <MatchScheduleContext.Provider value={value}>
      {children}
    </MatchScheduleContext.Provider>
  );
}
