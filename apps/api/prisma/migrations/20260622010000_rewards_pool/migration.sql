-- Create RewardsPool table
CREATE TABLE "RewardsPool" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "totalStaked" INTEGER NOT NULL DEFAULT 0,
    "rewardRatePerDay" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
    "totalRewardsDistributed" INTEGER NOT NULL DEFAULT 0,
    "totalRewardsFunded" INTEGER NOT NULL DEFAULT 0,
    "lastDistributionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardsPool_pkey" PRIMARY KEY ("id")
);

-- Create UserStake table
CREATE TABLE "UserStake" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL DEFAULT 'main',
    "amount" INTEGER NOT NULL,
    "stakedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastClaimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalClaimed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "unstakeRequestedAt" TIMESTAMP(3),

    CONSTRAINT "UserStake_pkey" PRIMARY KEY ("id")
);

-- Create RewardDistribution table
CREATE TABLE "RewardDistribution" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "poolId" TEXT NOT NULL DEFAULT 'main',
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'DAILY_REWARD',
    "distributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardDistribution_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "UserStake_userId_idx" ON "UserStake"("userId");
CREATE INDEX "UserStake_poolId_idx" ON "UserStake"("poolId");
CREATE INDEX "UserStake_status_idx" ON "UserStake"("status");
CREATE INDEX "RewardDistribution_poolId_idx" ON "RewardDistribution"("poolId");
CREATE INDEX "RewardDistribution_distributedAt_idx" ON "RewardDistribution"("distributedAt");

-- Add foreign keys
ALTER TABLE "UserStake" ADD CONSTRAINT "UserStake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserStake" ADD CONSTRAINT "UserStake_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "RewardsPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardDistribution" ADD CONSTRAINT "RewardDistribution_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "RewardsPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed initial rewards pool
INSERT INTO "RewardsPool" ("id", "totalStaked", "rewardRatePerDay", "totalRewardsDistributed", "totalRewardsFunded", "lastDistributionAt", "active", "createdAt", "updatedAt")
VALUES ('main', 0, 0.005, 0, 0, CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
