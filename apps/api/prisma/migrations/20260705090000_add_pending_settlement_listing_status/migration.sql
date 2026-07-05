-- Add an in-transaction claim state so marketplace purchases can atomically
-- reserve a listing before debiting wallets or transferring ownership.
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'PENDING_SETTLEMENT';
