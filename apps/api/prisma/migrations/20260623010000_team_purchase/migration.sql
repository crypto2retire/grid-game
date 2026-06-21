-- Add hasPaidPurchase to User
ALTER TABLE "User" ADD COLUMN "hasPaidPurchase" BOOLEAN NOT NULL DEFAULT false;

-- Add tier/purchase fields to Team
ALTER TABLE "Team" ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'STATE_COLLEGE';
ALTER TABLE "Team" ADD COLUMN "isFree" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Team" ADD COLUMN "purchasePrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Team" ADD COLUMN "purchaseCurrency" TEXT;
ALTER TABLE "Team" ADD COLUMN "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Team" ADD COLUMN "seasonsPlayed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Team" ADD COLUMN "isForSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Team" ADD COLUMN "salePrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Team" ADD COLUMN "saleCurrency" TEXT NOT NULL DEFAULT 'GRID';
ALTER TABLE "Team" ADD COLUMN "saleListedAt" TIMESTAMP(3);
ALTER TABLE "Team" ADD COLUMN "catalogId" TEXT;

-- Create TeamCatalog table
CREATE TABLE "TeamCatalog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "sportId" TEXT NOT NULL DEFAULT 'american-football',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tier" TEXT NOT NULL,
    "gridPrice" INTEGER NOT NULL DEFAULT 0,
    "solPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "playerCount" INTEGER NOT NULL DEFAULT 22,
    "minOverall" INTEGER NOT NULL DEFAULT 65,
    "maxOverall" INTEGER NOT NULL DEFAULT 75,
    "stadiumTier" TEXT NOT NULL DEFAULT 'PARK_FIELD',
    "stadiumCapacity" INTEGER NOT NULL DEFAULT 5000,
    "requiresSeasons" INTEGER NOT NULL DEFAULT 0,
    "requiresWinPct" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "maxSupply" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamCatalog_pkey" PRIMARY KEY ("id")
);

-- Create TeamMarketplaceListing table
CREATE TABLE "TeamMarketplaceListing" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "sportId" TEXT NOT NULL DEFAULT 'american-football',
    "sellerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GRID',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "foundationTaxPaid" INTEGER NOT NULL DEFAULT 0,
    "burnAmount" INTEGER NOT NULL DEFAULT 0,
    "sellerReceives" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "TeamMarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "TeamMarketplaceListing" ADD CONSTRAINT "TeamMarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMarketplaceListing" ADD CONSTRAINT "TeamMarketplaceListing_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "Team_tier_idx" ON "Team"("tier");
CREATE INDEX "Team_isForSale_idx" ON "Team"("isForSale");
CREATE INDEX "TeamCatalog_sportId_tier_idx" ON "TeamCatalog"("sportId", "tier");
CREATE INDEX "TeamCatalog_active_idx" ON "TeamCatalog"("active");
CREATE INDEX "TeamMarketplaceListing_status_idx" ON "TeamMarketplaceListing"("status");
CREATE INDEX "TeamMarketplaceListing_sportId_idx" ON "TeamMarketplaceListing"("sportId");
CREATE INDEX "TeamMarketplaceListing_sellerId_idx" ON "TeamMarketplaceListing"("sellerId");
CREATE INDEX "TeamMarketplaceListing_teamId_idx" ON "TeamMarketplaceListing"("teamId");

-- Seed initial team catalog
INSERT INTO "TeamCatalog" ("id", "sportId", "name", "description", "tier", "gridPrice", "solPrice", "playerCount", "minOverall", "maxOverall", "stadiumTier", "stadiumCapacity", "requiresSeasons", "requiresWinPct", "active", "createdAt")
VALUES
  -- State College (free tier - reference only, not sold from catalog)
  ('catalog-state-001', 'american-football', 'State College Starter', 'A basic state-level college program. Free to all players.', 'STATE_COLLEGE', 0, 0, 22, 65, 72, 'PARK_FIELD', 5000, 0, 0, false, CURRENT_TIMESTAMP),
  -- Mid College (entry paid tier)
  ('catalog-mid-001', 'american-football', 'Mid-Level Conference', 'A competitive mid-major college program with solid recruiting.', 'MID_COLLEGE', 15000, 75, 22, 70, 78, 'COMMUNITY', 12000, 1, 0.55, true, CURRENT_TIMESTAMP),
  ('catalog-mid-002', 'american-football', 'Rising Program', 'An up-and-coming program with breakout potential.', 'MID_COLLEGE', 18000, 90, 22, 72, 80, 'COMMUNITY', 15000, 1, 0.55, true, CURRENT_TIMESTAMP),
  -- Top College (premium college tier)
  ('catalog-top-001', 'american-football', 'Top 10 Program', 'A prestigious top-10 caliber college football program.', 'TOP_COLLEGE', 50000, 250, 22, 78, 85, 'SMALL_STADIUM', 35000, 2, 0.60, true, CURRENT_TIMESTAMP),
  ('catalog-top-002', 'american-football', 'Blue Blood', 'One of the most storied programs in college football history.', 'TOP_COLLEGE', 75000, 375, 22, 80, 87, 'SMALL_STADIUM', 50000, 2, 0.65, true, CURRENT_TIMESTAMP),
  -- Regional Pro
  ('catalog-regional-001', 'american-football', 'Regional Pro Franchise', 'A professional franchise in a regional league.', 'REGIONAL_PRO', 200000, 1000, 22, 75, 82, 'REGIONAL', 25000, 1, 0.50, true, CURRENT_TIMESTAMP),
  ('catalog-regional-002', 'american-football', 'Regional Powerhouse', 'A dominant regional team with pro ambitions.', 'REGIONAL_PRO', 300000, 1500, 22, 78, 85, 'REGIONAL', 35000, 1, 0.55, true, CURRENT_TIMESTAMP),
  -- Pro Entry
  ('catalog-pro-001', 'american-football', 'Pro Expansion Team', 'A newly minted pro franchise. High potential, high price.', 'PRO_ENTRY', 1000000, 5000, 22, 80, 86, 'PRO', 65000, 2, 0.55, true, CURRENT_TIMESTAMP),
  ('catalog-pro-002', 'american-football', 'Pro Franchise', 'An established pro team with a loyal fanbase.', 'PRO_ENTRY', 1500000, 7500, 22, 82, 88, 'PRO', 80000, 2, 0.60, true, CURRENT_TIMESTAMP),
  -- Pro Elite (limited supply, high price to prevent flipping)
  ('catalog-elite-001', 'american-football', 'Elite Dynasty', 'A championship-caliber franchise with elite talent.', 'PRO_ELITE', 5000000, 25000, 22, 85, 92, 'ELITE', 100000, 3, 0.65, true, CURRENT_TIMESTAMP);

-- Update existing teams to have a tier
UPDATE "Team" SET "tier" = 'STATE_COLLEGE', "isFree" = true WHERE "purchasePrice" = 0;
