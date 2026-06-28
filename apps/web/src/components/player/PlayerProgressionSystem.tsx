import { createContext, useContext, useState, useCallback } from 'react';

// ─── Types ───

export interface CareerStats {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  ties: number;
  rushingYards: number;
  passingYards: number;
  receivingYards: number;
  touchdowns: number;
  passingTouchdowns: number;
  tackles: number;
  sacks: number;
  interceptions: number;
  fieldGoals: number;
  fumbles: number;
  fumblesRecovered: number;
  seasonBest: number; // highest single-game rating
}

export interface PlayerProgression {
  playerId: string;
  playerName: string;
  position: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalXpEarned: number;
  careerStats: CareerStats;
  badges: string[]; // earned achievements like "1000 Yard Season", "First Win"
  isLocked: boolean; // if player hasn't been unlocked/created yet
}

export interface XPGainEvent {
  source: 'TRAINING' | 'MATCH' | 'MILESTONE' | 'ACHIEVEMENT';
  amount: number;
  description: string;
  timestamp: number;
}

interface PlayerProgressionContextValue {
  players: PlayerProgression[];
  xpHistory: XPGainEvent[];
  getPlayerProgression: (playerId: string) => PlayerProgression | undefined;
  addXP: (playerId: string, amount: number, source: XPGainEvent['source'], description: string) => void;
  getLevelForXP: (xp: number) => number;
  getXPForLevel: (level: number) => number;
  getXPNeededForNextLevel: (currentLevel: number) => number;
  getXPGainFromTraining: (packageName: string, statBoosts: Record<string, number>) => number;
  getXPGainFromMatch: (playerStats: any) => number;
  getBadgeForMilestone: (stat: keyof CareerStats, value: number) => string | null;
  getOverallBonus: (playerId: string) => number; // +1 OVR per 5 levels
}

// ─── Level Constants ───
// XP curve: exponential growth, level 99 = ~1M XP total
// Level N requires: baseXP * (multiplier ^ (N-1))
const BASE_XP = 100;
const XP_MULTIPLIER = 1.15;
const MAX_LEVEL = 99;

// Cache XP thresholds for performance
const XP_THRESHOLDS: number[] = [];
let cumulativeXP = 0;
for (let i = 1; i <= MAX_LEVEL; i++) {
  cumulativeXP += Math.floor(BASE_XP * Math.pow(XP_MULTIPLIER, i - 1));
  XP_THRESHOLDS[i] = cumulativeXP;
}
XP_THRESHOLDS[0] = 0;

// ─── Badge Constants ───

const MILESTONE_BADGES: Record<string, { thresholds: number[]; names: string[] }> = {
  gamesPlayed: {
    thresholds: [1, 10, 50, 100, 500],
    names: ['Debut', 'Veteran', 'Iron Man', 'Legendary', 'Hall of Fame'],
  },
  touchdowns: {
    thresholds: [1, 10, 50, 100, 500],
    names: ['First TD', 'Scorer', 'End Zone', 'TD Machine', 'Touchdown King'],
  },
  rushingYards: {
    thresholds: [100, 1000, 5000, 10000, 50000],
    names: ['Getting Started', '1K Club', '5K Club', '10K Club', 'Rush Legend'],
  },
  passingYards: {
    thresholds: [100, 1000, 5000, 10000, 50000],
    names: ['First Pass', '1K Club', '5K Club', '10K Club', 'Air Legend'],
  },
  tackles: {
    thresholds: [10, 50, 100, 500, 1000],
    names: ['First Stop', 'Tackler', 'Enforcer', 'Wall', 'Brick Wall'],
  },
  wins: {
    thresholds: [1, 10, 50, 100, 500],
    names: ['First Win', 'Winner', 'Champion', 'Dynasty', 'Untouchable'],
  },
};

// ─── Mock Data Generator ───

function generateMockProgression(playerId: string, playerName: string, position: string): PlayerProgression {
  return {
    playerId,
    playerName,
    position,
    level: 1 + Math.floor(Math.random() * 15),
    xp: 0,
    xpToNextLevel: 0,
    totalXpEarned: Math.floor(Math.random() * 5000),
    careerStats: {
      gamesPlayed: Math.floor(Math.random() * 20),
      gamesStarted: Math.floor(Math.random() * 15),
      wins: Math.floor(Math.random() * 10),
      losses: Math.floor(Math.random() * 8),
      ties: Math.floor(Math.random() * 2),
      rushingYards: Math.floor(Math.random() * 800),
      passingYards: Math.floor(Math.random() * 1500),
      receivingYards: Math.floor(Math.random() * 600),
      touchdowns: Math.floor(Math.random() * 8),
      passingTouchdowns: Math.floor(Math.random() * 6),
      tackles: Math.floor(Math.random() * 40),
      sacks: Math.floor(Math.random() * 5),
      interceptions: Math.floor(Math.random() * 3),
      fieldGoals: Math.floor(Math.random() * 4),
      fumbles: Math.floor(Math.random() * 3),
      fumblesRecovered: Math.floor(Math.random() * 2),
      seasonBest: 6 + Math.floor(Math.random() * 3),
    },
    badges: ['Debut'],
    isLocked: false,
  };
}

// ─── Context ───

const PlayerProgressionContext = createContext<PlayerProgressionContextValue | null>(null);

export const usePlayerProgression = () => {
  const ctx = useContext(PlayerProgressionContext);
  if (!ctx) throw new Error('usePlayerProgression must be inside PlayerProgressionProvider');
  return ctx;
};

export function PlayerProgressionProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<PlayerProgression[]>(
    [
      generateMockProgression('player-0', 'Marcus Johnson', 'RB'),
      generateMockProgression('player-1', 'Tyree Wilson', 'QB'),
      generateMockProgression('player-2', 'Darius Davis', 'WR'),
      generateMockProgression('player-3', 'Khalil Brown', 'LB'),
      generateMockProgression('player-4', 'Jalen Carter', 'DL'),
      generateMockProgression('player-5', 'Devin White', 'CB'),
      generateMockProgression('player-6', 'Jordan Smith', 'TE'),
      generateMockProgression('player-7', 'Cameron Payne', 'K'),
    ]
  );
  const [xpHistory, setXpHistory] = useState<XPGainEvent[]>([]);

  const getLevelForXP = useCallback((xp: number): number => {
    for (let i = MAX_LEVEL; i >= 0; i--) {
      if (xp >= XP_THRESHOLDS[i]) return i;
    }
    return 0;
  }, []);

  const getXPForLevel = useCallback((level: number): number => {
    return XP_THRESHOLDS[level] || 0;
  }, []);

  const getXPNeededForNextLevel = useCallback((currentLevel: number): number => {
    if (currentLevel >= MAX_LEVEL) return 0;
    return XP_THRESHOLDS[currentLevel + 1] - XP_THRESHOLDS[currentLevel];
  }, []);

  const getBadgeForMilestone = useCallback((stat: keyof CareerStats, value: number): string | null => {
    const milestone = MILESTONE_BADGES[stat];
    if (!milestone) return null;
    for (let i = milestone.thresholds.length - 1; i >= 0; i--) {
      if (value >= milestone.thresholds[i]) {
        return milestone.names[i];
      }
    }
    return null;
  }, []);

  const addXP = useCallback((playerId: string, amount: number, source: XPGainEvent['source'], description: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.playerId !== playerId) return p;
      
      const newTotalXp = p.totalXpEarned + amount;
      const newLevel = getLevelForXP(newTotalXp);
      const xpToNext = getXPNeededForNextLevel(newLevel);
      const currentLevelXp = newTotalXp - getXPForLevel(newLevel);
      
      // Check for new badges
      const newBadges = [...p.badges];
      const statEntries = Object.entries(p.careerStats) as [keyof CareerStats, number][];
      for (const [stat, value] of statEntries) {
        const badge = getBadgeForMilestone(stat, value);
        if (badge && !newBadges.includes(badge)) {
          newBadges.push(badge);
        }
      }
      
      return {
        ...p,
        level: newLevel,
        xp: currentLevelXp,
        xpToNextLevel: xpToNext,
        totalXpEarned: newTotalXp,
        badges: newBadges,
      };
    }));

    setXpHistory(prev => [{
      source,
      amount,
      description,
      timestamp: Date.now(),
    }, ...prev].slice(0, 100));
  }, [getLevelForXP, getXPForLevel, getXPNeededForNextLevel, getBadgeForMilestone]);

  const getXPGainFromTraining = useCallback((_packageName: string, statBoosts: Record<string, number>): number => {
    const baseXP = 50;
    const boostMultiplier = Object.values(statBoosts).reduce((sum, val) => sum + val, 0) * 5;
    return baseXP + boostMultiplier;
  }, []);

  const getXPGainFromMatch = useCallback((playerStats: any): number => {
    if (!playerStats) return 10;
    const rating = playerStats.rating || 5;
    const goals = playerStats.goals || 0;
    const assists = playerStats.assists || 0;
    const tackles = playerStats.tackles || 0;
    return Math.floor(10 + (rating * 5) + (goals * 20) + (assists * 10) + (tackles * 5));
  }, []);

  const getOverallBonus = useCallback((playerId: string): number => {
    const player = players.find(p => p.playerId === playerId);
    if (!player) return 0;
    return Math.floor(player.level / 5); // +1 OVR per 5 levels
  }, [players]);

  const getPlayerProgression = useCallback((playerId: string): PlayerProgression | undefined => {
    return players.find(p => p.playerId === playerId);
  }, [players]);

  const value: PlayerProgressionContextValue = {
    players,
    xpHistory,
    getPlayerProgression,
    addXP,
    getLevelForXP,
    getXPForLevel,
    getXPNeededForNextLevel,
    getXPGainFromTraining,
    getXPGainFromMatch,
    getBadgeForMilestone,
    getOverallBonus,
  };

  return (
    <PlayerProgressionContext.Provider value={value}>
      {children}
    </PlayerProgressionContext.Provider>
  );
}
