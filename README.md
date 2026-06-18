# GRID - Sports Management Simulation Game

A full-stack sports management game with American football and soccer. Built with React, Node.js, PostgreSQL, and Redis.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Database**: PostgreSQL (data persistence) + Redis (caching/sessions)
- **WebSocket**: Socket.io for real-time match viewing
- **Authentication**: JWT + bcrypt
- **Deployment**: Railway (primary) / Render (fallback)

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/crypto2retire/grid-game.git
cd grid-game

# Install dependencies
npm install

# Start PostgreSQL and Redis
npm run docker:up

# Run database migrations
npm run db:migrate

# Seed the database with 200 players
npm run db:seed

# Start both frontend and backend
npm run dev
```

The frontend will be available at `http://localhost:5173` and the API at `http://localhost:3000`.

### Environment Variables

Create a `.env` file in `apps/api/`:

```env
DATABASE_URL=postgresql://grid:gridpassword@localhost:5432/gridgame
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
DAILY_SALT=change-this-daily
FRONTEND_URL=http://localhost:5173
```

## Features

- **Team Management**: Create up to 3 teams, manage formations, tactics, and player lineups
- **Player Collection**: 200+ unique players with attributes, rarity tiers, and stats
- **Match Simulation**: Server-authoritative, deterministic match engine with full replay support
- **Marketplace**: Buy and sell players with a 5% marketplace fee
- **Economy**: CASH system with match rewards, daily bonuses, and transaction history
- **Leaderboard**: Global team rankings and player statistics
- **Real-time**: WebSocket match viewing with animated event timeline

## API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account (50K CASH starting) |
| POST | /api/auth/login | Login and receive JWT |
| GET | /api/auth/me | Get current user |

### Teams

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/teams | Create team (max 3) |
| GET | /api/teams/mine | Get my teams |
| GET | /api/teams/:id | Get team details |
| PUT | /api/teams/:id | Update team/tactics |
| POST | /api/teams/:id/players | Add player to team |
| DELETE | /api/teams/:id/players/:pid | Remove player |

### Matches

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/matches | Schedule match |
| GET | /api/matches/:id | Get match details |
| POST | /api/matches/:id/simulate | Run simulation |

### Marketplace

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/marketplace | Active listings |
| POST | /api/marketplace | Create listing |
| POST | /api/marketplace/:id/buy | Buy player |

## Game Mechanics

### Match Simulation

- **Engine**: Discrete-event simulation with 1-second ticks
- **Duration**: 90 minutes (first half + second half)
- **Possession**: Alternating based on tactics and player quality
- **Events**: Pass, tackle, shot, save, goal, corner, foul, card
- **RNG**: SFC32 seeded PRNG for deterministic, auditable results

### Economy

| Outcome | Reward |
|---------|--------|
| Win | 5,000 CASH + XP |
| Draw | 2,000 CASH + XP |
| Loss | 1,000 CASH + XP |

### Player Rarity

| Rarity | Attribute Range | Drop Rate |
|--------|-----------------|-----------|
| Common | 40-55 | 60% |
| Bronze | 50-65 | 25% |
| Silver | 60-75 | 10% |
| Gold | 70-85 | 4% |
| Elite | 80-92 | 0.9% |
| Legend | 88-99 | 0.1% |

## Testing

```bash
# Run all tests
npm run test

# Backend tests only
npm run test --workspace=@grid/api

# Frontend tests only
npm run test --workspace=@grid/web
```

## Deployment

### Railway (Recommended)

1. Create a Railway account at https://railway.app
2. Connect your GitHub repository
3. Add PostgreSQL and Redis services
4. Set environment variables in Railway dashboard
5. Deploy on every push to main

### Render

1. Create a Render account at https://render.com
2. Create a new Web Service from your GitHub repo
3. Set environment variables
4. Deploy automatically on push

## License

MIT

## Support

For support, join our Discord community or open an issue on GitHub.
