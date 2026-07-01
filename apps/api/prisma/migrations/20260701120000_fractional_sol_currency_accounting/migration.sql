-- Allow SOL accounting to preserve fractional token amounts while keeping CASH/DYN integer-compatible.
ALTER TABLE "CurrencyLedger" ALTER COLUMN "amount" TYPE DOUBLE PRECISION USING "amount"::double precision;
ALTER TABLE "CurrencyLedger" ALTER COLUMN "balanceAfter" TYPE DOUBLE PRECISION USING "balanceAfter"::double precision;

ALTER TABLE "GameTreasury" ALTER COLUMN "balance" TYPE DOUBLE PRECISION USING "balance"::double precision;
ALTER TABLE "GameTreasury" ALTER COLUMN "totalInflows" TYPE DOUBLE PRECISION USING "totalInflows"::double precision;
ALTER TABLE "GameTreasury" ALTER COLUMN "totalOutflows" TYPE DOUBLE PRECISION USING "totalOutflows"::double precision;
ALTER TABLE "GameTreasury" ALTER COLUMN "totalBurned" TYPE DOUBLE PRECISION USING "totalBurned"::double precision;

ALTER TABLE "TreasuryTransaction" ALTER COLUMN "amount" TYPE DOUBLE PRECISION USING "amount"::double precision;
