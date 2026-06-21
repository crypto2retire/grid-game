-- Add playable match fields to Match table
ALTER TABLE "Match" ADD COLUMN "isPlayable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Match" ADD COLUMN "gamePhase" TEXT NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "Match" ADD COLUMN "currentQuarter" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Match" ADD COLUMN "gameClock" INTEGER NOT NULL DEFAULT 900;
ALTER TABLE "Match" ADD COLUMN "possessionTeamId" TEXT;
ALTER TABLE "Match" ADD COLUMN "ballPosition" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "Match" ADD COLUMN "down" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Match" ADD COLUMN "yardsToGo" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Match" ADD COLUMN "offensiveLineup" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "Match" ADD COLUMN "defensiveLineup" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "Match" ADD COLUMN "offensiveStyle" TEXT DEFAULT 'balanced';
ALTER TABLE "Match" ADD COLUMN "defensiveStyle" TEXT DEFAULT 'balanced';
ALTER TABLE "Match" ADD COLUMN "playHistory" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "Match" ADD COLUMN "lastPlayResult" JSONB;
ALTER TABLE "Match" ADD COLUMN "userTeamId" TEXT;

-- Create MatchPlay table
CREATE TABLE "MatchPlay" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "matchId" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "gameClock" INTEGER NOT NULL,
    "down" INTEGER NOT NULL,
    "yardsToGo" INTEGER NOT NULL,
    "ballPosition" INTEGER NOT NULL,
    "playType" TEXT NOT NULL,
    "direction" TEXT,
    "result" TEXT NOT NULL,
    "yardsGained" INTEGER NOT NULL DEFAULT 0,
    "playerId" TEXT,
    "targetId" TEXT,
    "description" TEXT NOT NULL,
    "animationData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPlay_pkey" PRIMARY KEY ("id")
);

-- Create PlayerDevelopmentLog table
CREATE TABLE "PlayerDevelopmentLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "playerId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "statGained" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerDevelopmentLog_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "MatchPlay" ADD CONSTRAINT "MatchPlay_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerDevelopmentLog" ADD CONSTRAINT "PlayerDevelopmentLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "MatchPlay_matchId_quarter_idx" ON "MatchPlay"("matchId", "quarter");
CREATE INDEX "MatchPlay_matchId_createdAt_idx" ON "MatchPlay"("matchId", "createdAt");
CREATE INDEX "PlayerDevelopmentLog_playerId_matchId_idx" ON "PlayerDevelopmentLog"("playerId", "matchId");
CREATE INDEX "PlayerDevelopmentLog_playerId_createdAt_idx" ON "PlayerDevelopmentLog"("playerId", "createdAt");
CREATE INDEX "Match_isPlayable_gamePhase_idx" ON "Match"("isPlayable", "gamePhase");
