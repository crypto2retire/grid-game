-- Rename gridTokens column to dynTokens in Wallet table
ALTER TABLE "Wallet" RENAME COLUMN "gridTokens" TO "dynTokens";
