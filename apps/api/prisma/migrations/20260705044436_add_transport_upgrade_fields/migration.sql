-- Add transport upgrade/condition state columns to TransportationAsset
ALTER TABLE "TransportationAsset" ADD COLUMN "condition" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "TransportationAsset" ADD COLUMN "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "TransportationAsset" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "TransportationAsset" ADD COLUMN "upgradeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TransportationAsset" ADD COLUMN "maxUpgrade" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "TransportationAsset" ADD COLUMN "tripsTaken" INTEGER NOT NULL DEFAULT 0;
