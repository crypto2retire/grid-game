import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchApi } from '../lib/api';

interface Team {
  id: string;
  name: string;
  tier: string;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  venue?: {
    id: string;
    name: string;
    tier: string;
    capacity: number;
    ticketPrice: number;
    condition: number;
    prestige: number;
  };
  transportationAssets?: {
    id: string;
    name: string;
    tier: string;
    operatingCost: number;
    fatigueReduction: number;
    prestige: number;
  }[];
  teamPlayers: {
    id: string;
    isStarter: boolean;
    player: {
      id: string;
      name: string;
      position: string;
      overall: number;
      pace: number;
      shooting: number;
      passing: number;
      dribbling: number;
      defending: number;
      physical: number;
      rarity: string;
    };
  }[];
}

interface Player {
  id: string;
  name: string;
  position: string;
  nationality: string;
  age: number;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  rarity: string;
  currentPrice: number;
  demandMultiplier: number;
  lastSoldPrice: number | null;
}

interface WalletData {
  cash: number;
  dynTokens: number;
}

interface GameState {
  // Teams
  teams: Team[];
  selectedTeamId: string | null;
  teamsLoading: boolean;
  teamsError: string | null;
  setTeams: (teams: Team[]) => void;
  setSelectedTeamId: (id: string | null) => void;
  setTeamsLoading: (loading: boolean) => void;
  setTeamsError: (error: string | null) => void;
  
  // Players (available in marketplace/pool)
  players: Player[];
  playersLoading: boolean;
  playersError: string | null;
  setPlayers: (players: Player[]) => void;
  setPlayersLoading: (loading: boolean) => void;
  setPlayersError: (error: string | null) => void;
  
  // Wallet
  wallet: WalletData;
  walletLoading: boolean;
  setWallet: (wallet: WalletData) => void;
  setWalletLoading: (loading: boolean) => void;
  
  // Active sport
  activeSportId: SportId;
  setActiveSportId: (sportId: SportId) => void;
  
  // Last sync timestamp
  lastSync: number;
  setLastSync: (timestamp: number) => void;
  
  // Actions
  refreshTeams: () => Promise<void>;
  refreshPlayers: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const SPORT_OPTIONS = [
  { id: 'american-football', label: 'American Football', shortLabel: 'Football', rosterName: 'Roster', matchupName: 'Game' },
  { id: 'soccer', label: 'Soccer', shortLabel: 'Soccer', rosterName: 'Squad', matchupName: 'Match' },
  { id: 'basketball', label: 'Basketball', shortLabel: 'Basketball', rosterName: 'Roster', matchupName: 'Game' },
  { id: 'baseball', label: 'Baseball', shortLabel: 'Baseball', rosterName: 'Roster', matchupName: 'Game' },
] as const;

export type SportId = typeof SPORT_OPTIONS[number]['id'];

export const getSportLabel = (sportId: string) => SPORT_OPTIONS.find((sport) => sport.id === sportId)?.label || 'American Football';

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Teams
      teams: [],
      selectedTeamId: null,
      teamsLoading: false,
      teamsError: null,
      setTeams: (teams) => set({ teams }),
      setSelectedTeamId: (selectedTeamId) => set({ selectedTeamId }),
      setTeamsLoading: (teamsLoading) => set({ teamsLoading }),
      setTeamsError: (teamsError) => set({ teamsError }),
      
      // Players
      players: [],
      playersLoading: false,
      playersError: null,
      setPlayers: (players) => set({ players }),
      setPlayersLoading: (playersLoading) => set({ playersLoading }),
      setPlayersError: (playersError) => set({ playersError }),
      
      // Wallet
      wallet: { cash: 0, dynTokens: 0 },
      walletLoading: false,
      setWallet: (wallet) => set({ wallet }),
      setWalletLoading: (walletLoading) => set({ walletLoading }),
      
      // Active sport
      activeSportId: 'american-football',
      setActiveSportId: (activeSportId) => {
        set({ activeSportId, selectedTeamId: null, teams: [], players: [], lastSync: 0 });
        setTimeout(() => {
          get().refreshTeams();
          get().refreshPlayers();
        }, 0);
      },
      
      // Last sync
      lastSync: 0,
      setLastSync: (lastSync) => set({ lastSync }),
      
      // Actions
      refreshTeams: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        set({ teamsLoading: true, teamsError: null });
        try {
          const data = await fetchApi('/teams/mine', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const teams = (data.data || []).filter((team: any) => (team.sportId || 'american-football') === get().activeSportId);
          set({ teams, teamsLoading: false, lastSync: Date.now() });
          // If no selected team, select first one
          const { selectedTeamId } = get();
          if (!selectedTeamId && teams.length > 0) {
            set({ selectedTeamId: teams[0].id });
          }
        } catch (err) {
          set({ teamsError: err instanceof Error ? err.message : 'Network error', teamsLoading: false });
        }
      },
      
      refreshPlayers: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        set({ playersLoading: true, playersError: null });
        try {
          const data = await fetchApi(`/players?limit=50&sportId=${get().activeSportId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          set({ players: data.data?.players || [], playersLoading: false, lastSync: Date.now() });
        } catch (err) {
          set({ playersError: err instanceof Error ? err.message : 'Network error', playersLoading: false });
        }
      },
      
      refreshWallet: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        set({ walletLoading: true });
        try {
          const data = await fetchApi('/economy/wallet', {
            headers: { Authorization: `Bearer ${token}` },
          });
          set({ wallet: data.data || { cash: 0, dynTokens: 0 }, walletLoading: false, lastSync: Date.now() });
        } catch (err) {
          set({ walletLoading: false });
        }
      },
      
      refreshAll: async () => {
        await Promise.all([
          get().refreshTeams(),
          get().refreshPlayers(),
          get().refreshWallet(),
        ]);
      },
    }),
    {
      name: 'grid-game-storage',
      partialize: (state) => ({
        teams: state.teams,
        selectedTeamId: state.selectedTeamId,
        players: state.players,
        wallet: state.wallet,
        activeSportId: state.activeSportId,
        lastSync: state.lastSync,
      }),
    }
  )
);
