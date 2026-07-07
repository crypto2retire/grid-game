import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamPage from './TeamPage';
import { useGameStore } from '../store/gameStore';

vi.mock('../components/player/PlayerCard', () => ({
  default: ({ player }: { player: { name: string; position: string; overall: number } }) => (
    <div data-testid="player-card">
      <span>{player.name}</span>
      <span>{player.position}</span>
      <span>{player.overall}</span>
    </div>
  ),
}));

vi.mock('../hooks/useGameTime', () => ({
  useLeagueTierConfig: () => ({ config: {} }),
}));

vi.mock('../components/training/TrainingSystem', () => ({
  useTraining: () => ({
    packages: [],
    activeTraining: null,
    isTraining: false,
    startTraining: vi.fn(),
    cancelTraining: vi.fn(),
    claimReward: vi.fn(),
    playerFatigue: [{ playerId: 'player-injured', playerName: 'Casey Bruised', position: 'LB', fatigue: 18 }],
    canTrain: () => ({ ok: true }),
    completedSessions: [],
    loading: false,
    refreshHistory: vi.fn(),
  }),
}));

const injuredTeam = {
  id: 'team-medical',
  name: 'Medical QA Club',
  sportId: 'american-football',
  tier: 'STATE_COLLEGE',
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  teamPlayers: [
    {
      id: 'team-player-injured',
      isStarter: true,
      player: {
        id: 'player-injured',
        name: 'Casey Bruised',
        position: 'LB',
        overall: 62,
        age: 23,
        nationality: 'USA',
        pace: 61,
        shooting: 45,
        passing: 55,
        dribbling: 58,
        defending: 70,
        physical: 69,
        rarity: 'COMMON',
        health: 42,
        fatigue: 18,
        injuryStatus: 'WEEK_TO_WEEK',
        injuryType: 'Ankle sprain',
        injuryWeeks: 2,
        playerItems: [],
      },
    },
  ],
};

const okJsonResponse = (data: unknown) => ({ ok: true, json: async () => data });

describe('TeamPage Medical Center', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    useGameStore.setState({
      teams: [injuredTeam as any],
      selectedTeamId: injuredTeam.id,
      teamsLoading: false,
      wallet: { cash: 10_000, dynTokens: 0 },
      activeSportId: 'american-football',
    });
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/players/treat')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ playerId: 'player-injured' });
        return Promise.resolve(okJsonResponse({
          data: {
            cost: 200,
            message: 'Casey Bruised treated for 200 CASH and is now healthy.',
            player: { ...injuredTeam.teamPlayers[0].player, injuryStatus: 'HEALTHY', injuryWeeks: 0 },
          },
        }));
      }
      if (String(url).includes('/api/teams/team-medical/promotion-eligibility')) {
        return Promise.resolve(okJsonResponse({ data: null }));
      }
      return Promise.resolve(okJsonResponse({ data: [] }));
    }));
  });

  it('shows and treats an actually injured player', async () => {
    render(<TeamPage initialTab="medical" />);

    expect(screen.getByRole('heading', { name: /medical center/i })).toBeInTheDocument();
    expect(screen.getByText('1 injured')).toBeInTheDocument();
    expect(screen.getByText('Casey Bruised')).toBeInTheDocument();
    expect(screen.getByText(/Week-to-week: Ankle sprain \(2w\)/i)).toBeInTheDocument();
    expect(screen.getByText('200 CASH')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Treat' }));

    await waitFor(() => {
      expect(screen.getByText(/Casey Bruised treated for 200 CASH and is now healthy\./i)).toBeInTheDocument();
    });
  });
});
