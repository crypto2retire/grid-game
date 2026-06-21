# Safe Team Economy Implementation Plan

> **For Hermes:** Use `software-delivery-workflows` for TDD/build/deploy discipline. Use `grid-game` references, especially `references/local-coach-to-pro-scope.md`, `references/player-progression-and-leaderboards.md`, and `references/multi-sport-crypto-backend-refactor.md`.

**Goal:** Replace the legally risky “winner takes both teams’ entry fees” model with a safer sports-management economy where teams earn from game-day revenue, sponsors, league rewards, fans, player development/sales, stadiums, transportation, and infrastructure.

**Architecture:** Add league/tier, venue/stadium, sponsorship, team finance, game economics, facilities/development, and transportation systems incrementally. Match fees become operating costs/sinks or infrastructure revenue, not winner-funded prize pools. Rewards are fixed/league/sponsor-funded and recorded through append-only ledger entries.

**Tech Stack:** Node/Express API, Prisma/PostgreSQL, React/Vite frontend, Zustand game store, Render Docker deploy.

---

## Legal/Economy Guardrail

Do **not** implement:

```txt
Team A pays entry fee + Team B pays entry fee -> winner receives combined fees
```

Implement instead:

```txt
Teams pay operating costs -> costs flow to venue/league/platform sinks -> teams earn fixed game-day revenue, sponsor rewards, fan growth, standings, and progression.
```

All currency movement must use `CurrencyLedger`.

---

## Phase 0 — Product/Economy Constants

### Task 0.1: Add shared economy config

**Objective:** Centralize tiers, revenue multipliers, cost multipliers, and safe reward rules.

**Files:**
- Create: `apps/api/src/modules/economy/teamEconomy.config.ts`
- Test: `apps/api/src/modules/economy/teamEconomy.config.test.ts`

**Implementation notes:**

Export constants:

```ts
export const LEAGUE_TIERS = ['LOCAL_REC', 'REGIONAL', 'SEMI_PRO', 'PRO'] as const;
export const VENUE_TIERS = ['PARK_FIELD', 'COMMUNITY_FIELD', 'SMALL_STADIUM', 'REGIONAL_STADIUM', 'PRO_STADIUM'] as const;
export const TRANSPORT_TIERS = ['CARPOOL', 'USED_BUS', 'TEAM_BUS', 'LUXURY_COACH', 'CHARTER_FLIGHT', 'TEAM_AIRCRAFT', 'CUSTOM_JET'] as const;

export const SAFE_REWARD_POLICY = {
  winnerDoesNotReceiveOpponentFees: true,
  rewardsFundedBy: ['LEAGUE_BUDGET', 'SPONSOR_BUDGET', 'GAME_DAY_REVENUE', 'PLATFORM_GRANT'],
  entryFeesAreOperatingCosts: true,
};
```

**Test:** Assert the policy forbids winner-take-entry-fee.

**Run:**

```bash
cd /tmp/grid-game && npm run build && npm test
```

---

## Phase 1 — Schema Foundation

### Task 1.1: Add league and membership models

**Objective:** Teams belong to a league tier that controls rewards, fans, stadium requirements, and promotion.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create migration: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_team_economy_foundation/migration.sql`

**Models to add:**

```prisma
model League {
  id          String   @id @default(uuid())
  sportId     String   @default("american-football")
  name        String
  tier        String
  level       Int      @default(1)
  metadata    Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships TeamLeagueMembership[]
  sponsorships Sponsorship[]

  @@index([sportId, tier])
}

model TeamLeagueMembership {
  id        String   @id @default(uuid())
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  leagueId  String
  league    League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  season    String   @default("beta")
  status    String   @default("ACTIVE")
  joinedAt  DateTime @default(now())

  @@unique([teamId, leagueId, season])
  @@index([teamId])
  @@index([leagueId, season])
}
```

Also add to `Team`:

```prisma
leagueMemberships TeamLeagueMembership[]
```

**Migration:** Add tables only. Do not drop legacy team standings fields.

### Task 1.2: Add venue/stadium models

**Objective:** Teams can earn revenue from home games and upgrade facilities.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify same migration as Task 1.1 if not committed yet; otherwise create new migration.

**Models:**

```prisma
model Venue {
  id          String   @id @default(uuid())
  teamId      String?  @unique
  team        Team?    @relation(fields: [teamId], references: [id], onDelete: SetNull)
  ownerId     String?
  sportId     String   @default("american-football")
  name        String
  tier        String   @default("PARK_FIELD")
  capacity    Int      @default(250)
  ticketPrice Int      @default(8)
  condition   Int      @default(70)
  prestige    Int      @default(10)
  metadata    Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  upgrades StadiumUpgrade[]

  @@index([sportId, tier])
  @@index([ownerId])
}

model StadiumUpgrade {
  id        String   @id @default(uuid())
  venueId   String
  venue     Venue    @relation(fields: [venueId], references: [id], onDelete: Cascade)
  type      String
  level     Int      @default(1)
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())

  @@index([venueId])
}
```

Add to `Team`:

```prisma
venue Venue?
```

### Task 1.3: Add transportation, sponsorship, and team finance snapshot models

**Objective:** Create data structures for transport costs/effects, sponsorship revenue, and team financial history.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Models:**

```prisma
model TransportationAsset {
  id             String   @id @default(uuid())
  teamId         String
  team           Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  tier           String   @default("CARPOOL")
  name           String
  operatingCost  Int      @default(100)
  fatigueReduction Int    @default(0)
  prestige       Int      @default(0)
  metadata       Json     @default("{}")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([teamId])
}

model Sponsorship {
  id        String   @id @default(uuid())
  teamId    String?
  team      Team?    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  leagueId  String?
  league    League?  @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  sponsorName String
  amountPerGame Int  @default(0)
  amountPerSeason Int @default(0)
  bonusRules Json    @default("{}")
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([teamId])
  @@index([leagueId])
}

model TeamFinanceSnapshot {
  id          String   @id @default(uuid())
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  matchId     String?
  category    String
  revenue     Int      @default(0)
  expense     Int      @default(0)
  net         Int      @default(0)
  metadata    Json     @default("{}")
  createdAt   DateTime @default(now())

  @@index([teamId, createdAt])
  @@index([matchId])
}
```

Add relations to `Team`:

```prisma
transportationAssets TransportationAsset[]
sponsorships Sponsorship[]
financeSnapshots TeamFinanceSnapshot[]
```

### Task 1.4: Generate Prisma and verify migration compiles

**Commands:**

```bash
cd /tmp/grid-game
PATH=/opt/homebrew/bin:$HOME/.nvm/versions/node/v20.20.2/bin:$PATH npx prisma generate --schema apps/api/prisma/schema.prisma
PATH=/opt/homebrew/bin:$HOME/.nvm/versions/node/v20.20.2/bin:$PATH npm run build
```

Expected: TypeScript build passes.

---

## Phase 2 — Seed Defaults for Local/Rec Start

### Task 2.1: Seed default leagues

**Objective:** Ensure a fresh DB has local/regional/semi-pro/pro football leagues.

**Files:**
- Modify: `apps/api/prisma/seed.js`
- Modify: `apps/api/prisma/seed.ts` if still used by tests/local scripts

Add leagues:

```txt
Local Rec Football League
Regional Football League
Semi-Pro Football League
Pro Football League
```

Use `upsert` where possible so restart seeding is safe.

### Task 2.2: Create starter venue on team creation

**Objective:** New teams automatically start with a small local venue.

**Files:**
- Modify: `apps/api/src/modules/teams/team.routes.ts`

Inside team creation transaction, create:

```ts
venue: {
  create: {
    sportId: input.sportId,
    name: `${input.name} Community Field`,
    tier: 'PARK_FIELD',
    capacity: 250,
    ticketPrice: 8,
    condition: 70,
    prestige: 10,
  }
}
```

Also attach the team to the local league if one exists.

### Task 2.3: Create starter transportation on team creation

**Objective:** New teams start with carpool/rental vans, not buses/jets.

**Files:**
- Modify: `apps/api/src/modules/teams/team.routes.ts`

Create:

```ts
transportationAssets: {
  create: {
    tier: 'CARPOOL',
    name: 'Carpool / Rental Vans',
    operatingCost: 100,
    fatigueReduction: 0,
    prestige: 0,
  }
}
```

---

## Phase 3 — Game-Day Economy Engine

### Task 3.1: Create game economics service

**Objective:** Calculate game revenue/expenses without winner-take-entry-fees.

**Files:**
- Create: `apps/api/src/modules/economy/gameEconomics.ts`
- Test: `apps/api/src/modules/economy/gameEconomics.test.ts`

Function signature:

```ts
export function calculateGameEconomics(input: {
  team: any;
  opponent: any;
  venue: any;
  transport?: any;
  sponsorships?: any[];
  isHome: boolean;
  didWin: boolean;
  didTie: boolean;
  scoreFor: number;
  scoreAgainst: number;
}): {
  revenue: number;
  expenses: number;
  net: number;
  breakdown: Record<string, number>;
}
```

Suggested components:

Revenue:
- tickets = attendance × ticketPrice
- concessions = attendance × tier concession rate
- merch = fanbase proxy × merch rate
- sponsorGameRevenue
- fixedLeagueResultReward

Expenses:
- travel/transport operating cost
- venue/staff/referee cost
- player recovery cost
- facility wear

Winning should increase revenue through fixed bonuses/fan interest, not opponent fees.

### Task 3.2: Add tests proving no opponent fee transfer

**Test cases:**

1. `winnerDoesNotReceiveOpponentOperatingCost`
2. `homeTeamEarnsTicketRevenueFromVenue`
3. `awayTeamPaysTravelCost`
4. `winnerGetsFixedLeagueBonusOnly`
5. `sponsorBonusDoesNotDependOnOpponentPayment`

Run:

```bash
cd /tmp/grid-game && npm test -- --runInBand apps/api/src/modules/economy/gameEconomics.test.ts
```

---

## Phase 4 — Hook Economy into Match Completion

### Task 4.1: Load venue/transport/sponsorship data in match simulation route

**Files:**
- Modify: `apps/api/src/modules/matches/match.routes.ts`

When loading `match`, include:

```ts
homeTeam: {
  include: {
    owner: true,
    venue: true,
    transportationAssets: true,
    sponsorships: { where: { active: true } },
    teamPlayers: { include: { player: true } },
  }
}
```

Same for `awayTeam`.

### Task 4.2: Apply game economics in simulation transaction

**Objective:** After simulation and team record update, write finance snapshots and wallet ledger entries.

**Files:**
- Modify: `apps/api/src/modules/matches/match.routes.ts`
- Import: `calculateGameEconomics`
- Reuse: `recordCurrencyLedger`

For each owner:

1. Calculate economics.
2. Update wallet by `net` if positive/negative.
3. Write `CurrencyLedger` with reason `GAME_DAY_NET_REVENUE`.
4. Create `TeamFinanceSnapshot` with full breakdown.

Important:

```ts
sourceType: 'MATCH_ECONOMICS'
sourceId: match.id
```

### Task 4.3: Replace current match reward logic

Current route writes match win/participation rewards. Replace with the game-day economics model or keep fixed rewards inside the economics breakdown.

Search in:

```txt
apps/api/src/modules/matches/match.routes.ts
```

for:

```txt
MATCH_WIN_REWARD
MATCH_PARTICIPATION_REWARD
```

Replace with:

```txt
GAME_DAY_NET_REVENUE
```

or more granular reasons:

```txt
GAME_DAY_TICKET_REVENUE
GAME_DAY_SPONSOR_REWARD
GAME_DAY_OPERATING_COST
```

Prefer one net ledger row plus `TeamFinanceSnapshot.metadata.breakdown` for MVP speed.

---

## Phase 5 — Facilities and Development Spend

### Task 5.1: Add development program model

**Objective:** Allow teams to spend currency developing players without direct betting mechanics.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create migration if Phase 1 migration already committed

Model:

```prisma
model DevelopmentProgram {
  id          String   @id @default(uuid())
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  playerId    String
  player      Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  type        String
  cost        Int
  status      String   @default("COMPLETED")
  effects     Json     @default("{}")
  createdAt   DateTime @default(now())

  @@index([teamId])
  @@index([playerId])
}
```

Add relations to `Team` and `Player`.

### Task 5.2: Add player development route

**Files:**
- Create: `apps/api/src/modules/development/development.routes.ts`
- Modify: `apps/api/src/server.ts` to mount `/api/development`

Endpoint:

```txt
POST /api/development/player/:playerId/train
```

Body:

```json
{
  "teamId": "...",
  "programType": "POSITION_COACHING"
}
```

Behavior:

- verify user owns team
- verify player is on team
- calculate cost/effects
- deduct wallet inside transaction
- write `CurrencyLedger` reason `PLAYER_DEVELOPMENT`
- create `DevelopmentProgram`
- update player attributes modestly

### Task 5.3: Add training UI on Team page

**Files:**
- Modify: `apps/web/src/pages/TeamPage.tsx`
- Maybe create: `apps/web/src/components/PlayerDevelopmentModal.tsx`

UI:

- button on roster card: `Train`
- modal lists program options and costs
- show projected effects
- show wallet balance
- show inline errors

---

## Phase 6 — Stadium and Transportation UI/API

### Task 6.1: Add team assets API routes

**Files:**
- Create: `apps/api/src/modules/assets/assets.routes.ts`
- Modify: `apps/api/src/server.ts`

Endpoints:

```txt
GET /api/assets/team/:teamId
POST /api/assets/team/:teamId/stadium/upgrade
POST /api/assets/team/:teamId/transportation/buy
```

All purchases:

- verify ownership
- check wallet
- apply upgrades
- write `CurrencyLedger`
- write or update `Venue`, `StadiumUpgrade`, `TransportationAsset`

### Task 6.2: Add Assets/Facilities frontend page

**Files:**
- Create: `apps/web/src/pages/AssetsPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Sidebar.tsx`

Sections:

- Stadium card
- Revenue breakdown
- Upgrade options
- Transportation ladder
- Current travel/fatigue effect
- Sponsor slots preview

Terminology: football-first, but sport-agnostic backend.

---

## Phase 7 — Sponsors and League Rewards

### Task 7.1: Sponsor offer generation service

**Files:**
- Create: `apps/api/src/modules/sponsors/sponsorEngine.ts`
- Create: `apps/api/src/modules/sponsors/sponsor.routes.ts`

Sponsor value inputs:

- league tier
- wins/losses/ties
- fanbase proxy
- venue prestige
- recent form
- star player OVR/performance

Routes:

```txt
GET /api/sponsors/team/:teamId/offers
POST /api/sponsors/team/:teamId/accept
```

### Task 7.2: Sponsorship UI

**Files:**
- Create: `apps/web/src/pages/SponsorsPage.tsx`
- Modify: Sidebar/App routes

Show:

- current sponsors
- available offers
- per-game/season value
- bonus terms
- sponsor prestige

---

## Phase 8 — Promotion Path and League Tiers

### Task 8.1: Promotion eligibility service

**Files:**
- Create: `apps/api/src/modules/leagues/promotion.ts`
- Create: `apps/api/src/modules/leagues/league.routes.ts`

Inputs:

- team record
- points
- venue tier/capacity
- wallet minimum
- roster minimum OVR/depth
- transportation tier

Endpoint:

```txt
GET /api/leagues/team/:teamId/promotion-status
POST /api/leagues/team/:teamId/promote
```

Promotion should cost money and possibly require stadium/transport thresholds.

### Task 8.2: League UI

**Files:**
- Create: `apps/web/src/pages/LeaguePage.tsx`
- Modify: Sidebar/App routes

Show:

- current league tier
- promotion checklist
- upcoming requirements
- reward differences
- stadium/transport gates

---

## Phase 9 — Frontend Dashboard Integration

### Task 9.1: Update dashboard economy cards

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx`

Cards:

- Team cash flow
- Fanbase/reputation
- Stadium tier
- Transportation tier
- League tier
- Next promotion requirements

### Task 9.2: Update wallet transaction labels

**Files:**
- Modify: `apps/web/src/pages/WalletPage.tsx`

Add readable labels for:

```txt
GAME_DAY_NET_REVENUE
PLAYER_DEVELOPMENT
STADIUM_UPGRADE
TRANSPORTATION_PURCHASE
SPONSOR_REWARD
LEAGUE_PROMOTION_FEE
```

---

## Phase 10 — Live Verification Script

### Task 10.1: Add executable economy verification script

**Files:**
- Create: `scripts/verify-safe-team-economy.py`

Script should:

1. Register test user.
2. Create two teams.
3. Verify starter venue/transport exists.
4. Top up wallet.
5. Hire players.
6. Simulate game.
7. Fetch wallet transactions.
8. Assert no ledger reason transfers opponent entry fee to winner.
9. Assert both teams have `TeamFinanceSnapshot` rows.
10. Assert winner/loss economics are based on breakdown fields.

Expected final output:

```txt
SAFE_ECONOMY_VERIFIED
health=200
match=COMPLETED
financeSnapshots=2
winnerTakesOpponentFee=false
```

---

## Phase 11 — Deployment Procedure

For each phase:

```bash
cd /tmp/grid-game
PATH=/opt/homebrew/bin:$HOME/.nvm/versions/node/v20.20.2/bin:$PATH npx prisma generate --schema apps/api/prisma/schema.prisma
PATH=/opt/homebrew/bin:$HOME/.nvm/versions/node/v20.20.2/bin:$PATH npm run build
PATH=/opt/homebrew/bin:$HOME/.nvm/versions/node/v20.20.2/bin:$PATH npm test
docker build -t grid-game-safe-economy-test .
git add -A
git commit -m "feat: [phase summary]"
git push origin main
```

Then trigger/poll Render and verify:

```txt
GET https://grid-game-pom3.onrender.com/api/health -> 200
python3 scripts/verify-safe-team-economy.py
```

---

## Recommended Implementation Order

1. Phase 0 — config/tests
2. Phase 1 — schema/migration
3. Phase 2 — starter league/venue/transport on team create
4. Phase 3 — pure game economics service with tests
5. Phase 4 — integrate match completion economics
6. Phase 10 — live verification script
7. Phase 5 — player development spend
8. Phase 6 — stadium/transport UI/API
9. Phase 7 — sponsors
10. Phase 8 — promotion
11. Phase 9 — dashboard/wallet polish

## Acceptance Criteria

- No code path transfers one team’s game fee directly to the opponent/winner.
- Every currency movement writes `CurrencyLedger`.
- New teams start local/rec with low-end venue and transport.
- Games generate revenue/expenses through business simulation.
- Winners earn via fan/reputation/sponsor/league rewards, not entry pots.
- Teams can spend on development, stadium, and transport upgrades.
- UI explains how teams make money.
- Build/test/Docker pass.
- Render deploy goes live.
- Live verification script prints `SAFE_ECONOMY_VERIFIED`.
