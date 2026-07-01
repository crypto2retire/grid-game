-- Add token-holding luck system fields to Wallet
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "lifetimeDynEarned" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "lifetimeDynPurchased" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "lifetimeDynSold" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "luckScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "luckTier" TEXT NOT NULL DEFAULT 'NONE';

-- Index for leaderboards/lookup by luck score
CREATE INDEX IF NOT EXISTS "Wallet_luckScore_idx" ON "Wallet"("luckScore" DESC);
