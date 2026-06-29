-- CreateTable Item
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "statBoosts" JSONB NOT NULL DEFAULT '{}',
    "durability" INTEGER NOT NULL DEFAULT 100,
    "baseCostCash" INTEGER NOT NULL DEFAULT 0,
    "baseCostGrid" INTEGER NOT NULL DEFAULT 0,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Item
CREATE INDEX "Item_slot_idx" ON "Item"("slot");
CREATE INDEX "Item_rarity_idx" ON "Item"("rarity");
CREATE INDEX "Item_tier_idx" ON "Item"("tier");
CREATE INDEX "Item_active_idx" ON "Item"("active");

-- CreateTable PlayerItem
CREATE TABLE "PlayerItem" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "durability" INTEGER NOT NULL DEFAULT 100,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acquiredFrom" TEXT NOT NULL DEFAULT 'STARTER',

    CONSTRAINT "PlayerItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex PlayerItem
CREATE INDEX "PlayerItem_playerId_idx" ON "PlayerItem"("playerId");
CREATE INDEX "PlayerItem_itemId_idx" ON "PlayerItem"("itemId");
CREATE INDEX "PlayerItem_equipped_idx" ON "PlayerItem"("equipped");

-- AddForeignKey PlayerItem -> Player
ALTER TABLE "PlayerItem" ADD CONSTRAINT "PlayerItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey PlayerItem -> Item
ALTER TABLE "PlayerItem" ADD CONSTRAINT "PlayerItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable MarketItem
CREATE TABLE "MarketItem" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "marketPriceCash" INTEGER NOT NULL,
    "marketPriceGrid" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastMarketplacePrice" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex MarketItem
CREATE UNIQUE INDEX "MarketItem_itemId_key" ON "MarketItem"("itemId");

-- AddForeignKey MarketItem -> Item
ALTER TABLE "MarketItem" ADD CONSTRAINT "MarketItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ItemSaleHistory
CREATE TABLE "ItemSaleHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CASH',
    "sellerId" TEXT,
    "buyerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemSaleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex ItemSaleHistory
CREATE INDEX "ItemSaleHistory_itemId_idx" ON "ItemSaleHistory"("itemId");
CREATE INDEX "ItemSaleHistory_createdAt_idx" ON "ItemSaleHistory"("createdAt");

-- AddForeignKey ItemSaleHistory -> Item
ALTER TABLE "ItemSaleHistory" ADD CONSTRAINT "ItemSaleHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable MarketplaceItemListing
CREATE TABLE "MarketplaceItemListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "playerItemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceItemListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex MarketplaceItemListing
CREATE INDEX "MarketplaceItemListing_status_idx" ON "MarketplaceItemListing"("status");
CREATE INDEX "MarketplaceItemListing_sellerId_idx" ON "MarketplaceItemListing"("sellerId");
CREATE INDEX "MarketplaceItemListing_playerItemId_idx" ON "MarketplaceItemListing"("playerItemId");

-- AddForeignKey MarketplaceItemListing -> User
ALTER TABLE "MarketplaceItemListing" ADD CONSTRAINT "MarketplaceItemListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey MarketplaceItemListing -> PlayerItem
ALTER TABLE "MarketplaceItemListing" ADD CONSTRAINT "MarketplaceItemListing_playerItemId_fkey" FOREIGN KEY ("playerItemId") REFERENCES "PlayerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
