CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "RetentionProfile" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "bestStreak" INTEGER NOT NULL DEFAULT 0,
  "lastActiveDate" TEXT,
  "seasonXp" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DailyJourney" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "dateKey" TEXT NOT NULL,
  "stages" JSONB NOT NULL DEFAULT '{"PREPARE":false,"DEVELOP":false,"COMPETE":false,"GROW":false}'::jsonb,
  "completedAt" TIMESTAMP(3),
  "chestEligibleAt" TIMESTAMP(3),
  "chestClaimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyJourney_userId_dateKey_key" UNIQUE ("userId", "dateKey")
);
CREATE INDEX "DailyJourney_userId_dateKey_idx" ON "DailyJourney"("userId", "dateKey");

CREATE TABLE "RewardClaim" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "claimType" TEXT NOT NULL,
  "claimKey" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "rewardCash" INTEGER NOT NULL DEFAULT 0,
  "rewardDyn" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardClaim_userId_idempotencyKey_key" UNIQUE ("userId", "idempotencyKey"),
  CONSTRAINT "RewardClaim_userId_claimType_claimKey_key" UNIQUE ("userId", "claimType", "claimKey")
);
CREATE INDEX "RewardClaim_userId_createdAt_idx" ON "RewardClaim"("userId", "createdAt");

CREATE TABLE "RetentionSeason" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SeasonMilestone" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "seasonId" TEXT NOT NULL REFERENCES "RetentionSeason"("id") ON DELETE CASCADE,
  "tier" INTEGER NOT NULL,
  "xpRequired" INTEGER NOT NULL,
  "rewardCash" INTEGER NOT NULL DEFAULT 0,
  "rewardDyn" INTEGER NOT NULL DEFAULT 0,
  "label" TEXT NOT NULL,
  CONSTRAINT "SeasonMilestone_seasonId_tier_key" UNIQUE ("seasonId", "tier")
);
CREATE INDEX "SeasonMilestone_seasonId_xpRequired_idx" ON "SeasonMilestone"("seasonId", "xpRequired");

CREATE TABLE "SeasonProgress" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "seasonId" TEXT NOT NULL REFERENCES "RetentionSeason"("id") ON DELETE CASCADE,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonProgress_userId_seasonId_key" UNIQUE ("userId", "seasonId")
);

CREATE TABLE "FacilityModifier" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL UNIQUE,
  "facilityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "effects" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "FacilityModifier_status_startsAt_endsAt_idx" ON "FacilityModifier"("status", "startsAt", "endsAt");

INSERT INTO "RetentionSeason" ("code", "name", "startsAt", "endsAt", "status")
VALUES ('FOUNDERS-2026', 'Founders Season', TIMESTAMP '2026-07-01 00:00:00', TIMESTAMP '2026-09-30 23:59:59', 'ACTIVE')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "SeasonMilestone" ("seasonId", "tier", "xpRequired", "rewardCash", "rewardDyn", "label")
SELECT s."id", v.tier, v.xp, v.cash, v.dyn, v.label
FROM "RetentionSeason" s
CROSS JOIN (VALUES
  (1, 300, 2500, 0, 'Rookie Foundation'),
  (2, 800, 5000, 10, 'Contender Pack'),
  (3, 1600, 10000, 25, 'Playoff Push'),
  (4, 3000, 20000, 50, 'Franchise Elite')
) AS v(tier, xp, cash, dyn, label)
WHERE s."code" = 'FOUNDERS-2026'
ON CONFLICT ("seasonId", "tier") DO NOTHING;

INSERT INTO "FacilityModifier" ("code", "facilityId", "name", "description", "startsAt", "endsAt", "effects", "status") VALUES
('TRAINING-TUESDAY-2026-01', 'training', 'Training Tuesday', 'Training sessions grant 20% more development progress.', TIMESTAMP '2026-07-14 00:00:00', TIMESTAMP '2026-07-15 00:00:00', '{"trainingProgressMultiplier":1.2}'::jsonb, 'SCHEDULED'),
('RIVALRY-WEEKEND-2026-01', 'stadium', 'Rivalry Weekend', 'Rivalry matches grant 15% more season XP; currency rewards are unchanged.', TIMESTAMP '2026-07-17 00:00:00', TIMESTAMP '2026-07-20 00:00:00', '{"seasonXpMultiplier":1.15,"rivalryOnly":true}'::jsonb, 'SCHEDULED'),
('RECOVERY-SUNDAY-2026-01', 'medical', 'Recovery Sunday', 'Medical recovery time is reduced by 20%.', TIMESTAMP '2026-07-19 00:00:00', TIMESTAMP '2026-07-20 00:00:00', '{"recoveryTimeMultiplier":0.8}'::jsonb, 'SCHEDULED')
ON CONFLICT ("code") DO NOTHING;
