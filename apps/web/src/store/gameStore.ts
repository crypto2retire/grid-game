import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Team {
  id: string;
  name: string;
  wins: number;
  draws: number;
  losses: number;
  points: number;
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
  gridTokens: number;
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
  
  // Last sync timestamp
  lastSync: number;
  setLastSync: (timestamp: number) => void;
  
  // Actions
  refreshTeams: () => Promise<void>;
  refreshPlayers: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = API_ORIGIN.endsWith('/api') ? API_ORIGIN : `${API_ORIGIN}/api`;

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
      wallet: { cash: 0, gridTokens: 0 },
      walletLoading: false,
      setWallet: (wallet) => set({ wallet }),
      setWalletLoading: (walletLoading) => set({ walletLoading }),
      
      // Last sync
      lastSync: 0,
      setLastSync: (lastSync) => set({ lastSync }),
      
      // Actions
      refreshTeams: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        set({ teamsLoading: true, teamsError: null });
        try {
          const res = await fetch(`${API_BASE}/teams/mine`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const teams = data.data || [];
            set({ teams, teamsLoading: false, lastSync: Date.now() });
            // If no selected team, select first one
            const { selectedTeamId } = get();
            if (!selectedTeamId && teams.length > 0) {
              set({ selectedTeamId: teams[0].id });
            }
          } else {
            set({ teamsError: 'Failed to fetch teams', teamsLoading: false });
          }
        } catch (err) {
          set({ teamsError: 'Network error', teamsLoading: false });
        }
      },
      
      refreshPlayers: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        set({ playersLoading: true, playersError: null });
        try {
          const res = await fetch(`${API_BASE}/players?limit=50`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            set({ players: data.data?.players || [], playersLoading: false, lastSync: Date.now() });
          } else {
            set({ playersError: 'Failed to fetch players', playersLoading: false });
          }
        } catch (err) {
          set({ playersError: 'Network error', playersLoading: false });
        }
      },
      
      refreshWallet: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        set({ walletLoading: true });
        try {
          const res = await fetch(`${API_BASE}/economy/wallet`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            set({ wallet: data.data || { cash: 0, gridTokens: 0 }, walletLoading: false, lastSync: Date.now() });
          } else {
            set({ walletLoading: false });
          }
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
        lastSync: state.lastSync,
      }),
    }
  )
);
