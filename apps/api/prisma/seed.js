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

  const positions = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
  const rarities = ['COMMON', 'BRONZE', 'SILVER', 'GOLD', 'ELITE', 'LEGEND'];
  const rarityWeights = [0.6, 0.25, 0.10, 0.04, 0.009, 0.001];

  const getRarity = () => {
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < rarities.length; i++) {
      cumulative += rarityWeights[i];
      if (rand <= cumulative) return rarities[i];
    }
    return 'COMMON';
  };

  const getAttributeRange = (rarity) => {
    switch (rarity) {
      case 'COMMON': return { min: 40, max: 55 };
      case 'BRONZE': return { min: 50, max: 65 };
      case 'SILVER': return { min: 60, max: 75 };
      case 'GOLD': return { min: 70, max: 85 };
      case 'ELITE': return { min: 80, max: 92 };
      case 'LEGEND': return { min: 88, max: 99 };
      default: return { min: 40, max: 55 };
    }
  };

  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const players = [];
  for (let i = 0; i < 200; i++) {
    const firstName = firstNames[randomInt(0, firstNames.length - 1)];
    const lastName = lastNames[randomInt(0, lastNames.length - 1)];
    const rarity = getRarity();
    const range = getAttributeRange(rarity);
    const position = positions[i % positions.length];

    const pace = randomInt(range.min, range.max);
    const shooting = position === 'GK' ? randomInt(20, 40) : randomInt(range.min, range.max);
    const passing = randomInt(range.min, range.max);
    const dribbling = randomInt(range.min, range.max);
    const defending = position === 'FWD' ? randomInt(20, 50) : randomInt(range.min, range.max);
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
    });
  }

  await prisma.player.createMany({ data: players });

  console.log(`Created ${players.length} players`);
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
