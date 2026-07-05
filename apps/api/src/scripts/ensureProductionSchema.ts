import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureColumn(sql: string) {
  await prisma.$executeRawUnsafe(sql);
}

async function main() {
  // Defensive repair for Render databases where Prisma migration history says a
  // migration was applied but one or more additive columns are missing. These
  // statements are idempotent and only add nullable/defaulted columns used by
  // the live Team Garage / world-map queries.
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "condition" INTEGER NOT NULL DEFAULT 70');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 12');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "upgradeCount" INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "maxUpgrade" INTEGER NOT NULL DEFAULT 5');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "tripsTaken" INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "isForSale" BOOLEAN NOT NULL DEFAULT false');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "salePrice" INTEGER');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "saleCurrency" TEXT NOT NULL DEFAULT \'CASH\'');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "saleListedAt" TIMESTAMP(3)');
  await ensureColumn('ALTER TABLE "TransportationAsset" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT \'{}\'');

  await ensureColumn('ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "leaseRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10');
  await ensureColumn('ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "isForSale" BOOLEAN NOT NULL DEFAULT false');
  await ensureColumn('ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "salePrice" INTEGER');
  await ensureColumn('ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "saleCurrency" TEXT NOT NULL DEFAULT \'CASH\'');
  await ensureColumn('ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "saleListedAt" TIMESTAMP(3)');
  await ensureColumn('ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT \'{}\'');

  console.log('Production schema additive column check complete');
}

main()
  .catch((error) => {
    console.error('Production schema additive column check failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
