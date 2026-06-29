import { useState, createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { fetchApi } from '../../lib/api';
import { usePlayerProgression } from '../player/PlayerProgressionSystem';
import { useGameStore } from '../../store/gameStore';

// ─── Types ───

export interface TrainingPackage {
  id: string;
  name: string;
  description: string;
  focusType: string;
  targetPosition: string | null;
  durationDays: number;
  costGrid: number;
  costCash: number;
  statBoosts: Record<string, number>;
  maxUsesPerPlayer: number;
}

export interface PlayerTraining {
  id: string;
  playerId: string;
  teamId: string;
  trainingPackageId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  completedAt: string | null;
  statImprovements: Record<string, number>;
  costGrid: number;
  costCash: number;
  player?: { id: string; name: string; position: string; overall: number };
  trainingPackage?: { id: string; name: string; focusType: string };
}

export interface PlayerFatigue {
  playerId: string;
  playerName: string;
  fatigue: number;
  lastTrainedAt: string | null;
  trainingStreak: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: 'helmet' | 'pads' | 'gloves' | 'shoes' | 'accessory';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  statBoosts: Record<string, number>;
  durability: number;
  icon: string;
  acquiredAt: string;
}

export interface EquippedSlot {
  playerId: string;
  slot: string;
  item: EquipmentItem;
}

export interface ActiveTrainingSession {
  id: string;
  teamId: string;
  teamName: string;
  packageName: string;
  focusType: string;
  targetPlayerId?: string;
  targetPlayerName?: string;
  startedAt: number;
  durationSeconds: number;
  costGrid: number;
  costCash: number;
  statBoosts: Record<string, number>;
  progress: number;
  status: 'running' | 'completed' | 'cancelled';
  backendResults?: any;
}

interface TrainingContextValue {
  packages: TrainingPackage[];
  activeTraining: ActiveTrainingSession | null;
  completedSessions: PlayerTraining[];
  playerFatigue: PlayerFatigue[];
  equipment: EquipmentItem[];
  equippedSlots: EquippedSlot[];
  loading: boolean;
  startTraining: (params: {
    teamId: string;
    teamName: string;
    packageId: string;
    packageName: string;
    focusType: string;
    targetPlayerId?: string;
    targetPlayerName?: string;
    durationSeconds: number;
    costGrid: number;
    costCash: number;
    statBoosts: Record<string, number>;
  }) => Promise<boolean>;
  cancelTraining: () => void;
  claimReward: () => void;
  equipItem: (playerId: string, itemId: string) => void;
  unequipItem: (playerId: string, slot: string) => void;
  isTraining: boolean;
  canTrain: (playerId?: string) => { ok: boolean; reason?: string };
  refreshPackages: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshPlayers: (teamId: string) => Promise<void>;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export const useTraining = () => {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error('useTraining must be inside TrainingProvider');
  return ctx;
};

const MAX_FATIGUE = 100;
const FATIGUE_PER_TRAINING = 15;
const FATIGUE_RECOVERY_RATE = 1; // per minute
const TRAINING_DURATION_SECONDS = 30; // Client-side countdown for game feel

const EQUIPMENT_NAMES: Record<string, string[]> = {
  helmet: ['Pro Cap', 'Elite Visor', 'Titan Helmet', 'Velocity Cap', 'Guardian Dome'],
  pads: ['Flex Pads', 'Impact Guards', 'Titan Shell', 'Lightweight Vest', 'Heavy Hitter'],
  gloves: ['Grip Master', 'Sticky Fingers', 'Elite Catcher', 'Pro Receiver', 'Battle Mitts'],
  shoes: ['Speed Cleats', 'Turf Terrors', 'Elite Runners', 'Quick Steps', 'Endurance Pro'],
  accessory: ['Performance Band', 'Focus Lens', 'Power Bracelet', 'Lucky Charm', 'Veteran Patch'],
};

function generateMockEquipment(count: number = 12): EquipmentItem[] {
  const slots: EquipmentItem['slot'][] = ['helmet', 'pads', 'gloves', 'shoes', 'accessory'];
  const rarities: EquipmentItem['rarity'][] = ['common', 'common', 'common', 'rare', 'rare', 'epic', 'legendary'];
  const stats = ['speed', 'strength', 'agility', 'endurance', 'skill', 'awareness'];

  return Array.from({ length: count }).map((_, i) => {
    const slot = slots[i % slots.length];
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    const name = EQUIPMENT_NAMES[slot][Math.floor(Math.random() * EQUIPMENT_NAMES[slot].length)];
    const statBoosts: Record<string, number> = {};
    const numBoosts = rarity === 'common' ? 1 : rarity === 'rare' ? 2 : rarity === 'epic' ? 2 : 3;
    const shuffled = [...stats].sort(() => Math.random() - 0.5);
    for (let j = 0; j < numBoosts; j++) {
      const boost = rarity === 'common' ? 1 + Math.floor(Math.random() * 3) :
                    rarity === 'rare' ? 2 + Math.floor(Math.random() * 4) :
                    rarity === 'epic' ? 3 + Math.floor(Math.random() * 5) :
                    5 + Math.floor(Math.random() * 6);
      statBoosts[shuffled[j]] = boost;
    }
    return {
      id: `eq-${i}-${Date.now()}`,
      name: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${name}`,
      slot,
      rarity,
      statBoosts,
      durability: 50 + Math.floor(Math.random() * 50),
      icon: slot,
      acquiredAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
}

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const { addXP, getXPGainFromTraining } = usePlayerProgression();
  const { teams, selectedTeamId, refreshTeams } = useGameStore();
  
  const [packages, setPackages] = useState<TrainingPackage[]>([]);
  const [activeTraining, setActiveTraining] = useState<ActiveTrainingSession | null>(null);
  const [completedSessions, setCompletedSessions] = useState<PlayerTraining[]>([]);
  const [playerFatigue, setPlayerFatigue] = useState<PlayerFatigue[]>([]);
  const [equipment] = useState<EquipmentItem[]>(generateMockEquipment(12));
  const [equippedSlots, setEquippedSlots] = useState<EquippedSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoadedRef = useRef(false);

  // ─── Sync playerFatigue with gameStore teams ───
  // This ensures Training and Locker Room always show the same players as Team Page
  useEffect(() => {
    if (!selectedTeamId) {
      setPlayerFatigue([]);
      return;
    }
    const team = teams.find((t) => t.id === selectedTeamId);
    if (team?.teamPlayers?.length) {
      setPlayerFatigue(
        team.teamPlayers.map((tp: any) => ({
          playerId: tp.player.id,
          playerName: tp.player.name,
          position: tp.player.position,
          fatigue: tp.player.fatigue ?? 0,
          lastTrainedAt: null,
          trainingStreak: 0,
        }))
      );
    } else if (teams.length > 0) {
      // Team exists but has no players yet
      setPlayerFatigue([]);
    }
  }, [selectedTeamId, teams]);

  // ─── Auto-refresh teams on mount if empty ───
  useEffect(() => {
    if (!hasLoadedRef.current && teams.length === 0) {
      hasLoadedRef.current = true;
      refreshTeams();
    }
  }, [teams.length, refreshTeams]);

  // Load training packages on mount
  const refreshPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/training/packages');
      setPackages(res.data || []);
    } catch (e) {
      console.error('Failed to load training packages:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load training history
  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetchApi('/training/history');
      setCompletedSessions(res.data || []);
    } catch (e) {
      console.error('Failed to load training history:', e);
    }
  }, []);

  useEffect(() => {
    refreshPackages();
    refreshHistory();
  }, [refreshPackages, refreshHistory]);

  const startTraining = useCallback(async (params: {
    teamId: string;
    teamName: string;
    packageId: string;
    packageName: string;
    focusType: string;
    targetPlayerId?: string;
    targetPlayerName?: string;
    durationSeconds: number;
    costGrid: number;
    costCash: number;
    statBoosts: Record<string, number>;
  }): Promise<boolean> => {
    if (activeTraining?.status === 'running') return false;

    try {
      // Call backend immediately - stats are applied server-side
      const backendRes = await fetchApi('/training/start', {
        method: 'POST',
        body: JSON.stringify({
          teamId: params.teamId,
          packageId: params.packageId,
          playerId: params.targetPlayerId,
        }),
      });

      // Start client-side countdown for game feel
      const newTraining: ActiveTrainingSession = {
        id: `train-${Date.now()}`,
        teamId: params.teamId,
        teamName: params.teamName,
        packageName: params.packageName,
        focusType: params.focusType,
        targetPlayerId: params.targetPlayerId,
        targetPlayerName: params.targetPlayerName,
        startedAt: Date.now(),
        durationSeconds: TRAINING_DURATION_SECONDS,
        costGrid: params.costGrid,
        costCash: params.costCash,
        statBoosts: params.statBoosts,
        progress: 0,
        status: 'running',
        backendResults: backendRes.data,
      };

      setActiveTraining(newTraining);

      // Update fatigue locally
      setPlayerFatigue(prev => prev.map(p => {
        if (params.focusType === 'INDIVIDUAL' && p.playerId === params.targetPlayerId) {
          return { ...p, fatigue: Math.min(MAX_FATIGUE, p.fatigue + FATIGUE_PER_TRAINING), lastTrainedAt: new Date().toISOString(), trainingStreak: p.trainingStreak + 1 };
        }
        if (params.focusType !== 'INDIVIDUAL') {
          return { ...p, fatigue: Math.min(MAX_FATIGUE, p.fatigue + FATIGUE_PER_TRAINING * 0.6), lastTrainedAt: new Date().toISOString(), trainingStreak: p.trainingStreak + 1 };
        }
        return p;
      }));

      // Start countdown timer
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setActiveTraining(current => {
          if (!current || current.status !== 'running') return current;
          const elapsed = (Date.now() - current.startedAt) / 1000;
          const progress = Math.min(100, (elapsed / current.durationSeconds) * 100);
          
          if (progress >= 100) {
            return { ...current, progress: 100, status: 'completed' };
          }
          
          return { ...current, progress };
        });
      }, 1000);

      return true;
    } catch (err: any) {
      console.error('Training failed:', err);
      return false;
    }
  }, [activeTraining]);

  const cancelTraining = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActiveTraining(prev => prev ? { ...prev, status: 'cancelled' } : null);
    setTimeout(() => setActiveTraining(null), 2000);
  }, []);

  const claimReward = useCallback(() => {
    // Award XP to trained player(s)
    if (activeTraining) {
      const xpAmount = getXPGainFromTraining(activeTraining.packageName, activeTraining.statBoosts);
      if (activeTraining.focusType === 'INDIVIDUAL' && activeTraining.targetPlayerId) {
        addXP(activeTraining.targetPlayerId, xpAmount, 'TRAINING', `Completed ${activeTraining.packageName}`);
      } else {
        // Team training — award XP to all players
        playerFatigue.forEach(p => {
          addXP(p.playerId, Math.floor(xpAmount * 0.6), 'TRAINING', `Team ${activeTraining.packageName}`);
        });
      }
    }
    setActiveTraining(null);
    refreshHistory(); // Refresh history to show completed training
  }, [activeTraining, getXPGainFromTraining, addXP, playerFatigue, refreshHistory]);

  const canTrain = useCallback((playerId?: string): { ok: boolean; reason?: string } => {
    if (activeTraining?.status === 'running') return { ok: false, reason: 'Training already in progress' };
    
    if (playerId) {
      const player = playerFatigue.find(p => p.playerId === playerId);
      if (player && player.fatigue >= 90) return { ok: false, reason: 'Player is too fatigued' };
    } else {
      const avgFatigue = playerFatigue.length > 0 
        ? playerFatigue.reduce((sum, p) => sum + p.fatigue, 0) / playerFatigue.length 
        : 0;
      if (avgFatigue >= 85) return { ok: false, reason: 'Team is too fatigued' };
    }
    
    return { ok: true };
  }, [activeTraining, playerFatigue]);

  // Fatigue recovery over time (every minute)
  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      setPlayerFatigue(prev => prev.map(p => ({
        ...p,
        fatigue: Math.max(0, p.fatigue - FATIGUE_RECOVERY_RATE),
      })));
    }, 60000);
    return () => clearInterval(recoveryInterval);
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const equipItem = useCallback((playerId: string, itemId: string) => {
    const item = equipment.find(e => e.id === itemId);
    if (!item) return;
    setEquippedSlots(prev => {
      const filtered = prev.filter(s => !(s.playerId === playerId && s.slot === item.slot));
      return [...filtered, { playerId, slot: item.slot, item }];
    });
  }, [equipment]);

  const unequipItem = useCallback((playerId: string, slot: string) => {
    setEquippedSlots(prev => prev.filter(s => !(s.playerId === playerId && s.slot === slot)));
  }, []);

  // refreshPlayers is kept for backward compat; it refreshes the game store teams
  const refreshPlayers = useCallback(async (teamId: string) => {
    if (!teamId) return;
    await refreshTeams();
  }, [refreshTeams]);

  const value: TrainingContextValue = {
    packages,
    activeTraining,
    completedSessions,
    playerFatigue,
    equipment,
    equippedSlots,
    loading,
    startTraining,
    cancelTraining,
    claimReward,
    equipItem,
    unequipItem,
    isTraining: activeTraining?.status === 'running',
    canTrain,
    refreshPackages,
    refreshHistory,
    refreshPlayers,
  };

  return (
    <TrainingContext.Provider value={value}>
      {children}
    </TrainingContext.Provider>
  );
}
