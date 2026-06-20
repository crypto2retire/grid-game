-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "basePrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN "demandMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "Player" ADD COLUMN "lastSoldPrice" INTEGER;
ALTER TABLE "Player" ADD COLUMN "priceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "MarketplaceOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceOffer_listingId_idx" ON "MarketplaceOffer"("listingId");
CREATE INDEX "MarketplaceOffer_buyerId_idx" ON "MarketplaceOffer"("buyerId");
CREATE INDEX "MarketplaceOffer_status_idx" ON "MarketplaceOffer"("status");

-- AddForeignKey
ALTER TABLE "MarketplaceOffer" ADD CONSTRAINT "MarketplaceOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOffer" ADD CONSTRAINT "MarketplaceOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
