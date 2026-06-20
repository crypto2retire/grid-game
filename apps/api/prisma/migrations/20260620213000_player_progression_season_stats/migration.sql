-- Add aggregate player season/career stats for performance rankings and progression.
CREATE TABLE IF NOT EXISTS "PlayerSeasonStats" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL DEFAULT 'american-football',
    "season" TEXT NOT NULL DEFAULT 'beta',
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "starts" INTEGER NOT NULL DEFAULT 0,
    "touchdowns" INTEGER NOT NULL DEFAULT 0,
    "passingTouchdowns" INTEGER NOT NULL DEFAULT 0,
    "fieldGoals" INTEGER NOT NULL DEFAULT 0,
    "yards" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "tackles" INTEGER NOT NULL DEFAULT 0,
    "stops" INTEGER NOT NULL DEFAULT 0,
    "turnoversForced" INTEGER NOT NULL DEFAULT 0,
    "ratingTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 6.0,
    "mvpScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerSeasonStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlayerSeasonStats_playerId_sportId_season_key" ON "PlayerSeasonStats"("playerId", "sportId", "season");
CREATE INDEX IF NOT EXISTS "PlayerSeasonStats_sportId_season_mvpScore_idx" ON "PlayerSeasonStats"("sportId", "season", "mvpScore");
CREATE INDEX IF NOT EXISTS "PlayerSeasonStats_sportId_season_touchdowns_idx" ON "PlayerSeasonStats"("sportId", "season", "touchdowns");
CREATE INDEX IF NOT EXISTS "PlayerSeasonStats_sportId_season_yards_idx" ON "PlayerSeasonStats"("sportId", "season", "yards");
CREATE INDEX IF NOT EXISTS "PlayerSeasonStats_sportId_season_tackles_idx" ON "PlayerSeasonStats"("sportId", "season", "tackles");
CREATE INDEX IF NOT EXISTS "PlayerSeasonStats_sportId_season_ratingAverage_idx" ON "PlayerSeasonStats"("sportId", "season", "ratingAverage");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PlayerSeasonStats_playerId_fkey'
      AND table_name = 'PlayerSeasonStats'
  ) THEN
    ALTER TABLE "PlayerSeasonStats"
      ADD CONSTRAINT "PlayerSeasonStats_playerId_fkey"
      FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
