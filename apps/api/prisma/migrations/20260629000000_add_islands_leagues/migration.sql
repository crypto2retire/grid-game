-- Add missing columns to League table
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "creatorId" TEXT;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "islandId" TEXT UNIQUE;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "entryFee" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "maxTeams" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "minTeamRating" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "minOverall" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "maxOverall" INTEGER NOT NULL DEFAULT 99;

-- Add foreign key to League.creatorId -> User.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'League_creatorId_fkey'
      AND table_name = 'League'
  ) THEN
    ALTER TABLE "League"
      ADD CONSTRAINT "League_creatorId_fkey"
      FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create Island table
CREATE TABLE IF NOT EXISTS "Island" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LEAGUE',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "size" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "theme" TEXT NOT NULL DEFAULT 'grass',
    "color" TEXT NOT NULL DEFAULT '#4ade80',
    "icon" TEXT,
    "teamCount" INTEGER NOT NULL DEFAULT 0,
    "maxTeams" INTEGER NOT NULL DEFAULT 12,
    "prestige" INTEGER NOT NULL DEFAULT 10,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Island_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Island_type_idx" ON "Island"("type");
CREATE INDEX IF NOT EXISTS "Island_x_y_idx" ON "Island"("x", "y");

-- Add foreign key to League.islandId -> Island.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'League_islandId_fkey'
      AND table_name = 'League'
  ) THEN
    ALTER TABLE "League"
      ADD CONSTRAINT "League_islandId_fkey"
      FOREIGN KEY ("islandId") REFERENCES "Island"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add League indexes
CREATE INDEX IF NOT EXISTS "League_visibility_status_idx" ON "League"("visibility", "status");
CREATE INDEX IF NOT EXISTS "League_creatorId_idx" ON "League"("creatorId");
CREATE INDEX IF NOT EXISTS "League_isDefault_idx" ON "League"("isDefault");

-- Create GameSettings table
CREATE TABLE IF NOT EXISTS "GameSettings" (
    "id" TEXT NOT NULL,
    "gameEpochStart" TIMESTAMP(3) NOT NULL DEFAULT '2026-01-01 00:00:00',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameSettings_pkey" PRIMARY KEY ("id")
);

-- Create LeagueInvitation table
CREATE TABLE IF NOT EXISTS "LeagueInvitation" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "LeagueInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeagueInvitation_leagueId_inviteeId_status_key" ON "LeagueInvitation"("leagueId", "inviteeId", "status");
CREATE INDEX IF NOT EXISTS "LeagueInvitation_leagueId_status_idx" ON "LeagueInvitation"("leagueId", "status");
CREATE INDEX IF NOT EXISTS "LeagueInvitation_inviteeId_status_idx" ON "LeagueInvitation"("inviteeId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LeagueInvitation_leagueId_fkey'
      AND table_name = 'LeagueInvitation'
  ) THEN
    ALTER TABLE "LeagueInvitation"
      ADD CONSTRAINT "LeagueInvitation_leagueId_fkey"
      FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LeagueInvitation_inviterId_fkey'
      AND table_name = 'LeagueInvitation'
  ) THEN
    ALTER TABLE "LeagueInvitation"
      ADD CONSTRAINT "LeagueInvitation_inviterId_fkey"
      FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LeagueInvitation_inviteeId_fkey'
      AND table_name = 'LeagueInvitation'
  ) THEN
    ALTER TABLE "LeagueInvitation"
      ADD CONSTRAINT "LeagueInvitation_inviteeId_fkey"
      FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Create LeagueApplication table
CREATE TABLE IF NOT EXISTS "LeagueApplication" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "LeagueApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeagueApplication_leagueId_teamId_key" ON "LeagueApplication"("leagueId", "teamId");
CREATE INDEX IF NOT EXISTS "LeagueApplication_leagueId_status_idx" ON "LeagueApplication"("leagueId", "status");
CREATE INDEX IF NOT EXISTS "LeagueApplication_userId_idx" ON "LeagueApplication"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LeagueApplication_leagueId_fkey'
      AND table_name = 'LeagueApplication'
  ) THEN
    ALTER TABLE "LeagueApplication"
      ADD CONSTRAINT "LeagueApplication_leagueId_fkey"
      FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LeagueApplication_teamId_fkey'
      AND table_name = 'LeagueApplication'
  ) THEN
    ALTER TABLE "LeagueApplication"
      ADD CONSTRAINT "LeagueApplication_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LeagueApplication_userId_fkey'
      AND table_name = 'LeagueApplication'
  ) THEN
    ALTER TABLE "LeagueApplication"
      ADD CONSTRAINT "LeagueApplication_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed default GameSettings
INSERT INTO "GameSettings" ("id", "gameEpochStart", "updatedAt")
VALUES ('main', '2026-01-01 00:00:00', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Seed default islands (Hub + league islands)
INSERT INTO "Island" ("id", "name", "type", "x", "y", "size", "theme", "color", "maxTeams", "prestige", "createdAt", "updatedAt")
VALUES
  ('island-hub', 'Grid City Central', 'HUB', 0, 0, 2.5, 'grass', '#4ade80', 999, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('island-state-001', 'State College Circuit', 'LEAGUE', -200, -150, 1.0, 'grass', '#86efac', 16, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('island-mid-001', 'Mid-College Conference', 'LEAGUE', 200, -150, 1.1, 'tropical', '#22d3ee', 16, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('island-top-001', 'Top College Tournament', 'LEAGUE', -250, 100, 1.2, 'desert', '#fbbf24', 12, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('island-regional-001', 'Regional Pro Circuit', 'LEAGUE', 250, 100, 1.3, 'industrial', '#94a3b8', 12, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('island-pro-001', 'Pro Entry League', 'LEAGUE', -150, 250, 1.4, 'snow', '#e2e8f0', 10, 18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('island-elite-001', 'Pro Elite Championship', 'LEAGUE', 150, 250, 1.5, 'volcanic', '#f87171', 8, 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Seed default leagues linked to islands
INSERT INTO "League" ("id", "sportId", "name", "tier", "level", "minOverall", "maxOverall", "islandId", "visibility", "entryFee", "maxTeams", "minTeamRating", "isDefault", "status", "metadata", "createdAt", "updatedAt")
VALUES
  ('league-hub', 'american-football', 'Grid City Central', 'HUB', 1, 0, 99, 'island-hub', 'PUBLIC', 0, 999, 0, true, 'ACTIVE', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('league-state-001', 'american-football', 'State College Circuit', 'STATE_COLLEGE', 1, 50, 69, 'island-state-001', 'PUBLIC', 0, 16, 0, true, 'ACTIVE', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('league-mid-001', 'american-football', 'Mid-College Conference', 'MID_COLLEGE', 1, 60, 74, 'island-mid-001', 'PUBLIC', 0, 16, 0, true, 'ACTIVE', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('league-top-001', 'american-football', 'Top College Tournament', 'TOP_COLLEGE', 1, 70, 79, 'island-top-001', 'PUBLIC', 0, 12, 0, true, 'ACTIVE', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('league-regional-001', 'american-football', 'Regional Pro Circuit', 'REGIONAL_PRO', 1, 75, 84, 'island-regional-001', 'PUBLIC', 0, 12, 0, true, 'ACTIVE', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('league-pro-001', 'american-football', 'Pro Entry League', 'PRO_ENTRY', 1, 80, 89, 'island-pro-001', 'PUBLIC', 0, 10, 0, true, 'ACTIVE', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('league-elite-001', 'american-football', 'Pro Elite Championship', 'PRO_ELITE', 1, 85, 99, 'island-elite-001', 'PUBLIC', 0, 8, 0, true, 'ACTIVE', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
