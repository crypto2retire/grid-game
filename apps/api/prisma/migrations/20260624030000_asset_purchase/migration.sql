-- Add purchasePrice to Venue
ALTER TABLE "Venue" ADD COLUMN "purchasePrice" INTEGER;

-- Add ownerId and purchasePrice to TransportationAsset, make teamId nullable
ALTER TABLE "TransportationAsset" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "TransportationAsset" ADD COLUMN "purchasePrice" INTEGER;
ALTER TABLE "TransportationAsset" ALTER COLUMN "teamId" DROP NOT NULL;

-- Index new columns
CREATE INDEX "TransportationAsset_ownerId_idx" ON "TransportationAsset"("ownerId");
