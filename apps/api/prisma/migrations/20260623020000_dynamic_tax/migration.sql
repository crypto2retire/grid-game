-- Add daysHeld to TeamMarketplaceListing
ALTER TABLE "TeamMarketplaceListing" ADD COLUMN "daysHeld" INTEGER NOT NULL DEFAULT 0;
