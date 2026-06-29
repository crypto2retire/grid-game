import { PrismaClient } from '@prisma/client';

// Starter and upgradeable wearable items
const ITEMS = [
  // ─── Starter Items (given to new players) ───
  { id: 'item-helmet-starter', name: 'Practice Helmet', slot: 'helmet', rarity: 'common', tier: 1, statBoosts: { awareness: 1 }, durability: 80, baseCostCash: 0, baseCostGrid: 0, isStarter: true },
  { id: 'item-pads-starter', name: 'Practice Pads', slot: 'pads', rarity: 'common', tier: 1, statBoosts: { physical: 1 }, durability: 80, baseCostCash: 0, baseCostGrid: 0, isStarter: true },
  { id: 'item-gloves-starter', name: 'Practice Gloves', slot: 'gloves', rarity: 'common', tier: 1, statBoosts: { catching: 1 }, durability: 80, baseCostCash: 0, baseCostGrid: 0, isStarter: true },
  { id: 'item-shoes-starter', name: 'Practice Cleats', slot: 'shoes', rarity: 'common', tier: 1, statBoosts: { speed: 1 }, durability: 80, baseCostCash: 0, baseCostGrid: 0, isStarter: true },
  { id: 'item-accessory-starter', name: 'Wristband', slot: 'accessory', rarity: 'common', tier: 1, statBoosts: { morale: 2 }, durability: 100, baseCostCash: 0, baseCostGrid: 0, isStarter: true },

  // ─── Common Upgrades ───
  { id: 'item-helmet-common', name: 'Standard Helmet', slot: 'helmet', rarity: 'common', tier: 2, statBoosts: { awareness: 2 }, durability: 100, baseCostCash: 2500, baseCostGrid: 0, isStarter: false },
  { id: 'item-pads-common', name: 'Standard Pads', slot: 'pads', rarity: 'common', tier: 2, statBoosts: { physical: 2 }, durability: 100, baseCostCash: 2500, baseCostGrid: 0, isStarter: false },
  { id: 'item-gloves-common', name: 'Standard Gloves', slot: 'gloves', rarity: 'common', tier: 2, statBoosts: { catching: 2 }, durability: 100, baseCostCash: 2500, baseCostGrid: 0, isStarter: false },
  { id: 'item-shoes-common', name: 'Standard Cleats', slot: 'shoes', rarity: 'common', tier: 2, statBoosts: { speed: 2 }, durability: 100, baseCostCash: 2500, baseCostGrid: 0, isStarter: false },
  { id: 'item-accessory-common', name: 'Compression Sleeve', slot: 'accessory', rarity: 'common', tier: 2, statBoosts: { morale: 3, endurance: 1 }, durability: 100, baseCostCash: 2000, baseCostGrid: 0, isStarter: false },

  // ─── Rare Upgrades ───
  { id: 'item-helmet-rare', name: 'Impact Helmet', slot: 'helmet', rarity: 'rare', tier: 3, statBoosts: { awareness: 3, physical: 1 }, durability: 120, baseCostCash: 7500, baseCostGrid: 0, isStarter: false },
  { id: 'item-pads-rare', name: 'Impact Pads', slot: 'pads', rarity: 'rare', tier: 3, statBoosts: { physical: 3, speed: 1 }, durability: 120, baseCostCash: 7500, baseCostGrid: 0, isStarter: false },
  { id: 'item-gloves-rare', name: 'Grip Gloves', slot: 'gloves', rarity: 'rare', tier: 3, statBoosts: { catching: 3, awareness: 1 }, durability: 120, baseCostCash: 7500, baseCostGrid: 0, isStarter: false },
  { id: 'item-shoes-rare', name: 'Speed Cleats', slot: 'shoes', rarity: 'rare', tier: 3, statBoosts: { speed: 3, agility: 1 }, durability: 120, baseCostCash: 7500, baseCostGrid: 0, isStarter: false },
  { id: 'item-accessory-rare', name: 'Heart Rate Monitor', slot: 'accessory', rarity: 'rare', tier: 3, statBoosts: { endurance: 2, morale: 2 }, durability: 120, baseCostCash: 6000, baseCostGrid: 0, isStarter: false },

  // ─── Epic Upgrades ───
  { id: 'item-helmet-epic', name: 'Elite Visor Helmet', slot: 'helmet', rarity: 'epic', tier: 4, statBoosts: { awareness: 4, physical: 2, morale: 1 }, durability: 150, baseCostCash: 20000, baseCostGrid: 0, isStarter: false },
  { id: 'item-pads-epic', name: 'Elite Body Armor', slot: 'pads', rarity: 'epic', tier: 4, statBoosts: { physical: 4, speed: 1, endurance: 1 }, durability: 150, baseCostCash: 20000, baseCostGrid: 0, isStarter: false },
  { id: 'item-gloves-epic', name: 'Elite Receiver Gloves', slot: 'gloves', rarity: 'epic', tier: 4, statBoosts: { catching: 4, awareness: 2, agility: 1 }, durability: 150, baseCostCash: 20000, baseCostGrid: 0, isStarter: false },
  { id: 'item-shoes-epic', name: 'Elite Sprinter Cleats', slot: 'shoes', rarity: 'epic', tier: 4, statBoosts: { speed: 4, agility: 2, physical: 1 }, durability: 150, baseCostCash: 20000, baseCostGrid: 0, isStarter: false },
  { id: 'item-accessory-epic', name: 'GPS Tracker', slot: 'accessory', rarity: 'epic', tier: 4, statBoosts: { endurance: 3, awareness: 2, morale: 2 }, durability: 150, baseCostCash: 15000, baseCostGrid: 0, isStarter: false },

  // ─── Legendary Upgrades ───
  { id: 'item-helmet-legendary', name: 'Legendary Crown', slot: 'helmet', rarity: 'legendary', tier: 5, statBoosts: { awareness: 5, physical: 3, morale: 2, endurance: 1 }, durability: 200, baseCostCash: 50000, baseCostGrid: 50, isStarter: false },
  { id: 'item-pads-legendary', name: 'Legendary Armor', slot: 'pads', rarity: 'legendary', tier: 5, statBoosts: { physical: 5, speed: 2, endurance: 2, morale: 1 }, durability: 200, baseCostCash: 50000, baseCostGrid: 50, isStarter: false },
  { id: 'item-gloves-legendary', name: 'Legendary Hands', slot: 'gloves', rarity: 'legendary', tier: 5, statBoosts: { catching: 5, awareness: 3, agility: 2, speed: 1 }, durability: 200, baseCostCash: 50000, baseCostGrid: 50, isStarter: false },
  { id: 'item-shoes-legendary', name: 'Legendary Boots', slot: 'shoes', rarity: 'legendary', tier: 5, statBoosts: { speed: 5, agility: 3, physical: 1, awareness: 1 }, durability: 200, baseCostCash: 50000, baseCostGrid: 50, isStarter: false },
  { id: 'item-accessory-legendary', name: 'Championship Ring', slot: 'accessory', rarity: 'legendary', tier: 5, statBoosts: { morale: 5, awareness: 3, endurance: 2, speed: 1 }, durability: 200, baseCostCash: 40000, baseCostGrid: 40, isStarter: false },
];

export async function seedItems(prisma: PrismaClient) {
  const count = await prisma.item.count();
  if (count > 0) {
    console.log(`Items already seeded (${count}), skipping`);
    return;
  }

  console.log('Seeding items and market prices...');

  for (const item of ITEMS) {
    await prisma.item.create({ data: item });

    // Only add to market if it has a base cost (not starter items)
    if (!item.isStarter && item.baseCostCash > 0) {
      await prisma.marketItem.create({
        data: {
          itemId: item.id,
          marketPriceCash: item.baseCostCash,
          marketPriceGrid: item.baseCostGrid,
          isAvailable: true,
        },
      });
    }
  }

  console.log(`Seeded ${ITEMS.length} items`);
}

/**
 * Give starter equipment to all players on a team.
 * Call this after creating a new team or when onboarding new players.
 */
export async function giveStarterEquipment(prisma: PrismaClient, teamId: string) {
  const starterItems = await prisma.item.findMany({
    where: { isStarter: true, active: true },
  });

  if (starterItems.length === 0) {
    console.log('No starter items found, skipping starter equipment');
    return;
  }

  const teamPlayers = await prisma.teamPlayer.findMany({
    where: { teamId },
    select: { playerId: true },
  });

  for (const tp of teamPlayers) {
    for (const item of starterItems) {
      // Check if player already has this starter item
      const existing = await prisma.playerItem.findFirst({
        where: { playerId: tp.playerId, itemId: item.id },
      });
      if (existing) continue;

      await prisma.playerItem.create({
        data: {
          playerId: tp.playerId,
          itemId: item.id,
          equipped: true, // Starter items are auto-equipped
          durability: item.durability,
          acquiredFrom: 'STARTER',
        },
      });
    }
  }

  console.log(`Gave starter equipment to ${teamPlayers.length} players on team ${teamId}`);
}
