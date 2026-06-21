import { prisma } from '../../config/database';

const firstNames = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Kenneth', 'Joshua',
  'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob',
  'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin',
  'Samuel', 'Gregory', 'Frank', 'Alexander', 'Raymond', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler',
  'Aaron', 'Jose', 'Adam', 'Nathan', 'Henry', 'Zachary', 'Douglas', 'Peter', 'Kyle', 'Noah',
  'Ethan', 'Jeremy', 'Walter', 'Christian', 'Keith', 'Roger', 'Terry', 'Austin', 'Sean', 'Gerald',
  'Carl', 'Dylan', 'Harold', 'Jordan', 'Juan', 'Bryan', 'Lawrence', 'Arthur', 'Gabriel', 'Bruce',
  'Logan', 'Albert', 'Willie', 'Alan', 'Wayne', 'Elijah', 'Randy', 'Vincent', 'Mason',
  'Roy', 'Ralph', 'Bobby', 'Russell', 'Philip', 'Eugene', 'Mary', 'Patricia', 'Jennifer', 'Linda'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
  'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'
];

const nationalities = [
  'USA', 'Canada', 'Mexico', 'Germany', 'United Kingdom', 'France', 'Japan', 'Australia',
  'Brazil', 'Nigeria', 'Ghana', 'Samoa', 'Tonga', 'Jamaica', 'Puerto Rico', 'Dominican Republic',
  'Ireland', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Poland',
  'Austria', 'Switzerland', 'South Korea', 'Philippines', 'New Zealand', 'South Africa'
];

const footballPositions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S', 'K'];

const tiers = [
  { name: 'COMMON', weight: 0.50, min: 25, max: 40, label: 'Rec League' },
  { name: 'BRONZE', weight: 0.30, min: 32, max: 48, label: 'Local Amateur' },
  { name: 'SILVER', weight: 0.15, min: 40, max: 58, label: 'Semi-Pro' },
  { name: 'GOLD', weight: 0.04, min: 50, max: 68, label: 'Professional' },
  { name: 'ELITE', weight: 0.009, min: 60, max: 78, label: 'All-State' },
  { name: 'LEGEND', weight: 0.001, min: 70, max: 85, label: 'Pro Prospect' },
] as const;

function getRarity(): string {
  const rand = Math.random();
  let cumulative = 0;
  for (const tier of tiers) {
    cumulative += tier.weight;
    if (rand <= cumulative) return tier.name;
  }
  return 'COMMON';
}

function getAttributeRange(rarity: string): { min: number; max: number } {
  const tier = tiers.find(t => t.name === rarity) || tiers[0];
  return { min: tier.min, max: tier.max };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface GeneratePlayerOptions {
  sportId?: string;
  position?: string;
}

export function generatePlayerData(options: GeneratePlayerOptions = {}) {
  const sportId = options.sportId || 'american-football';
  const position = options.position || footballPositions[randomInt(0, footballPositions.length - 1)];
  const rarity = getRarity();
  const range = getAttributeRange(rarity);

  const firstName = firstNames[randomInt(0, firstNames.length - 1)];
  const lastName = lastNames[randomInt(0, lastNames.length - 1)];

  // Position-aware stat generation (same logic as seed.js)
  const pace = ['RB', 'WR', 'CB', 'S'].includes(position)
    ? randomInt(range.min, range.max)
    : randomInt(Math.max(15, range.min - 8), range.max);

  const shooting = position === 'QB'
    ? randomInt(range.min, range.max)
    : ['RB', 'WR', 'TE', 'K'].includes(position)
    ? randomInt(Math.max(15, range.min - 5), range.max)
    : randomInt(15, Math.max(25, range.max - 15));

  const passing = ['QB', 'WR', 'TE', 'S'].includes(position)
    ? randomInt(range.min, range.max)
    : randomInt(Math.max(15, range.min - 6), range.max);

  const dribbling = ['RB', 'WR', 'CB'].includes(position)
    ? randomInt(range.min, range.max)
    : randomInt(Math.max(15, range.min - 8), range.max);

  const defending = ['DL', 'LB', 'CB', 'S'].includes(position)
    ? randomInt(range.min, range.max)
    : randomInt(15, Math.max(25, range.max - 12));

  const physical = ['OL', 'DL', 'TE', 'LB'].includes(position)
    ? randomInt(range.min, range.max)
    : randomInt(Math.max(15, range.min - 5), range.max);

  const goalkeeping = null;

  const overall = Math.round((pace + shooting + passing + dribbling + defending + physical) / 6);

  const attributes = {
    speed: pace,
    arm: shooting,
    footballIQ: passing,
    agility: dribbling,
    tackling: defending,
    strength: physical,
    blocking: ['OL', 'TE'].includes(position) ? physical : Math.round((physical + passing) / 2),
    catching: ['WR', 'TE', 'RB'].includes(position) ? shooting : Math.round((shooting + passing) / 2),
    coverage: ['CB', 'S', 'LB'].includes(position) ? defending : Math.round((defending + pace) / 2),
    legacy: { pace, shooting, passing, dribbling, defending, physical, goalkeeping: 0 },
  };

  return {
    name: `${firstName} ${lastName}`,
    sportId,
    position,
    nationality: nationalities[randomInt(0, nationalities.length - 1)],
    age: randomInt(18, 35),
    pace,
    shooting,
    passing,
    dribbling,
    defending,
    physical,
    goalkeeping,
    attributes,
    overall,
    rarity,
    form: 50,
    fatigue: 0,
    morale: 50,
    basePrice: overall * 100,
    demandMultiplier: 1.0,
  };
}

/**
 * Generate a new player and persist it to the database.
 * This is used to maintain the pool size after hires.
 */
export async function generateAndCreatePlayer(options: GeneratePlayerOptions = {}) {
  const data = generatePlayerData(options);
  return prisma.player.create({ data: data as any });
}

/**
 * Generate a replacement player inside a transaction context.
 * Pass the tx client (from prisma.$transaction) to use the same transaction.
 */
export async function generateAndCreatePlayerTx(tx: any, options: GeneratePlayerOptions = {}) {
  const data = generatePlayerData(options);
  return tx.player.create({ data: data as any });
}

/**
 * Maintain the pool size at target count.
 * Counts how many players have no team (free agents) and generates new ones if below target.
 */
export async function maintainPlayerPool(targetSize: number = 200) {
  const freeAgentCount = await prisma.player.count({
    where: {
      teamPlayers: {
        none: {},
      },
    },
  });

  const toCreate = targetSize - freeAgentCount;
  if (toCreate > 0) {
    const players = Array.from({ length: toCreate }, () => generatePlayerData());
    await prisma.player.createMany({ data: players as any });
    return toCreate;
  }
  return 0;
}
