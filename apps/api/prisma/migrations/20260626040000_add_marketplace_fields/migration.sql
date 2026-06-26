-- Add marketplace fields to Venue table
ALTER TABLE "Venue" ADD COLUMN "isForSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Venue" ADD COLUMN "salePrice" INTEGER;
ALTER TABLE "Venue" ADD COLUMN "saleCurrency" TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE "Venue" ADD COLUMN "saleListedAt" TIMESTAMP(3);

-- Add marketplace fields to TransportationAsset table
ALTER TABLE "TransportationAsset" ADD COLUMN "isForSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TransportationAsset" ADD COLUMN "salePrice" INTEGER;
ALTER TABLE "TransportationAsset" ADD COLUMN "saleCurrency" TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE "TransportationAsset" ADD COLUMN "saleListedAt" TIMESTAMP(3);

-- Create indexes for marketplace queries
CREATE INDEX "Venue_isForSale_idx" ON "Venue"("isForSale");
CREATE INDEX "TransportationAsset_isForSale_idx" ON "TransportationAsset"("isForSale");
