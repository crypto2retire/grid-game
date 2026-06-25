import { prisma } from '../../config/database';
import { processTreasuryInflow, processBurn } from '../treasury/treasury.service';
import { env } from '../../config/env';
import { generateAndCreatePlayerTx } from '../players/player.generator';

// ─── Mega Simulation V2 ───

interface SimUser {
  id: string; username: string; email: string; displayName: string;
  activityLevel: 'whale' | 'active' | 'casual' | 'inactive';
  walletId: string; joinSeason: number; churnSeason: number | null;
  seasonActivity: number[];
}

interface SimTeam {
  id: string; ownerId: string; name: string; tier: string; sportId: string;
  players: SimPlayer[]; venue: SimVenue | null; transport: SimTransport | null;
  sponsorships: SimSponsor[]; equipment: string[];
  formation: string; style: string; pressing: string; mentality: string;
  wins: number; draws: number; losses: number; points: number;
  goalsFor: number; goalsAgainst: number;
  purchasedAt: Date; purchasePrice: number; purchaseCurrency: string; isAI: boolean;
  prestige: number;
}

interface SimPlayer {
  id: string; name: string; position: string; overall: number; age: number;
  health: number; injuryStatus: string | null; injuryType: string | null; injuryWeeks: number;
  form: number; fatigue: number; morale: number; rarity: string;
  pace: number; shooting: number; passing: number; dribbling: number;
  defending: number; physical: number; goalkeeping: number;
  basePrice: number; isStarter: boolean;
}

interface SimVenue {
  id: string; teamId: string; ownerId: string; name: string; tier: string;
  capacity: number; ticketPrice: number; condition: number; prestige: number;
  leaseRate: number; purchasePrice: number; solPrice: number;
  operatingCost: number;
}

interface SimTransport {
  id: string; teamId: string; ownerId: string; tier: string; name: string;
  operatingCost: number; fatigueReduction: number; prestige: number;
  purchasePrice: number; solPrice: number;
}

interface SimSponsor { id: string; name: string; amountPerGame: number; amountPerSeason: number; active: boolean; }

interface PumpFunState {
  tokenAddress: string | null; tokenSymbol: string;
  currentPrice: number; marketCap: number; volume24h: number;
  totalFeesEarned: number; totalVolume: number; liquidityDepth: number;
  priceHistory: Array<{ season: number; week: number; price: number; volume: number; fees: number; activeUsers: number; marketPhase: string; timestamp: Date }>;
  regime: 'accumulation' | 'markup' | 'distribution' | 'markdown';
  regimeWeeks: number; avgPrice: number; allTimeHigh: number; allTimeLow: number;
}

interface FeeTracker {
  trainingGridToTreasury: number; trainingGridBurned: number; trainingCashToTreasury: number;
  equipmentGridToTreasury: number; equipmentCashToTreasury: number;
  teamMarketplaceTax: number; teamMarketplaceBurn: number;
  playerMarketplaceTax: number; playerMarketplaceVolume: number;
  venueLeaseFees: number; gameEntryFees: number; ticketRevenue: number;
  concessionsRevenue: number; merchRevenue: number; sponsorRevenue: number; leagueRewards: number;
  solPurchases: number; solTreasuryInflow: number; pumpfunFees: number; stakingRewards: number;
  gridExchangeFees: number; weeklyOperatingCosts: number; playerWages: number;
  venueMaintenance: number; transportOperating: number; playerRecovery: number; leagueDues: number;
}

interface SeasonMetrics {
  seasonNumber: number; activeUsers: number; totalUsers: number; newUsers: number; churnedUsers: number;
  matchesPlayed: number; homeWins: number; awayWins: number; draws: number;
  avgHomeScore: number; avgAwayScore: number; trainingSessions: number;
  trainingGridSpent: number; trainingCashSpent: number;
  equipmentPurchases: number; equipmentGridSpent: number; equipmentCashSpent: number;
  playerListings: number; playerSales: number; playerMarketplaceVolume: number;
  teamListings: number; teamSales: number; teamMarketplaceVolume: number;
  venuePurchases: number; venueSolPurchases: number;
  transportPurchases: number; transportSolPurchases: number;
  gridExchanges: number; gridExchanged: number;
  stakingEvents: number; stakedAmount: number; stakingRewards: number;
  injuries: number; retirements: number; promotions: number; demotions: number;
  weeklyCostsProcessed: number;
  totalCashSpent: number; totalGridSpent: number; totalSolSpent: number;
  treasuryInflow: number; solTreasuryInflow: number;
  pumpfunPrice: number; pumpfunVolume: number; pumpfunFees: number; pumpfunMarketCap: number; pumpfunRegime: string;
  sponsorRevenue: number;
  issues: string[];
}

interface MegaSimV2Result {
  usersCreated: number; teamsCreated: number; aiTeamsCreated: number; totalPlayers: number;
  seasons: SeasonMetrics[];
  finalStandings: Array<{ teamId: string; teamName: string; tier: string; owner: string; wins: number; draws: number; losses: number; points: number; goalsFor: number; goalsAgainst: number; netRevenue: number }>;
  topPlayers: Array<{ playerId: string; playerName: string; teamName: string; position: string; age: number; overall: number; mvpScore: number; ratingAverage: number }>;
  feeTracker: FeeTracker;
  pumpfunSummary: { startingPrice: number; finalPrice: number; allTimeHigh: number; allTimeLow: number; totalVolume: number; totalFees: number; finalMarketCap: number; priceHistory: PumpFunState['priceHistory']; regimeTransitions: Array<{ season: number; week: number; from: string; to: string }> };
  marketplaceSummary: { totalPlayerListings: number; totalPlayerSales: number; totalPlayerVolume: number; totalTeamListings: number; totalTeamSales: number; totalTeamVolume: number; totalVenuePurchases: number; totalTransportPurchases: number; totalSolSpent: number; totalCashSpent: number; totalGridSpent: number };
  economicSummary: { totalTicketRevenue: number; totalVenueLeaseFees: number; totalGameEntryFees: number; totalConcessions: number; totalMerchandise: number; totalSponsorRevenue: number; totalLeagueRewards: number; totalWeeklyCosts: number; totalPlayerWages: number; totalVenueMaintenance: number; totalTransportOp: number; totalPlayerRecovery: number; totalLeagueDues: number; totalTreasuryInflow: number; totalBurned: number; totalSolRevenue: number; totalGameOwnerRevenue: number; netTreasuryChange: number; avgRevenuePerHomeGame: number; avgRevenuePerAwayGame: number };
  issues: string[]; duration: number;
}

interface SimRunState {
  users: SimUser[];
  allTeams: SimTeam[];
  feeTracker: FeeTracker;
  pumpFunState: PumpFunState;
  seasons: SeasonMetrics[];
  regimeTransitions: Array<{ season: number; week: number; from: string; to: string }>;
  aiOwnerId: string;
  trainingPackages: any[];
  equipmentTypes: any[];
  seasonCount: number;
  startTime: number;
  issues: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SIM_CONFIG = {
  userCount: 250, seasonCount: 5, weeksPerSeason: 52,
  retirementAge: 38, rookieAge: 18, maxInjuryWeeks: 8, injuryBaseRate: 0.03,
  churnRate: 0.08, newUserGrowth: 0.15,
  pumpfunBaseVolatility: 0.35, pumpfunVolatilityDecay: 0.92, pumpfunActivityCorrelation: 0.4,
  pumpfunCreatorShare: env.PUMPFUN_CREATOR_SHARE_PCT || 0.5, pumpfunTradingFee: env.PUMPFUN_TRADING_FEE_PCT || 0.01,
  tokenSymbol: env.PUMPFUN_TOKEN_SYMBOL || 'GRID', tokenSupply: 1_000_000_000, initialLiquidity: 5000,
  gridExchangeRate: 1000,
};

interface ActivityConfigEntry {
  weight: number;
  gamesPerWeek: { min: number; max: number };
  trainingPerWeek: { min: number; max: number };
  marketChance: number;
  upgradeChance: number;
  stakeChance: number;
  exchangeChance: number;
  equipmentChance: number;
  teamCount: { min: number; max: number };
  walletCash: { min: number; max: number };
  walletGrid: { min: number; max: number };
  walletSol: { min: number; max: number };
  tiers: string[];
}

const ACTIVITY_CONFIG: Record<'whale' | 'active' | 'casual' | 'inactive', ActivityConfigEntry> = {
  whale: { weight: 0.05, gamesPerWeek: { min: 2, max: 4 }, trainingPerWeek: { min: 1, max: 3 }, marketChance: 0.35, upgradeChance: 0.25, stakeChance: 0.2, exchangeChance: 0.15, equipmentChance: 0.2, teamCount: { min: 2, max: 4 }, walletCash: { min: 50000, max: 250000 }, walletGrid: { min: 50000, max: 250000 }, walletSol: { min: 5, max: 50 }, tiers: ['PRO_ENTRY', 'PRO_ELITE', 'PRO_ELITE'] },
  active: { weight: 0.20, gamesPerWeek: { min: 1, max: 3 }, trainingPerWeek: { min: 0, max: 2 }, marketChance: 0.18, upgradeChance: 0.12, stakeChance: 0.1, exchangeChance: 0.08, equipmentChance: 0.1, teamCount: { min: 1, max: 2 }, walletCash: { min: 15000, max: 50000 }, walletGrid: { min: 15000, max: 50000 }, walletSol: { min: 1, max: 10 }, tiers: ['TOP_COLLEGE', 'REGIONAL_PRO', 'PRO_ENTRY'] },
  casual: { weight: 0.45, gamesPerWeek: { min: 0, max: 2 }, trainingPerWeek: { min: 0, max: 1 }, marketChance: 0.06, upgradeChance: 0.04, stakeChance: 0.03, exchangeChance: 0.03, equipmentChance: 0.03, teamCount: { min: 1, max: 1 }, walletCash: { min: 5000, max: 15000 }, walletGrid: { min: 3000, max: 10000 }, walletSol: { min: 0.5, max: 3 }, tiers: ['STATE_COLLEGE', 'MID_COLLEGE', 'TOP_COLLEGE'] },
  inactive: { weight: 0.30, gamesPerWeek: { min: 0, max: 1 }, trainingPerWeek: { min: 0, max: 0 }, marketChance: 0.01, upgradeChance: 0.005, stakeChance: 0.0, exchangeChance: 0.01, equipmentChance: 0.005, teamCount: { min: 1, max: 1 }, walletCash: { min: 1000, max: 5000 }, walletGrid: { min: 500, max: 3000 }, walletSol: { min: 0.1, max: 1 }, tiers: ['STATE_COLLEGE', 'STATE_COLLEGE', 'MID_COLLEGE'] },
};

const SEASON_PHASES = [
  { weeks: [1,2,3,4], name: 'pre-season', activityMult: 0.7, trainingMult: 1.5, marketMult: 1.3 },
  { weeks: [5,6,7,8,9,10,11,12], name: 'early-season', activityMult: 1.0, trainingMult: 1.0, marketMult: 1.0 },
  { weeks: [13,14,15,16,17,18,19,20,21,22,23,24], name: 'mid-season', activityMult: 1.1, trainingMult: 0.9, marketMult: 1.1 },
  { weeks: [25,26,27,28,29,30,31,32,33,34,35,36], name: 'peak-season', activityMult: 1.2, trainingMult: 0.8, marketMult: 1.2 },
  { weeks: [37,38,39,40,41,42,43,44], name: 'late-season', activityMult: 1.0, trainingMult: 0.7, marketMult: 1.0 },
  { weeks: [45,46,47,48], name: 'playoffs', activityMult: 1.4, trainingMult: 0.5, marketMult: 1.5 },
  { weeks: [49,50,51,52], name: 'off-season', activityMult: 0.4, trainingMult: 0.3, marketMult: 0.6 },
];

const SPONSOR_NAMES = ['Nike','Adidas','Under Armour','Puma','New Balance','Gatorade','Powerade','Red Bull','Monster Energy','Rockstar','Bud Light','Coors Light','Miller Lite','Michelob Ultra','State Farm','Geico','Progressive','Allstate','Farmers','Verizon','AT&T','T-Mobile','Comcast','Spectrum','Amazon','Walmart','Target','Costco','Sams Club','Ford','Chevy','Toyota','Honda','BMW','Pepsi','Coca-Cola','Dr Pepper','Mountain Dew','Sprite','Chick-fil-A','McDonalds','Burger King','Wendys','Taco Bell','DraftKings','FanDuel','BetMGM','Caesars','PointsBet'];

function randomPick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min: number, max: number): number { return Math.random() * (max - min) + min; }
function clamp(val: number, min: number, max: number): number { return Math.max(min, Math.min(max, val)); }
function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random(); const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * stdDev;
}

function pickActivityLevel(): 'whale' | 'active' | 'casual' | 'inactive' {
  const rand = Math.random(); let cumulative = 0;
  for (const [level, cfg] of Object.entries(ACTIVITY_CONFIG) as [string, any][]) { cumulative += cfg.weight; if (rand <= cumulative) return level as any; }
  return 'casual';
}

function getSeasonPhase(week: number): typeof SEASON_PHASES[0] {
  for (const phase of SEASON_PHASES) { if (phase.weeks.includes(week)) return phase; }
  return SEASON_PHASES[SEASON_PHASES.length - 1];
}

const firstNames = ['James','John','Robert','Michael','William','David','Richard','Joseph','Thomas','Charles','Daniel','Matthew','Anthony','Mark','Donald','Steven','Paul','Andrew','Kenneth','Joshua','Kevin','Brian','George','Timothy','Ronald','Jason','Edward','Jeffrey','Ryan','Jacob','Gary','Nicholas','Eric','Jonathan','Stephen','Larry','Justin','Scott','Brandon','Benjamin','Samuel','Gregory','Frank','Alexander','Raymond','Patrick','Jack','Dennis','Jerry','Tyler','Aaron','Jose','Adam','Nathan','Henry','Zachary','Douglas','Peter','Kyle','Noah','Ethan','Jeremy','Walter','Christian','Keith','Roger','Terry','Austin','Sean','Gerald','Carl','Dylan','Harold','Jordan','Juan','Bryan','Lawrence','Arthur','Gabriel','Bruce','Logan','Albert','Willie','Alan','Wayne','Elijah','Randy','Vincent','Mason','Roy','Ralph','Bobby','Russell','Philip','Eugene','Mary','Patricia','Jennifer','Linda','Elizabeth','Susan','Jessica','Sarah','Karen','Nancy','Lisa','Betty','Margaret','Sandra','Ashley','Kimberly','Emily','Donna','Michelle','Dorothy','Carol','Amanda','Melissa','Deborah','Stephanie','Rebecca','Laura','Sharon','Cynthia','Kathleen','Amy','Shirley','Angela','Helen','Anna','Brenda','Pamela','Nicole','Samantha','Katherine','Emma','Ruth','Christine','Catherine','Debra','Rachel','Carolyn','Janet','Emma','Virginia','Maria','Heather','Diane','Frances','Joyce','Julie','Olivia','Martha','Evelyn','Kelly','Christina','Lauren','Joan','Victoria','Amber','Megan','Doris','Abigail','Kathryn','Jean','Alice','Ann','Hannah','Sara','Julia','Grace','Judith','Sophia','Marie','Theresa','Beverly','Denise','Marilyn','Amber','Danielle','Brittany','Madison','Diana','Kayla','Jane','Lori','Tiffany'];
const lastNames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes','Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson','Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes','Price','Alvarez','Castillo','Sanders','Patel','Myers','Long','Ross','Foster','Jimenez','Powell','Jenkins','Perry','Russell','Sullivan','Bell','Coleman','Butler','Henderson','Barnes','Gonzales','Fisher','Vasquez','Simpson','Murray','Ford','Marshall','Owens','Mcdonald','Harrison','Ruiz','Kennedy','Wells','Alvarez','Woods','Mendoza','Castillo','Olson','Webb','Washington','Tucker','Freeman','Burns','Henry','Vasquez','Snyder','Simpson','Crawford','Jimenez','Porter','Mason','Shaw','Gordon','Wagner','Hunter','Romero','Hicks','Dixon','Hunt','Palmer','Mills','Nichols','Grant','Knight','Ferguson','Rose','Stone','Hawkins','Dunn','Perkins','Hudson','Spencer','Gardner','Payne','Wagner','Alexander','Stevens','Berry','Watkins','Oliver','Jenkins','Ellis','Matthews','Holmes','Murphy','Adams','Richardson','Wood','Stevens','Tucker','Coleman','Hayes','Watkins','Mills','Nicholson','Underwood','Crawford','Benson','Sharp','Mcdonald','Parker','Morrison','Holland','Tate','Cross','Harper','Moss','Baldwin','Reeves','Klein','Dean','Burgess','Walsh','Snow','Summers','Vaughn','Sutton','Little','Black','Fleming','Rhodes','Gibson','Holt','Maxwell','Powers','Garrison','Mack','Leach','Mccarthy'];

function generateUsername(): string { return randomPick(firstNames).toLowerCase() + randomPick(lastNames).toLowerCase() + randomInt(1, 999); }
function generateTeamName(userDisplayName: string): string { return userDisplayName.split(' ')[0] + ' ' + randomPick(['FC','United','Town','City','Rovers','Wanderers','Athletic','Rangers','Titans','Bulldogs','Eagles','Warriors','Knights','Storm','Thunder','Lightning','Dragons','Wolves','Bears','Lions']); }

async function ensureTrainingPackages(): Promise<any[]> {
  const existing = await prisma.trainingPackage.findMany({ where: { active: true } });
  if (existing.length > 0) return existing;
  const packages = [
    { id: 'tp-offense-bronze', name: 'Bronze Offense Camp', description: 'Basic offensive training', focusType: 'OFFENSE', targetPosition: null, durationDays: 3, costGrid: 500, costCash: 1000, statBoosts: { pace: 2, shooting: 2, passing: 1, dribbling: 2 }, maxUsesPerPlayer: 3, cooldownHours: 24, active: true },
    { id: 'tp-defense-bronze', name: 'Bronze Defense Camp', description: 'Basic defensive training', focusType: 'DEFENSE', targetPosition: null, durationDays: 3, costGrid: 500, costCash: 1000, statBoosts: { defending: 3, physical: 2, pace: 1 }, maxUsesPerPlayer: 3, cooldownHours: 24, active: true },
    { id: 'tp-qb-silver', name: 'Silver QB Academy', description: 'Quarterback-focused training', focusType: 'POSITION_GROUP', targetPosition: 'QB', durationDays: 5, costGrid: 1500, costCash: 3000, statBoosts: { passing: 4, shooting: 2, dribbling: 1 }, maxUsesPerPlayer: 2, cooldownHours: 48, active: true },
    { id: 'tp-wr-silver', name: 'Silver WR Camp', description: 'Wide receiver training', focusType: 'POSITION_GROUP', targetPosition: 'WR', durationDays: 5, costGrid: 1500, costCash: 3000, statBoosts: { pace: 3, shooting: 3, dribbling: 2 }, maxUsesPerPlayer: 2, cooldownHours: 48, active: true },
    { id: 'tp-rb-silver', name: 'Silver RB Camp', description: 'Running back training', focusType: 'POSITION_GROUP', targetPosition: 'RB', durationDays: 5, costGrid: 1500, costCash: 3000, statBoosts: { pace: 3, physical: 3, dribbling: 2 }, maxUsesPerPlayer: 2, cooldownHours: 48, active: true },
    { id: 'tp-lb-silver', name: 'Silver LB Camp', description: 'Linebacker training', focusType: 'POSITION_GROUP', targetPosition: 'LB', durationDays: 5, costGrid: 1500, costCash: 3000, statBoosts: { defending: 4, physical: 2, pace: 1 }, maxUsesPerPlayer: 2, cooldownHours: 48, active: true },
    { id: 'tp-all-gold', name: 'Gold All-Around Camp', description: 'Elite comprehensive training', focusType: 'ALL', targetPosition: null, durationDays: 7, costGrid: 5000, costCash: 10000, statBoosts: { pace: 2, shooting: 2, passing: 2, dribbling: 2, defending: 2, physical: 2 }, maxUsesPerPlayer: 1, cooldownHours: 72, active: true },
    { id: 'tp-individual-gold', name: 'Gold Individual Elite', description: 'Personal 1-on-1 coaching (2x boost)', focusType: 'INDIVIDUAL', targetPosition: null, durationDays: 7, costGrid: 8000, costCash: 15000, statBoosts: { pace: 3, shooting: 3, passing: 3, dribbling: 3, defending: 3, physical: 3 }, maxUsesPerPlayer: 1, cooldownHours: 72, active: true },
  ];
  await prisma.trainingPackage.createMany({ data: packages as any, skipDuplicates: true });
  return prisma.trainingPackage.findMany({ where: { active: true } });
}

async function ensureEquipmentTypes(): Promise<any[]> {
  const existing = await prisma.equipmentType.findMany({ where: { active: true } });
  if (existing.length > 0) return existing;
  const types = [
    { id: 'eq-weights-bronze', name: 'Bronze Weight Room', category: 'FACILITY', tier: 'BRONZE', description: 'Basic strength training', baseCostGrid: 2000, baseCostCash: 5000, effects: { trainingBoost: 0.05, physicalBoost: 0.02 }, active: true },
    { id: 'eq-film-bronze', name: 'Bronze Film Room', category: 'FACILITY', tier: 'BRONZE', description: 'Basic film study', baseCostGrid: 1500, baseCostCash: 4000, effects: { trainingBoost: 0.03, passingBoost: 0.02 }, active: true },
    { id: 'eq-recovery-bronze', name: 'Bronze Recovery Center', category: 'MEDICAL', tier: 'BRONZE', description: 'Basic recovery', baseCostGrid: 1000, baseCostCash: 3000, effects: { injuryReduction: 0.05, fatigueReduction: 0.03 }, active: true },
    { id: 'eq-weights-silver', name: 'Silver Performance Lab', category: 'FACILITY', tier: 'SILVER', description: 'Advanced strength and conditioning', baseCostGrid: 8000, baseCostCash: 20000, effects: { trainingBoost: 0.12, physicalBoost: 0.05 }, active: true },
    { id: 'eq-film-silver', name: 'Silver Analytics Suite', category: 'FACILITY', tier: 'SILVER', description: 'Advanced analytics', baseCostGrid: 6000, baseCostCash: 15000, effects: { trainingBoost: 0.08, passingBoost: 0.05, defendingBoost: 0.03 }, active: true },
    { id: 'eq-recovery-silver', name: 'Silver Sports Medicine', category: 'MEDICAL', tier: 'SILVER', description: 'Full sports medicine', baseCostGrid: 5000, baseCostCash: 12000, effects: { injuryReduction: 0.12, fatigueReduction: 0.08 }, active: true },
    { id: 'eq-gear-silver', name: 'Silver Gear Package', category: 'GEAR', tier: 'SILVER', description: 'Premium gear', baseCostGrid: 3000, baseCostCash: 8000, effects: { moraleBoost: 0.05, paceBoost: 0.02 }, active: true },
    { id: 'eq-weights-gold', name: 'Gold Elite Training Center', category: 'FACILITY', tier: 'GOLD', description: 'Elite training facility', baseCostGrid: 25000, baseCostCash: 60000, effects: { trainingBoost: 0.25, physicalBoost: 0.12, paceBoost: 0.08 }, active: true },
    { id: 'eq-film-gold', name: 'Gold AI Analytics Center', category: 'FACILITY', tier: 'GOLD', description: 'AI-powered analysis', baseCostGrid: 20000, baseCostCash: 50000, effects: { trainingBoost: 0.18, passingBoost: 0.1, defendingBoost: 0.08 }, active: true },
    { id: 'eq-recovery-gold', name: 'Gold Recovery Institute', category: 'MEDICAL', tier: 'GOLD', description: 'World-class recovery', baseCostGrid: 15000, baseCostCash: 35000, effects: { injuryReduction: 0.25, fatigueReduction: 0.15 }, active: true },
  ];
  await prisma.equipmentType.createMany({ data: types as any, skipDuplicates: true });
  return prisma.equipmentType.findMany({ where: { active: true } });
}

async function ensureStakingPool(): Promise<any> {
  const pool = await prisma.rewardsPool.findFirst({ where: { active: true } });
  if (pool) return pool;
  return prisma.rewardsPool.create({ data: { id: 'main-pool', totalStaked: 0, rewardRatePerDay: 0.005, totalRewardsDistributed: 0, totalRewardsFunded: 1000000, lastDistributionAt: new Date(), active: true } });
}

async function ensureAIOwner(): Promise<string> {
  const AI_OWNER_ID = 'ai-system-owner-001';
  let owner = await prisma.user.findUnique({ where: { id: AI_OWNER_ID } });
  if (!owner) {
    owner = await prisma.user.create({ data: { id: AI_OWNER_ID, email: 'ai@grid-game.system', username: 'ai-system', password: 'AI_HASH', displayName: 'AI System', role: 'ADMIN' } });
    await prisma.wallet.create({ data: { userId: AI_OWNER_ID, cash: 0, gridTokens: 0, solBalance: 0 } });
  }
  return owner.id;
}

async function createSimUser(activityLevel: 'whale' | 'active' | 'casual' | 'inactive', joinSeason: number): Promise<SimUser> {
  const cfg = ACTIVITY_CONFIG[activityLevel] as any;
  const username = generateUsername();
  const email = username + '@gridsim.test';
  const displayName = randomPick(firstNames) + ' ' + randomPick(lastNames);
  const userId = 'sim-' + username + '-' + Date.now() + '-' + randomInt(1, 1000000);

  await prisma.user.create({ data: { id: userId, email, username, password: 'SIM_PASSWORD_HASH', displayName, role: 'USER', hasPaidPurchase: activityLevel !== 'inactive' } });

  const cash = randomInt(cfg.walletCash.min, cfg.walletCash.max);
  const grid = randomInt(cfg.walletGrid.min, cfg.walletGrid.max);
  const sol = randomFloat(cfg.walletSol.min, cfg.walletSol.max);
  const wallet = await prisma.wallet.create({ data: { userId, cash, gridTokens: grid, solBalance: sol } });

  const seasonActivity = Array.from({ length: SIM_CONFIG.seasonCount }, (_, i) => {
    const base = activityLevel === 'whale' ? 0.9 : activityLevel === 'active' ? 0.7 : activityLevel === 'casual' ? 0.4 : 0.1;
    const ramp = i < 2 ? 0.8 + i * 0.1 : 1.0;
    const fatigue = i > 3 ? 0.95 : 1.0;
    return clamp(base * ramp * fatigue, 0.05, 1.0);
  });

  return { id: userId, username, email, displayName, activityLevel, walletId: wallet.id, joinSeason, churnSeason: null, seasonActivity };
}

async function assignTeamToUser(user: SimUser, season: number, aiOwnerId: string): Promise<SimTeam> {
  const cfg = ACTIVITY_CONFIG[user.activityLevel] as any;
  const tier = randomPick(cfg.tiers) as string;
  const teamName = generateTeamName(user.displayName);
  const teamId = 'sim-team-' + user.id + '-' + season + '-' + randomInt(1, 100000);
  const purchasePrice = tier === 'STATE_COLLEGE' ? 0 : randomInt(5000, 500000);
  const purchaseCurrency = tier === 'STATE_COLLEGE' ? 'FREE' : 'GRID';

  const team = await prisma.team.create({ data: { id: teamId, name: teamName, sportId: 'american-football', ownerId: user.id, tier, isFree: tier === 'STATE_COLLEGE', isAI: false, formation: '4-3-3', tactics: { formation: '4-3-3', sportId: 'american-football' }, purchasePrice, purchaseCurrency, purchasedAt: new Date() } });

  const venueTierMap: any = { STATE_COLLEGE: 'PARK_FIELD', MID_COLLEGE: 'COMMUNITY', TOP_COLLEGE: 'SMALL_STADIUM', REGIONAL_PRO: 'REGIONAL', PRO_ENTRY: 'PRO', PRO_ELITE: 'ELITE' };
  const capacityMap: any = { PARK_FIELD: 5000, COMMUNITY: 12000, SMALL_STADIUM: 35000, REGIONAL: 25000, PRO: 65000, ELITE: 100000 };
  const prestigeMap: any = { PARK_FIELD: 10, COMMUNITY: 25, SMALL_STADIUM: 40, REGIONAL: 50, PRO: 65, ELITE: 85 };
  const venuePriceMap: any = { PARK_FIELD: 5000, COMMUNITY: 25000, SMALL_STADIUM: 100000, REGIONAL: 500000, PRO: 2000000, ELITE: 10000000 };
  const venueSolMap: any = { PARK_FIELD: 0.05, COMMUNITY: 0.2, SMALL_STADIUM: 0.5, REGIONAL: 2.0, PRO: 5.0, ELITE: 20.0 };
  const vt = venueTierMap[tier];

  const venue = await prisma.venue.create({ data: { teamId: team.id, sportId: 'american-football', name: teamName + ' Stadium', tier: vt, capacity: capacityMap[vt] || 5000, ticketPrice: 10 + randomInt(0, 40), condition: 70 + randomInt(0, 30), prestige: prestigeMap[vt] || 10, leaseRate: 0.10, purchasePrice: venuePriceMap[vt] || 5000, solPrice: venueSolMap[vt] || 0.05, ownerId: aiOwnerId } });

  const transportTierMap: any = { STATE_COLLEGE: 'CARPOOL', MID_COLLEGE: 'BUS', TOP_COLLEGE: 'BUS', REGIONAL_PRO: 'CHARTER', PRO_ENTRY: 'CHARTER', PRO_ELITE: 'LUXURY' };
  const transportNameMap: any = { CARPOOL: 'Team Carpool', BUS: 'Team Bus', CHARTER: 'Charter Flight', LUXURY: 'Private Jet' };
  const transportCostMap: any = { CARPOOL: 100, BUS: 300, CHARTER: 1000, LUXURY: 5000 };
  const transportPriceMap: any = { CARPOOL: 1000, BUS: 5000, CHARTER: 50000, LUXURY: 1000000 };
  const transportSolMap: any = { CARPOOL: 0.01, BUS: 0.04, CHARTER: 0.2, LUXURY: 2.0 };
  const tt = transportTierMap[tier];

  const transport = await prisma.transportationAsset.create({ data: { teamId: team.id, tier: tt, name: transportNameMap[tt] || 'Team Bus', operatingCost: transportCostMap[tt] || 300, fatigueReduction: randomInt(0, 15), prestige: randomInt(0, 10), purchasePrice: transportPriceMap[tt] || 5000, solPrice: transportSolMap[tt] || 0.04, ownerId: aiOwnerId } });

  await prisma.teamLeagueMembership.create({ data: { teamId: team.id, leagueId: 'local-rec-football', season: 'beta', status: 'ACTIVE' } });

  const difficultyMap: any = { STATE_COLLEGE: { min: 50, max: 65 }, MID_COLLEGE: { min: 55, max: 70 }, TOP_COLLEGE: { min: 60, max: 75 }, REGIONAL_PRO: { min: 65, max: 80 }, PRO_ENTRY: { min: 70, max: 85 }, PRO_ELITE: { min: 75, max: 95 } };
  const diff = difficultyMap[tier] || { min: 50, max: 70 };
  const ageRange: any = { STATE_COLLEGE: [18, 20], MID_COLLEGE: [19, 21], TOP_COLLEGE: [20, 23], REGIONAL_PRO: [22, 27], PRO_ENTRY: [24, 29], PRO_ELITE: [27, 35] };
  const [ageMin, ageMax] = ageRange[tier] || [18, 35];
  const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S', 'K'];

  const simPlayers: SimPlayer[] = [];
  for (let i = 0; i < 43; i++) {
    const pos = positions[i % positions.length];
    const targetOvr = randomInt(diff.min, diff.max);
    const spread = targetOvr - 50;
    const age = randomInt(ageMin, ageMax);
    const pace = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const shooting = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const passing = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const dribbling = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const defending = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const physical = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const overall = Math.round((pace + shooting + passing + dribbling + defending + physical) / 6);

    const player = await prisma.player.create({ data: { name: randomPick(firstNames) + ' ' + randomPick(lastNames), sportId: 'american-football', position: pos, nationality: randomPick(['USA', 'Canada', 'Mexico', 'Germany', 'United Kingdom', 'Brazil', 'Nigeria', 'Australia', 'Japan']), age, health: 100, injuryStatus: 'HEALTHY', injuryWeeks: 0, pace, shooting, passing, dribbling, defending, physical, goalkeeping: 0, overall, form: 50 + randomInt(0, 30), fatigue: 0, morale: 50 + randomInt(0, 30), rarity: overall >= 85 ? 'ELITE' : overall >= 75 ? 'GOLD' : overall >= 65 ? 'SILVER' : overall >= 55 ? 'BRONZE' : 'COMMON', basePrice: overall * 100, demandMultiplier: 1.0, attributes: { legacy: { pace, shooting, passing, dribbling, defending, physical, goalkeeping: 0 } } } as any });
    await prisma.teamPlayer.create({ data: { teamId: team.id, playerId: player.id, isStarter: i < 11 } });
    simPlayers.push({ id: player.id, name: player.name, position: pos, overall: player.overall, age: player.age, health: 100, injuryStatus: 'HEALTHY', injuryType: null, injuryWeeks: 0, form: player.form, fatigue: 0, morale: player.morale, rarity: player.rarity, pace, shooting, passing, dribbling, defending, physical, goalkeeping: 0, basePrice: player.basePrice, isStarter: i < 11 });
  }

  return { id: team.id, ownerId: user.id, name: teamName, tier, sportId: 'american-football', players: simPlayers, venue: { id: venue.id, teamId: team.id, ownerId: aiOwnerId, name: venue.name, tier: venue.tier, capacity: venue.capacity, ticketPrice: venue.ticketPrice, condition: venue.condition, prestige: venue.prestige, leaseRate: venue.leaseRate, purchasePrice: venue.purchasePrice || 0, solPrice: venue.solPrice || 0, operatingCost: Math.round(venue.capacity * 0.1) }, transport: { id: transport.id, teamId: team.id, ownerId: aiOwnerId, tier: transport.tier, name: transport.name, operatingCost: transport.operatingCost, fatigueReduction: transport.fatigueReduction, prestige: transport.prestige, purchasePrice: transport.purchasePrice || 0, solPrice: transport.solPrice || 0 }, sponsorships: [], equipment: [], formation: '4-3-3', style: randomPick(['balanced', 'runHeavy', 'passHeavy', 'aggressive', 'conservative']), pressing: randomPick(['low', 'medium', 'high']), mentality: randomPick(['defensive', 'balanced', 'attacking']), wins: 0, draws: 0, losses: 0, points: 0, goalsFor: 0, goalsAgainst: 0, purchasedAt: new Date(), purchasePrice, purchaseCurrency, isAI: false, prestige: venue.prestige || 10 };
}

async function generateAITeam(tier: string, index: number, aiOwnerId: string): Promise<SimTeam> {
  const names: any = { STATE_COLLEGE: ['JV Strikers', 'Freshman Raptors', 'Sophomore Cobras'], MID_COLLEGE: ['CC Phoenix', 'Division II Renegades', 'Conference Thunderbolts'], TOP_COLLEGE: ['FCS Comets', 'FBS Centurions', 'National Paladins', 'Conference Monarchs'], REGIONAL_PRO: ['Semi-Pro Outlaws', 'Xtreme Vipers', 'Alliance Express', 'Regional Wolves'], PRO_ENTRY: ['Pro Grid Expansion', 'Gridiron Invaders', 'United Gamblers', 'Pro Debut Coyotes'], PRO_ELITE: ['Dynasty Sentinels', 'Legendary Miners', 'Hall of Fame Merchants'] };
  const nameList = names[tier] || ['AI Team ' + index];
  const teamName = nameList[index % nameList.length] || 'AI ' + tier + ' ' + index;
  const teamId = 'sim-ai-' + tier + '-' + index + '-' + Date.now();
  const gridPrice = { STATE_COLLEGE: 0, MID_COLLEGE: 15000, TOP_COLLEGE: 50000, REGIONAL_PRO: 200000, PRO_ENTRY: 1000000, PRO_ELITE: 5000000 }[tier] || 0;
  const solPrice = { STATE_COLLEGE: 0, MID_COLLEGE: 0.1, TOP_COLLEGE: 0.3, REGIONAL_PRO: 1.5, PRO_ENTRY: 4.0, PRO_ELITE: 15.0 }[tier] || 0;

  const team = await prisma.team.create({ data: { id: teamId, name: teamName, sportId: 'american-football', ownerId: aiOwnerId, tier, isFree: tier === 'STATE_COLLEGE', isAI: true, aiDifficulty: randomPick(['rookie', 'veteran', 'elite', 'legend']), aiStrategy: randomPick(['balanced', 'runHeavy', 'passHeavy', 'aggressive', 'conservative']), purchasePrice: gridPrice, solPrice, purchaseCurrency: tier === 'STATE_COLLEGE' ? 'FREE' : 'GRID', formation: '4-3-3', tactics: { formation: '4-3-3', sportId: 'american-football' } } });

  const venueTierMap: any = { STATE_COLLEGE: 'PARK_FIELD', MID_COLLEGE: 'COMMUNITY', TOP_COLLEGE: 'SMALL_STADIUM', REGIONAL_PRO: 'REGIONAL', PRO_ENTRY: 'PRO', PRO_ELITE: 'ELITE' };
  const vt = venueTierMap[tier];
  const capacityMap: any = { PARK_FIELD: 5000, COMMUNITY: 12000, SMALL_STADIUM: 35000, REGIONAL: 25000, PRO: 65000, ELITE: 100000 };
  const prestigeMap: any = { PARK_FIELD: 10, COMMUNITY: 25, SMALL_STADIUM: 40, REGIONAL: 50, PRO: 65, ELITE: 85 };
  const venuePriceMap: any = { PARK_FIELD: 5000, COMMUNITY: 25000, SMALL_STADIUM: 100000, REGIONAL: 500000, PRO: 2000000, ELITE: 10000000 };
  const venueSolMap: any = { PARK_FIELD: 0.05, COMMUNITY: 0.2, SMALL_STADIUM: 0.5, REGIONAL: 2.0, PRO: 5.0, ELITE: 20.0 };

  const venue = await prisma.venue.create({ data: { teamId: team.id, sportId: 'american-football', ownerId: aiOwnerId, name: teamName + ' Stadium', tier: vt, capacity: capacityMap[vt] || 5000, ticketPrice: 15 + randomInt(0, 30), condition: 80, prestige: prestigeMap[vt] || 10, leaseRate: 0.10, purchasePrice: venuePriceMap[vt] || 5000, solPrice: venueSolMap[vt] || 0.05 } });

  const transportTierMap: any = { STATE_COLLEGE: 'CARPOOL', MID_COLLEGE: 'BUS', TOP_COLLEGE: 'BUS', REGIONAL_PRO: 'CHARTER', PRO_ENTRY: 'CHARTER', PRO_ELITE: 'LUXURY' };
  const transportNameMap: any = { CARPOOL: 'Carpool / Rental Vans', BUS: 'Team Bus', CHARTER: 'Team Charter', LUXURY: 'Private Jet' };
  const transportCostMap: any = { CARPOOL: 100, BUS: 300, CHARTER: 1000, LUXURY: 5000 };
  const transportPriceMap: any = { CARPOOL: 1000, BUS: 5000, CHARTER: 50000, LUXURY: 1000000 };
  const transportSolMap: any = { CARPOOL: 0.01, BUS: 0.04, CHARTER: 0.2, LUXURY: 2.0 };
  const tt = transportTierMap[tier];

  const transport = await prisma.transportationAsset.create({ data: { teamId: team.id, tier: tt, name: transportNameMap[tt] || 'Team Bus', operatingCost: transportCostMap[tt] || 300, fatigueReduction: randomInt(0, 30), prestige: randomInt(0, 20), purchasePrice: transportPriceMap[tt] || 5000, solPrice: transportSolMap[tt] || 0.04, ownerId: aiOwnerId } });

  await prisma.teamLeagueMembership.create({ data: { teamId: team.id, leagueId: 'local-rec-football', season: 'beta', status: 'ACTIVE' } });

  const difficultyMap: any = { rookie: { min: 55, max: 70 }, veteran: { min: 65, max: 80 }, elite: { min: 75, max: 90 }, legend: { min: 85, max: 99 } };
  const aiDiff = team.aiDifficulty || 'rookie';
  const diff = difficultyMap[aiDiff] || { min: 55, max: 70 };
  const ageRange: any = { STATE_COLLEGE: [18, 20], MID_COLLEGE: [19, 21], TOP_COLLEGE: [20, 23], REGIONAL_PRO: [22, 27], PRO_ENTRY: [24, 29], PRO_ELITE: [27, 35] };
  const [ageMin, ageMax] = ageRange[tier] || [18, 35];
  const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S', 'K'];

  const simPlayers: SimPlayer[] = [];
  for (let i = 0; i < 43; i++) {
    const pos = positions[i % positions.length];
    const targetOvr = randomInt(diff.min, diff.max);
    const spread = targetOvr - 50;
    const age = randomInt(ageMin, ageMax);
    const pace = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const shooting = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const passing = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const dribbling = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const defending = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const physical = clamp(50 + spread + randomInt(-5, 5), 30, 99);
    const overall = Math.round((pace + shooting + passing + dribbling + defending + physical) / 6);

    const player = await prisma.player.create({ data: { name: randomPick(firstNames) + ' ' + randomPick(lastNames), sportId: 'american-football', position: pos, nationality: 'USA', age, health: 100, injuryStatus: 'HEALTHY', injuryWeeks: 0, pace, shooting, passing, dribbling, defending, physical, goalkeeping: 0, overall, form: 50 + randomInt(0, 30), fatigue: 0, morale: 50 + randomInt(0, 30), rarity: overall >= 85 ? 'ELITE' : overall >= 75 ? 'GOLD' : overall >= 65 ? 'SILVER' : overall >= 55 ? 'BRONZE' : 'COMMON', basePrice: overall * 100, demandMultiplier: 1.0, attributes: { legacy: { pace, shooting, passing, dribbling, defending, physical, goalkeeping: 0 } } } as any });
    await prisma.teamPlayer.create({ data: { teamId: team.id, playerId: player.id, isStarter: i < 11 } });
    simPlayers.push({ id: player.id, name: player.name, position: pos, overall, age, health: 100, injuryStatus: 'HEALTHY', injuryType: null, injuryWeeks: 0, form: player.form, fatigue: 0, morale: player.morale, rarity: player.rarity, pace, shooting, passing, dribbling, defending, physical, goalkeeping: 0, basePrice: player.basePrice, isStarter: i < 11 });
  }

  return { id: team.id, ownerId: aiOwnerId, name: teamName, tier, sportId: 'american-football', players: simPlayers, venue: { id: venue.id, teamId: team.id, ownerId: aiOwnerId, name: venue.name, tier: venue.tier, capacity: venue.capacity, ticketPrice: venue.ticketPrice, condition: venue.condition, prestige: venue.prestige, leaseRate: venue.leaseRate, purchasePrice: venue.purchasePrice || 0, solPrice: venue.solPrice || 0, operatingCost: Math.round(venue.capacity * 0.1) }, transport: { id: transport.id, teamId: team.id, ownerId: aiOwnerId, tier: transport.tier, name: transport.name, operatingCost: transport.operatingCost, fatigueReduction: transport.fatigueReduction, prestige: transport.prestige, purchasePrice: transport.purchasePrice || 0, solPrice: transport.solPrice || 0 }, sponsorships: [], equipment: [], formation: '4-3-3', style: team.aiStrategy || 'balanced', pressing: 'medium', mentality: 'balanced', wins: 0, draws: 0, losses: 0, points: 0, goalsFor: 0, goalsAgainst: 0, purchasedAt: new Date(), purchasePrice: gridPrice, purchaseCurrency: tier === 'STATE_COLLEGE' ? 'FREE' : 'GRID', isAI: true, prestige: venue.prestige || 10 };
}
// ─── Pump.fun Price Model ───

function simulatePumpFunPrice(pf: PumpFunState, weekMetrics: { activeUsers: number; matches: number; marketplaceVolume: number; trainingSpent: number; season: number; week: number; }): void {
  const baseVol = SIM_CONFIG.pumpfunBaseVolatility * Math.pow(SIM_CONFIG.pumpfunVolatilityDecay, pf.regimeWeeks / 10);
  const activityVol = baseVol * (1 + SIM_CONFIG.pumpfunActivityCorrelation * (weekMetrics.activeUsers / 250));
  const dt = 1 / 52;
  const drift = 0.02;
  const noise = normalRandom(0, 1);
  const gbmReturn = (drift - 0.5 * activityVol * activityVol) * dt + activityVol * Math.sqrt(dt) * noise;
  let priceChange = gbmReturn;

  // Jump diffusion for viral events (5% chance per week)
  if (Math.random() < 0.05) {
    const jumpSize = randomFloat(0.10, 0.50);
    const jumpDirection = Math.random() < 0.6 ? 1 : -1;
    priceChange += jumpDirection * jumpSize;
  }

  let newPrice = pf.currentPrice * Math.exp(priceChange);
  newPrice = clamp(newPrice, 0.001, 1000);

  // Volume correlates with activity
  const volume = weekMetrics.matches * 50 + weekMetrics.marketplaceVolume * 0.1 + weekMetrics.trainingSpent * 0.01 + randomFloat(100, 500);
  const fees = volume * SIM_CONFIG.pumpfunTradingFee;
  const creatorShare = fees * SIM_CONFIG.pumpfunCreatorShare;
  const remainingFees = fees - creatorShare;

  pf.currentPrice = newPrice;
  pf.totalVolume += volume;
  pf.totalFeesEarned += fees;
  pf.liquidityDepth += remainingFees;
  pf.marketCap = newPrice * SIM_CONFIG.tokenSupply;
  pf.volume24h = volume;

  // Regime switching
  pf.regimeWeeks++;
  const regimeThresholds: any = { accumulation: 20, markup: 12, distribution: 8, markdown: 16 };
  const regimeTrans: any = { accumulation: 'markup', markup: 'distribution', distribution: 'markdown', markdown: 'accumulation' };
  if (pf.regimeWeeks > (regimeThresholds[pf.regime] || 12)) {
    if (Math.random() < 0.3) {
      pf.regime = regimeTrans[pf.regime];
      pf.regimeWeeks = 0;
    }
  }

  if (newPrice > pf.allTimeHigh) pf.allTimeHigh = newPrice;
  if (newPrice < pf.allTimeLow) pf.allTimeLow = newPrice;
  pf.avgPrice = (pf.avgPrice * pf.priceHistory.length + newPrice) / (pf.priceHistory.length + 1);

  pf.priceHistory.push({
    season: weekMetrics.season, week: weekMetrics.week, price: newPrice, volume, fees,
    activeUsers: weekMetrics.activeUsers, marketPhase: pf.regime, timestamp: new Date()
  });
}

// ─── Weekly Simulation Functions ───

async function simulateTraining(user: SimUser, team: SimTeam, packages: any[], metrics: SeasonMetrics, fees: FeeTracker, week: number): Promise<void> {
  if (!user.seasonActivity || user.seasonActivity.length === 0) return;
  const activity = user.seasonActivity[Math.min(metrics.seasonNumber - 1, user.seasonActivity.length - 1)];
  const cfg = ACTIVITY_CONFIG[user.activityLevel] as any;
  const sessions = Math.floor(randomInt(cfg.trainingPerWeek.min, cfg.trainingPerWeek.max) * activity * getSeasonPhase(week).trainingMult);

  for (let i = 0; i < sessions; i++) {
    const pkg = randomPick(packages);
    if (!pkg) continue;

    const player = randomPick(team.players.filter((p: SimPlayer) => p.health > 50 && !p.injuryStatus));
    if (!player) continue;

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    if (!wallet) continue;

    const costGrid = (pkg.costGrid || 0) * (1 + normalRandom(0, 0.1));
    const costCash = (pkg.costCash || 0) * (1 + normalRandom(0, 0.1));

    if (wallet.gridTokens >= costGrid) {
      await prisma.wallet.update({ where: { userId: user.id }, data: { gridTokens: { decrement: costGrid } } });
      const treasuryAmount = costGrid * 0.9;
      const burnAmount = costGrid * 0.1;
      await processTreasuryInflow(prisma, 'GRID', treasuryAmount, 'training_grid', pkg.id);
      await processBurn(prisma, 'GRID', burnAmount, 'training_grid', user.id);
      fees.trainingGridToTreasury += treasuryAmount;
      fees.trainingGridBurned += burnAmount;
      metrics.trainingGridSpent += costGrid;
      metrics.totalGridSpent += costGrid;
    } else if (wallet.cash >= costCash) {
      await prisma.wallet.update({ where: { userId: user.id }, data: { cash: { decrement: costCash } } });
      await processTreasuryInflow(prisma, 'CASH', costCash, 'training_cash', pkg.id);
      fees.trainingCashToTreasury += costCash;
      metrics.trainingCashSpent += costCash;
      metrics.totalCashSpent += costCash;
    } else { continue; }

    // Apply stat boosts
    const boosts = (pkg.statBoosts as any) || {};
    if (boosts.pace) player.pace = clamp(player.pace + boosts.pace, 30, 99);
    if (boosts.shooting) player.shooting = clamp(player.shooting + boosts.shooting, 30, 99);
    if (boosts.passing) player.passing = clamp(player.passing + boosts.passing, 30, 99);
    if (boosts.dribbling) player.dribbling = clamp(player.dribbling + boosts.dribbling, 30, 99);
    if (boosts.defending) player.defending = clamp(player.defending + boosts.defending, 30, 99);
    if (boosts.physical) player.physical = clamp(player.physical + boosts.physical, 30, 99);
    player.overall = Math.round((player.pace + player.shooting + player.passing + player.dribbling + player.defending + player.physical) / 6);

    await prisma.player.update({
      where: { id: player.id },
      data: { pace: player.pace, shooting: player.shooting, passing: player.passing, dribbling: player.dribbling, defending: player.defending, physical: player.physical, overall: player.overall, attributes: { legacy: { pace: player.pace, shooting: player.shooting, passing: player.passing, dribbling: player.dribbling, defending: player.defending, physical: player.physical, goalkeeping: player.goalkeeping } } } as any
    });

    metrics.trainingSessions++;
  }
}

async function simulateEquipment(user: SimUser, team: SimTeam, equipmentTypes: any[], metrics: SeasonMetrics, fees: FeeTracker): Promise<void> {
  if (!user.seasonActivity || user.seasonActivity.length === 0) return;
  const activity = user.seasonActivity[Math.min(metrics.seasonNumber - 1, user.seasonActivity.length - 1)];
  const cfg = ACTIVITY_CONFIG[user.activityLevel] as any;
  if (Math.random() > cfg.equipmentChance * activity) return;

  const eqType = randomPick(equipmentTypes);
  if (!eqType) return;

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return;

  const costGrid = (eqType.baseCostGrid || 0) * (1 + normalRandom(0, 0.15));
  const costCash = (eqType.baseCostCash || 0) * (1 + normalRandom(0, 0.15));

  if (wallet.gridTokens >= costGrid) {
    await prisma.wallet.update({ where: { userId: user.id }, data: { gridTokens: { decrement: costGrid } } });
    await processTreasuryInflow(prisma, 'GRID', costGrid, 'equipment_grid', eqType.id);
    fees.equipmentGridToTreasury += costGrid;
    metrics.equipmentGridSpent += costGrid;
    metrics.totalGridSpent += costGrid;
  } else if (wallet.cash >= costCash) {
    await prisma.wallet.update({ where: { userId: user.id }, data: { cash: { decrement: costCash } } });
    await processTreasuryInflow(prisma, 'CASH', costCash, 'equipment_cash', eqType.id);
    fees.equipmentCashToTreasury += costCash;
    metrics.equipmentCashSpent += costCash;
    metrics.totalCashSpent += costCash;
  } else { return; }

  await prisma.teamEquipment.create({ data: { teamId: team.id, equipmentTypeId: eqType.id, level: 1, activeEffects: {} } });
  team.equipment.push(eqType.id);
  metrics.equipmentPurchases++;
}

async function simulateMatch(homeTeam: SimTeam, awayTeam: SimTeam, homeUser: SimUser | null, _awayUser: SimUser | null, week: number, season: number, metrics: SeasonMetrics, fees: FeeTracker): Promise<void> {
  try {
    const homeVenue = homeTeam.venue;
    const ticketPrice = homeVenue?.ticketPrice || 15;
    const attendance = homeVenue ? Math.floor(homeVenue.capacity * (0.3 + 0.5 * (homeTeam.prestige || 50) / 100) * randomFloat(0.7, 1.3)) : 5000;

    const ticketRevenue = attendance * ticketPrice;
    const concessions = ticketRevenue * 0.25;
    const merchandise = ticketRevenue * 0.1;
    const gameEntryFee = 100;

    fees.ticketRevenue += ticketRevenue;
    fees.concessionsRevenue += concessions;
    fees.merchRevenue += merchandise;
    fees.gameEntryFees += gameEntryFee;

    if (homeUser) {
      const wallet = await prisma.wallet.findUnique({ where: { userId: homeUser.id } });
      if (wallet && wallet.cash >= gameEntryFee) {
        await prisma.wallet.update({ where: { userId: homeUser.id }, data: { cash: { decrement: gameEntryFee } } });
        await processTreasuryInflow(prisma, 'CASH', gameEntryFee, 'game_entry', homeTeam.id);
      }
    }

    // Venue lease fee
    if (homeVenue) {
      const leaseFee = ticketRevenue * (homeVenue.leaseRate || 0.10);
      fees.venueLeaseFees += leaseFee;
      if (homeTeam.ownerId !== 'ai-system-owner-001') {
        const ownerWallet = await prisma.wallet.findUnique({ where: { userId: homeTeam.ownerId } });
        if (ownerWallet) {
          await prisma.wallet.update({ where: { userId: homeTeam.ownerId }, data: { cash: { increment: leaseFee } } });
        }
      } else {
        await processTreasuryInflow(prisma, 'CASH', leaseFee, 'venue_lease', homeVenue.id);
      }
    }

    // Run match simulation
    const homePlayers = homeTeam.players.filter((p: SimPlayer) => p.isStarter && p.health > 50 && !p.injuryStatus);
    const awayPlayers = awayTeam.players.filter((p: SimPlayer) => p.isStarter && p.health > 50 && !p.injuryStatus);
    if (homePlayers.length < 11 || awayPlayers.length < 11) return;

    const homeOvr = homePlayers.reduce((s: number, p: SimPlayer) => s + p.overall, 0) / homePlayers.length;
    const awayOvr = awayPlayers.reduce((s: number, p: SimPlayer) => s + p.overall, 0) / awayPlayers.length;
    const homeAdvantage = 1.05;
    const formDiff = (homeTeam.wins - homeTeam.losses) * 0.5 - (awayTeam.wins - awayTeam.losses) * 0.5;

    const homeScore = Math.round(Math.max(0, normalRandom((homeOvr / 20) * homeAdvantage + formDiff * 0.1, 2)));
    const awayScore = Math.round(Math.max(0, normalRandom((awayOvr / 20), 2)));

    // Update standings
    homeTeam.goalsFor += homeScore;
    homeTeam.goalsAgainst += awayScore;
    awayTeam.goalsFor += awayScore;
    awayTeam.goalsAgainst += homeScore;

    if (homeScore > awayScore) { homeTeam.wins++; awayTeam.losses++; homeTeam.points += 3; metrics.homeWins++; }
    else if (awayScore > homeScore) { awayTeam.wins++; homeTeam.losses++; awayTeam.points += 3; metrics.awayWins++; }
    else { homeTeam.draws++; awayTeam.draws++; homeTeam.points++; awayTeam.points++; metrics.draws++; }

    metrics.matchesPlayed++;
    metrics.avgHomeScore = (metrics.avgHomeScore * (metrics.matchesPlayed - 1) + homeScore) / metrics.matchesPlayed;
    metrics.avgAwayScore = (metrics.avgAwayScore * (metrics.matchesPlayed - 1) + awayScore) / metrics.matchesPlayed;

    // Injury simulation
    for (const player of [...homePlayers, ...awayPlayers]) {
      if (Math.random() < SIM_CONFIG.injuryBaseRate) {
        player.injuryStatus = 'INJURED';
        player.injuryType = randomPick(['sprain', 'strain', 'bruise', 'fracture', 'concussion']);
        player.injuryWeeks = randomInt(1, SIM_CONFIG.maxInjuryWeeks);
        player.health = clamp(player.health - randomInt(10, 40), 20, 100);
        await prisma.player.update({ where: { id: player.id }, data: { injuryStatus: 'INJURED', injuryType: player.injuryType, injuryWeeks: player.injuryWeeks, health: player.health } });
        metrics.injuries++;
        fees.playerRecovery += player.injuryWeeks * 50;
      }
    }

    // Weekly operating costs
    const weeklyOpCost = (homeTeam.players.length * 25) + (awayTeam.players.length * 25) + (homeVenue ? homeVenue.operatingCost * 0.5 : 0) + (awayTeam.transport ? awayTeam.transport.operatingCost * 0.5 : 0);
    fees.weeklyOperatingCosts += weeklyOpCost;
    fees.playerWages += (homeTeam.players.length + awayTeam.players.length) * 25;
    if (homeVenue) fees.venueMaintenance += homeVenue.operatingCost * 0.5;
    if (awayTeam.transport) fees.transportOperating += awayTeam.transport.operatingCost * 0.5;

    // League rewards
    const leagueReward = 500 + (homeScore + awayScore) * 10;
    fees.leagueRewards += leagueReward;
    await processTreasuryInflow(prisma, 'CASH', leagueReward, 'league_reward', 'sim-match-' + season + '-' + week + '-' + homeTeam.id);

    // Sponsor revenue
    if (homeTeam.sponsorships && homeTeam.sponsorships.length > 0) {
      for (const sponsor of homeTeam.sponsorships) {
        if (sponsor.active) {
          const sponsorPay = sponsor.amountPerGame + (sponsor.amountPerSeason / 52);
          fees.sponsorRevenue += sponsorPay;
          await prisma.wallet.update({ where: { userId: homeTeam.ownerId }, data: { cash: { increment: sponsorPay } } }).catch(() => {});
        }
      }
    }

  } catch (err: any) {
    metrics.issues.push('Match error: ' + (err?.message || 'unknown'));
  }
}

async function simulatePlayerMarketplace(user: SimUser, userTeams: SimTeam[], allTeams: SimTeam[], metrics: SeasonMetrics, fees: FeeTracker): Promise<void> {
  if (!user.seasonActivity || user.seasonActivity.length === 0) return;
  const activity = user.seasonActivity[Math.min(metrics.seasonNumber - 1, user.seasonActivity.length - 1)];
  const cfg = ACTIVITY_CONFIG[user.activityLevel] as any;
  if (Math.random() > cfg.marketChance * activity) return;

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return;

  // List a player for sale
  const team = randomPick(userTeams);
  if (!team || team.players.length < 12) return;

  const player = randomPick(team.players.filter((p: SimPlayer) => !p.isStarter));
  if (!player) return;

  const listingPrice = Math.floor(player.basePrice * randomFloat(0.8, 2.5));
  const listingId = 'sim-listing-' + player.id + '-' + Date.now();

  await prisma.marketplaceListing.create({ data: { id: listingId, sellerId: user.id, playerId: player.id, price: listingPrice, status: 'ACTIVE' } });
  metrics.playerListings++;
  fees.playerMarketplaceVolume += listingPrice;

  // Simulate a purchase
  const otherTeams = allTeams.filter((t: SimTeam) => t.ownerId !== user.id && t.players.length < 50);
  if (otherTeams.length > 0 && Math.random() < 0.3) {
    const buyerTeam = randomPick(otherTeams);
    const buyerWallet = await prisma.wallet.findUnique({ where: { userId: buyerTeam.ownerId } });
    if (buyerWallet && buyerWallet.gridTokens >= listingPrice) {
      await prisma.wallet.update({ where: { userId: buyerTeam.ownerId }, data: { gridTokens: { decrement: listingPrice } } });
      await prisma.wallet.update({ where: { userId: user.id }, data: { gridTokens: { increment: listingPrice * 0.95 } } });
      const tax = listingPrice * 0.05;
      await processTreasuryInflow(prisma, 'GRID', tax * 0.9, 'player_marketplace_tax', listingId);
      await processBurn(prisma, 'GRID', tax * 0.1, 'player_marketplace_tax', listingId);
      fees.playerMarketplaceTax += tax * 0.9;
      fees.playerMarketplaceVolume += listingPrice;
      metrics.playerSales++;
      metrics.totalGridSpent += listingPrice;

      // Transfer player
      await prisma.teamPlayer.deleteMany({ where: { playerId: player.id } });
      await prisma.teamPlayer.create({ data: { teamId: buyerTeam.id, playerId: player.id, isStarter: false } });
      team.players = team.players.filter((p: SimPlayer) => p.id !== player.id);
      buyerTeam.players.push(player);
    }
  }
}

async function simulateTeamMarketplace(user: SimUser, userTeams: SimTeam[], allTeams: SimTeam[], metrics: SeasonMetrics, fees: FeeTracker): Promise<void> {
  if (!user.seasonActivity || user.seasonActivity.length === 0) return;
  const activity = user.seasonActivity[Math.min(metrics.seasonNumber - 1, user.seasonActivity.length - 1)];
  const cfg = ACTIVITY_CONFIG[user.activityLevel] as any;
  if (Math.random() > cfg.marketChance * activity * 0.5) return;

  const team = randomPick(userTeams);
  if (!team) return;

  const listingPrice = Math.floor(team.purchasePrice * randomFloat(0.5, 3.0));
  const listingId = 'sim-team-listing-' + team.id + '-' + Date.now();

  // Team marketplace listings tracked in simulation only (MarketplaceListing requires playerId)
  metrics.teamListings++;
  fees.teamMarketplaceTax += listingPrice * 0.05;
  metrics.teamMarketplaceVolume += listingPrice;

  // Simulate a purchase
  const otherUsers = allTeams.filter((t: SimTeam) => t.ownerId !== user.id);
  if (otherUsers.length > 0 && Math.random() < 0.15) {
    const buyerTeam = randomPick(otherUsers);
    const buyerWallet = await prisma.wallet.findUnique({ where: { userId: buyerTeam.ownerId } });
    if (buyerWallet && buyerWallet.gridTokens >= listingPrice) {
      await prisma.wallet.update({ where: { userId: buyerTeam.ownerId }, data: { gridTokens: { decrement: listingPrice } } });
      await prisma.wallet.update({ where: { userId: user.id }, data: { gridTokens: { increment: listingPrice * 0.95 } } });
      const tax = listingPrice * 0.05;
      await processTreasuryInflow(prisma, 'GRID', tax * 0.9, 'team_marketplace_tax', listingId);
      await processBurn(prisma, 'GRID', tax * 0.1, 'team_marketplace_tax', listingId);
      fees.teamMarketplaceTax += tax * 0.9;
      fees.teamMarketplaceBurn += tax * 0.1;
      metrics.teamSales++;
      metrics.totalGridSpent += listingPrice;
      team.ownerId = buyerTeam.ownerId;
    }
  }
}

async function simulateVenuePurchase(user: SimUser, userTeams: SimTeam[], metrics: SeasonMetrics, fees: FeeTracker): Promise<void> {
  if (!user.seasonActivity || user.seasonActivity.length === 0) return;
  const activity = user.seasonActivity[Math.min(metrics.seasonNumber - 1, user.seasonActivity.length - 1)];
  const cfg = ACTIVITY_CONFIG[user.activityLevel] as any;
  if (Math.random() > cfg.upgradeChance * activity * 0.3) return;

  const team = randomPick(userTeams);
  if (!team || !team.venue) return;

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return;

  const venueSolPrice = team.venue.solPrice || 0;
  if (wallet.solBalance >= venueSolPrice && venueSolPrice > 0) {
    await prisma.wallet.update({ where: { userId: user.id }, data: { solBalance: { decrement: venueSolPrice } } });
    await processTreasuryInflow(prisma, 'GRID', venueSolPrice * 1000, 'venue_sol_purchase', team.id);
    fees.solPurchases += venueSolPrice;
    fees.solTreasuryInflow += venueSolPrice * 1000;
    metrics.venueSolPurchases += venueSolPrice;
    metrics.totalSolSpent += venueSolPrice;
    team.venue.ownerId = user.id;
    await prisma.venue.update({ where: { id: team.venue.id }, data: { ownerId: user.id } });
    metrics.venuePurchases++;
  }
}

async function simulateTransportPurchase(user: SimUser, userTeams: SimTeam[], metrics: SeasonMetrics, fees: FeeTracker): Promise<void> {
  if (!user.seasonActivity || user.seasonActivity.length === 0) return;
  const activity = user.seasonActivity[Math.min(metrics.seasonNumber - 1, user.seasonActivity.length - 1)];
  const cfg = ACTIVITY_CONFIG[user.activityLevel] as any;
  if (Math.random() > cfg.upgradeChance * activity * 0.2) return;

  const team = randomPick(userTeams);
  if (!team || !team.transport) return;

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return;

  const transportSolPrice = team.transport.solPrice || 0;
  if (wallet.solBalance >= transportSolPrice && transportSolPrice > 0) {
    await prisma.wallet.update({ where: { userId: user.id }, data: { solBalance: { decrement: transportSolPrice } } });
    await processTreasuryInflow(prisma, 'GRID', transportSolPrice * 1000, 'transport_sol_purchase', team.id);
    fees.solPurchases += transportSolPrice;
    fees.solTreasuryInflow += transportSolPrice * 1000;
    metrics.transportSolPurchases += transportSolPrice;
    metrics.totalSolSpent += transportSolPrice;
    team.transport.ownerId = user.id;
    await prisma.transportationAsset.update({ where: { id: team.transport.id }, data: { ownerId: user.id } });
    metrics.transportPurchases++;
  }
}

async function simulateStaking(user: SimUser, metrics: SeasonMetrics, fees: FeeTracker): Promise<void> {
  if (!user.seasonActivity || user.seasonActivity.length === 0) return;
  const activity = user.seasonActivity[Math.min(metrics.seasonNumber - 1, user.seasonActivity.length - 1)];
  const cfg = ACTIVITY_CONFIG[user.activityLevel] as any;
  if (Math.random() > cfg.stakeChance * activity) return;

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet || wallet.gridTokens < 1000) return;

  const stakeAmount = Math.floor(randomFloat(0.1, 0.5) * wallet.gridTokens);
  const pool = await prisma.rewardsPool.findFirst({ where: { active: true } });
  if (!pool) return;

  await prisma.wallet.update({ where: { userId: user.id }, data: { gridTokens: { decrement: stakeAmount } } });
  await prisma.rewardsPool.update({ where: { id: pool.id }, data: { totalStaked: { increment: stakeAmount } } });

  const rewardRate = pool.rewardRatePerDay || 0.005;
  const weeklyReward = stakeAmount * rewardRate * 7;
  await prisma.wallet.update({ where: { userId: user.id }, data: { gridTokens: { increment: weeklyReward } } });
  await prisma.rewardsPool.update({ where: { id: pool.id }, data: { totalRewardsDistributed: { increment: weeklyReward } } });

  fees.stakingRewards += weeklyReward;
  metrics.stakingEvents++;
  metrics.stakedAmount += stakeAmount;
  metrics.totalGridSpent += stakeAmount;
}

async function simulateGridExchange(user: SimUser, metrics: SeasonMetrics, fees: FeeTracker): Promise<void> {
  if (!user.seasonActivity || user.seasonActivity.length === 0) return;
  const activity = user.seasonActivity[Math.min(metrics.seasonNumber - 1, user.seasonActivity.length - 1)];
  const cfg = ACTIVITY_CONFIG[user.activityLevel] as any;
  if (Math.random() > cfg.exchangeChance * activity) return;

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return;

  const exchangeType = Math.random() < 0.5 ? 'CASH_TO_GRID' : 'GRID_TO_CASH';
  const rate = SIM_CONFIG.gridExchangeRate;
  const fee = 0.02;

  if (exchangeType === 'CASH_TO_GRID') {
    const amount = randomInt(100, 5000);
    if (wallet.cash >= amount) {
      const gridReceived = Math.floor(amount / rate * (1 - fee));
      await prisma.wallet.update({ where: { userId: user.id }, data: { cash: { decrement: amount }, gridTokens: { increment: gridReceived } } });
      fees.gridExchangeFees += amount * fee;
      metrics.gridExchanges++;
      metrics.gridExchanged += gridReceived;
      metrics.totalCashSpent += amount;
    }
  } else {
    const amount = randomInt(100, 5000);
    if (wallet.gridTokens >= amount) {
      const cashReceived = Math.floor(amount * rate * (1 - fee));
      await prisma.wallet.update({ where: { userId: user.id }, data: { gridTokens: { decrement: amount }, cash: { increment: cashReceived } } });
      fees.gridExchangeFees += amount * fee;
      metrics.gridExchanges++;
      metrics.gridExchanged += amount;
      metrics.totalGridSpent += amount;
    }
  }
}

async function simulateSponsorships(teams: SimTeam[], metrics: SeasonMetrics, fees: FeeTracker): Promise<void> {
  for (const team of teams) {
    if (team.sponsorships.length < 3 && Math.random() < 0.05) {
      const sponsorName = randomPick(SPONSOR_NAMES);
      const amountPerGame = randomInt(100, 2000);
      const amountPerSeason = randomInt(5000, 50000);
      const sponsorId = 'sim-sponsor-' + team.id + '-' + Date.now();
      team.sponsorships.push({ id: sponsorId, name: sponsorName, amountPerGame, amountPerSeason, active: true });
      fees.sponsorRevenue += amountPerSeason / 52;
      metrics.sponsorRevenue = (metrics.sponsorRevenue || 0) + amountPerSeason / 52;
    }
  }
}

async function processWeeklyCosts(teams: SimTeam[], fees: FeeTracker): Promise<void> {
  for (const team of teams) {
    const weeklyWages = team.players.length * 25;
    const venueMaint = team.venue ? team.venue.operatingCost * 0.1 : 0;
    const transportOp = team.transport ? team.transport.operatingCost : 0;
    const leagueDues = team.tier === 'PRO_ELITE' ? 500 : team.tier === 'PRO_ENTRY' ? 200 : 50;

    fees.playerWages += weeklyWages;
    fees.venueMaintenance += venueMaint;
    fees.transportOperating += transportOp;
    fees.leagueDues += leagueDues;
    fees.weeklyOperatingCosts += weeklyWages + venueMaint + transportOp + leagueDues;

    const ownerWallet = await prisma.wallet.findUnique({ where: { userId: team.ownerId } });
    if (ownerWallet) {
      const totalCost = weeklyWages + venueMaint + transportOp + leagueDues;
      if (ownerWallet.cash >= totalCost) {
        await prisma.wallet.update({ where: { userId: team.ownerId }, data: { cash: { decrement: totalCost } } });
      }
    }
  }
}

async function processRetirements(teams: SimTeam[], metrics: SeasonMetrics, _fees: FeeTracker): Promise<void> {
  for (const team of teams) {
    for (const player of team.players) {
      if (player.age >= SIM_CONFIG.retirementAge && Math.random() < 0.3) {
        // Player retired - removed from team
        team.players = team.players.filter((p: SimPlayer) => p.id !== player.id);
        metrics.retirements++;

        // Replace with rookie
        const rookie = await generateAndCreatePlayerTx(prisma, {
          sportId: 'american-football', position: player.position
        });
        if (rookie) {
          team.players.push({
            id: rookie.id, name: rookie.name, position: rookie.position, overall: rookie.overall, age: rookie.age,
            health: 100, injuryStatus: null, injuryType: null, injuryWeeks: 0, form: 50, fatigue: 0, morale: 50,
            rarity: rookie.rarity, pace: rookie.pace, shooting: rookie.shooting, passing: rookie.passing,
            dribbling: rookie.dribbling, defending: rookie.defending, physical: rookie.physical,
            goalkeeping: rookie.goalkeeping || 0, basePrice: rookie.basePrice, isStarter: false
          });
        }
      }
    }
  }
}

async function processChurnAndGrowth(users: SimUser[], allTeams: SimTeam[], season: number, aiOwnerId: string): Promise<{ newUsers: SimUser[]; churnedCount: number }> {
  let churnedCount = 0;
  const newUsers: SimUser[] = [];

  for (const user of users) {
    if (user.churnSeason) continue;
    const churnRate = user.activityLevel === 'inactive' ? 0.08 : user.activityLevel === 'casual' ? 0.024 : user.activityLevel === 'active' ? 0.01 : 0.005;
    if (Math.random() < churnRate) {
      user.churnSeason = season;
      churnedCount++;
      // Transfer teams to AI
      const userTeams = allTeams.filter((t: SimTeam) => t.ownerId === user.id);
      for (const team of userTeams) {
        team.ownerId = aiOwnerId;
        team.isAI = true;
        await prisma.team.update({ where: { id: team.id }, data: { ownerId: aiOwnerId, isAI: true } });
      }
    }
  }

  // New user growth
  const newUserCount = Math.floor(users.length * SIM_CONFIG.newUserGrowth / SIM_CONFIG.seasonCount);
  for (let i = 0; i < newUserCount; i++) {
    const activityLevel = pickActivityLevel();
    const user = await createSimUser(activityLevel, season);
    users.push(user);
    newUsers.push(user);

    const teamCount = randomInt((ACTIVITY_CONFIG[activityLevel] as any).teamCount.min, (ACTIVITY_CONFIG[activityLevel] as any).teamCount.max);
    for (let j = 0; j < teamCount; j++) {
      const team = await assignTeamToUser(user, season, aiOwnerId);
      allTeams.push(team);
    }
  }

  return { newUsers, churnedCount };
}

// ─── Chunked Simulation Runner ───

async function initializeMegaSimulation(
  userCount: number,
  seasonCount: number
): Promise<SimRunState> {
  const startTime = Date.now();
  const issues: string[] = [];

  // Seed data
  const trainingPackages = await ensureTrainingPackages();
  const equipmentTypes = await ensureEquipmentTypes();
  await ensureStakingPool();
  const aiOwnerId = await ensureAIOwner();

  // Initialize Pump.fun state
  const pumpFunState: PumpFunState = {
    tokenAddress: env.PUMPFUN_TOKEN_ADDRESS || null,
    tokenSymbol: SIM_CONFIG.tokenSymbol,
    currentPrice: 0.01,
    marketCap: 0.01 * SIM_CONFIG.tokenSupply,
    volume24h: 0,
    totalFeesEarned: 0,
    totalVolume: 0,
    liquidityDepth: SIM_CONFIG.initialLiquidity,
    priceHistory: [],
    regime: 'accumulation',
    regimeWeeks: 0,
    avgPrice: 0.01,
    allTimeHigh: 0.01,
    allTimeLow: 0.01,
  };

  const feeTracker: FeeTracker = {
    trainingGridToTreasury: 0, trainingGridBurned: 0, trainingCashToTreasury: 0,
    equipmentGridToTreasury: 0, equipmentCashToTreasury: 0,
    teamMarketplaceTax: 0, teamMarketplaceBurn: 0,
    playerMarketplaceTax: 0, playerMarketplaceVolume: 0,
    venueLeaseFees: 0, gameEntryFees: 0, ticketRevenue: 0,
    concessionsRevenue: 0, merchRevenue: 0, sponsorRevenue: 0, leagueRewards: 0,
    solPurchases: 0, solTreasuryInflow: 0, pumpfunFees: 0, stakingRewards: 0,
    gridExchangeFees: 0, weeklyOperatingCosts: 0, playerWages: 0,
    venueMaintenance: 0, transportOperating: 0, playerRecovery: 0, leagueDues: 0,
  };

  const users: SimUser[] = [];
  const allTeams: SimTeam[] = [];
  const seasons: SeasonMetrics[] = [];
  const regimeTransitions: Array<{ season: number; week: number; from: string; to: string }> = [];

  // Create initial users and teams
  for (let i = 0; i < userCount; i++) {
    const activityLevel = pickActivityLevel();
    const user = await createSimUser(activityLevel, 1);
    users.push(user);

    const teamCount = randomInt((ACTIVITY_CONFIG[activityLevel] as any).teamCount.min, (ACTIVITY_CONFIG[activityLevel] as any).teamCount.max);
    for (let j = 0; j < teamCount; j++) {
      const team = await assignTeamToUser(user, 1, aiOwnerId);
      allTeams.push(team);
    }
  }

  // Create AI teams to fill out competition
  const aiTeamCounts: any = { STATE_COLLEGE: 8, MID_COLLEGE: 6, TOP_COLLEGE: 5, REGIONAL_PRO: 4, PRO_ENTRY: 3, PRO_ELITE: 2 };
  let aiIndex = 0;
  for (const [tier, count] of Object.entries(aiTeamCounts)) {
    for (let i = 0; i < (count as number); i++) {
      const aiTeam = await generateAITeam(tier, aiIndex++, aiOwnerId);
      allTeams.push(aiTeam);
    }
  }

  return {
    users, allTeams, feeTracker, pumpFunState, seasons, regimeTransitions,
    aiOwnerId, trainingPackages, equipmentTypes, seasonCount, startTime, issues,
  };
}

async function runMegaSimulationSeason(
  state: SimRunState,
  season: number,
  throttleMs: number = 0
): Promise<void> {
  const { users, allTeams, feeTracker, pumpFunState, seasons, regimeTransitions, aiOwnerId, trainingPackages, equipmentTypes, issues } = state;

  const seasonMetrics: SeasonMetrics = {
    seasonNumber: season, activeUsers: 0, totalUsers: users.length, newUsers: 0, churnedUsers: 0,
    matchesPlayed: 0, homeWins: 0, awayWins: 0, draws: 0,
    avgHomeScore: 0, avgAwayScore: 0, trainingSessions: 0,
    trainingGridSpent: 0, trainingCashSpent: 0,
    equipmentPurchases: 0, equipmentGridSpent: 0, equipmentCashSpent: 0,
    playerListings: 0, playerSales: 0, playerMarketplaceVolume: 0,
    teamListings: 0, teamSales: 0, teamMarketplaceVolume: 0,
    venuePurchases: 0, venueSolPurchases: 0,
    transportPurchases: 0, transportSolPurchases: 0,
    gridExchanges: 0, gridExchanged: 0,
    stakingEvents: 0, stakedAmount: 0, stakingRewards: 0,
    injuries: 0, retirements: 0, promotions: 0, demotions: 0,
    weeklyCostsProcessed: 0,
    totalCashSpent: 0, totalGridSpent: 0, totalSolSpent: 0,
    treasuryInflow: 0, solTreasuryInflow: 0,
    pumpfunPrice: 0, pumpfunVolume: 0, pumpfunFees: 0, pumpfunMarketCap: 0, pumpfunRegime: 'accumulation',
    sponsorRevenue: 0,
    issues: [],
  };

  // Process churn and growth at start of season
  const { newUsers, churnedCount } = await processChurnAndGrowth(users, allTeams, season, aiOwnerId);
  seasonMetrics.newUsers = newUsers.length;
  seasonMetrics.churnedUsers = churnedCount;
  seasonMetrics.totalUsers = users.length;

  const activeUsers = users.filter((u: SimUser) => !u.churnSeason);
  seasonMetrics.activeUsers = activeUsers.length;

  // Week loop
  for (let week = 1; week <= SIM_CONFIG.weeksPerSeason; week++) {
    const weekActiveUsers = activeUsers.filter((u: SimUser) => {
      const activity = u.seasonActivity[Math.min(season - 1, u.seasonActivity.length - 1)];
      return activity >= 0.3;
    });

    // Simulate matches
    const shuffledTeams = [...allTeams].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffledTeams.length - 1; i += 2) {
      const home = shuffledTeams[i];
      const away = shuffledTeams[i + 1];
      if (home && away) {
        const homeUser = users.find((u: SimUser) => u.id === home.ownerId) || null;
        const awayUser = users.find((u: SimUser) => u.id === away.ownerId) || null;
        await simulateMatch(home, away, homeUser, awayUser, week, season, seasonMetrics, feeTracker);
      }
    }

    if (throttleMs > 0) await sleep(throttleMs);

    // Simulate user activities
    for (const user of activeUsers) {
      const userTeams = allTeams.filter((t: SimTeam) => t.ownerId === user.id);
      if (userTeams.length === 0) continue;

      await simulateTraining(user, randomPick(userTeams), trainingPackages, seasonMetrics, feeTracker, week);
      await simulateEquipment(user, randomPick(userTeams), equipmentTypes, seasonMetrics, feeTracker);
      await simulatePlayerMarketplace(user, userTeams, allTeams, seasonMetrics, feeTracker);
      await simulateTeamMarketplace(user, userTeams, allTeams, seasonMetrics, feeTracker);
      await simulateVenuePurchase(user, userTeams, seasonMetrics, feeTracker);
      await simulateTransportPurchase(user, userTeams, seasonMetrics, feeTracker);
      await simulateStaking(user, seasonMetrics, feeTracker);
      await simulateGridExchange(user, seasonMetrics, feeTracker);

      if (throttleMs > 0) await sleep(throttleMs);
    }

    // Simulate sponsorships
    await simulateSponsorships(allTeams, seasonMetrics, feeTracker);

    // Process weekly costs
    await processWeeklyCosts(allTeams, feeTracker);
    seasonMetrics.weeklyCostsProcessed++;

    // Process retirements (end of season)
    if (week === 52) {
      await processRetirements(allTeams, seasonMetrics, feeTracker);
    }

    // Update pump.fun price
    simulatePumpFunPrice(pumpFunState, {
      activeUsers: weekActiveUsers.length,
      matches: seasonMetrics.matchesPlayed,
      marketplaceVolume: seasonMetrics.playerMarketplaceVolume + seasonMetrics.teamMarketplaceVolume,
      trainingSpent: seasonMetrics.trainingGridSpent + seasonMetrics.trainingCashSpent,
      season, week,
    });

    // Track regime transitions
    if (pumpFunState.priceHistory.length > 1) {
      const last = pumpFunState.priceHistory[pumpFunState.priceHistory.length - 2];
      const curr = pumpFunState.priceHistory[pumpFunState.priceHistory.length - 1];
      if (last.marketPhase !== curr.marketPhase) {
        regimeTransitions.push({ season, week, from: last.marketPhase, to: curr.marketPhase });
      }
    }
  }

  // End-of-season metrics
  seasonMetrics.pumpfunPrice = pumpFunState.currentPrice;
  seasonMetrics.pumpfunVolume = pumpFunState.volume24h;
  seasonMetrics.pumpfunFees = pumpFunState.totalFeesEarned;
  seasonMetrics.pumpfunMarketCap = pumpFunState.marketCap;
  seasonMetrics.pumpfunRegime = pumpFunState.regime;
  seasonMetrics.totalCashSpent = seasonMetrics.trainingCashSpent + seasonMetrics.equipmentCashSpent;
  seasonMetrics.totalGridSpent = seasonMetrics.trainingGridSpent + seasonMetrics.equipmentGridSpent + seasonMetrics.playerMarketplaceVolume + seasonMetrics.teamMarketplaceVolume;
  seasonMetrics.totalSolSpent = seasonMetrics.venueSolPurchases + seasonMetrics.transportSolPurchases;

  seasons.push(seasonMetrics);
  issues.push(...seasonMetrics.issues);
}

function buildMegaSimulationResults(state: SimRunState): MegaSimV2Result {
  const { users, allTeams, feeTracker, pumpFunState, seasons, regimeTransitions, startTime, issues } = state;

  // Build final standings
  const finalStandings = allTeams
    .filter((t: SimTeam) => !t.isAI)
    .map((team: SimTeam) => {
      const owner = users.find((u: SimUser) => u.id === team.ownerId);
      const netRevenue = (team.goalsFor * 10) - ((team.players.length * 25 * 52) + (team.venue?.operatingCost || 0) + (team.transport?.operatingCost || 0));
      return {
        teamId: team.id, teamName: team.name, tier: team.tier,
        owner: owner?.displayName || 'AI Owner',
        wins: team.wins, draws: team.draws, losses: team.losses,
        points: team.points, goalsFor: team.goalsFor, goalsAgainst: team.goalsAgainst,
        netRevenue,
      };
    })
    .sort((a: any, b: any) => b.points - a.points)
    .slice(0, 50);

  // Build top players
  const allPlayers = allTeams.flatMap((t: SimTeam) => t.players.map((p: SimPlayer) => ({ ...p, teamName: t.name })));
  const topPlayers = allPlayers
    .map((p: any) => ({
      playerId: p.id, playerName: p.name, teamName: p.teamName,
      position: p.position, age: p.age, overall: p.overall,
      mvpScore: p.overall + (p.goalkeeping || 0),
      ratingAverage: p.form,
    }))
    .sort((a: any, b: any) => b.mvpScore - a.mvpScore)
    .slice(0, 50);

  // Build summaries
  const marketplaceSummary = {
    totalPlayerListings: seasons.reduce((s, m) => s + m.playerListings, 0),
    totalPlayerSales: seasons.reduce((s, m) => s + m.playerSales, 0),
    totalPlayerVolume: seasons.reduce((s, m) => s + m.playerMarketplaceVolume, 0),
    totalTeamListings: seasons.reduce((s, m) => s + m.teamListings, 0),
    totalTeamSales: seasons.reduce((s, m) => s + m.teamSales, 0),
    totalTeamVolume: seasons.reduce((s, m) => s + m.teamMarketplaceVolume, 0),
    totalVenuePurchases: seasons.reduce((s, m) => s + m.venuePurchases, 0),
    totalTransportPurchases: seasons.reduce((s, m) => s + m.transportPurchases, 0),
    totalSolSpent: seasons.reduce((s, m) => s + m.totalSolSpent, 0),
    totalCashSpent: seasons.reduce((s, m) => s + m.totalCashSpent, 0),
    totalGridSpent: seasons.reduce((s, m) => s + m.totalGridSpent, 0),
  };

  const economicSummary = {
    totalTicketRevenue: feeTracker.ticketRevenue,
    totalVenueLeaseFees: feeTracker.venueLeaseFees,
    totalGameEntryFees: feeTracker.gameEntryFees,
    totalConcessions: feeTracker.concessionsRevenue,
    totalMerchandise: feeTracker.merchRevenue,
    totalSponsorRevenue: feeTracker.sponsorRevenue,
    totalLeagueRewards: feeTracker.leagueRewards,
    totalWeeklyCosts: feeTracker.weeklyOperatingCosts,
    totalPlayerWages: feeTracker.playerWages,
    totalVenueMaintenance: feeTracker.venueMaintenance,
    totalTransportOp: feeTracker.transportOperating,
    totalPlayerRecovery: feeTracker.playerRecovery,
    totalLeagueDues: feeTracker.leagueDues,
    totalTreasuryInflow: feeTracker.trainingGridToTreasury + feeTracker.trainingCashToTreasury + feeTracker.equipmentGridToTreasury + feeTracker.equipmentCashToTreasury + feeTracker.teamMarketplaceTax + feeTracker.playerMarketplaceTax + feeTracker.gameEntryFees + feeTracker.venueLeaseFees + feeTracker.leagueRewards,
    totalBurned: feeTracker.trainingGridBurned + feeTracker.teamMarketplaceBurn,
    totalSolRevenue: feeTracker.solTreasuryInflow,
    totalGameOwnerRevenue: feeTracker.ticketRevenue + feeTracker.concessionsRevenue + feeTracker.merchRevenue + feeTracker.sponsorRevenue - feeTracker.venueLeaseFees - feeTracker.weeklyOperatingCosts,
    netTreasuryChange: (feeTracker.trainingGridToTreasury + feeTracker.trainingCashToTreasury + feeTracker.equipmentGridToTreasury + feeTracker.equipmentCashToTreasury + feeTracker.teamMarketplaceTax + feeTracker.playerMarketplaceTax + feeTracker.gameEntryFees + feeTracker.leagueRewards) - feeTracker.weeklyOperatingCosts,
    avgRevenuePerHomeGame: feeTracker.ticketRevenue / Math.max(1, seasons.reduce((s, m) => s + m.matchesPlayed, 0) / 2),
    avgRevenuePerAwayGame: (feeTracker.concessionsRevenue + feeTracker.merchRevenue) / Math.max(1, seasons.reduce((s, m) => s + m.matchesPlayed, 0) / 2),
  };

  const pumpfunSummary = {
    startingPrice: 0.01,
    finalPrice: pumpFunState.currentPrice,
    allTimeHigh: pumpFunState.allTimeHigh,
    allTimeLow: pumpFunState.allTimeLow,
    totalVolume: pumpFunState.totalVolume,
    totalFees: pumpFunState.totalFeesEarned,
    finalMarketCap: pumpFunState.marketCap,
    priceHistory: pumpFunState.priceHistory,
    regimeTransitions,
  };

  const duration = Date.now() - startTime;

  return {
    usersCreated: users.length,
    teamsCreated: allTeams.filter((t: SimTeam) => !t.isAI).length,
    aiTeamsCreated: allTeams.filter((t: SimTeam) => t.isAI).length,
    totalPlayers: allPlayers.length,
    seasons,
    finalStandings,
    topPlayers,
    feeTracker,
    pumpfunSummary,
    marketplaceSummary,
    economicSummary,
    issues,
    duration,
  };
}

export async function runMegaSimulationV2(
  userCount: number = 250,
  seasonCount: number = 5,
  throttleMs: number = 0
): Promise<MegaSimV2Result> {
  const issues: string[] = [];

  try {
    const state = await initializeMegaSimulation(userCount, seasonCount);

    for (let season = 1; season <= seasonCount; season++) {
      await runMegaSimulationSeason(state, season, throttleMs);
    }

    return buildMegaSimulationResults(state);
  } catch (error: any) {
    issues.push('Fatal error: ' + (error?.message || 'unknown'));
    return {
      usersCreated: 0, teamsCreated: 0, aiTeamsCreated: 0, totalPlayers: 0,
      seasons: [], finalStandings: [], topPlayers: [],
      feeTracker: {} as FeeTracker,
      pumpfunSummary: {} as any,
      marketplaceSummary: {} as any,
      economicSummary: {} as any,
      issues,
      duration: 0,
    };
  }
}

export { initializeMegaSimulation, runMegaSimulationSeason, buildMegaSimulationResults, SimRunState };
