-- Robinhood Chain payment foundation.
-- CASH remains an internal game balance. DYN and USDG may be reconciled
-- against confirmed Robinhood Chain transactions.

ALTER TABLE "Wallet"
  ADD COLUMN IF NOT EXISTS "usdgBalance" NUMERIC(20, 6) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ChainWallet" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "chain" TEXT NOT NULL DEFAULT 'ROBINHOOD',
  "address" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "verifiedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ChainWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ChainWallet_userId_chain_key" UNIQUE ("userId", "chain"),
  CONSTRAINT "ChainWallet_chain_address_key" UNIQUE ("chain", "address")
);

CREATE INDEX IF NOT EXISTS "ChainWallet_userId_idx" ON "ChainWallet"("userId");
CREATE INDEX IF NOT EXISTS "ChainWallet_chain_address_idx" ON "ChainWallet"("chain", "address");

CREATE TABLE IF NOT EXISTS "ChainTransaction" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "chain" TEXT NOT NULL DEFAULT 'ROBINHOOD',
  "currency" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "txHash" TEXT NOT NULL,
  "logIndex" INTEGER NOT NULL DEFAULT 0,
  "amountAtomic" TEXT NOT NULL,
  "amountDisplay" NUMERIC(30, 8) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "confirmations" INTEGER NOT NULL DEFAULT 0,
  "blockNumber" BIGINT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "confirmedAt" TIMESTAMPTZ,
  CONSTRAINT "ChainTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ChainTransaction_txHash_logIndex_key" UNIQUE ("txHash", "logIndex")
);

CREATE INDEX IF NOT EXISTS "ChainTransaction_userId_createdAt_idx" ON "ChainTransaction"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ChainTransaction_status_createdAt_idx" ON "ChainTransaction"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ChainTransaction_chain_currency_idx" ON "ChainTransaction"("chain", "currency");
