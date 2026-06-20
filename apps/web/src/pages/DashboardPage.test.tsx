import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      email: 'coach@example.com',
      username: 'coach',
      displayName: 'Test Coach',
      role: 'USER',
    },
  }),
}));

const mockJsonResponse = (data: unknown) => ({
  ok: true,
  json: async () => data,
});

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: [
              {
                id: 'team-1',
                name: 'Grid Iron',
                wins: 2,
                draws: 1,
                losses: 0,
                points: 7,
                teamPlayers: [{ player: { id: 'p1', name: 'Alex', position: 'WR', overall: 72 } }],
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            data: {
              matches: [
                {
                  id: 'match-1',
                  homeTeam: { name: 'Grid Iron' },
                  awayTeam: { name: 'Chain United' },
                  homeScore: 3,
                  awayScore: 1,
                  completedAt: '2026-06-20T00:00:00.000Z',
                },
              ],
            },
          })
        )
    );
  });

  it('explains the main dashboard options with differentiated action cards', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: /choose what you want to do/i })).toBeInTheDocument());

    expect(screen.getByRole('heading', { name: /welcome back, test coach/i })).toBeInTheDocument();
    expect(screen.getByText(/blue for team setup/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My Team' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marketplace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sports Economy' })).toBeInTheDocument();
    expect(screen.getAllByText(/Why it matters/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/How the GRID economy should make sense/i)).toBeInTheDocument();
  });
});
