-- Add health, injury fields to Player
ALTER TABLE "Player" ADD COLUMN "health" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Player" ADD COLUMN "injuryStatus" TEXT;
ALTER TABLE "Player" ADD COLUMN "injuryType" TEXT;
ALTER TABLE "Player" ADD COLUMN "injuryWeeks" INTEGER NOT NULL DEFAULT 0;

-- Index for injury queries
CREATE INDEX "Player_injuryStatus_idx" ON "Player"("injuryStatus");
