const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding players...');

  const firstNames = [
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
    'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Kenneth', 'Joshua',
    'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob',
    'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin',
    'Samuel', 'Gregory', 'Frank', 'Alexander', 'Raymond', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler',
    'Aaron', 'Jose', 'Adam', 'Nathan', 'Henry', 'Zachary', 'Douglas', 'Peter', 'Kyle', 'Noah',
    'Ethan', 'Jeremy', 'Walter', 'Christian', 'Keith', 'Roger', 'Terry', 'Austin', 'Sean', 'Gerald',
    'Carl', 'Dylan', 'Harold', 'Jordan', 'Juan', 'Bryan', 'Lawrence', 'Arthur', 'Gabriel', 'Bruce',
    'Logan', 'Albert', 'Willie', 'Alan', 'Juan', 'Wayne', 'Elijah', 'Randy', 'Vincent', 'Mason',
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

  // Rec league / beer league American football starting levels
  // Players start at local flag/touch/beer-league level and progress through competitive tiers
  const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S', 'K'];
  
  // Tier system: Rec → Amateur → Semi-Pro → Pro → Elite → World Class
  const tiers = [
    { name: 'COMMON', weight: 0.50, min: 25, max: 40, label: 'Rec League' },
    { name: 'BRONZE', weight: 0.30, min: 32, max: 48, label: 'Local Amateur' },
    { name: 'SILVER', weight: 0.15, min: 40, max: 58, label: 'Semi-Pro' },
    { name: 'GOLD', weight: 0.04, min: 50, max: 68, label: 'Professional' },
    { name: 'ELITE', weight: 0.009, min: 60, max: 78, label: 'All-State' },
    { name: 'LEGEND', weight: 0.001, min: 70, max: 85, label: 'Pro Prospect' },
  ];

  const getRarity = () => {
    const rand = Math.random();
    let cumulative = 0;
    for (const tier of tiers) {
      cumulative += tier.weight;
      if (rand <= cumulative) return tier.name;
    }
    return 'COMMON';
  };

  const getAttributeRange = (rarity) => {
    const tier = tiers.find(t => t.name === rarity) || tiers[0];
    return { min: tier.min, max: tier.max };
  };

  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const players = [];
  for (let i = 0; i < 200; i++) {
    const firstName = firstNames[randomInt(0, firstNames.length - 1)];
    const lastName = lastNames[randomInt(0, lastNames.length - 1)];
    const rarity = getRarity();
    const range = getAttributeRange(rarity);
    const position = positions[i % positions.length];
    const tier = tiers.find(t => t.name === rarity) || tiers[0];

    // Existing DB stat columns are re-skinned for football:
    // pace = speed, shooting = arm/finishing, passing = vision/route IQ,
    // dribbling = agility, defending = tackling/coverage, physical = strength.
    const pace = ['RB', 'WR', 'CB', 'S'].includes(position) ? randomInt(range.min, range.max) : randomInt(Math.max(15, range.min - 8), range.max);
    const shooting = position === 'QB' ? randomInt(range.min, range.max) : ['RB', 'WR', 'TE', 'K'].includes(position) ? randomInt(Math.max(15, range.min - 5), range.max) : randomInt(15, Math.max(25, range.max - 15));
    const passing = ['QB', 'WR', 'TE', 'S'].includes(position) ? randomInt(range.min, range.max) : randomInt(Math.max(15, range.min - 6), range.max);
    const dribbling = ['RB', 'WR', 'CB'].includes(position) ? randomInt(range.min, range.max) : randomInt(Math.max(15, range.min - 8), range.max);
    const defending = ['DL', 'LB', 'CB', 'S'].includes(position) ? randomInt(range.min, range.max) : randomInt(15, Math.max(25, range.max - 12));
    const physical = ['OL', 'DL', 'TE', 'LB'].includes(position) ? randomInt(range.min, range.max) : randomInt(Math.max(15, range.min - 5), range.max);
    const goalkeeping = null;

    const overall = Math.round((pace + shooting + passing + dribbling + defending + physical) / 6);

    players.push({
      name: `${firstName} ${lastName}`,
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
      overall,
      rarity,
      basePrice: overall * 100,
      demandMultiplier: 1.0,
    });
  }

  // Clear existing players and recreate with new rec-league stats
  await prisma.player.deleteMany({});
  await prisma.player.createMany({ data: players });

  console.log(`Created ${players.length} players`);
  console.log('Tier distribution:');
  for (const tier of tiers) {
    const count = players.filter(p => p.rarity === tier.name).length;
    console.log(`  ${tier.name} (${tier.label}): ${count} players`);
  }
  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
