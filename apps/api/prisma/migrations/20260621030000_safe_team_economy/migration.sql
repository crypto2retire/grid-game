-- Safe team economy schema foundation
-- Adds league, venue, transport, sponsorship, and finance snapshot models
-- Required by: teamEconomy.config.ts, gameEconomics.ts, match.routes.ts, team.routes.ts

-- League table
CREATE TABLE IF NOT EXISTS "League" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL DEFAULT 'american-football',
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "League_sportId_tier_idx" ON "League"("sportId", "tier");

-- TeamLeagueMembership table
CREATE TABLE IF NOT EXISTS "TeamLeagueMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" TEXT NOT NULL DEFAULT 'beta',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamLeagueMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamLeagueMembership_teamId_leagueId_season_key" ON "TeamLeagueMembership"("teamId", "leagueId", "season");
CREATE INDEX IF NOT EXISTS "TeamLeagueMembership_teamId_idx" ON "TeamLeagueMembership"("teamId");
CREATE INDEX IF NOT EXISTS "TeamLeagueMembership_leagueId_season_idx" ON "TeamLeagueMembership"("leagueId", "season");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TeamLeagueMembership_teamId_fkey'
      AND table_name = 'TeamLeagueMembership'
  ) THEN
    ALTER TABLE "TeamLeagueMembership"
      ADD CONSTRAINT "TeamLeagueMembership_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TeamLeagueMembership_leagueId_fkey'
      AND table_name = 'TeamLeagueMembership'
  ) THEN
    ALTER TABLE "TeamLeagueMembership"
      ADD CONSTRAINT "TeamLeagueMembership_leagueId_fkey"
      FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Venue table
CREATE TABLE IF NOT EXISTS "Venue" (
    "id" TEXT NOT NULL,
    "teamId" TEXT UNIQUE,
    "ownerId" TEXT,
    "sportId" TEXT NOT NULL DEFAULT 'american-football',
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'PARK_FIELD',
    "capacity" INTEGER NOT NULL DEFAULT 250,
    "ticketPrice" INTEGER NOT NULL DEFAULT 8,
    "condition" INTEGER NOT NULL DEFAULT 70,
    "prestige" INTEGER NOT NULL DEFAULT 10,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Venue_sportId_tier_idx" ON "Venue"("sportId", "tier");
CREATE INDEX IF NOT EXISTS "Venue_ownerId_idx" ON "Venue"("ownerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Venue_teamId_fkey'
      AND table_name = 'Venue'
  ) THEN
    ALTER TABLE "Venue"
      ADD CONSTRAINT "Venue_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- StadiumUpgrade table
CREATE TABLE IF NOT EXISTS "StadiumUpgrade" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StadiumUpgrade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StadiumUpgrade_venueId_idx" ON "StadiumUpgrade"("venueId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StadiumUpgrade_venueId_fkey'
      AND table_name = 'StadiumUpgrade'
  ) THEN
    ALTER TABLE "StadiumUpgrade"
      ADD CONSTRAINT "StadiumUpgrade_venueId_fkey"
      FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- TransportationAsset table
CREATE TABLE IF NOT EXISTS "TransportationAsset" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'CARPOOL',
    "name" TEXT NOT NULL,
    "operatingCost" INTEGER NOT NULL DEFAULT 100,
    "fatigueReduction" INTEGER NOT NULL DEFAULT 0,
    "prestige" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportationAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TransportationAsset_teamId_idx" ON "TransportationAsset"("teamId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TransportationAsset_teamId_fkey'
      AND table_name = 'TransportationAsset'
  ) THEN
    ALTER TABLE "TransportationAsset"
      ADD CONSTRAINT "TransportationAsset_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Sponsorship table
CREATE TABLE IF NOT EXISTS "Sponsorship" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "leagueId" TEXT,
    "sponsorName" TEXT NOT NULL,
    "amountPerGame" INTEGER NOT NULL DEFAULT 0,
    "amountPerSeason" INTEGER NOT NULL DEFAULT 0,
    "bonusRules" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sponsorship_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Sponsorship_teamId_idx" ON "Sponsorship"("teamId");
CREATE INDEX IF NOT EXISTS "Sponsorship_leagueId_idx" ON "Sponsorship"("leagueId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Sponsorship_teamId_fkey'
      AND table_name = 'Sponsorship'
  ) THEN
    ALTER TABLE "Sponsorship"
      ADD CONSTRAINT "Sponsorship_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Sponsorship_leagueId_fkey'
      AND table_name = 'Sponsorship'
  ) THEN
    ALTER TABLE "Sponsorship"
      ADD CONSTRAINT "Sponsorship_leagueId_fkey"
      FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- TeamFinanceSnapshot table
CREATE TABLE IF NOT EXISTS "TeamFinanceSnapshot" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "matchId" TEXT,
    "category" TEXT NOT NULL,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "expense" INTEGER NOT NULL DEFAULT 0,
    "net" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamFinanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamFinanceSnapshot_teamId_createdAt_idx" ON "TeamFinanceSnapshot"("teamId", "createdAt");
CREATE INDEX IF NOT EXISTS "TeamFinanceSnapshot_matchId_idx" ON "TeamFinanceSnapshot"("matchId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TeamFinanceSnapshot_teamId_fkey'
      AND table_name = 'TeamFinanceSnapshot'
  ) THEN
    ALTER TABLE "TeamFinanceSnapshot"
      ADD CONSTRAINT "TeamFinanceSnapshot_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed default leagues
INSERT INTO "League" ("id", "sportId", "name", "tier", "level", "createdAt", "updatedAt")
VALUES
  ('local-rec-football', 'american-football', 'Local Rec Football League', 'LOCAL_REC', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('regional-football', 'american-football', 'Regional Football League', 'REGIONAL', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('semi-pro-football', 'american-football', 'Semi-Pro Football League', 'SEMI_PRO', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pro-football', 'american-football', 'Pro Football League', 'PRO', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
