-- Normalize treasury rows so currency is the unique lookup key.
-- Older code used deterministic ids like treasury-cash; this migration keeps those ids
-- where possible, merges accidental duplicates, and preserves transaction history.

UPDATE "GameTreasury"
SET "currency" = 'DYN'
WHERE "currency" = 'GRID';

WITH canonical AS (
  SELECT
    "currency",
    MIN("id") AS keep_id,
    SUM("balance") AS balance,
    SUM("totalInflows") AS total_inflows,
    SUM("totalOutflows") AS total_outflows,
    SUM("totalBurned") AS total_burned
  FROM "GameTreasury"
  GROUP BY "currency"
  HAVING COUNT(*) > 1
), duplicates AS (
  SELECT gt."id", c.keep_id
  FROM "GameTreasury" gt
  JOIN canonical c ON c."currency" = gt."currency"
  WHERE gt."id" <> c.keep_id
)
UPDATE "TreasuryTransaction" tt
SET "treasuryId" = d.keep_id
FROM duplicates d
WHERE tt."treasuryId" = d."id";

WITH canonical AS (
  SELECT
    "currency",
    MIN("id") AS keep_id,
    SUM("balance") AS balance,
    SUM("totalInflows") AS total_inflows,
    SUM("totalOutflows") AS total_outflows,
    SUM("totalBurned") AS total_burned
  FROM "GameTreasury"
  GROUP BY "currency"
  HAVING COUNT(*) > 1
)
UPDATE "GameTreasury" gt
SET
  "balance" = c.balance,
  "totalInflows" = c.total_inflows,
  "totalOutflows" = c.total_outflows,
  "totalBurned" = c.total_burned
FROM canonical c
WHERE gt."id" = c.keep_id;

WITH canonical AS (
  SELECT "currency", MIN("id") AS keep_id
  FROM "GameTreasury"
  GROUP BY "currency"
  HAVING COUNT(*) > 1
), duplicates AS (
  SELECT gt."id"
  FROM "GameTreasury" gt
  JOIN canonical c ON c."currency" = gt."currency"
  WHERE gt."id" <> c.keep_id
)
DELETE FROM "GameTreasury" gt
USING duplicates d
WHERE gt."id" = d."id";

CREATE UNIQUE INDEX IF NOT EXISTS "GameTreasury_currency_key" ON "GameTreasury"("currency");
