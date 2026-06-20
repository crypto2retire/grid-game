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
    'England', 'Spain', 'Brazil', 'Argentina', 'France', 'Germany', 'Italy', 'Portugal',
    'Netherlands', 'Belgium', 'Croatia', 'Uruguay', 'Colombia', 'Mexico', 'USA', 'Nigeria',
    'Senegal', 'Morocco', 'Japan', 'South Korea', 'Australia', 'Poland', 'Denmark', 'Sweden',
    'Norway', 'Switzerland', 'Austria', 'Turkey', 'Russia', 'Ukraine'
  ];

  // Rec league / beer league starting levels
  // Players start at local amateur level and progress through competitive tiers
  const positions = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
  
  // Tier system: Rec → Amateur → Semi-Pro → Pro → Elite → World Class
  const tiers = [
    { name: 'COMMON', weight: 0.50, min: 25, max: 40, label: 'Rec League' },
    { name: 'BRONZE', weight: 0.30, min: 32, max: 48, label: 'Local Amateur' },
    { name: 'SILVER', weight: 0.15, min: 40, max: 58, label: 'Semi-Pro' },
    { name: 'GOLD', weight: 0.04, min: 50, max: 68, label: 'Professional' },
    { name: 'ELITE', weight: 0.009, min: 60, max: 78, label: 'National Team' },
    { name: 'LEGEND', weight: 0.001, min: 70, max: 85, label: 'World Class' },
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

    const pace = randomInt(range.min, range.max);
    const shooting = position === 'GK' ? randomInt(15, 30) : randomInt(range.min, range.max);
    const passing = randomInt(range.min, range.max);
    const dribbling = randomInt(range.min, range.max);
    const defending = position === 'FWD' ? randomInt(15, 35) : randomInt(range.min, range.max);
    const physical = randomInt(range.min, range.max);
    const goalkeeping = position === 'GK' ? randomInt(range.min, range.max) : null;

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
