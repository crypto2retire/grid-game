-- Sports Commissioner Cycle: community funding, limited inventory, restock phases, and contribution accounting.
CREATE TABLE "CommissionerCycle" (
  "id" TEXT NOT NULL,
  "sportId" TEXT NOT NULL DEFAULT 'american-football',
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "theme" TEXT NOT NULL DEFAULT 'Community Sports Commission',
  "phase" TEXT NOT NULL DEFAULT 'FUNDING',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "fundingCurrency" TEXT NOT NULL DEFAULT 'DYN',
  "fundingGoal" DOUBLE PRECISION NOT NULL DEFAULT 25000,
  "fundingRaised" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rewardPool" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fundingEndsAt" TIMESTAMP(3),
  "restockAt" TIMESTAMP(3),
  "inventoryReleasedAt" TIMESTAMP(3),
  "economyMeters" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionerCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionerInventory" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT 'LEAGUE_ASSET',
  "currency" TEXT NOT NULL DEFAULT 'DYN',
  "price" DOUBLE PRECISION NOT NULL,
  "quantityTotal" INTEGER NOT NULL,
  "quantityRemaining" INTEGER NOT NULL,
  "phase" TEXT NOT NULL DEFAULT 'LOCKED',
  "restockBatch" INTEGER NOT NULL DEFAULT 1,
  "unlockFundingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "effects" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionerInventory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionerContribution" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "inventoryId" TEXT,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'FUNDING',
  "currency" TEXT NOT NULL DEFAULT 'DYN',
  "amount" DOUBLE PRECISION NOT NULL,
  "dynEquivalent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rewardCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rewardDyn" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "share" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionerContribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommissionerCycle_code_key" ON "CommissionerCycle"("code");
CREATE INDEX "CommissionerCycle_sportId_status_phase_idx" ON "CommissionerCycle"("sportId", "status", "phase");
CREATE INDEX "CommissionerCycle_code_idx" ON "CommissionerCycle"("code");

CREATE UNIQUE INDEX "CommissionerInventory_cycleId_sku_key" ON "CommissionerInventory"("cycleId", "sku");
CREATE INDEX "CommissionerInventory_cycleId_phase_active_idx" ON "CommissionerInventory"("cycleId", "phase", "active");
CREATE INDEX "CommissionerInventory_category_idx" ON "CommissionerInventory"("category");

CREATE INDEX "CommissionerContribution_cycleId_createdAt_idx" ON "CommissionerContribution"("cycleId", "createdAt");
CREATE INDEX "CommissionerContribution_userId_createdAt_idx" ON "CommissionerContribution"("userId", "createdAt");
CREATE INDEX "CommissionerContribution_inventoryId_idx" ON "CommissionerContribution"("inventoryId");
CREATE INDEX "CommissionerContribution_type_idx" ON "CommissionerContribution"("type");

ALTER TABLE "CommissionerInventory" ADD CONSTRAINT "CommissionerInventory_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CommissionerCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionerContribution" ADD CONSTRAINT "CommissionerContribution_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CommissionerCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionerContribution" ADD CONSTRAINT "CommissionerContribution_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "CommissionerInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionerContribution" ADD CONSTRAINT "CommissionerContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
