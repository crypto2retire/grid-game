-- Token Revenue Tracking Tables
CREATE TABLE "TokenRevenue" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "usdValue" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "feePct" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRevenue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenPriceHistory" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "marketCap" DOUBLE PRECISION,
    "volume24h" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'pumpfun',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenTreasury" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMinted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBurned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFeesEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenTreasury_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "TokenRevenue_source_createdAt_idx" ON "TokenRevenue"("source", "createdAt");
CREATE INDEX "TokenRevenue_currency_createdAt_idx" ON "TokenRevenue"("currency", "createdAt");
CREATE INDEX "TokenPriceHistory_token_recordedAt_idx" ON "TokenPriceHistory"("token", "recordedAt");
CREATE UNIQUE INDEX "TokenTreasury_token_key" ON "TokenTreasury"("token");
