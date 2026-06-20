-- Multi-sport + crypto-ready backend foundation
-- Safe additive migration: preserves legacy columns while adding sport-aware and JSON-backed fields.

ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "sportId" TEXT NOT NULL DEFAULT 'american-football';
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "tactics" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "record" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "sportId" TEXT NOT NULL DEFAULT 'american-football';
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "attributes" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "sportId" TEXT NOT NULL DEFAULT 'american-football';
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "PlayerMatchStats" ADD COLUMN IF NOT EXISTS "stats" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "MarketplaceListing" ADD COLUMN IF NOT EXISTS "sportId" TEXT NOT NULL DEFAULT 'american-football';

CREATE TABLE IF NOT EXISTS "CurrencyLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER,
  "reason" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurrencyLedger_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CurrencyLedger_userId_fkey'
      AND table_name = 'CurrencyLedger'
  ) THEN
    ALTER TABLE "CurrencyLedger"
      ADD CONSTRAINT "CurrencyLedger_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "Player"
SET "attributes" = jsonb_build_object(
  'speed', "pace",
  'arm', "shooting",
  'footballIQ', "passing",
  'agility', "dribbling",
  'tackling', "defending",
  'strength', "physical",
  'legacy', jsonb_build_object(
    'pace', "pace",
    'shooting', "shooting",
    'passing', "passing",
    'dribbling', "dribbling",
    'defending', "defending",
    'physical', "physical",
    'goalkeeping', COALESCE("goalkeeping", 0)
  )
)
WHERE "attributes" = '{}'::jsonb OR "attributes" IS NULL;

UPDATE "PlayerMatchStats"
SET "stats" = jsonb_build_object(
  'touchdowns', "goals",
  'assists', "assists",
  'plays', "shots",
  'onTarget', "shotsOnTarget",
  'passes', "passes",
  'passAccuracy', "passAccuracy",
  'tackles', "tackles",
  'stops', "saves",
  'distance', "distance",
  'rating', "rating",
  'legacy', jsonb_build_object(
    'goals', "goals",
    'assists', "assists",
    'shots', "shots",
    'shotsOnTarget', "shotsOnTarget",
    'passes', "passes",
    'tackles', "tackles",
    'saves', "saves"
  )
)
WHERE "stats" = '{}'::jsonb OR "stats" IS NULL;

UPDATE "Team"
SET "record" = jsonb_build_object(
  'wins', "wins",
  'draws', "draws",
  'losses', "losses",
  'points', "points",
  'pointsFor', "goalsFor",
  'pointsAgainst', "goalsAgainst",
  'legacy', jsonb_build_object('goalsFor', "goalsFor", 'goalsAgainst', "goalsAgainst")
)
WHERE "record" = '{}'::jsonb OR "record" IS NULL;

UPDATE "Match" m
SET "sportId" = COALESCE(t."sportId", 'american-football')
FROM "Team" t
WHERE m."homeTeamId" = t."id" AND (m."sportId" IS NULL OR m."sportId" = 'american-football');

UPDATE "MarketplaceListing" ml
SET "sportId" = COALESCE(p."sportId", 'american-football')
FROM "Player" p
WHERE ml."playerId" = p."id" AND (ml."sportId" IS NULL OR ml."sportId" = 'american-football');

CREATE INDEX IF NOT EXISTS "Team_sportId_idx" ON "Team"("sportId");
CREATE INDEX IF NOT EXISTS "Team_sportId_ownerId_idx" ON "Team"("sportId", "ownerId");
CREATE INDEX IF NOT EXISTS "Player_sportId_idx" ON "Player"("sportId");
CREATE INDEX IF NOT EXISTS "Player_sportId_position_idx" ON "Player"("sportId", "position");
CREATE INDEX IF NOT EXISTS "Match_sportId_idx" ON "Match"("sportId");
CREATE INDEX IF NOT EXISTS "Match_sportId_status_idx" ON "Match"("sportId", "status");
CREATE INDEX IF NOT EXISTS "MarketplaceListing_sportId_idx" ON "MarketplaceListing"("sportId");
CREATE INDEX IF NOT EXISTS "CurrencyLedger_userId_createdAt_idx" ON "CurrencyLedger"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CurrencyLedger_currency_idx" ON "CurrencyLedger"("currency");
CREATE INDEX IF NOT EXISTS "CurrencyLedger_sourceType_sourceId_idx" ON "CurrencyLedger"("sourceType", "sourceId");
