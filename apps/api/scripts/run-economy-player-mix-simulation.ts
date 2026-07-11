import fs from 'fs';

type Archetype = 'FREE_SELLER' | 'HOLDER_UPGRADER' | 'COMPETITIVE_GRINDER' | 'MODERATE_SPENDER' | 'WHALE';

type Agent = {
  id: number;
  archetype: Archetype;
  level: number;
  cash: number;
  dyn: number;
  upgrades: number;
  rosterValue: number;
  games: number;
  wins: number;
  sales: number;
  purchases: number;
  dynSold: number;
  dynBought: number;
  churned: boolean;
  netWorthHistory: number[];
};

type SeasonSummary = {
  season: number;
  activePlayers: number;
  churnedPlayers: number;
  matches: number;
  marketplaceSales: number;
  marketplaceVolumeCash: number;
  dynBought: number;
  dynSold: number;
  dynBurned: number;
  upgradeSpendCash: number;
  upgradeSpendDyn: number;
  rewardEmissionDyn: number;
  totalCash: number;
  totalDyn: number;
  tokenHolderShare: number;
  top10DynShare: number;
  medianNetWorth: number;
};

const USER_COUNT = Number(process.env.SIM_USERS || 240);
const SEASONS = Number(process.env.SIM_SEASONS || 6);
const WEEKS = 52;
const SEED = Number(process.env.SIM_SEED || 20260711);

let seed = SEED >>> 0;
function rng() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
}
function chance(p: number) { return rng() < p; }
function between(min: number, max: number) { return min + rng() * (max - min); }
function int(min: number, max: number) { return Math.floor(between(min, max + 1)); }
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

const MIX: Array<{ archetype: Archetype; share: number }> = [
  { archetype: 'FREE_SELLER', share: 0.55 },
  { archetype: 'HOLDER_UPGRADER', share: 0.15 },
  { archetype: 'COMPETITIVE_GRINDER', share: 0.15 },
  { archetype: 'MODERATE_SPENDER', share: 0.10 },
  { archetype: 'WHALE', share: 0.05 },
];

const PARAMS: Record<Archetype, {
  startCash: [number, number]; startDyn: [number, number];
  gamesPerWeek: [number, number]; winBonus: number; sellChance: number;
  buyChance: number; upgradeChance: number; holdRatio: number; churnBase: number;
}> = {
  FREE_SELLER: { startCash: [2500, 8000], startDyn: [0, 500], gamesPerWeek: [1, 3], winBonus: 500, sellChance: 0.34, buyChance: 0.015, upgradeChance: 0.012, holdRatio: 0.05, churnBase: 0.10 },
  HOLDER_UPGRADER: { startCash: [20000, 60000], startDyn: [12000, 45000], gamesPerWeek: [1, 3], winBonus: 700, sellChance: 0.025, buyChance: 0.08, upgradeChance: 0.24, holdRatio: 0.92, churnBase: 0.025 },
  COMPETITIVE_GRINDER: { startCash: [8000, 22000], startDyn: [1000, 7000], gamesPerWeek: [3, 6], winBonus: 900, sellChance: 0.12, buyChance: 0.04, upgradeChance: 0.07, holdRatio: 0.45, churnBase: 0.045 },
  MODERATE_SPENDER: { startCash: [45000, 100000], startDyn: [8000, 30000], gamesPerWeek: [2, 4], winBonus: 850, sellChance: 0.07, buyChance: 0.16, upgradeChance: 0.16, holdRatio: 0.72, churnBase: 0.025 },
  WHALE: { startCash: [200000, 650000], startDyn: [80000, 300000], gamesPerWeek: [2, 5], winBonus: 1000, sellChance: 0.04, buyChance: 0.32, upgradeChance: 0.31, holdRatio: 0.88, churnBase: 0.01 },
};

function archetypeFor(index: number): Archetype {
  const ratio = index / USER_COUNT;
  let cursor = 0;
  for (const item of MIX) {
    cursor += item.share;
    if (ratio < cursor) return item.archetype;
  }
  return 'WHALE';
}

const agents: Agent[] = Array.from({ length: USER_COUNT }, (_, id) => {
  const archetype = archetypeFor(id);
  const p = PARAMS[archetype];
  return {
    id,
    archetype,
    level: int(1, archetype === 'WHALE' ? 30 : archetype === 'FREE_SELLER' ? 8 : 18),
    cash: between(...p.startCash),
    dyn: between(...p.startDyn),
    upgrades: archetype === 'WHALE' ? int(2, 6) : archetype === 'HOLDER_UPGRADER' ? int(1, 4) : int(0, 2),
    rosterValue: between(12000, archetype === 'WHALE' ? 180000 : 65000),
    games: 0, wins: 0, sales: 0, purchases: 0, dynSold: 0, dynBought: 0,
    churned: false,
    netWorthHistory: [],
  };
});

let treasuryCash = 0;
let treasuryDyn = 0;
let burnedDyn = 0;
const summaries: SeasonSummary[] = [];

for (let season = 1; season <= SEASONS; season++) {
  const start = { matches: 0, sales: 0, volume: 0, bought: 0, sold: 0, burn: burnedDyn, upCash: 0, upDyn: 0, emission: 0 };

  for (let week = 1; week <= WEEKS; week++) {
    const active = agents.filter(a => !a.churned);
    for (const a of active) {
      const p = PARAMS[a.archetype];
      const games = int(...p.gamesPerWeek);
      const upgradeEdge = 1 + Math.min(0.18, a.upgrades * 0.015);
      for (let g = 0; g < games; g++) {
        start.matches++;
        a.games++;
        const winP = Math.min(0.72, 0.42 + (a.level - 8) * 0.008 + (upgradeEdge - 1));
        const won = chance(winP);
        if (won) a.wins++;
        const cashReward = won ? p.winBonus : Math.round(p.winBonus * 0.34);
        const dynReward = won && chance(0.12) ? 2 + Math.floor(a.level / 10) : 0;
        a.cash += cashReward;
        a.dyn += dynReward;
        start.emission += dynReward;
        treasuryCash -= cashReward;
      }

      const trainingCost = 150 + a.level * 18;
      if (chance(a.archetype === 'FREE_SELLER' ? 0.18 : 0.42) && a.cash > trainingCost * 2) {
        a.cash -= trainingCost;
        treasuryCash += trainingCost * 0.85;
        a.rosterValue += trainingCost * between(0.65, 1.3);
        if (chance(0.08)) a.level++;
      }

      if (chance(p.sellChance)) {
        const saleCash = between(450, 2400) * (1 + a.level / 30);
        const marketFee = saleCash * 0.10;
        a.cash += saleCash - marketFee;
        treasuryCash += marketFee;
        a.sales++;
        start.sales++;
        start.volume += saleCash;
      }

      if (chance(p.buyChance) && a.cash > 5000) {
        const cost = between(1200, Math.min(18000, a.cash * 0.22));
        a.cash -= cost;
        a.rosterValue += cost * between(0.7, 1.15);
        treasuryCash += cost * 0.08;
        a.purchases++;
      }

      if (chance(p.upgradeChance)) {
        const cashCost = 3500 * Math.pow(1.55, a.upgrades);
        const dynCost = 180 * Math.pow(1.42, a.upgrades);
        if (a.cash > cashCost * 1.25 && a.dyn > dynCost * 1.1) {
          a.cash -= cashCost;
          a.dyn -= dynCost;
          a.upgrades++;
          treasuryCash += cashCost * 0.82;
          treasuryDyn += dynCost * 0.55;
          const burn = dynCost * 0.45;
          burnedDyn += burn;
          start.upCash += cashCost;
          start.upDyn += dynCost;
        }
      }

      const liquidDyn = a.dyn * (1 - p.holdRatio);
      if (liquidDyn > 5 && chance(a.archetype === 'FREE_SELLER' ? 0.36 : 0.05)) {
        const sold = liquidDyn * between(0.15, 0.55);
        a.dyn -= sold;
        a.cash += sold * 9.5;
        a.dynSold += sold;
        start.sold += sold;
      }
      if (chance(p.buyChance * 0.45) && a.cash > 10000) {
        const spend = Math.min(a.cash * between(0.02, 0.08), 12000);
        const bought = spend / 10;
        a.cash -= spend;
        a.dyn += bought;
        a.dynBought += bought;
        start.bought += bought;
      }

      const upkeep = 90 + a.upgrades * 75 + a.level * 7;
      a.cash -= upkeep;
      treasuryCash += upkeep;

      const netWorth = a.cash + a.dyn * 10 + a.rosterValue;
      a.netWorthHistory.push(netWorth);
      const broke = a.cash < -1000;
      const losingMomentum = a.netWorthHistory.length > 26 && netWorth < a.netWorthHistory[a.netWorthHistory.length - 26] * 0.72;
      if (chance(p.churnBase / 52 + (broke ? 0.035 : 0) + (losingMomentum ? 0.008 : 0))) a.churned = true;
    }
  }

  const active = agents.filter(a => !a.churned);
  const totalDyn = agents.reduce((s, a) => s + Math.max(0, a.dyn), 0);
  const dynSorted = agents.map(a => Math.max(0, a.dyn)).sort((a, b) => b - a);
  const top10Count = Math.max(1, Math.ceil(USER_COUNT * 0.10));
  const top10Dyn = dynSorted.slice(0, top10Count).reduce((s, n) => s + n, 0);
  const holderCount = active.filter(a => a.dyn > 1000 && PARAMS[a.archetype].holdRatio >= 0.7).length;

  summaries.push({
    season,
    activePlayers: active.length,
    churnedPlayers: USER_COUNT - active.length,
    matches: start.matches,
    marketplaceSales: start.sales,
    marketplaceVolumeCash: Math.round(start.volume),
    dynBought: Math.round(start.bought),
    dynSold: Math.round(start.sold),
    dynBurned: Math.round(burnedDyn - start.burn),
    upgradeSpendCash: Math.round(start.upCash),
    upgradeSpendDyn: Math.round(start.upDyn),
    rewardEmissionDyn: Math.round(start.emission),
    totalCash: Math.round(agents.reduce((s, a) => s + a.cash, 0)),
    totalDyn: Math.round(totalDyn),
    tokenHolderShare: active.length ? holderCount / active.length : 0,
    top10DynShare: totalDyn ? top10Dyn / totalDyn : 0,
    medianNetWorth: Math.round(median(active.map(a => a.cash + a.dyn * 10 + a.rosterValue))),
  });
}

const counts = Object.fromEntries(MIX.map(m => [m.archetype, agents.filter(a => a.archetype === m.archetype).length]));
const final = summaries[summaries.length - 1];
const freeSellers = agents.filter(a => a.archetype === 'FREE_SELLER');
const holders = agents.filter(a => a.archetype === 'HOLDER_UPGRADER');
const report = {
  config: { users: USER_COUNT, seasons: SEASONS, weeksPerSeason: WEEKS, seed: SEED, mix: counts },
  constraints: {
    freeSellerShare: freeSellers.length / USER_COUNT,
    holderUpgraderShare: holders.length / USER_COUNT,
    freeSellerConstraintMet: freeSellers.length / USER_COUNT >= 0.50,
    holderUpgraderConstraintMet: holders.length / USER_COUNT >= 0.10,
  },
  final,
  treasury: { cash: Math.round(treasuryCash), dyn: Math.round(treasuryDyn), burnedDyn: Math.round(burnedDyn) },
  archetypes: Object.fromEntries(MIX.map(({ archetype }) => {
    const group = agents.filter(a => a.archetype === archetype);
    return [archetype, {
      count: group.length,
      active: group.filter(a => !a.churned).length,
      churnRate: group.filter(a => a.churned).length / group.length,
      avgCash: Math.round(group.reduce((s, a) => s + a.cash, 0) / group.length),
      avgDyn: Math.round(group.reduce((s, a) => s + a.dyn, 0) / group.length),
      avgUpgrades: Number((group.reduce((s, a) => s + a.upgrades, 0) / group.length).toFixed(2)),
      avgSales: Number((group.reduce((s, a) => s + a.sales, 0) / group.length).toFixed(1)),
      avgWinRate: Number((group.reduce((s, a) => s + (a.games ? a.wins / a.games : 0), 0) / group.length).toFixed(3)),
    }];
  })),
  seasons: summaries,
  guardrails: {
    activeAfterFinalSeason: final.activePlayers / USER_COUNT,
    top10DynShare: final.top10DynShare,
    emissionToBurnRatio: burnedDyn ? summaries.reduce((s, x) => s + x.rewardEmissionDyn, 0) / burnedDyn : null,
    marketplaceLiquidity: summaries.reduce((s, x) => s + x.marketplaceSales, 0),
  },
};

fs.mkdirSync('simulation-results', { recursive: true });
fs.writeFileSync('simulation-results/player-mix-economy.json', JSON.stringify(report, null, 2));
const markdown = `# Player Mix Economy Simulation\n\n- Users: ${USER_COUNT}\n- Seasons: ${SEASONS}\n- Free sellers: ${(report.constraints.freeSellerShare * 100).toFixed(1)}%\n- Holder/upgraders: ${(report.constraints.holderUpgraderShare * 100).toFixed(1)}%\n- Final active players: ${final.activePlayers}/${USER_COUNT}\n- Top 10% DYN ownership: ${(final.top10DynShare * 100).toFixed(1)}%\n- Final token-holder share: ${(final.tokenHolderShare * 100).toFixed(1)}%\n- Marketplace sales: ${report.guardrails.marketplaceLiquidity}\n- DYN burned: ${report.treasury.burnedDyn.toLocaleString()}\n- Emission/burn ratio: ${report.guardrails.emissionToBurnRatio?.toFixed(2)}\n- Median net worth: ${final.medianNetWorth.toLocaleString()}\n`;
fs.writeFileSync('simulation-results/player-mix-economy.md', markdown);
console.log(JSON.stringify(report, null, 2));
