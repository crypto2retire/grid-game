-- Add solPrice to Venue, TransportationAsset, and Team
ALTER TABLE "Venue" ADD COLUMN "solPrice" DOUBLE PRECISION;
ALTER TABLE "TransportationAsset" ADD COLUMN "solPrice" DOUBLE PRECISION;
ALTER TABLE "Team" ADD COLUMN "solPrice" DOUBLE PRECISION;

-- Ensure SOL treasury exists (will be seeded in app)
-- The GameTreasury model already supports currency = 'SOL'
