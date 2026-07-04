import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Coins,
  Compass,
  Hand,
  MessageCircle,
  RefreshCw,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { fetchApi } from '../../lib/api';
import { socket } from '../../lib/socket';
import { useWorld, type LiveMatch, type MyStadium } from './WorldSystem';
import { usePanels } from './PanelSystem';
const CityPage = lazy(() => import('../../pages/CityPage'));
const MarketplacePage = lazy(() => import('../../pages/MarketplacePage'));
const LeaderboardPage = lazy(() => import('../../pages/LeaderboardPage'));
const WalletPage = lazy(() => import('../../pages/WalletPage'));
const TrainingPage = lazy(() => import('../../pages/TrainingPage'));
const StadiumInteriorPage = lazy(() => import('../../pages/StadiumInteriorPage'));
const TransportGaragePage = lazy(() => import('../../pages/TransportGaragePage'));
const TeamPage = lazy(() => import('../../pages/TeamPage'));
const MatchesPage = lazy(() => import('../../pages/MatchesPage'));
const PlayerProgressionPage = lazy(() => import('../../pages/PlayerProgressionPage'));

function InteriorPageFallback({ label }: { label: string }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-center text-white">
      <div>
        <div className="mx-auto mb-3 h-12 w-12 animate-pulse rounded-2xl bg-amber-300/20 ring-2 ring-amber-200/40" />
        <div className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Loading station</div>
        <div className="mt-1 text-lg font-black">{label}</div>
      </div>
    </div>
  );
}

const TILE_W = 74;
const TILE_H = 38;

function iso(tileX: number, tileY: number) {
  return {
    x: (tileX - tileY) * (TILE_W / 2),
    y: (tileX + tileY) * (TILE_H / 2),
  };
}

const WORLD_BOUNDS = {
  topY: -610,
  centerY: -90,
  bottomY: 545,
  halfWidth: 1010,
  avatarMargin: 42,
};

function islandHalfWidthAtY(y: number) {
  const { topY, centerY, bottomY, halfWidth } = WORLD_BOUNDS;
  if (y <= centerY) {
    return Math.max(0, ((y - topY) / (centerY - topY)) * halfWidth);
  }
  return Math.max(0, ((bottomY - y) / (bottomY - centerY)) * halfWidth);
}

function clampToWorld(point: { x: number; y: number }) {
  const y = Math.max(WORLD_BOUNDS.topY, Math.min(WORLD_BOUNDS.bottomY, Number.isFinite(point.y) ? point.y : 95));
  const halfWidth = Math.max(WORLD_BOUNDS.avatarMargin, islandHalfWidthAtY(y));
  const minX = -halfWidth + WORLD_BOUNDS.avatarMargin;
  const maxX = halfWidth - WORLD_BOUNDS.avatarMargin;
  const x = Math.max(minX, Math.min(maxX, Number.isFinite(point.x) ? point.x : 0));
  return { x, y };
}

function pointsChanged(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5;
}

type BuildingKind =
  | 'stadium'
  | 'field'
  | 'gym'
  | 'shop'
  | 'clubhouse'
  | 'medical'
  | 'scout'
  | 'trophy'
  | 'garage'
  | 'bank'
  | 'team';

interface SportsBuilding {
  id: string;
  panelId: string;
  label: string;
  subtitle: string;
  loop: string;
  tx: number;
  ty: number;
  color: string;
  accent: string;
  kind: BuildingKind;
}

const BUILDINGS: SportsBuilding[] = [
  { id: 'stadium', panelId: 'stadium', label: 'Home Stadium', subtitle: 'Tickets + Capacity', loop: 'Game-day revenue: ticket yield, stadium wear, owner upgrades', tx: 0, ty: -10, color: '#ef4444', accent: '#991b1b', kind: 'stadium' },
  { id: 'practice', panelId: 'matches', label: 'Practice Field', subtitle: 'Match Volume', loop: 'Play games, generate fans, qualify for better leagues', tx: -10, ty: -5, color: '#22c55e', accent: '#15803d', kind: 'field' },
  { id: 'training', panelId: 'training', label: 'Training Gym', subtitle: 'Develop Assets', loop: 'Spend to improve players, then win or sell upward', tx: 10, ty: -5, color: '#8b5cf6', accent: '#5b21b6', kind: 'gym' },
  { id: 'clubhouse', panelId: 'dashboard', label: 'Clubhouse HQ', subtitle: 'Daily Ops', loop: 'Quests and office tasks route owners back into the economy', tx: -5, ty: 2, color: '#f97316', accent: '#9a3412', kind: 'clubhouse' },
  { id: 'team', panelId: 'team', label: 'Locker Room', subtitle: 'Roster Value', loop: 'Manage lineup, wages, morale, and tradable player value', tx: 5, ty: 2, color: '#38bdf8', accent: '#0369a1', kind: 'team' },
  { id: 'market', panelId: 'market', label: 'Sports Market', subtitle: 'Trade Liquidity', loop: 'Players, gear, slots, and team assets create marketplace volume', tx: -13, ty: 7, color: '#fbbf24', accent: '#b45309', kind: 'shop' },
  { id: 'medical', panelId: 'progression', label: 'Medical Center', subtitle: 'Recovery Sink', loop: 'Injury and fatigue costs protect player value but drain currency', tx: 13, ty: 7, color: '#f8fafc', accent: '#ef4444', kind: 'medical' },
  { id: 'commissioner', panelId: 'commissioner', label: 'Commissioner Office', subtitle: 'Fund Restocks', loop: 'Community funding unlocks limited sports infrastructure inventory', tx: -7, ty: 12, color: '#14b8a6', accent: '#0f766e', kind: 'scout' },
  { id: 'hall', panelId: 'leaderboard', label: 'Trophy Hall', subtitle: 'Prestige Race', loop: 'Rankings create demand for training, travel, and premium leagues', tx: 4, ty: 12, color: '#fde047', accent: '#ca8a04', kind: 'trophy' },
  { id: 'garage', panelId: 'transport', label: 'Team Garage', subtitle: 'Travel Upkeep', loop: 'Better transport reduces fatigue but adds recurring operating costs', tx: 14, ty: 0, color: '#94a3b8', accent: '#475569', kind: 'garage' },
  { id: 'bank', panelId: 'wallet', label: 'Sponsor Bank', subtitle: 'CASH ↔ DYN', loop: 'Sponsorship, exchange, fees, treasury, and token sinks', tx: -14, ty: 0, color: '#0ea5e9', accent: '#075985', kind: 'bank' },
];

type LeagueGateStatus = 'open' | 'locked' | 'owner';

interface LeagueGate {
  id: string;
  name: string;
  label: string;
  tier: string;
  tx: number;
  ty: number;
  route: Array<[number, number]>;
  color: string;
  accent: string;
  status: LeagueGateStatus;
  operator: string;
  entry: string;
  revenue: string;
  maintenance: string;
  tax: string;
  userIncentive: string;
}

const LEAGUE_GATES: LeagueGate[] = [
  {
    id: 'launch-rec',
    name: 'Launch Rec League',
    label: 'GRID Rec Road',
    tier: 'Launch / Basic',
    tx: -17,
    ty: 0,
    route: [[0, 0], [-4, 0], [-8, 0], [-12, 0], [-16, 0]],
    color: '#22c55e',
    accent: '#166534',
    status: 'open',
    operator: 'Game-run league',
    entry: 'Open to starter teams',
    revenue: 'Fixed league rewards, ticket growth, player progression value',
    maintenance: 'Low travel, small venue wear, basic staff costs',
    tax: 'Standard marketplace and game economy fees',
    userIncentive: 'Safe first loop: play games, earn fans, improve players, sell developed talent upward.',
  },
  {
    id: 'regional-grid',
    name: 'Regional League',
    label: 'Regional Route',
    tier: 'Promotion Gate',
    tx: 0,
    ty: -14,
    route: [[0, 0], [0, -3], [0, -7], [0, -11], [0, -14]],
    color: '#38bdf8',
    accent: '#0369a1',
    status: 'locked',
    operator: 'Game-run league',
    entry: 'Requires team OVR, wins, or a league pass',
    revenue: 'Higher tickets, sponsor bonuses, and leaderboard rewards',
    maintenance: 'Travel and stadium standards increase with league tier',
    tax: 'Game tax funds sinks, reward pools, and platform volume',
    userIncentive: 'A visible reason to train, upgrade transport, and build a roster instead of only grinding matches.',
  },
  {
    id: 'creator-leagues',
    name: 'Creator League District',
    label: 'Owner Leagues',
    tier: 'User-owned',
    tx: 17,
    ty: 0,
    route: [[0, 0], [4, 0], [8, 0], [12, 0], [16, 0]],
    color: '#a855f7',
    accent: '#6b21a8',
    status: 'owner',
    operator: 'User-run leagues',
    entry: 'Join by skill rating, invitation, season fee, or owner rules',
    revenue: 'Owners earn league revenue from season activity and demand',
    maintenance: 'Owners pay upkeep, reward escrow, and platform game tax',
    tax: 'A game tax keeps every league creating platform revenue and sinks',
    userIncentive: 'Players build leagues worth joining; better leagues attract outside teams and trade volume.',
  },
  {
    id: 'elite-franchise',
    name: 'Elite Franchise Circuit',
    label: 'Pro Circuit',
    tier: 'Premium / Custom',
    tx: 0,
    ty: 15,
    route: [[0, 0], [0, 3], [0, 7], [0, 11], [0, 15]],
    color: '#f59e0b',
    accent: '#92400e',
    status: 'locked',
    operator: 'Game + top user leagues',
    entry: 'High prestige, paid accelerators, or qualifying seasons',
    revenue: 'Media-style payouts, sponsor cards, elite player sales',
    maintenance: 'High upkeep, travel, player wages, and facility wear',
    tax: 'Higher activity creates more marketplace volume and platform fees',
    userIncentive: 'Long-term aspirational path: own facilities, recruit stars, host events, and build prestige.',
  },
];

function isLeaguePathTile(tx: number, ty: number) {
  return LEAGUE_GATES.some((gate) => gate.route.some(([rx, ry]) => Math.abs(tx - rx) <= 1 && Math.abs(ty - ry) <= 1));
}


interface DailyQuestHudItem {
  id: string;
  label: string;
  progress: number;
  total: number;
  completed: boolean;
  claimed: boolean;
  rewardLabel: string;
}

interface ChatHudMessage {
  id: string;
  channel: string;
  user: string;
  msg: string;
  createdAt?: string;
}

interface WalletSnapshot {
  cash: number;
  dynTokens: number;
}

interface EconomyMeter {
  key: string;
  label: string;
  value: number;
  target: number;
  progress: number;
  unit: string;
  description?: string;
}

interface BuildingEconomyLoop {
  buildingId: string;
  label: string;
  meterKey: string;
  progress: number;
  status: string;
}

interface CommissionerInventoryItem {
  id: string;
  name: string;
  description: string;
  category: string;
  currency: string;
  price: number;
  priceLabel: string;
  quantityTotal: number;
  quantityRemaining: number;
  phase: string;
  unlocked: boolean;
  soldOut: boolean;
  unlockProgress: number;
}

interface CommissionerOverview {
  cycle: {
    id: string;
    title: string;
    phase: string;
    fundingRaised: number;
    fundingGoal: number;
    rewardPool: number;
    fundingCurrency: string;
  };
  inventory: CommissionerInventoryItem[];
  meters: EconomyMeter[];
  buildingLoops: BuildingEconomyLoop[];
  myStats: { dynEquivalentFunded: number; purchaseCount: number; rewardDynEquivalent: number; share: number };
  topContributors: Array<{ userId: string; username: string; dynEquivalent: number; rewardDyn: number }>;
  recentActivity: Array<{ id: string; type: string; username: string; amount: number; currency: string; dynEquivalent: number; rewardDyn: number; inventoryName?: string; createdAt: string }>;
}

const NPCS = [
  { name: 'Coach Mills', role: 'Daily Drills', tx: -9, ty: -3, color: '#f97316', marker: '?' },
  { name: 'Scout Ava', role: 'Prospects', tx: -8, ty: 10, color: '#14b8a6', marker: '!' },
  { name: 'Medic Jo', role: 'Recovery', tx: 12, ty: 6, color: '#ef4444', marker: '+' },
  { name: 'Ticket Sam', role: 'Revenue', tx: -12, ty: 6, color: '#fbbf24', marker: '$' },
];

type HotbarSlot = {
  key: string;
  icon: string;
  label: string;
  miniGameType: 'TEAM_DRILL' | 'SCOUTING' | 'STADIUM_MATCH';
};

const HOTBAR: HotbarSlot[] = [
  { key: '1', icon: '🏟️', label: 'Match', miniGameType: 'STADIUM_MATCH' },
  { key: '2', icon: '💪', label: 'Drill', miniGameType: 'TEAM_DRILL' },
  { key: '3', icon: '🔭', label: 'Scout', miniGameType: 'SCOUTING' },
];

const BUILDING_SIGNS: Record<string, { code: string; icon: string; fill: string; text: string }> = {
  stadium: { code: 'GRID', icon: '🏟', fill: '#991b1b', text: 'Home field' },
  practice: { code: 'PLAY', icon: '▶', fill: '#166534', text: 'Match field' },
  training: { code: 'GYM', icon: '◆', fill: '#5b21b6', text: 'Training' },
  clubhouse: { code: 'HQ', icon: '★', fill: '#9a3412', text: 'Daily ops' },
  team: { code: 'LOCKER', icon: '◆', fill: '#0369a1', text: 'Roster' },
  market: { code: 'DROP', icon: '◆', fill: '#b45309', text: 'Market' },
  medical: { code: 'MED', icon: '+', fill: '#ef4444', text: 'Recovery' },
  commissioner: { code: 'COMMISH', icon: '◆', fill: '#0f766e', text: 'Restocks' },
  hall: { code: 'HOF', icon: '★', fill: '#ca8a04', text: 'Prestige' },
  garage: { code: 'BUS', icon: '◆', fill: '#475569', text: 'Travel' },
  bank: { code: 'DYN', icon: '$', fill: '#075985', text: 'Sponsor bank' },
};

const ONBOARDING_STEPS: Array<{ title: string; body: string; buildingIds: string[]; action: string }> = [
  {
    title: '1. Start as a local coach',
    body: 'Open the Clubhouse and Locker Room first. Your job is to turn a starter roster into a real sports business.',
    buildingIds: ['clubhouse', 'team'],
    action: 'Enter HQ or Locker Room',
  },
  {
    title: '2. Develop players before chasing leagues',
    body: 'Use Training to raise roster value. Better players win more, sell for more, and justify higher stadium demand.',
    buildingIds: ['training', 'team'],
    action: 'Train or manage roster',
  },
  {
    title: '3. Play matches to create revenue',
    body: 'Practice Field and Stadium are the first cash loop: schedule, play, earn fans, and create game-day revenue.',
    buildingIds: ['practice', 'stadium'],
    action: 'Play match loop',
  },
  {
    title: '4. Spend on infrastructure, not mining',
    body: 'Upgrade stadium, travel, recovery, and market inventory. These are sports-economy sinks that build status.',
    buildingIds: ['stadium', 'garage', 'medical', 'market'],
    action: 'Upgrade the business',
  },
  {
    title: '5. Graduate into scarce leagues',
    body: 'Commissioner funding, sponsor treasury, and league gates create the Kintara-style long game: scarcity, ownership, and status.',
    buildingIds: ['commissioner', 'bank', 'hall'],
    action: 'Fund, sponsor, compete',
  },
];

function questTargetsFor(quest: DailyQuestHudItem) {
  const text = `${quest.id} ${quest.label}`.toLowerCase();
  if (text.includes('match') || text.includes('game') || text.includes('play')) return ['practice', 'stadium'];
  if (text.includes('train') || text.includes('drill')) return ['training'];
  if (text.includes('equip') || text.includes('market') || text.includes('buy') || text.includes('purchase')) return ['market'];
  if (text.includes('sponsor') || text.includes('wallet') || text.includes('dyn')) return ['bank'];
  if (text.includes('league') || text.includes('commissioner') || text.includes('fund')) return ['commissioner'];
  if (text.includes('transport') || text.includes('travel') || text.includes('garage')) return ['garage'];
  if (text.includes('heal') || text.includes('recover') || text.includes('injur') || text.includes('medical')) return ['medical'];
  if (text.includes('roster') || text.includes('lineup') || text.includes('hire') || text.includes('team')) return ['team'];
  return [];
}

function darker(hex: string, amount = 34) {
  const raw = hex.replace('#', '');
  const n = parseInt(raw, 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) - amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) - amount));
  const b = Math.min(255, Math.max(0, (n & 255) - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function stadiumVisualLevel(stadium: { tier?: string; upgrades?: number; capacity?: number } | null) {
  const tierLevels: Record<string, number> = {
    shack: 0,
    basic: 1,
    standard: 2,
    premium: 3,
    elite: 4,
    legendary: 5,
  };
  const tierLevel = tierLevels[(stadium?.tier || '').toLowerCase()] ?? 0;
  const upgradeLevel = Math.floor((stadium?.upgrades ?? 0) / 2);
  const capacityLevel = Math.floor((stadium?.capacity ?? 0) / 15000);
  return Math.max(0, Math.min(5, Math.max(tierLevel, upgradeLevel, capacityLevel)));
}

function Tile({ x, y, fill, stroke = '#5fa83f' }: { x: number; y: number; fill: string; stroke?: string }) {
  return (
    <polygon
      points={`${x},${y - TILE_H / 2} ${x + TILE_W / 2},${y} ${x},${y + TILE_H / 2} ${x - TILE_W / 2},${y}`}
      fill={fill}
      stroke={stroke}
      strokeWidth={0.8}
    />
  );
}

function BlockTree({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={2} cy={8} rx={22} ry={11} fill="rgba(0,0,0,0.25)" />
      <rect x={-5} y={-18} width={10} height={26} rx={2} fill="#8b5a2b" />
      <rect x={-1} y={-18} width={3} height={25} fill="#b77943" opacity={0.55} />
      <polygon points="0,-71 32,-37 0,-23 -32,-37" fill="#176d34" stroke="#0f5132" strokeWidth={1.5} />
      <polygon points="0,-58 37,-24 0,-10 -37,-24" fill="#22a447" stroke="#176d34" strokeWidth={1.5} />
      <polygon points="0,-41 31,-11 0,3 -31,-11" fill="#3bc263" stroke="#176d34" strokeWidth={1.5} />
      <path d="M -7 -58 L 15 -39 L -5 -31 L -23 -40 Z" fill="#86efac" opacity={0.35} />
      <path d="M -8 -40 L 16 -18 L -6 -10 L -24 -19 Z" fill="#bbf7d0" opacity={0.32} />
    </g>
  );
}

type DecorationKind = 'lamp' | 'bench' | 'cone' | 'flag' | 'food' | 'bus' | 'statue' | 'ad';

const DECORATIONS: Array<{ kind: DecorationKind; tx: number; ty: number; color?: string; label?: string }> = [
  { kind: 'lamp', tx: -4, ty: -2 },
  { kind: 'lamp', tx: 4, ty: 2 },
  { kind: 'lamp', tx: -8, ty: 4 },
  { kind: 'lamp', tx: 8, ty: -2 },
  { kind: 'bench', tx: -5, ty: 3 },
  { kind: 'bench', tx: 6, ty: 3 },
  { kind: 'cone', tx: -11, ty: -6, color: '#fb923c' },
  { kind: 'cone', tx: -9, ty: -4, color: '#fb923c' },
  { kind: 'flag', tx: -2, ty: -11, color: '#ef4444', label: 'HOME' },
  { kind: 'flag', tx: 4, ty: -10, color: '#38bdf8', label: 'AWAY' },
  { kind: 'food', tx: -14, ty: 6, color: '#f59e0b' },
  { kind: 'food', tx: -12, ty: 9, color: '#ef4444' },
  { kind: 'bus', tx: 13, ty: -2 },
  { kind: 'statue', tx: 3, ty: 10 },
  { kind: 'ad', tx: -5, ty: -9, color: '#0f172a', label: 'DYN CUP' },
  { kind: 'ad', tx: 8, ty: 10, color: '#111827', label: 'OWNER LEAGUES' },
];

const CROWD_CLUSTERS = [
  { tx: -3, ty: -11, color: '#60a5fa' },
  { tx: 3, ty: -11, color: '#f87171' },
  { tx: -1, ty: -8, color: '#fde047' },
  { tx: 12, ty: 5, color: '#34d399' },
  { tx: -13, ty: 5, color: '#fb7185' },
  { tx: 4, ty: 11, color: '#c084fc' },
];

function meterProgress(meters: EconomyMeter[], key: string) {
  return meters.find((meter) => meter.key === key)?.progress ?? 0;
}

function buildingUpgradeStage(buildingId: string, economyLoop: BuildingEconomyLoop | undefined, economyMeters: EconomyMeter[], stadiumLevel = 0) {
  if (buildingId === 'stadium') return stadiumLevel;
  const loopProgress = economyLoop?.progress ?? 0;
  const meterBoost = buildingId === 'market'
    ? Math.max(meterProgress(economyMeters, 'limitedInventory'), meterProgress(economyMeters, 'inventoryScarcity'))
    : buildingId === 'commissioner'
      ? Math.max(meterProgress(economyMeters, 'communityFunding'), meterProgress(economyMeters, 'rewardPool'))
      : buildingId === 'bank'
        ? meterProgress(economyMeters, 'rewardPool')
        : loopProgress;
  return Math.max(0, Math.min(5, Math.ceil(Math.max(loopProgress, meterBoost) / 20)));
}

function WorldEconomyEvents({
  myStadium,
  liveMatches,
  commissionerOverview,
  economyMeters,
}: {
  myStadium: MyStadium | null;
  liveMatches: LiveMatch[];
  commissionerOverview: CommissionerOverview | null;
  economyMeters: EconomyMeter[];
}) {
  const funding = meterProgress(economyMeters, 'communityFunding');
  const restock = meterProgress(economyMeters, 'limitedInventory');
  const scarcity = meterProgress(economyMeters, 'inventoryScarcity');
  const rewards = meterProgress(economyMeters, 'rewardPool');
  const liveAttendance = myStadium?.liveMatch?.attendance ?? liveMatches[0]?.attendance ?? 0;
  const capacity = myStadium?.capacity ?? myStadium?.liveMatch?.capacity ?? 5000;
  const crowdLevel = Math.max(0, Math.min(5, Math.ceil((liveAttendance || capacity * 0.22) / Math.max(1, capacity) * 5)));
  const condition = myStadium?.condition ?? 92;
  const inventory = commissionerOverview?.inventory ?? [];
  const remainingDrops = inventory.reduce((sum, item) => sum + Math.max(0, item.quantityRemaining), 0);
  const unlockedDrops = inventory.filter((item) => item.unlocked && !item.soldOut).length;
  const marketCrates = Math.max(1, Math.min(6, unlockedDrops || Math.ceil(restock / 20) || Math.ceil(remainingDrops / 5)));
  const stadiumPoint = iso(0, -10);
  const marketPoint = iso(-13, 7);
  const commissionerPoint = iso(-7, 12);
  const bankPoint = iso(-14, 0);
  const medicalPoint = iso(13, 7);
  return (
    <g style={{ pointerEvents: 'none' }}>
      <g transform={`translate(${stadiumPoint.x}, ${stadiumPoint.y})`}>
        {Array.from({ length: crowdLevel }).map((_, idx) => (
          <g key={`crowd-event-${idx}`} transform={`translate(${-120 + idx * 60}, ${44 + (idx % 2) * 12})`}>
            <rect x={-22} y={-18} width={44} height={22} rx={8} fill="#0f172a" stroke="#fde047" strokeWidth={1.5} opacity={0.9} />
            <text x={0} y={-3} textAnchor="middle" fill="#fde047" fontSize={8} fontWeight={900}>FANS</text>
          </g>
        ))}
        <g transform="translate(-4, 96)">
          <rect x={-82} y={-16} width={164} height={32} rx={12} fill={condition < 75 ? '#7f1d1d' : '#064e3b'} stroke="#fef3c7" strokeWidth={2} />
          <text x={0} y={5} textAnchor="middle" fill="#fff7ed" fontSize={10} fontWeight={900}>{condition < 75 ? `REPAIR DUE • ${condition}%` : `GAME-DAY READY • ${condition}%`}</text>
        </g>
      </g>

      <g transform={`translate(${marketPoint.x}, ${marketPoint.y})`}>
        <rect x={-92} y={68} width={184} height={30} rx={12} fill="#451a03" stroke="#facc15" strokeWidth={2} />
        <text x={0} y={88} textAnchor="middle" fill="#fde68a" fontSize={10} fontWeight={900}>{scarcity >= 75 ? 'SOLD-OUT PRESSURE' : `RESTOCK QUEUE • ${restock}%`}</text>
        {Array.from({ length: marketCrates }).map((_, idx) => (
          <g key={`crate-${idx}`} transform={`translate(${-66 + idx * 26}, ${34 + (idx % 2) * 10})`}>
            <rect x={-10} y={-10} width={20} height={20} rx={3} fill={idx % 2 ? '#f59e0b' : '#fef3c7'} stroke="#78350f" strokeWidth={1.5} />
            <path d="M -10 0 H 10 M 0 -10 V 10" stroke="#78350f" strokeWidth={1} />
          </g>
        ))}
      </g>

      <g transform={`translate(${commissionerPoint.x}, ${commissionerPoint.y})`}>
        <rect x={-108} y={46} width={216} height={34} rx={14} fill="#042f2e" stroke="#5eead4" strokeWidth={2} />
        <rect x={-92} y={59} width={184} height={8} rx={4} fill="#134e4a" />
        <rect x={-92} y={59} width={(184 * Math.max(funding, rewards)) / 100} height={8} rx={4} fill="#5eead4" />
        <text x={0} y={41} textAnchor="middle" fill="#ccfbf1" fontSize={10} fontWeight={900}>COMMUNITY FUNDING {funding}%</text>
        <text x={0} y={94} textAnchor="middle" fill="#fde047" fontSize={9} fontWeight={900}>Reward pool signal {rewards}%</text>
      </g>

      <g transform={`translate(${bankPoint.x}, ${bankPoint.y})`}>
        <rect x={-92} y={58} width={184} height={30} rx={12} fill="#075985" stroke="#facc15" strokeWidth={2} />
        <text x={0} y={78} textAnchor="middle" fill="#fef3c7" fontSize={10} fontWeight={900}>SPONSOR TREASURY ACTIVE</text>
      </g>

      {condition < 85 && (
        <g transform={`translate(${medicalPoint.x}, ${medicalPoint.y})`}>
          <circle cx={88} cy={-70} r={24} fill="#ef4444" stroke="#fff7ed" strokeWidth={3} filter="url(#warmGlow)" />
          <text x={88} y={-62} textAnchor="middle" fill="#fff" fontSize={24} fontWeight={900}>+</text>
          <text x={88} y={-28} textAnchor="middle" fill="#7f1d1d" fontSize={9} fontWeight={900}>CARE COSTS</text>
        </g>
      )}
    </g>
  );
}

function DistrictGround({ building }: { building: SportsBuilding }) {
  const { x, y } = iso(building.tx, building.ty);
  const large = building.kind === 'stadium' || building.kind === 'field';
  return (
    <g transform={`translate(${x}, ${y})`} opacity={0.9}>
      <ellipse cx={0} cy={8} rx={large ? 150 : 82} ry={large ? 62 : 36} fill={building.color} opacity={0.14} />
      <ellipse cx={0} cy={8} rx={large ? 126 : 64} ry={large ? 50 : 28} fill="none" stroke={building.accent} strokeWidth={2} strokeDasharray="10 8" opacity={0.45} />
      {building.kind === 'garage' && (
        <g opacity={0.72}>
          {[-42, -21, 0, 21, 42].map((lx) => <line key={lx} x1={lx} y1={36} x2={lx + 24} y2={10} stroke="#e2e8f0" strokeWidth={2} />)}
        </g>
      )}
      {building.kind === 'shop' && (
        <g opacity={0.85}>
          {[-38, -14, 10, 34].map((lx, idx) => <rect key={lx} x={lx} y={18} width={18} height={10} rx={2} fill={idx % 2 ? '#fef3c7' : '#ef4444'} />)}
        </g>
      )}
    </g>
  );
}

function Decoration({ item }: { item: (typeof DECORATIONS)[number] }) {
  const { x, y } = iso(item.tx, item.ty);
  if (item.kind === 'lamp') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx={0} cy={7} rx={12} ry={5} fill="rgba(0,0,0,0.18)" />
        <rect x={-2} y={-38} width={4} height={44} fill="#334155" />
        <circle cx={0} cy={-43} r={9} fill="#fde68a" opacity={0.95} filter="url(#warmGlow)" />
      </g>
    );
  }
  if (item.kind === 'bench') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx={0} cy={7} rx={20} ry={7} fill="rgba(0,0,0,0.16)" />
        <rect x={-22} y={-8} width={44} height={8} rx={2} fill="#92400e" />
        <rect x={-18} y={-20} width={36} height={8} rx={2} fill="#b45309" />
        <rect x={-18} y={0} width={4} height={12} fill="#475569" />
        <rect x={14} y={0} width={4} height={12} fill="#475569" />
      </g>
    );
  }
  if (item.kind === 'cone') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx={0} cy={4} rx={12} ry={5} fill="rgba(0,0,0,0.18)" />
        <path d="M -10 4 L 0 -28 L 10 4 Z" fill={item.color || '#fb923c'} stroke="#9a3412" />
        <rect x={-6} y={-9} width={12} height={4} fill="#fff7ed" opacity={0.9} />
      </g>
    );
  }
  if (item.kind === 'flag') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx={0} cy={9} rx={16} ry={7} fill="rgba(0,0,0,0.18)" />
        <rect x={-2} y={-60} width={4} height={68} fill="#475569" />
        <path d="M 2 -60 L 54 -48 L 2 -36 Z" fill={item.color || '#ef4444'} stroke="#0f172a" />
        <text x={27} y={-47} textAnchor="middle" fill="#fff" fontSize={7} fontWeight={900}>{item.label}</text>
      </g>
    );
  }
  if (item.kind === 'food') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx={0} cy={14} rx={28} ry={12} fill="rgba(0,0,0,0.2)" />
        <rect x={-24} y={-22} width={48} height={34} rx={4} fill={item.color || '#f59e0b'} stroke="#7c2d12" />
        <path d="M -26 -22 L 26 -22 L 18 -38 L -18 -38 Z" fill="#fef3c7" stroke="#7c2d12" />
        <circle cx={-15} cy={15} r={5} fill="#111827" />
        <circle cx={15} cy={15} r={5} fill="#111827" />
      </g>
    );
  }
  if (item.kind === 'bus') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx={0} cy={15} rx={42} ry={15} fill="rgba(0,0,0,0.22)" />
        <rect x={-40} y={-26} width={80} height={40} rx={8} fill="#fbbf24" stroke="#92400e" strokeWidth={2} />
        {[-24, 0, 24].map((lx) => <rect key={lx} x={lx - 9} y={-18} width={18} height={14} rx={2} fill="#bae6fd" />)}
        <circle cx={-24} cy={16} r={7} fill="#111827" />
        <circle cx={26} cy={16} r={7} fill="#111827" />
      </g>
    );
  }
  if (item.kind === 'statue') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <ellipse cx={0} cy={9} rx={22} ry={10} fill="rgba(0,0,0,0.18)" />
        <rect x={-18} y={-8} width={36} height={16} rx={3} fill="#94a3b8" stroke="#475569" />
        <path d="M -7 -8 L 0 -54 L 7 -8 Z" fill="#e2e8f0" stroke="#64748b" />
        <circle cx={0} cy={-61} r={9} fill="#facc15" stroke="#92400e" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={0} cy={12} rx={44} ry={14} fill="rgba(0,0,0,0.2)" />
      <rect x={-4} y={-48} width={8} height={58} fill="#475569" />
      <rect x={-58} y={-78} width={116} height={34} rx={6} fill={item.color || '#0f172a'} stroke="#facc15" strokeWidth={2} />
      <text x={0} y={-56} textAnchor="middle" fill="#fef3c7" fontSize={11} fontWeight={900}>{item.label}</text>
    </g>
  );
}

function CrowdCluster({ tx, ty, color }: { tx: number; ty: number; color: string }) {
  const { x, y } = iso(tx, ty);
  return (
    <g transform={`translate(${x}, ${y})`} opacity={0.95}>
      <ellipse cx={0} cy={8} rx={24} ry={10} fill="rgba(0,0,0,0.14)" />
      {[[-14, -10], [0, -15], [14, -8], [-4, -2], [10, 2]].map(([cx, cy], idx) => (
        <g key={idx} transform={`translate(${cx}, ${cy})`}>
          <circle r={5} fill="#f7c89d" stroke="#0f172a" strokeWidth={0.8} />
          <rect x={-5} y={5} width={10} height={12} rx={2} fill={idx % 2 ? color : '#1d4ed8'} stroke="#0f172a" strokeWidth={0.8} />
        </g>
      ))}
    </g>
  );
}

function WaterfrontDetails() {
  return (
    <g opacity={0.58}>
      {[-920, -620, -310, 40, 380, 730].map((x, idx) => (
        <path key={`wave-top-${idx}`} d={`M ${x} ${-625 + (idx % 2) * 32} q 38 -20 76 0 t 76 0`} fill="none" stroke="#e0f2fe" strokeWidth={4} strokeLinecap="round" />
      ))}
      {[-900, -560, -200, 170, 520, 840].map((x, idx) => (
        <path key={`wave-bottom-${idx}`} d={`M ${x} ${548 - (idx % 2) * 28} q 36 18 72 0 t 72 0`} fill="none" stroke="#e0f2fe" strokeWidth={4} strokeLinecap="round" />
      ))}
    </g>
  );
}

function VoxelAvatar({ x, y, name, level, color, isPlayer = false }: { x: number; y: number; name: string; level: number; color: string; isPlayer?: boolean }) {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={10} rx={15} ry={7} fill="rgba(0,0,0,0.25)" />
      <g className={isPlayer ? 'animate-pulse' : ''}>
        <rect x={-7} y={-16} width={14} height={20} rx={3} fill={color} stroke="#0f172a" strokeWidth={1.4} />
        <rect x={-9} y={-31} width={18} height={18} rx={4} fill="#f7c89d" stroke="#0f172a" strokeWidth={1.4} />
        <rect x={-10} y={-35} width={20} height={6} rx={2} fill={isPlayer ? '#2563eb' : '#334155'} />
        <rect x={-13} y={-13} width={5} height={15} rx={2} fill={darker(color, 18)} />
        <rect x={8} y={-13} width={5} height={15} rx={2} fill={darker(color, 18)} />
        <rect x={-6} y={3} width={5} height={14} rx={2} fill="#1e293b" />
        <rect x={1} y={3} width={5} height={14} rx={2} fill="#1e293b" />
      </g>
      <g transform="translate(0, -58)">
        <rect x={-47} y={-14} width={94} height={28} rx={10} fill="rgba(15,23,42,0.88)" stroke={isPlayer ? '#60a5fa' : '#475569'} />
        <text x={0} y={-2} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={800}>{name}</text>
        <text x={0} y={10} textAnchor="middle" fill={isPlayer ? '#93c5fd' : '#cbd5e1'} fontSize={8} fontWeight={700}>LVL {level}</text>
      </g>
    </g>
  );
}

function StadiumBuilding({ building, upgradeLevel = 0 }: { building: SportsBuilding; upgradeLevel?: number }) {
  const { x, y } = iso(building.tx, building.ty);
  const level = Math.max(0, Math.min(5, Math.round(upgradeLevel)));
  const outerRx = 124 + level * 15;
  const outerRy = 56 + level * 6;
  const innerRx = 66 + level * 4;
  const innerRy = 28 + level * 2;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={0} cy={24} rx={outerRx + 12} ry={outerRy + 10} fill="rgba(0,0,0,0.22)" />
      {level >= 3 && <ellipse cx={0} cy={-24} rx={outerRx + 16} ry={outerRy + 10} fill="none" stroke="#fef3c7" strokeWidth={8} opacity={0.45} strokeDasharray="34 18" />}
      <ellipse cx={0} cy={-18} rx={outerRx} ry={outerRy} fill={building.accent} stroke="#111827" strokeWidth={2.5} />
      <ellipse cx={0} cy={-31} rx={outerRx - 22} ry={outerRy - 10} fill={building.color} stroke="#fee2e2" strokeWidth={2} />
      {level >= 1 && <ellipse cx={0} cy={-38} rx={outerRx - 43} ry={outerRy - 21} fill="#fecaca" stroke="#991b1b" strokeWidth={1.5} opacity={0.95} />}
      <ellipse cx={0} cy={-31} rx={innerRx} ry={innerRy} fill="#30c85f" stroke="#dcfce7" strokeWidth={2} />
      <rect x={-innerRx + 16} y={-43} width={innerRx * 2 - 32} height={24} rx={9} fill="none" stroke="#ffffff" strokeWidth={1.2} opacity={0.72} />
      {[-48, -24, 0, 24, 48].map((lx) => (
        <line key={lx} x1={lx} y1={-57} x2={lx} y2={-7} stroke="#ffffff" strokeWidth={1} opacity={0.72} />
      ))}
      {level >= 2 && [-108, -72, 72, 108].map((lx) => (
        <rect key={lx} x={lx - 18} y={-89} width={36} height={16} rx={4} fill="#fef3c7" stroke="#92400e" strokeWidth={1.5} />
      ))}
      {level >= 1 && [-112, -58, 58, 112].map((lx, idx) => (
        <g key={`sponsor-${idx}`} transform={`translate(${lx}, ${idx % 2 ? -10 : 8})`}>
          <rect x={-28} y={0} width={56} height={15} rx={4} fill={idx % 2 ? '#0f172a' : '#fbbf24'} stroke="#111827" strokeWidth={1.5} />
          <text x={0} y={11} textAnchor="middle" fill={idx % 2 ? '#fbbf24' : '#111827'} fontSize={8} fontWeight={900}>SPONSOR</text>
        </g>
      ))}
      <rect x={-48 - level * 5} y={-112 - level * 7} width={96 + level * 10} height={26 + level * 4} rx={5} fill="#0f172a" stroke={level >= 4 ? '#fde047' : '#64748b'} strokeWidth={2.5} />
      <text x={0} y={-94 - level * 7} textAnchor="middle" fill="#fff" fontSize={level >= 4 ? 10 : 8} fontWeight={900}>GRID 00 - 00 GUEST</text>
      {level >= 4 && <text x={0} y={-122} textAnchor="middle" fill="#fde047" fontSize={9} fontWeight={900}>ULTRA BOARD</text>}
      {[[-108 - level * 10, -96 - level * 3], [108 + level * 10, -96 - level * 3], [-120 - level * 8, -6], [120 + level * 8, -6]].map(([lx, ly], idx) => (
        <g key={idx}>
          <rect x={lx - 4} y={ly} width={8} height={78 + level * 6} fill="#475569" />
          <circle cx={lx} cy={ly - 4} r={11 + level} fill="#fde047" opacity={0.9} filter="url(#warmGlow)" />
        </g>
      ))}
      {level >= 5 && (
        <g>
          <path d="M -154 42 L -92 16 L -62 30 L -124 58 Z" fill="#111827" stroke="#fbbf24" strokeWidth={2} />
          <path d="M 154 42 L 92 16 L 62 30 L 124 58 Z" fill="#111827" stroke="#fbbf24" strokeWidth={2} />
          <text x={-110} y={40} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight={900}>VIP</text>
          <text x={110} y={40} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight={900}>CLUB</text>
        </g>
      )}
      <g transform={`translate(${outerRx - 22}, ${outerRy - 12})`}>
        <rect x={-44} y={-18} width={88} height={24} rx={8} fill="#fef3c7" stroke="#92400e" strokeWidth={1.5} />
        <text x={0} y={-2} textAnchor="middle" fill="#92400e" fontSize={9} fontWeight={900}>{level > 0 ? `UPGRADE ${level}` : 'STARTER PARK'}</text>
      </g>
    </g>
  );
}

function FieldBuilding({ building }: { building: SportsBuilding }) {
  const { x, y } = iso(building.tx, building.ty);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={0} cy={16} rx={72} ry={34} fill="rgba(0,0,0,0.18)" />
      <polygon points="-80,-10 0,-50 80,-10 0,30" fill="#22c55e" stroke="#166534" strokeWidth={2} />
      <polygon points="-58,-10 0,-39 58,-10 0,18" fill="#4ade80" stroke="#dcfce7" strokeWidth={1.5} />
      {[-30, -15, 0, 15, 30].map((lx) => (
        <line key={lx} x1={lx} y1={-33} x2={lx} y2={14} stroke="#fff" strokeWidth={0.8} opacity={0.7} />
      ))}
      <rect x={-72} y={-43} width={20} height={32} fill="#eab308" stroke="#92400e" />
      <rect x={52} y={-43} width={20} height={32} fill="#eab308" stroke="#92400e" />
    </g>
  );
}

function BoxBuilding({ building, upgradeStage = 0 }: { building: SportsBuilding; upgradeStage?: number }) {
  const { x, y } = iso(building.tx, building.ty);
  const stage = Math.max(0, Math.min(5, Math.round(upgradeStage)));
  const w = building.kind === 'gym' ? 112 : building.kind === 'garage' ? 132 : building.kind === 'bank' ? 112 : building.kind === 'shop' ? 118 : building.kind === 'medical' ? 100 : building.kind === 'team' ? 104 : 86;
  const h = building.kind === 'clubhouse' ? 96 : building.kind === 'scout' ? 132 : building.kind === 'trophy' ? 92 : building.kind === 'bank' ? 108 : building.kind === 'garage' ? 78 : building.kind === 'team' ? 82 : 72;
  const d = building.kind === 'garage' ? 72 : building.kind === 'shop' ? 62 : building.kind === 'team' ? 58 : 50;
  const roof = building.kind === 'bank' ? '#e0f2fe' : darker(building.color, -8);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={0} cy={16} rx={w * 0.72} ry={d * 0.52} fill="rgba(0,0,0,0.24)" />
      <path d={`M ${-w / 2} 0 L 0 ${d / 2} L ${w / 2} 0 L 0 ${-d / 2} Z`} fill={`${building.color}66`} stroke={building.accent} strokeWidth={1.5} />
      <path d={`M ${-w / 2} 0 L ${-w / 2} ${-h} L 0 ${-h + d / 2} L 0 ${d / 2} Z`} fill={building.color} stroke={building.accent} strokeWidth={1.5} />
      <path d={`M 0 ${d / 2} L 0 ${-h + d / 2} L ${w / 2} ${-h} L ${w / 2} 0 Z`} fill={darker(building.color, 24)} stroke={building.accent} strokeWidth={1.5} />
      <path d={`M ${-w / 2} ${-h} L 0 ${-h - d / 2} L ${w / 2} ${-h} L 0 ${-h + d / 2} Z`} fill={roof} stroke={building.accent} strokeWidth={1.5} />

      {building.kind === 'clubhouse' && (
        <g>
          <rect x={-18} y={-42} width={36} height={42} rx={4} fill="#1e293b" opacity={0.85} />
          <path d="M -38 -58 L -8 -74 L 22 -58" fill="none" stroke="#fed7aa" strokeWidth={4} strokeLinecap="round" />
          <rect x={25} y={-106} width={4} height={44} fill="#78350f" />
          <path d="M 29 -106 L 58 -96 L 29 -86 Z" fill="#fde047" stroke="#92400e" />
          <text x={-18} y={-68} fill="#fff7ed" fontSize={12} fontWeight={900}>HQ</text>
        </g>
      )}

      {building.kind === 'team' && (
        <g>
          <rect x={-30} y={-34} width={60} height={34} rx={4} fill="#0f172a" opacity={0.82} />
          {[-20, 0, 20].map((lx) => <rect key={lx} x={lx - 6} y={-55} width={12} height={14} rx={2} fill="#bae6fd" opacity={0.92} />)}
          <text x={0} y={-72} textAnchor="middle" fontSize={26}>👕</text>
          <text x={0} y={-15} textAnchor="middle" fill="#e0f2fe" fontSize={10} fontWeight={900}>LOCKERS</text>
        </g>
      )}

      {building.kind === 'shop' && (
        <g>
          <rect x={-28} y={-30} width={56} height={30} rx={4} fill="#451a03" opacity={0.82} />
          {[-30, -15, 0, 15].map((lx, idx) => <rect key={lx} x={lx} y={-68} width={15} height={15} fill={idx % 2 === 0 ? '#fff7ed' : '#ef4444'} stroke="#92400e" />)}
          <path d="M -36 -68 L 36 -68 L 28 -82 L -28 -82 Z" fill="#f59e0b" stroke="#92400e" />
          <text x={0} y={-16} textAnchor="middle" fill="#fde68a" fontSize={10} fontWeight={900}>TRADE</text>
          <text x={0} y={-96} textAnchor="middle" fontSize={24}>🛒</text>
        </g>
      )}

      {building.kind === 'medical' && (
        <g>
          <rect x={-20} y={-45} width={40} height={44} rx={4} fill="#f8fafc" stroke="#ef4444" strokeWidth={1.5} />
          <rect x={-5} y={-77} width={10} height={26} rx={2} fill="#ef4444" />
          <rect x={-14} y={-68} width={28} height={10} rx={2} fill="#ef4444" />
          <rect x={18} y={-20} width={26} height={18} rx={3} fill="#dcfce7" stroke="#166534" />
          <circle cx={24} cy={0} r={4} fill="#0f172a" />
          <circle cx={38} cy={0} r={4} fill="#0f172a" />
        </g>
      )}

      {building.kind === 'gym' && (
        <g>
          <rect x={-30} y={-38} width={60} height={38} rx={5} fill="#1e1b4b" opacity={0.82} />
          <g transform={`translate(0, ${-h - 10})`}>
            <rect x={-28} y={0} width={56} height={6} rx={3} fill="#334155" />
            <circle cx={-34} cy={3} r={10} fill="#475569" />
            <circle cx={34} cy={3} r={10} fill="#475569" />
          </g>
          <text x={0} y={-18} textAnchor="middle" fill="#ede9fe" fontSize={11} fontWeight={900}>TRAIN</text>
        </g>
      )}

      {building.kind === 'trophy' && (
        <g>
          <path d="M -36 -58 Q 0 -100 36 -58 Z" fill="#fef3c7" stroke="#ca8a04" strokeWidth={2} />
          {[-28, -10, 10, 28].map((lx) => <rect key={lx} x={lx - 4} y={-58} width={8} height={58} fill="#facc15" stroke="#a16207" />)}
          <text x={0} y={-82} textAnchor="middle" fontSize={28}>🏆</text>
          <text x={0} y={-16} textAnchor="middle" fill="#422006" fontSize={10} fontWeight={900}>HALL</text>
        </g>
      )}

      {building.kind === 'garage' && (
        <g>
          <rect x={-38} y={-34} width={76} height={34} rx={3} fill="#1e293b" opacity={0.9} />
          {[-22, 22].map((lx) => <rect key={lx} x={lx - 16} y={-29} width={32} height={29} fill="#334155" stroke="#cbd5e1" />)}
          <rect x={-18} y={-62} width={36} height={16} rx={3} fill="#f8fafc" stroke="#475569" />
          <text x={0} y={-50} textAnchor="middle" fill="#0f172a" fontSize={9} fontWeight={900}>BUS</text>
          <text x={0} y={-84} textAnchor="middle" fontSize={26}>🚌</text>
        </g>
      )}

      {building.kind === 'scout' && (
        <g>
          <path d="M -18 0 L -10 -92 L 10 -92 L 18 0 Z" fill="#115e59" stroke="#0f766e" strokeWidth={2} />
          <rect x={-30} y={-124} width={60} height={34} rx={5} fill="#0f766e" stroke="#99f6e4" strokeWidth={2} />
          <circle cx={0} cy={-107} r={10} fill="#67e8f9" opacity={0.9} />
          <line x1={-24} y1={-88} x2={-42} y2={-12} stroke="#99f6e4" strokeWidth={2} />
          <line x1={24} y1={-88} x2={42} y2={-12} stroke="#99f6e4" strokeWidth={2} />
          <text x={0} y={-137} textAnchor="middle" fontSize={23}>🔭</text>
        </g>
      )}

      {building.kind === 'bank' && (
        <g>
          <path d="M -42 -58 L 0 -88 L 42 -58 Z" fill="#e0f2fe" stroke="#075985" strokeWidth={2} />
          {[-27, -9, 9, 27].map((lx) => <rect key={lx} x={lx - 5} y={-58} width={10} height={58} fill="#bae6fd" stroke="#075985" />)}
          <rect x={-44} y={-6} width={88} height={10} fill="#075985" />
          <circle cx={0} cy={-60} r={12} fill="#facc15" stroke="#a16207" />
          <text x={0} y={-56} textAnchor="middle" fill="#422006" fontSize={10} fontWeight={900}>$</text>
        </g>
      )}

      {stage > 0 && (
        <g className="building-upgrade-state" style={{ pointerEvents: 'none' }}>
          {building.kind === 'shop' && Array.from({ length: Math.min(5, stage) }).map((_, idx) => (
            <g key={`market-crate-${idx}`} transform={`translate(${-54 + idx * 27}, ${18 + (idx % 2) * 10})`}>
              <rect x={-10} y={-10} width={20} height={18} rx={3} fill={idx % 2 ? '#fef08a' : '#fb923c'} stroke="#78350f" strokeWidth={1.5} />
              <text x={0} y={3} textAnchor="middle" fill="#78350f" fontSize={8} fontWeight={900}>$</text>
            </g>
          ))}
          {building.kind === 'gym' && Array.from({ length: Math.min(4, stage) }).map((_, idx) => (
            <g key={`gym-lane-${idx}`} transform={`translate(${-48 + idx * 32}, ${10 + idx * 2})`}>
              <rect x={-10} y={-4} width={20} height={8} rx={4} fill="#bbf7d0" stroke="#14532d" strokeWidth={1} />
              <circle cx={0} cy={-18} r={7} fill="#fde68a" filter="url(#warmGlow)" />
            </g>
          ))}
          {building.kind === 'team' && Array.from({ length: Math.min(4, stage) }).map((_, idx) => (
            <path key={`locker-banner-${idx}`} d={`M ${-48 + idx * 31} -104 L ${-32 + idx * 31} -96 L ${-48 + idx * 31} -88 Z`} fill={idx % 2 ? '#fde047' : '#38bdf8'} stroke="#0f172a" strokeWidth={1} />
          ))}
          {building.kind === 'medical' && Array.from({ length: Math.min(3, stage) }).map((_, idx) => (
            <g key={`recovery-pod-${idx}`} transform={`translate(${-40 + idx * 40}, 18)`}>
              <rect x={-13} y={-12} width={26} height={18} rx={8} fill="#ecfeff" stroke="#ef4444" strokeWidth={1.5} />
              <text x={0} y={2} textAnchor="middle" fill="#ef4444" fontSize={12} fontWeight={900}>+</text>
            </g>
          ))}
          {building.kind === 'garage' && stage >= 2 && (
            <g transform="translate(58, 18)">
              <rect x={-32} y={-18} width={64} height={28} rx={8} fill={stage >= 4 ? '#0ea5e9' : '#fbbf24'} stroke="#0f172a" strokeWidth={2} />
              <circle cx={-18} cy={12} r={6} fill="#0f172a" /><circle cx={20} cy={12} r={6} fill="#0f172a" />
              <text x={0} y={0} textAnchor="middle" fill="#0f172a" fontSize={8} fontWeight={900}>{stage >= 4 ? 'JET' : 'BUS+'}</text>
            </g>
          )}
          {building.kind === 'bank' && stage >= 1 && (
            <g transform="translate(62, -86)">
              <rect x={-36} y={-13} width={72} height={26} rx={7} fill="#0f172a" stroke="#facc15" strokeWidth={2} />
              <text x={0} y={4} textAnchor="middle" fill="#facc15" fontSize={9} fontWeight={900}>DYN x{stage}</text>
            </g>
          )}
          {building.kind === 'scout' && stage >= 1 && (
            <g transform="translate(54,-120)">
              <rect x={-32} y={-12} width={64} height={24} rx={7} fill="#042f2e" stroke="#5eead4" strokeWidth={2} />
              <text x={0} y={4} textAnchor="middle" fill="#ccfbf1" fontSize={8} fontWeight={900}>FUND {stage}</text>
            </g>
          )}
          {building.kind === 'trophy' && Array.from({ length: Math.min(5, stage) }).map((_, idx) => (
            <circle key={`prestige-light-${idx}`} cx={-48 + idx * 24} cy={-108} r={6} fill="#fde047" filter="url(#warmGlow)" />
          ))}
          {building.kind === 'clubhouse' && stage >= 1 && (
            <g transform="translate(54,-62)">
              <rect x={-30} y={-16} width={60} height={32} rx={7} fill="#422006" stroke="#fde68a" strokeWidth={2} />
              <text x={0} y={4} textAnchor="middle" fill="#fde68a" fontSize={8} fontWeight={900}>OPS +{stage}</text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}

function BuildingPhysicalSign({ building, questTarget = false, emphasized = false, upgradeStage = 0 }: { building: SportsBuilding; questTarget?: boolean; emphasized?: boolean; upgradeStage?: number }) {
  const { x, y } = iso(building.tx, building.ty);
  const sign = BUILDING_SIGNS[building.id] || { code: building.label.slice(0, 4).toUpperCase(), icon: '◆', fill: building.accent, text: building.subtitle };
  const yOffset = building.kind === 'stadium' ? -154 : building.kind === 'field' ? -70 : building.kind === 'scout' ? -162 : building.kind === 'bank' ? -120 : -112;
  const labelScale = emphasized ? 1.22 : 1.04;
  const signWidth = Math.max(emphasized ? 96 : 78, sign.code.length * (emphasized ? 11 : 10) + 32);
  const signHeight = emphasized ? 34 : 30;
  const subLabel = upgradeStage > 0 ? `${sign.text} • tier ${upgradeStage}` : sign.text;
  return (
    <g transform={`translate(${x}, ${y + yOffset}) scale(${labelScale})`} style={{ pointerEvents: 'none' }}>
      {questTarget && (
        <g transform="translate(0,-38)">
          <circle r={19} fill="#fde047" stroke="#92400e" strokeWidth={2.5} filter="url(#warmGlow)" />
          <text x={0} y={7} textAnchor="middle" fill="#422006" fontSize={20} fontWeight={900}>!</text>
        </g>
      )}
      <rect x={-signWidth / 2} y={-signHeight / 2} width={signWidth} height={signHeight} rx={10} fill={sign.fill} stroke="#fff7ed" strokeWidth={2.25} />
      <text x={-signWidth / 2 + 16} y={5} textAnchor="middle" fill="#fff7ed" fontSize={emphasized ? 15 : 14} fontWeight={900}>{sign.icon}</text>
      <text x={8} y={5} textAnchor="middle" fill="#fff7ed" fontSize={sign.code.length > 5 ? (emphasized ? 10 : 9) : (emphasized ? 12 : 11)} fontWeight={900}>{sign.code}</text>
      <rect x={-signWidth / 2 + 6} y={signHeight / 2 + 3} width={signWidth - 12} height={14} rx={7} fill="rgba(255,247,237,.88)" />
      <text x={0} y={signHeight / 2 + 14} textAnchor="middle" fill="#0f172a" fontSize={emphasized ? 8.5 : 8} fontWeight={900}>{subLabel}</text>
    </g>
  );
}

function BuildingLabel({ building, economyLoop, selected = false, questTarget = false, upgradeStage = 0 }: { building: SportsBuilding; economyLoop?: BuildingEconomyLoop; selected?: boolean; questTarget?: boolean; upgradeStage?: number }) {
  const { x, y } = iso(building.tx, building.ty);
  const progress = Math.max(0, Math.min(100, economyLoop?.progress ?? 0));
  const status = upgradeStage > 0 ? `Visible upgrade tier ${upgradeStage}` : economyLoop?.status || building.subtitle;
  const width = selected || questTarget ? 206 : 184;
  return (
    <g transform={`translate(${x}, ${y + 78})`} style={{ pointerEvents: 'none' }}>
      <rect x={-width / 2} y={-28} width={width} height={66} rx={16} fill="rgba(15,23,42,0.94)" stroke={selected ? '#fde047' : questTarget ? '#fb923c' : building.accent} strokeWidth={selected || questTarget ? 2.75 : 1.75} />
      <text x={0} y={-10} textAnchor="middle" fill="#fff" fontSize={selected || questTarget ? 14 : 13} fontWeight={900}>{building.label}</text>
      <text x={0} y={7} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontWeight={800}>{economyLoop?.label || building.subtitle}</text>
      <rect x={-66} y={19} width={132} height={6} rx={3} fill="rgba(148,163,184,0.45)" />
      <rect x={-66} y={19} width={(132 * progress) / 100} height={6} rx={3} fill={building.color} />
      <text x={0} y={38} textAnchor="middle" fill={selected ? '#fde047' : questTarget ? '#fed7aa' : '#e2e8f0'} fontSize={9} fontWeight={900}>{selected ? 'PRESS E TO ENTER' : questTarget ? 'QUEST TARGET' : status}</text>
    </g>
  );
}

function BuildingFootprint({ building, active }: { building: SportsBuilding; active: boolean }) {
  const { x, y } = iso(building.tx, building.ty);
  return (
    <g transform={`translate(${x}, ${y})`} opacity={active ? 1 : 0.78} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={28} rx={building.kind === 'stadium' ? 188 : building.kind === 'field' ? 122 : 88} ry={building.kind === 'stadium' ? 66 : building.kind === 'field' ? 44 : 34} fill="none" stroke={active ? '#fde047' : building.accent} strokeWidth={active ? 5 : 2} strokeDasharray={active ? '18 10' : '10 9'} opacity={active ? 0.78 : 0.34} />
      {active && <path d="M -26 38 L 0 56 L 26 38" fill="none" stroke="#fde047" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />}
    </g>
  );
}

function SportsBuildingView({
  building,
  economyLoop,
  onClick,
  active = false,
  hovered = false,
  onHover,
  stadiumUpgradeLevel = 0,
  visualStage = 0,
  questTarget = false,
}: {
  building: SportsBuilding;
  economyLoop?: BuildingEconomyLoop;
  onClick: (building: SportsBuilding) => void;
  active?: boolean;
  hovered?: boolean;
  onHover: (id: string | null) => void;
  stadiumUpgradeLevel?: number;
  visualStage?: number;
  questTarget?: boolean;
}) {
  const { x, y } = iso(building.tx, building.ty);
  const showLabel = active || hovered || questTarget;
  const emphasized = active || hovered || questTarget;
  const buildingStage = building.kind === 'stadium' ? stadiumUpgradeLevel : visualStage;
  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(building); }}
      onMouseEnter={() => onHover(building.id)}
      onMouseLeave={() => onHover(null)}
      className="cursor-pointer"
    >
      <title>{`${building.label}: ${economyLoop?.label || building.subtitle}${buildingStage > 0 ? `, visible tier ${buildingStage}` : ''}`}</title>
      <BuildingFootprint building={building} active={active || hovered} />
      <g className="transition-transform duration-150 hover:scale-105" style={{ transformOrigin: `${x}px ${y}px` }}>
        {building.kind === 'stadium' ? <StadiumBuilding building={building} upgradeLevel={stadiumUpgradeLevel} /> : building.kind === 'field' ? <FieldBuilding building={building} /> : <BoxBuilding building={building} upgradeStage={visualStage} />}
        <BuildingPhysicalSign building={building} questTarget={questTarget} emphasized={emphasized} upgradeStage={buildingStage} />
        {showLabel && <BuildingLabel building={building} economyLoop={economyLoop} selected={active} questTarget={questTarget} upgradeStage={buildingStage} />}
      </g>
    </g>
  );
}

function leagueGatePoint(gate: LeagueGate) {
  if (gate.id === 'regional-grid') return { x: 0, y: WORLD_BOUNDS.topY + 16 };
  if (gate.id === 'elite-franchise') return { x: 0, y: WORLD_BOUNDS.bottomY - 10 };
  if (gate.id === 'creator-leagues') return { x: WORLD_BOUNDS.halfWidth - 22, y: WORLD_BOUNDS.centerY };
  return { x: -WORLD_BOUNDS.halfWidth + 22, y: WORLD_BOUNDS.centerY };
}

function LeagueGateView({ gate, onClick }: { gate: LeagueGate; onClick: (gate: LeagueGate) => void }) {
  const endpoint = leagueGatePoint(gate);
  const routePoints = [iso(0, 0), ...gate.route.slice(1).map(([tx, ty]) => iso(tx, ty)), endpoint];
  const points = routePoints.map((p) => `${p.x},${p.y}`).join(' ');
  const statusLabel = gate.status === 'open' ? 'OPEN' : gate.status === 'owner' ? 'CREATE' : 'LOCKED';
  return (
    <g onClick={(e) => { e.stopPropagation(); onClick(gate); }} className="cursor-pointer">
      <polyline points={points} fill="none" stroke="#78350f" strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <polyline points={points} fill="none" stroke={gate.color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} strokeDasharray="14 10" />
      <g transform={`translate(${endpoint.x}, ${endpoint.y})`}>
        <ellipse cx={0} cy={20} rx={74} ry={28} fill="rgba(0,0,0,0.28)" />
        <path d="M -58 10 Q -45 -76 0 -100 Q 45 -76 58 10 Z" fill="#0f172a" stroke={gate.color} strokeWidth={4} />
        <path d="M -34 10 Q -26 -50 0 -68 Q 26 -50 34 10 Z" fill={gate.status === 'locked' ? '#334155' : gate.color} opacity={0.85} />
        <rect x={-68} y={8} width={136} height={34} rx={12} fill="rgba(15,23,42,0.94)" stroke={gate.accent} strokeWidth={2} />
        <text x={0} y={1} textAnchor="middle" fill="#fff" fontSize={15} fontWeight={900}>{gate.status === 'locked' ? '🔒' : gate.status === 'owner' ? '👑' : '🏟️'}</text>
        <text x={0} y={25} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={900}>{gate.label}</text>
        <text x={0} y={37} textAnchor="middle" fill={gate.color} fontSize={8} fontWeight={900}>{statusLabel} • {gate.tier}</text>
      </g>
    </g>
  );
}

function LeagueEconomyPanel({ gate }: { gate: LeagueGate }) {
  const rows = [
    ['Operator', gate.operator],
    ['Entry', gate.entry],
    ['Revenue', gate.revenue],
    ['Costs', gate.maintenance],
    ['Game Tax', gate.tax],
  ];
  return (
    <div className="min-h-full bg-slate-950 text-white p-6 space-y-5">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-2xl">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">League Gate</div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black">{gate.name}</h2>
            <p className="text-sm text-slate-300 mt-1">{gate.tier} • {gate.status === 'owner' ? 'user-owned economy' : 'controlled progression league'}</p>
          </div>
          <div className="rounded-2xl px-4 py-3 text-center border" style={{ borderColor: gate.color, color: gate.color }}>
            <div className="text-2xl">{gate.status === 'locked' ? '🔒' : gate.status === 'owner' ? '👑' : '🏟️'}</div>
            <div className="text-xs font-black uppercase">{gate.status}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-400 font-black">{label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
        <div className="text-sm font-black text-emerald-200">Why users return</div>
        <p className="mt-1 text-sm text-emerald-50">{gate.userIncentive}</p>
      </div>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
        <div className="text-sm font-black text-amber-200">Economy guardrail</div>
        <p className="mt-1 text-sm text-amber-50">Teams earn from game-day business, sponsors, asset value, and league rewards. Fees pay maintenance, sinks, owner operations, and platform tax — not winner-takes-opponent-fees.</p>
      </div>
    </div>
  );
}

function CommissionerPanel({
  initialOverview,
  onWallet,
  onStatus,
  onOverview,
}: {
  initialOverview: CommissionerOverview | null;
  onWallet: (wallet: WalletSnapshot) => void;
  onStatus: (status: string) => void;
  onOverview: (overview: CommissionerOverview) => void;
}) {
  const [overview, setOverview] = useState<CommissionerOverview | null>(initialOverview);
  const [amount, setAmount] = useState(500);
  const [busy, setBusy] = useState<string | null>(null);

  const syncOverview = useCallback((next: CommissionerOverview) => {
    setOverview(next);
    onOverview(next);
  }, [onOverview]);

  const reload = useCallback(async () => {
    const data = await fetchApi('/api/commissioner/overview');
    syncOverview(data.data);
  }, [syncOverview]);

  useEffect(() => {
    if (initialOverview) setOverview(initialOverview);
    else reload().catch((error) => onStatus(error instanceof Error ? error.message : 'Commissioner overview failed'));
  }, [initialOverview, reload, onStatus]);

  const contribute = async (currency = 'DYN') => {
    try {
      setBusy('contribute');
      const data = await fetchApi('/api/commissioner/contribute', {
        method: 'POST',
        body: JSON.stringify({ amount, currency }),
      });
      if (data.data?.wallet) onWallet(data.data.wallet);
      if (data.data?.overview) syncOverview(data.data.overview);
      onStatus(`Commissioner funded: ${amount.toLocaleString()} ${currency}. Limited inventory meters updated.`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'Contribution failed');
    } finally {
      setBusy(null);
    }
  };

  const purchase = async (item: CommissionerInventoryItem) => {
    try {
      setBusy(item.id);
      const data = await fetchApi(`/api/commissioner/inventory/${item.id}/purchase`, {
        method: 'POST',
        body: JSON.stringify({ quantity: 1 }),
      });
      if (data.data?.wallet) onWallet(data.data.wallet);
      if (data.data?.overview) syncOverview(data.data.overview);
      onStatus(`${item.name} purchased. Restock demand and scarcity meters updated.`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setBusy(null);
    }
  };

  const meters = overview?.meters || [];
  const inventory = overview?.inventory || [];

  return (
    <div className="min-h-full bg-slate-950 text-white p-6 space-y-5">
      <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-900 p-5 shadow-2xl">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-200 font-black">Sports Commissioner Cycle</div>
        <div className="mt-2 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black">{overview?.cycle.title || 'Grid City Sports Commissioner Cycle'}</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">Community funds league infrastructure, limited inventory unlocks by milestone, buyers create scarcity, and restocks happen only when demand is visible.</p>
          </div>
          <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-center">
            <div className="text-2xl font-black text-cyan-100">{overview?.cycle.phase || 'FUNDING'}</div>
            <div className="text-[11px] uppercase tracking-widest text-cyan-200">Current Phase</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {meters.map((meter) => (
          <div key={meter.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">{meter.label}</div>
            <div className="mt-1 text-lg font-black text-white">{Math.round(meter.value).toLocaleString()}<span className="text-xs text-slate-400"> / {Math.round(meter.target).toLocaleString()} {meter.unit}</span></div>
            <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${Math.max(0, Math.min(100, meter.progress))}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 space-y-3">
          <div>
            <div className="text-sm font-black text-emerald-100">Fund the next sports-economy drop</div>
            <p className="text-xs text-emerald-50/80 mt-1">This is the Kintara-style loop with a sports theme: fund → unlock scarce useful supply → create trade/upkeep pressure → restock from demand.</p>
          </div>
          <label className="block text-xs uppercase tracking-widest text-emerald-100 font-black">DYN Contribution</label>
          <input
            type="number"
            value={amount}
            min={1}
            max={1000000}
            onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))}
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-300"
          />
          <div className="flex flex-wrap gap-2">
            {[250, 500, 2500, 10000].map((value) => (
              <button key={value} type="button" onClick={() => setAmount(value)} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-black hover:bg-white/20">{value.toLocaleString()}</button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy === 'contribute'}
            onClick={() => contribute('DYN')}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-black text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
          >
            {busy === 'contribute' ? 'Funding...' : 'Fund Commissioner Cycle'}
          </button>
          {overview && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-900/70 p-2"><div className="font-black text-white">{Math.round(overview.myStats.dynEquivalentFunded).toLocaleString()}</div><div className="text-slate-400">My Funded</div></div>
              <div className="rounded-xl bg-slate-900/70 p-2"><div className="font-black text-white">{overview.myStats.purchaseCount}</div><div className="text-slate-400">Buys</div></div>
              <div className="rounded-xl bg-slate-900/70 p-2"><div className="font-black text-white">{Math.round(overview.myStats.rewardDynEquivalent).toLocaleString()}</div><div className="text-slate-400">Rewards</div></div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-black">Limited Restock Inventory</div>
              <div className="text-xs text-slate-400">No infinite shop: funding milestones release finite batches.</div>
            </div>
            <button type="button" onClick={() => reload().catch(() => undefined)} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20">Refresh</button>
          </div>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {inventory.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-white">{item.name}</div>
                    <div className="text-xs text-slate-300 mt-1">{item.description}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-amber-200">{item.priceLabel}</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">{item.phase}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex-1">
                    <div className="flex justify-between text-slate-300"><span>Unlock</span><span>{item.unlockProgress}%</span></div>
                    <div className="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-400" style={{ width: `${item.unlockProgress}%` }} /></div>
                  </div>
                  <div className="w-24 text-center rounded-xl bg-white/5 p-2"><div className="font-black">{item.quantityRemaining}/{item.quantityTotal}</div><div className="text-slate-400">left</div></div>
                  <button
                    type="button"
                    disabled={!item.unlocked || item.soldOut || busy === item.id}
                    onClick={() => purchase(item)}
                    className="rounded-xl bg-amber-400 px-3 py-2 font-black text-slate-950 hover:bg-amber-200 disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {item.soldOut ? 'Sold Out' : item.unlocked ? 'Buy' : 'Locked'}
                  </button>
                </div>
              </div>
            ))}
            {inventory.length === 0 && <div className="text-sm text-slate-400">Loading commissioner inventory...</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function InteriorSceneProps({ building, stadiumUpgradeLevel = 0, visualStage = 0 }: { building: SportsBuilding; stadiumUpgradeLevel?: number; visualStage?: number }) {
  const stage = Math.max(0, Math.min(5, Math.round(Math.max(stadiumUpgradeLevel, visualStage))));
  const commonCase = (label: string, x: number, y: number, color = building.color) => (
    <g key={label} transform={`translate(${x}, ${y})`}>
      <rect x={-34} y={-22} width={68} height={44} rx={8} fill="rgba(15,23,42,.88)" stroke={color} strokeWidth={2} />
      <text x={0} y={-1} textAnchor="middle" fill="#fff" fontSize={8} fontWeight={900}>{label}</text>
      {stage > 0 && <text x={0} y={11} textAnchor="middle" fill="#fde047" fontSize={6.5} fontWeight={900}>TIER {stage}</text>}
    </g>
  );

  if (building.id === 'stadium') {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
        <rect x="68" y="90" width="284" height="52" rx="12" fill="#0f172a" stroke="#fde047" strokeWidth="3" />
        <text x="210" y="123" textAnchor="middle" fill="#fde047" fontSize="16" fontWeight="900">SCOREBOARD TIER {stadiumUpgradeLevel}</text>
        <rect x="38" y="178" width="118" height="84" rx="14" fill="#7f1d1d" stroke="#fecaca" strokeWidth="2" />
        <text x="97" y="221" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="900">TICKET OFFICE</text>
        <rect x="264" y="174" width="118" height="92" rx="14" fill="#78350f" stroke="#facc15" strokeWidth="2" />
        <text x="323" y="214" textAnchor="middle" fill="#fef3c7" fontSize="12" fontWeight="900">SPONSOR SUITE</text>
        <path d="M80 345 Q210 286 340 345 L310 394 Q210 354 110 394 Z" fill="#15803d" stroke="#dcfce7" strokeWidth="3" />
        <text x="210" y="370" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="900">MATCHDAY REVENUE FLOOR</text>
      </svg>
    );
  }
  if (building.id === 'training') {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
        {[92, 142, 192, 242].map((x) => <rect key={x} x={x} y="120" width="22" height="210" rx="10" fill="#166534" stroke="#bbf7d0" strokeWidth="2" />)}
        {[90, 140, 190, 240, 290].map((x) => <circle key={x} cx={x} cy="352" r="13" fill="#fb923c" stroke="#7c2d12" strokeWidth="2" />)}
        {commonCase('COACH BOARD', 315, 170, '#a78bfa')}
        {commonCase('WEIGHTS', 102, 386, '#a78bfa')}
      </svg>
    );
  }
  if (building.id === 'team') {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
        {[74, 126, 178, 230, 282].map((x, idx) => (
          <g key={x}>
            <rect x={x} y="108" width="38" height="128" rx="8" fill="#075985" stroke="#bae6fd" strokeWidth="2" />
            <text x={x + 19} y="179" textAnchor="middle" fill="#e0f2fe" fontSize="20" fontWeight="900">{idx + 1}</text>
          </g>
        ))}
        <rect x="66" y="280" width="130" height="82" rx="12" fill="#f8fafc" stroke="#0f172a" strokeWidth="3" />
        <text x="131" y="326" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="900">LINEUP BOARD</text>
        {commonCase('GEAR RACK', 294, 320, '#38bdf8')}
      </svg>
    );
  }
  if (building.id === 'market') {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
        <rect x="52" y="102" width="316" height="36" rx="10" fill="#451a03" stroke="#facc15" strokeWidth="2" />
        <text x="210" y="126" textAnchor="middle" fill="#fde68a" fontSize="14" fontWeight="900">LIMITED DROP TICKER</text>
        {[92, 210, 328].map((x, idx) => (
          <g key={x}>
            <rect x={x - 44} y="184" width="88" height="88" rx="14" fill={idx === 1 ? '#7f1d1d' : '#78350f'} stroke="#fef3c7" strokeWidth="2" />
            <text x={x} y="232" textAnchor="middle" fill="#f8fafc" stroke="#020617" strokeWidth="3" paintOrder="stroke" fontSize="12" fontWeight="900">CASE {idx + 1}</text>
          </g>
        ))}
        {commonCase('AUCTION', 114, 355, '#f59e0b')}
        {commonCase('RESTOCK', 306, 355, '#f59e0b')}
      </svg>
    );
  }
  if (building.id === 'medical') {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
        {[104, 210, 316].map((x) => <rect key={x} x={x - 38} y="150" width="76" height="150" rx="28" fill="#ecfeff" stroke="#ef4444" strokeWidth="3" />)}
        <rect x="190" y="72" width="40" height="100" rx="8" fill="#ef4444" />
        <rect x="160" y="102" width="100" height="40" rx="8" fill="#ef4444" />
        {commonCase('TREATMENT', 118, 365, '#ef4444')}
        {commonCase('RECOVERY', 302, 365, '#ef4444')}
      </svg>
    );
  }
  if (building.id === 'garage') {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
        {[96, 210, 324].map((x, idx) => <rect key={x} x={x - 46} y="118" width="92" height="122" rx="10" fill="#1e293b" stroke="#cbd5e1" strokeWidth="3" opacity={idx === 1 ? 1 : .75} />)}
        <rect x="115" y="274" width="190" height="70" rx="18" fill="#fbbf24" stroke="#92400e" strokeWidth="3" />
        <circle cx="160" cy="348" r="17" fill="#0f172a" /><circle cx="260" cy="348" r="17" fill="#0f172a" />
        {commonCase('ROUTES', 108, 405, '#94a3b8')}
        {commonCase('UPKEEP', 312, 405, '#94a3b8')}
      </svg>
    );
  }
  if (building.id === 'commissioner') {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
        <rect x="48" y="98" width="148" height="140" rx="16" fill="#064e3b" stroke="#5eead4" strokeWidth="3" />
        <text x="122" y="153" textAnchor="middle" fill="#ccfbf1" fontSize="13" fontWeight="900">FUNDING BOARD</text>
        <text x="122" y="181" textAnchor="middle" fill="#fde047" fontSize="22" fontWeight="900">%</text>
        <rect x="226" y="98" width="146" height="140" rx="16" fill="#0f172a" stroke="#facc15" strokeWidth="3" />
        <text x="299" y="153" textAnchor="middle" fill="#fef3c7" fontSize="13" fontWeight="900">DROP WALL</text>
        {[254, 300, 346].map((x) => <rect key={x} x={x - 15} y="176" width="30" height="30" rx="6" fill="#facc15" />)}
        {commonCase('SEASON', 116, 340, '#14b8a6')}
        {commonCase('RESTOCK', 304, 340, '#14b8a6')}
      </svg>
    );
  }
  if (building.id === 'hall') {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
        {[92, 160, 228, 296].map((x) => <g key={x}><rect x={x - 28} y="132" width="56" height="98" rx="10" fill="#78350f" stroke="#facc15" strokeWidth="2" /><text x={x} y="192" textAnchor="middle" fontSize="30">🏆</text></g>)}
        <rect x="70" y="278" width="280" height="78" rx="16" fill="#422006" stroke="#fde047" strokeWidth="3" />
        <text x="210" y="326" textAnchor="middle" fill="#fde68a" fontSize="15" fontWeight="900">PRESTIGE WALL</text>
      </svg>
    );
  }
  if (building.id === 'bank') {
    return (
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
        <circle cx="210" cy="176" r="74" fill="#075985" stroke="#bae6fd" strokeWidth="6" />
        <circle cx="210" cy="176" r="42" fill="#0f172a" stroke="#facc15" strokeWidth="4" />
        <text x="210" y="188" textAnchor="middle" fill="#facc15" fontSize="22" fontWeight="900">DYN</text>
        {commonCase('SPONSORS', 104, 332, '#0ea5e9')}
        {commonCase('TREASURY', 316, 332, '#0ea5e9')}
      </svg>
    );
  }
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 520" aria-hidden="true">
      <rect x="64" y="110" width="292" height="120" rx="18" fill="#78350f" stroke="#fed7aa" strokeWidth="3" />
      <text x="210" y="174" textAnchor="middle" fill="#fff7ed" fontSize="15" fontWeight="900">DAILY OPS BOARD</text>
      {commonCase('QUESTS', 108, 320, '#f97316')}
      {commonCase('STAFF', 310, 320, '#f97316')}
    </svg>
  );
}

interface InteriorAction {
  label: string;
  helper: string;
  buttonTextMatches: string[];
}

const BUILDING_INTERIOR_ACTIONS: Record<string, InteriorAction[]> = {
  stadium: [
    { label: 'Open upgrades', helper: 'Find the stadium upgrade controls', buttonTextMatches: ['Upgrade', 'Upgrade Stadium', 'Buy Upgrade'] },
    { label: 'View economy', helper: 'Jump to capacity, wear, and ticket yield panels', buttonTextMatches: ['Economy', 'Revenue', 'Capacity'] },
    { label: 'Back to assets', helper: 'Use the asset overview for stadium context', buttonTextMatches: ['Back to Assets', 'Assets'] },
  ],
  practice: [
    { label: 'Play match', helper: 'Start the core game loop', buttonTextMatches: ['Play', 'Play Match', 'Start Match', 'Quick Match'] },
    { label: 'Schedule', helper: 'Open opponent and schedule controls', buttonTextMatches: ['Schedule', 'Schedule Match', 'Opponents'] },
    { label: 'History', helper: 'Review match outcomes', buttonTextMatches: ['History', 'Past Matches', 'Results'] },
  ],
  training: [
    { label: 'Pick team', helper: 'Focus the team selector first', buttonTextMatches: ['Select Team'] },
    { label: 'Start training', helper: 'Run the first available drill', buttonTextMatches: ['Start Training', 'Train', 'Start'] },
    { label: 'Claim reward', helper: 'Collect completed training output', buttonTextMatches: ['Claim Reward', 'Claim'] },
  ],
  clubhouse: [
    { label: 'Daily ops', helper: 'Open the dashboard operations path', buttonTextMatches: ['Daily', 'Quests', 'Dashboard'] },
    { label: 'Team', helper: 'Open roster management', buttonTextMatches: ['Team', 'Roster'] },
    { label: 'Market', helper: 'Open economy activity', buttonTextMatches: ['Market', 'Marketplace'] },
  ],
  team: [
    { label: 'Roster', helper: 'Manage players and lineup', buttonTextMatches: ['Roster'] },
    { label: 'Sponsorships', helper: 'Open sponsor offers and contracts', buttonTextMatches: ['Sponsorships', 'Refresh Offers'] },
    { label: 'Equipment', helper: 'Buy or review team gear', buttonTextMatches: ['Equipment', 'Purchase'] },
  ],
  market: [
    { label: 'Game market', helper: 'Buy game-supplied gear', buttonTextMatches: ['Market'] },
    { label: 'P2P listings', helper: 'Open player-created marketplace listings', buttonTextMatches: ['Marketplace', 'Sell Item'] },
    { label: 'Player market', helper: 'Open player sale listings', buttonTextMatches: ['Players'] },
  ],
  medical: [
    { label: 'Player cards', helper: 'Select the first progression card', buttonTextMatches: ['XP', 'Career Stats', 'Recent XP Gains'] },
    { label: 'XP history', helper: 'Open recent XP and recovery history', buttonTextMatches: ['Recent XP Gains'] },
    { label: 'Career stats', helper: 'Jump to selected-player detail', buttonTextMatches: ['Career Stats'] },
  ],
  commissioner: [
    { label: 'Fund cycle', helper: 'Use community funding controls', buttonTextMatches: ['Fund', 'Contribute', 'Add Funding'] },
    { label: 'Restock', helper: 'Review or unlock limited inventory restocks', buttonTextMatches: ['Restock', 'Unlock'] },
    { label: 'Meters', helper: 'Jump to economy meters', buttonTextMatches: ['Meters', 'Economy'] },
  ],
  hall: [
    { label: 'Teams', helper: 'View team leaderboard', buttonTextMatches: ['Teams', 'Team'] },
    { label: 'Players', helper: 'View player leaderboard', buttonTextMatches: ['Players', 'Player'] },
    { label: 'Refresh', helper: 'Reload rankings', buttonTextMatches: ['Refresh', 'Reload'] },
  ],
  garage: [
    { label: 'Select vehicle', helper: 'Select the first vehicle bay', buttonTextMatches: ['Select', 'View', 'Upgrade'] },
    { label: 'Upgrade', helper: 'Improve condition and fatigue reduction', buttonTextMatches: ['Upgrade', 'Repair'] },
    { label: 'Marketplace', helper: 'List or buy transport assets', buttonTextMatches: ['List for Sale', 'Buy'] },
  ],
  bank: [
    { label: 'Add CASH', helper: 'Use the current test-economy CASH faucet', buttonTextMatches: ['Add 50,000 Test CASH', 'Add CASH'] },
    { label: 'Add DYN', helper: 'Use the current test-economy DYN faucet', buttonTextMatches: ['Add 100,000 Test DYN', 'Add DYN'] },
    { label: 'Ledger', helper: 'Review wallet transaction history', buttonTextMatches: ['Recent Ledger Activity', 'Ledger'] },
  ],
};

function getInteriorActions(buildingId: string) {
  return BUILDING_INTERIOR_ACTIONS[buildingId] || BUILDING_INTERIOR_ACTIONS.clubhouse;
}

function normalizeActionText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function runInteriorAction(action: InteriorAction) {
  const root = document.querySelector('.building-interior-content');
  if (!root) return false;
  const controls = Array.from(root.querySelectorAll<HTMLElement>('button, a, [role="button"], select, input'));
  const normalizedTargets = action.buttonTextMatches.map(normalizeActionText);
  const target = controls.find((control) => {
    const text = normalizeActionText(control.textContent || control.getAttribute('aria-label') || control.getAttribute('title') || '');
    return normalizedTargets.some((targetText) => text.includes(targetText));
  });
  if (target) {
    target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement || target.getAttribute('role') === 'button') {
      target.click();
    } else {
      target.focus();
    }
    return true;
  }
  root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  return false;
}

function BuildingInteriorShell({
  building,
  title,
  children,
  onExit,
  stadiumUpgradeLevel = 0,
  visualStage = 0,
}: {
  building: SportsBuilding;
  title: string;
  children: ReactNode;
  onExit: () => void;
  stadiumUpgradeLevel?: number;
  visualStage?: number;
}) {
  const isComputerLed = ['market', 'bank', 'commissioner', 'garage', 'stadium'].includes(building.id);
  const roomLabel = building.id === 'team'
    ? 'Locker wall • roster board • gear rack'
    : building.id === 'training'
      ? 'Coach station • turf lanes • weight room'
      : building.id === 'stadium'
        ? `Suite desk • scoreboard terminal • upgrade tier ${stadiumUpgradeLevel}`
        : building.id === 'market'
          ? 'Auction terminals • display cases • equipment counter'
          : building.id === 'medical'
            ? 'Trainer desk • recovery pods • treatment board'
            : building.id === 'garage'
              ? 'Route computer • vehicle bays • mechanic desk'
              : building.id === 'commissioner'
                ? 'League office • funding board • drop terminal'
                : building.id === 'hall'
                  ? 'Trophy cases • prestige wall • season archive'
                  : building.id === 'bank'
                    ? 'Sponsor desk • DYN vault • treasury terminal'
                    : 'Operations desk • daily board • staff room';
  const stationLabels = roomLabel.split(' • ');
  const interiorActions = getInteriorActions(building.id);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#06101d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(56,189,248,.22),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(249,115,22,.18),transparent_24%),linear-gradient(180deg,#071525_0%,#050913_100%)]" />
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/70 px-5 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.32em] text-slate-400 font-black">Inside {building.label}</div>
            <h2 className="text-xl md:text-2xl font-black truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20"
          >
            Exit to Grid City
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[460px_minmax(0,1fr)]">
          <div className="relative overflow-hidden border-r border-white/10 bg-slate-900/80 p-5">
            <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
            <div className="relative z-10 h-full min-h-[360px] rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.03] p-5 shadow-2xl overflow-hidden">
              <InteriorSceneProps building={building} stadiumUpgradeLevel={stadiumUpgradeLevel} visualStage={visualStage} />
              <div className="relative z-20 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-300 font-black">Room Stations</div>
                  <div className="mt-1 text-sm text-slate-200 leading-snug">{roomLabel}</div>
                </div>
                <div className="rounded-2xl px-3 py-2 text-center font-black text-slate-950 shadow-lg" style={{ backgroundColor: building.color }}>
                  {building.id === 'stadium' ? '🏟️' : building.id === 'team' ? '👕' : building.id === 'training' ? '🏋️' : building.id === 'medical' ? '➕' : building.id === 'market' ? '🛒' : building.id === 'garage' ? '🚌' : building.id === 'bank' ? '🏦' : building.id === 'hall' ? '🏆' : building.id === 'commissioner' ? '📋' : '🏠'}
                </div>
              </div>

              <div className="absolute left-8 right-8 top-28 h-24 rounded-t-[2rem] border border-white/10 bg-slate-950/80 shadow-inner" />
              <div className="absolute left-10 right-10 top-32 flex justify-around">
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="h-20 w-14 rounded-t-xl border border-white/10 bg-slate-800 shadow-lg">
                    <div className="mx-auto mt-3 h-2 w-8 rounded-full" style={{ backgroundColor: idx % 2 ? building.color : building.accent }} />
                    <div className="mx-auto mt-3 h-7 w-7 rounded-md bg-white/10" />
                  </div>
                ))}
              </div>

              <div className="absolute bottom-9 left-1/2 h-36 w-[330px] -translate-x-1/2 rounded-[45%] bg-black/25 blur-sm" />
              <div className="absolute bottom-16 left-10 right-10 h-24 rounded-3xl border border-white/10 bg-slate-800/80 shadow-2xl" />
              <div className="absolute bottom-24 left-16 right-16 h-8 rounded-xl border border-white/10 bg-slate-700/90" />

              <div className="absolute left-8 right-8 top-[226px] z-20 grid grid-cols-3 gap-2 text-[10px] font-black uppercase tracking-wider text-white">
                {stationLabels.map((label, idx) => {
                  const action = interiorActions[idx % interiorActions.length];
                  return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => runInteriorAction(action)}
                    title={action.helper}
                    className="rounded-xl border border-cyan-200/25 bg-slate-950/90 px-2 py-2 text-center shadow-xl transition-all hover:-translate-y-0.5 hover:border-cyan-200/60 hover:bg-cyan-950/60 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                    style={{ color: idx === 1 ? building.accent : '#e2e8f0' }}
                  >
                    {label}
                  </button>
                  );
                })}
              </div>

              {isComputerLed ? (
                <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
                  <div className="h-24 w-36 rounded-2xl border-4 border-slate-700 bg-slate-950 shadow-2xl">
                    <div className="m-3 h-16 rounded-lg border border-cyan-300/40 bg-cyan-300/15 p-2 text-[10px] font-black text-cyan-100">
                      MENU<br />CONTROL<br />TERMINAL
                    </div>
                  </div>
                  <div className="mx-auto h-8 w-16 bg-slate-700" />
                  <div className="h-4 w-28 rounded-full bg-slate-600" />
                </div>
              ) : (
                <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
                  <div className="mx-auto h-14 w-14 rounded-2xl border-2 border-slate-950 bg-[#f7c89d]" />
                  <div className="mx-auto -mt-1 h-24 w-20 rounded-2xl border-2 border-slate-950 shadow-xl" style={{ backgroundColor: building.color }} />
                  <div className="absolute left-[-26px] top-20 h-10 w-10 rotate-[-18deg] rounded-xl border-2 border-slate-950 bg-[#f7c89d]" />
                  <div className="absolute right-[-26px] top-20 h-10 w-10 rotate-[18deg] rounded-xl border-2 border-slate-950 bg-[#f7c89d]" />
                  <div className="mt-2 rounded-xl bg-slate-950/90 px-4 py-2 text-center text-xs font-black text-white shadow-xl">STAFF MENU</div>
                </div>
              )}

              <div className="absolute bottom-5 left-5 right-5 z-20 grid grid-cols-3 gap-2 text-[10px] font-black uppercase tracking-widest text-slate-200">
                <div className="rounded-xl bg-cyan-400/15 p-2 text-center text-cyan-100">Stations work</div>
                <div className="rounded-xl bg-amber-300/15 p-2 text-center text-amber-100">Quick actions</div>
                <div className="rounded-xl bg-emerald-300/15 p-2 text-center text-emerald-100">Readable menus</div>
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-y-auto bg-slate-950 p-4 md:p-6">
            <div className="building-interior-content mx-auto max-w-6xl rounded-[1.75rem] border border-cyan-200/15 bg-slate-950/90 p-3 text-white shadow-2xl md:p-4">
              <div className="mb-4 rounded-2xl border border-cyan-200/15 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-3 shadow-xl">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">Working controls</div>
                    <div className="mt-1 text-sm leading-snug text-slate-200">Use these buttons or the room stations on the left. They jump to the real controls inside this building instead of decorative dead spots.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {interiorActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => runInteriorAction(action)}
                        className="rounded-xl border border-cyan-200/20 bg-cyan-400/15 px-3 py-2 text-xs font-black uppercase tracking-wider text-cyan-50 transition-all hover:-translate-y-0.5 hover:border-cyan-200/60 hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                        title={action.helper}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Suspense fallback={<InteriorPageFallback label={title} />}>
                {children}
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMap({ player }: { player: { x: number; y: number } }) {
  const toMini = (x: number, y: number) => ({
    left: Math.max(14, Math.min(130, 80 + x / 16)),
    top: Math.max(14, Math.min(130, 80 + y / 11)),
  });
  const playerPoint = toMini(player.x, player.y);
  return (
    <div className="absolute top-5 right-5 z-[6] hidden sm:block">
      <div className="relative w-40 h-40 rounded-full border-[5px] border-slate-900 bg-gradient-to-b from-sky-300 to-sky-600 shadow-2xl overflow-hidden ring-2 ring-white/40">
        <div className="absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,.65) 0 2px, transparent 3px)', backgroundSize: '18px 18px' }} />
        <div className="absolute inset-[18px] bg-[#69bd47] shadow-inner" style={{ clipPath: 'polygon(50% 0%, 100% 41%, 50% 100%, 0% 41%)' }} />
        <div className="absolute left-[83px] top-[20px] h-[126px] w-3 rounded-full bg-amber-800/60 rotate-45" />
        <div className="absolute left-[31px] top-[82px] h-3 w-[112px] rounded-full bg-amber-800/60 -rotate-45" />
        <div className="absolute left-[76px] top-[76px] w-8 h-8 rounded-full bg-slate-200 border border-slate-500 -translate-x-1/2 -translate-y-1/2" />
        {LEAGUE_GATES.map((gate) => {
          const p = leagueGatePoint(gate);
          const point = toMini(p.x, p.y);
          return (
            <div
              key={gate.id}
              title={gate.label}
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2"
              style={{ left: point.left, top: point.top, backgroundColor: gate.color }}
            />
          );
        })}
        {BUILDINGS.map((b) => {
          const p = iso(b.tx, b.ty);
          const point = toMini(p.x, p.y);
          return (
            <div
              key={b.id}
              title={b.label}
              className="absolute w-3 h-3 rounded-[3px] border border-slate-950 shadow -translate-x-1/2 -translate-y-1/2"
              style={{ left: point.left, top: point.top, backgroundColor: b.color }}
            />
          );
        })}
        <div className="absolute w-4 h-4 rounded-full bg-yellow-300 border-2 border-white shadow-[0_0_14px_rgba(250,204,21,.95)] -translate-x-1/2 -translate-y-1/2" style={{ left: playerPoint.left, top: playerPoint.top }} />
        <div className="absolute left-1/2 bottom-2 -translate-x-1/2 rounded-full bg-slate-950/75 px-3 py-1 text-[9px] font-black tracking-widest text-white">GRID CITY</div>
      </div>
      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900 border-2 border-white/80 flex items-center justify-center text-white shadow-xl">
        <Compass className="w-5 h-5" />
      </div>
    </div>
  );
}

export default function KintaraSportsWorld() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { user } = useAuthStore();
  const { onlinePlayers, myStadium, liveMatches, moveAvatar, refreshWorld } = useWorld();
  const { openPanel, closePanel } = usePanels();
  const [player, setPlayer] = useState(() => ({ x: 0, y: 95 }));
  const [nearby, setNearby] = useState<SportsBuilding | null>(null);
  const [nearbyGate, setNearbyGate] = useState<LeagueGate | null>(null);
  const [hoveredBuildingId, setHoveredBuildingId] = useState<string | null>(null);
  const [quests, setQuests] = useState<DailyQuestHudItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatHudMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [worldStatus, setWorldStatus] = useState('Live world connected');
  const [walletOverride, setWalletOverride] = useState<WalletSnapshot | null>(null);
  const [commissionerOverview, setCommissionerOverview] = useState<CommissionerOverview | null>(null);
  const [hudOpen, setHudOpen] = useState({ economy: false, quests: false, chat: false });
  const [coachGuideOpen, setCoachGuideOpen] = useState(() => (typeof window === 'undefined' ? false : localStorage.getItem('grid-local-coach-guide-seen') !== 'yes'));
  const [coachStep, setCoachStep] = useState(0);

  const tiles = useMemo(() => {
    const all: Array<{ key: string; x: number; y: number; fill: string; stroke: string }> = [];
    for (let tx = -16; tx <= 16; tx += 1) {
      for (let ty = -13; ty <= 15; ty += 1) {
        const p = iso(tx, ty);
        const onMainRoad = Math.abs(tx) <= 1 || Math.abs(ty) <= 1 || Math.abs(tx + ty) <= 1;
        const onLeagueRoad = isLeaguePathTile(tx, ty);
        const onPlaza = Math.abs(tx) <= 2 && Math.abs(ty) <= 2;
        const nearStadium = tx >= -5 && tx <= 5 && ty >= -12 && ty <= -8;
        const nearMarket = tx >= -15 && tx <= -11 && ty >= 5 && ty <= 9;
        const nearGarage = tx >= 12 && tx <= 16 && ty >= -2 && ty <= 2;
        const nearMedical = tx >= 11 && tx <= 15 && ty >= 5 && ty <= 9;
        const nearTrophy = tx >= 2 && tx <= 6 && ty >= 10 && ty <= 14;
        const nearBank = tx >= -16 && tx <= -12 && ty >= -2 && ty <= 2;
        const turf = (tx + ty) % 2 === 0 ? '#78c74f' : '#6fbd45';
        const fill = onPlaza
          ? '#d1d5db'
          : onLeagueRoad
            ? '#f2c078'
            : onMainRoad
              ? '#b77943'
              : nearStadium
                ? '#86efac'
                : nearMarket
                  ? '#fef08a'
                  : nearGarage
                    ? '#cbd5e1'
                    : nearMedical
                      ? '#dcfce7'
                      : nearTrophy
                        ? '#fde68a'
                        : nearBank
                          ? '#bae6fd'
                          : turf;
        const stroke = onLeagueRoad ? '#f59e0b' : onMainRoad ? '#8b5a2b' : onPlaza ? '#94a3b8' : '#5fa83f';
        all.push({ key: `${tx}:${ty}`, x: p.x, y: p.y, fill, stroke });
      }
    }
    return all;
  }, []);

  const loadQuests = useCallback(async () => {
    try {
      const data = await fetchApi('/api/daily-quests');
      setQuests(data.data || []);
    } catch {
      setQuests([]);
    }
  }, []);

  const loadChat = useCallback(async () => {
    try {
      const data = await fetchApi('/api/chat/messages?channel=Realm&limit=40');
      setChatMessages(data.data || []);
    } catch {
      setChatMessages([]);
    }
  }, []);

  const loadCommissioner = useCallback(async () => {
    try {
      const data = await fetchApi('/api/commissioner/overview');
      setCommissionerOverview(data.data || null);
    } catch {
      setCommissionerOverview(null);
    }
  }, []);

  useEffect(() => {
    loadQuests();
    loadChat();
    loadCommissioner();
  }, [loadChat, loadCommissioner, loadQuests]);

  useEffect(() => {
    const handleMessage = (message: ChatHudMessage) => {
      setChatMessages((prev) => [...prev.filter((m) => m.id !== message.id), message].slice(-40));
    };
    socket.on('chat:message', handleMessage);
    socket.emit('chat:history', { channel: 'Realm', limit: 40 });
    socket.on('chat:history', (messages: ChatHudMessage[]) => setChatMessages(messages || []));
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:history');
    };
  }, []);

  useEffect(() => {
    moveAvatar(player.x, player.y);
  }, [moveAvatar, player.x, player.y]);

  useEffect(() => {
    const nearest = BUILDINGS
      .map((b) => ({ b, p: iso(b.tx, b.ty) }))
      .map(({ b, p }) => ({ b, dist: Math.hypot(p.x - player.x, p.y - player.y) }))
      .filter(({ dist }) => dist < 154)
      .sort((a, b) => a.dist - b.dist)[0]?.b ?? null;
    const nearestLeagueGate = LEAGUE_GATES
      .map((gate) => ({ gate, p: leagueGatePoint(gate) }))
      .map(({ gate, p }) => ({ gate, dist: Math.hypot(p.x - player.x, p.y - player.y) }))
      .filter(({ dist }) => dist < 145)
      .sort((a, b) => a.dist - b.dist)[0]?.gate ?? null;
    setNearby(nearest);
    setNearbyGate(nearestLeagueGate);
  }, [player.x, player.y]);

  const panelForBuilding = (building: SportsBuilding) => {
    switch (building.panelId) {
      case 'dashboard': return { title: 'Clubhouse HQ', content: <CityPage /> };
      case 'team': return { title: 'Locker Room', content: <TeamPage /> };
      case 'market': return { title: 'Sports Market', content: <MarketplacePage /> };
      case 'leaderboard': return { title: 'Trophy Hall', content: <LeaderboardPage /> };
      case 'wallet': return { title: 'Sponsor Bank', content: <WalletPage /> };
      case 'training': return { title: 'Training Gym', content: <TrainingPage /> };
      case 'stadium': return { title: 'Home Stadium', content: <StadiumInteriorPage embedded /> };
      case 'commissioner': return { title: 'Commissioner Office', content: <CommissionerPanel initialOverview={commissionerOverview} onWallet={setWalletOverride} onStatus={setWorldStatus} onOverview={setCommissionerOverview} /> };
      case 'transport': return { title: 'Team Garage', content: <TransportGaragePage /> };
      case 'matches': return { title: 'Practice Field', content: <MatchesPage /> };
      case 'progression': return { title: 'Medical Center', content: <PlayerProgressionPage /> };
      default: return { title: building.label, content: <CityPage /> };
    }
  };

  const openBuilding = (building: SportsBuilding) => {
    const panel = panelForBuilding(building);
    const visualLevel = stadiumVisualLevel(myStadium);
    const visualStage = buildingUpgradeStage(building.id, loopByBuilding.get(building.id), economyMeters, visualLevel);
    openPanel({
      id: building.panelId,
      title: panel.title,
      buildingId: building.id,
      x: 80,
      y: 60,
      width: 900,
      height: 640,
      minimized: false,
      maximized: false,
      mode: 'interior',
      content: (
        <BuildingInteriorShell
          building={building}
          title={panel.title}
          stadiumUpgradeLevel={visualLevel}
          visualStage={visualStage}
          onExit={() => closePanel(building.panelId)}
        >
          {panel.content}
        </BuildingInteriorShell>
      ),
    });
    setWorldStatus(`Entered ${building.label}: ${building.loop}`);
  };

  const openLeagueGate = (gate: LeagueGate) => {
    openPanel({
      id: `league-${gate.id}`,
      title: gate.name,
      buildingId: gate.id,
      x: 110,
      y: 72,
      width: 860,
      height: 620,
      minimized: false,
      maximized: false,
      content: <LeagueEconomyPanel gate={gate} />,
    });
    setWorldStatus(`${gate.name}: ${gate.status === 'owner' ? 'creator economy preview' : gate.entry}`);
  };

  const movePlayerTo = useCallback((point: { x: number; y: number }) => {
    const clamped = clampToWorld(point);
    if (pointsChanged(point, clamped)) {
      setWorldStatus('Map edge reached — use a league gate path to travel to another league.');
    }
    setPlayer(clamped);
  }, []);

  const moveToSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const transformed = point.matrixTransform(matrix.inverse());
    movePlayerTo({ x: transformed.x, y: transformed.y });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', 'e'].includes(key)) return;
      if (key === 'e') {
        event.preventDefault();
        if (nearby) {
          openBuilding(nearby);
          return;
        }
        if (nearbyGate) {
          openLeagueGate(nearbyGate);
          return;
        }
      }
      const step = 44;
      event.preventDefault();
      if (key === 'w' || key === 'arrowup') movePlayerTo({ x: player.x, y: player.y - step });
      if (key === 's' || key === 'arrowdown') movePlayerTo({ x: player.x, y: player.y + step });
      if (key === 'a' || key === 'arrowleft') movePlayerTo({ x: player.x - step, y: player.y });
      if (key === 'd' || key === 'arrowright') movePlayerTo({ x: player.x + step, y: player.y });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [movePlayerTo, nearby, nearbyGate, player.x, player.y]);

  const sendChat = async (event: FormEvent) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message) return;
    setChatInput('');

    if (socket.connected) {
      socket.emit('chat:send', { channel: 'Realm', message }, (response: { status?: string; message?: string }) => {
        if (response?.status === 'error') setWorldStatus(response.message || 'Chat send failed');
      });
      return;
    }

    try {
      const data = await fetchApi('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ channel: 'Realm', message }),
      });
      setChatMessages((prev) => [...prev, data.data].slice(-40));
    } catch (error) {
      setWorldStatus(error instanceof Error ? error.message : 'Chat send failed');
    }
  };

  const claimQuest = async (quest: DailyQuestHudItem) => {
    try {
      const data = await fetchApi(`/api/daily-quests/${quest.id}/claim`, { method: 'POST' });
      if (data.data?.wallet) setWalletOverride(data.data.wallet);
      setWorldStatus(`${quest.label} unlocked daily payout eligibility`);
      await loadQuests();
    } catch (error) {
      setWorldStatus(error instanceof Error ? error.message : 'Quest claim failed');
    }
  };

  const playHotbarMiniGame = async (slot: HotbarSlot) => {
    try {
      setWorldStatus(`Running ${slot.label} on the server...`);
      const data = await fetchApi('/api/mini-games/play', {
        method: 'POST',
        body: JSON.stringify({ miniGameType: slot.miniGameType }),
      });
      if (data.data?.wallet) setWalletOverride(data.data.wallet);
      setWorldStatus(`${data.data?.miniGame?.label || slot.label}: ${data.data?.outcome || 'Complete'} • +${(data.data?.netCash ?? 0).toLocaleString()} CASH net`);
      await Promise.all([loadQuests(), refreshWorld()]);
    } catch (error) {
      setWorldStatus(error instanceof Error ? error.message : 'Mini-game failed');
    }
  };

  const refreshHud = async () => {
    setWorldStatus('Refreshing live world, quests, and chat...');
    const results = await Promise.allSettled([refreshWorld(), loadQuests(), loadChat(), loadCommissioner()]);
    const failed = results.filter((result) => result.status === 'rejected').length;
    setWorldStatus(failed ? `Refresh finished with ${failed} server issue${failed === 1 ? '' : 's'}` : 'Live world refreshed');
  };

  const completeCoachGuide = () => {
    setCoachGuideOpen(false);
    localStorage.setItem('grid-local-coach-guide-seen', 'yes');
  };

  const username = user?.displayName || user?.username || 'Owner';
  const cash = walletOverride?.cash ?? user?.wallet?.cash ?? 0;
  const dyn = walletOverride?.dynTokens ?? user?.wallet?.dynTokens ?? 0;
  const stadiumLevel = stadiumVisualLevel(myStadium);
  const loopByBuilding = useMemo(() => {
    const map = new Map<string, BuildingEconomyLoop>();
    commissionerOverview?.buildingLoops?.forEach((loop) => map.set(loop.buildingId, loop));
    return map;
  }, [commissionerOverview]);
  const economyMeters: EconomyMeter[] = commissionerOverview?.meters || [
    { key: 'communityFunding', label: 'Community Funding', value: 0, target: 25000, progress: 0, unit: 'DYN', description: 'Fund shared sports infrastructure.' },
    { key: 'limitedInventory', label: 'Limited Inventory', value: 0, target: 5, progress: 0, unit: 'drops', description: 'Unlock finite restock batches.' },
    { key: 'inventoryScarcity', label: 'Scarcity', value: 0, target: 1, progress: 0, unit: 'claimed', description: 'Claimed supply drives restock demand.' },
    { key: 'rewardPool', label: 'Rewards', value: 0, target: 2500, progress: 0, unit: 'DYN-equiv', description: 'Contributor reward budget.' },
  ];
  const completedQuestCount = quests.filter((quest) => quest.completed).length;
  const openQuestCount = quests.filter((quest) => !quest.claimed).length;
  const economyAverage = Math.round(economyMeters.reduce((sum, meter) => sum + meter.progress, 0) / Math.max(1, economyMeters.length));
  const latestChat = chatMessages.at(-1);
  const questBuildingIds = useMemo(() => new Set(quests.filter((quest) => !quest.claimed).flatMap(questTargetsFor)), [quests]);
  const activeCoachStep = coachGuideOpen ? ONBOARDING_STEPS[coachStep] : null;
  const guidedBuildingIds = useMemo(() => {
    const ids = new Set(questBuildingIds);
    activeCoachStep?.buildingIds.forEach((id) => ids.add(id));
    return ids;
  }, [activeCoachStep, questBuildingIds]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#8ed5f5] select-none">
      <div className="absolute inset-0 bg-gradient-to-b from-[#8ed5f5] via-[#bcefc1] to-[#7bc65a]" />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0 5%, transparent 18%), radial-gradient(circle at 72% 18%, white 0 4%, transparent 16%)' }} />

      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        viewBox="-1120 -750 2240 1420"
        onClick={(e) => moveToSvgPoint(e.clientX, e.clientY)}
        role="img"
        aria-label="Interactive isometric sports world"
      >
        <defs>
          <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="52%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <radialGradient id="islandGlow" cx="50%" cy="44%" r="60%">
            <stop offset="0%" stopColor="#bbf7d0" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#14532d" stopOpacity="0" />
          </radialGradient>
          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity="0.22" />
          </filter>
          <filter id="warmGlow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={-1120} y={-750} width={2240} height={1420} fill="url(#waterGradient)" />
        <WaterfrontDetails />
        <ellipse cx={0} cy={-60} rx={960} ry={545} fill="url(#islandGlow)" />

        <g filter="url(#softShadow)">
          <polygon points="0,-682 1054,-104 0,602 -1054,-104" fill="#d9f99d" opacity={0.94} stroke="#fef3c7" strokeWidth={18} />
          <polygon points="0,-660 1025,-90 0,575 -1025,-90" fill="#5fb844" stroke="#3f8f2f" strokeWidth={7} />
          <polygon points="0,575 1025,-90 1025,-30 0,645" fill="#407e33" opacity={0.7} />
          <polygon points="0,575 -1025,-90 -1025,-30 0,645" fill="#386f2f" opacity={0.8} />
        </g>

        <g>
          {tiles.map((t) => <Tile key={t.key} x={t.x} y={t.y} fill={t.fill} stroke={t.stroke} />)}
        </g>

        <g>
          {BUILDINGS.map((building) => <DistrictGround key={`district-${building.id}`} building={building} />)}
        </g>

        <g>
          {LEAGUE_GATES.map((gate) => <LeagueGateView key={gate.id} gate={gate} onClick={openLeagueGate} />)}
        </g>

        {/* Central fountain / town-square anchor */}
        <g transform="translate(0,0)">
          <ellipse cx={0} cy={0} rx={54} ry={25} fill="#94a3b8" stroke="#475569" strokeWidth={2} />
          <ellipse cx={0} cy={-3} rx={38} ry={17} fill="#38bdf8" stroke="#bae6fd" strokeWidth={2} />
          <rect x={-9} y={-30} width={18} height={28} rx={4} fill="#cbd5e1" stroke="#64748b" />
          <circle cx={0} cy={-38} r={8} fill="#7dd3fc" opacity={0.8} />
        </g>

        {/* Trees and sports props */}
        {[-14, -11, -7, 7, 11, 14].map((tx, i) => {
          const p = iso(tx, -12 + (i % 4));
          return <BlockTree key={`top-tree-${i}`} x={p.x} y={p.y} />;
        })}
        {[-14, -10, -5, 5, 10, 14].map((tx, i) => {
          const p = iso(tx, 14 - (i % 5));
          return <BlockTree key={`bottom-tree-${i}`} x={p.x} y={p.y} />;
        })}

        {DECORATIONS.map((item, idx) => <Decoration key={`${item.kind}-${idx}`} item={item} />)}
        {CROWD_CLUSTERS.map((cluster, idx) => <CrowdCluster key={`crowd-${idx}`} tx={cluster.tx} ty={cluster.ty} color={cluster.color} />)}
        <WorldEconomyEvents myStadium={myStadium} liveMatches={liveMatches} commissionerOverview={commissionerOverview} economyMeters={economyMeters} />

        {BUILDINGS.map((building) => {
          const economyLoop = loopByBuilding.get(building.id);
          const visualStage = buildingUpgradeStage(building.id, economyLoop, economyMeters, stadiumLevel);
          return (
            <SportsBuildingView
              key={building.id}
              building={building}
              economyLoop={economyLoop}
              onClick={openBuilding}
              active={nearby?.id === building.id}
              hovered={hoveredBuildingId === building.id}
              onHover={setHoveredBuildingId}
              stadiumUpgradeLevel={building.id === 'stadium' ? stadiumLevel : 0}
              visualStage={visualStage}
              questTarget={guidedBuildingIds.has(building.id)}
            />
          );
        })}

        {NPCS.map((npc) => {
          const p = iso(npc.tx, npc.ty);
          return (
            <g key={npc.name} transform={`translate(${p.x}, ${p.y})`}>
              <VoxelAvatar x={0} y={0} name={npc.name} level={12} color={npc.color} />
              <g transform="translate(28,-76)">
                <circle r={13} fill="#fef3c7" stroke="#92400e" strokeWidth={2} />
                <text x={0} y={5} textAnchor="middle" fill="#92400e" fontSize={15} fontWeight={900}>{npc.marker}</text>
              </g>
            </g>
          );
        })}

        {onlinePlayers.slice(0, 8).map((p) => (
          <VoxelAvatar key={p.userId} x={p.x} y={p.y} name={p.username} level={9} color={p.avatarColor || '#3b82f6'} />
        ))}

        <g style={{ transition: 'transform 700ms cubic-bezier(.2,.8,.2,1)' }} transform={`translate(${player.x}, ${player.y})`}>
          <VoxelAvatar x={0} y={0} name={username} level={18} color="#2563eb" isPlayer />
        </g>
      </svg>

      {/* Top-left status / single utility action */}
      <div className="absolute top-4 left-4 z-[6] flex items-start gap-2">
        <button
          type="button"
          onClick={refreshHud}
          aria-label="Refresh live world data"
          title="Refresh live world data"
          className="w-11 h-11 rounded-full bg-slate-900/85 border border-white/30 text-white shadow-xl hover:scale-105 transition-transform font-black flex items-center justify-center"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
        <div className="px-4 py-2 rounded-xl bg-slate-900/85 text-white border border-white/20 shadow-xl max-w-[340px]">
          <div className="text-xs uppercase tracking-widest text-slate-300">Grid City Club 4</div>
          <div className="text-sm font-black leading-snug">{worldStatus}</div>
        </div>
      </div>

      {/* Top-center resource pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[6] flex items-center gap-2 rounded-2xl bg-slate-900/90 border border-white/20 px-4 py-2 shadow-2xl text-white">
        <Users className="w-4 h-4 text-sky-300" />
        <span className="font-black">{Math.max(onlinePlayers.length + 1629, 1632)}</span>
        <span className="w-px h-5 bg-white/20" />
        <Coins className="w-4 h-4 text-yellow-300" />
        <span className="font-black">{cash.toLocaleString()}</span>
        <span className="w-px h-5 bg-white/20" />
        <Zap className="w-4 h-4 text-orange-300" />
        <span className="font-black">{dyn.toLocaleString()} DYN</span>
      </div>

      <MiniMap player={player} />

      {/* First-session coach path: teaches the sports economy loop without a wall of text. */}
      {activeCoachStep && (
        <div className="absolute left-1/2 top-20 z-[8] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 rounded-3xl border border-amber-200/70 bg-slate-950/92 p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200 font-black">Local Coach Path</div>
              <h3 className="mt-1 text-lg font-black">{activeCoachStep.title}</h3>
              <p className="mt-1 text-sm leading-snug text-slate-200">{activeCoachStep.body}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                {activeCoachStep.buildingIds.map((id) => (
                  <span key={id} className="rounded-full bg-amber-300/15 px-2 py-1 text-amber-100">{BUILDING_SIGNS[id]?.text || id}</span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-stretch">
              <div className="rounded-2xl bg-emerald-400/15 px-3 py-2 text-center text-xs font-black text-emerald-100">{activeCoachStep.action}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCoachStep((step) => Math.min(ONBOARDING_STEPS.length - 1, step + 1))}
                  disabled={coachStep === ONBOARDING_STEPS.length - 1}
                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20 disabled:opacity-40"
                >
                  Next
                </button>
                <button type="button" onClick={completeCoachGuide} className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-200">
                  {coachStep === ONBOARDING_STEPS.length - 1 ? 'Finish' : 'Hide'}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1">
            {ONBOARDING_STEPS.map((step, idx) => (
              <button
                key={step.title}
                type="button"
                onClick={() => setCoachStep(idx)}
                className={`h-2 rounded-full ${idx === coachStep ? 'bg-amber-300' : idx < coachStep ? 'bg-emerald-400' : 'bg-white/20'}`}
                aria-label={`Show onboarding step ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {!activeCoachStep && (
        <button
          type="button"
          onClick={() => { setCoachGuideOpen(true); setCoachStep(0); }}
          className="absolute top-28 left-4 z-[7] rounded-2xl border border-amber-200/60 bg-slate-950/85 px-3 py-2 text-xs font-black uppercase tracking-wider text-amber-100 shadow-xl hover:bg-slate-900"
        >
          Local Coach Path
        </button>
      )}

      {/* Collapsible HUD dock: support widgets sit below the minimap on desktop and above it on phones. */}
      <div className="absolute right-4 top-28 sm:top-[12.75rem] z-[7] flex flex-col items-end gap-2 pointer-events-none">
        <button
          type="button"
          onClick={() => setHudOpen((prev) => ({ ...prev, economy: !prev.economy }))}
          className="pointer-events-auto min-w-[230px] rounded-2xl bg-slate-950/90 border border-white/20 shadow-2xl text-white px-4 py-3 backdrop-blur-md hover:-translate-y-0.5 transition-transform"
          aria-expanded={hudOpen.economy}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-[0.24em] text-orange-200 font-black">Economy</div>
              <div className="text-sm font-black">Fund → Unlock → Restock</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-cyan-400/20 px-2 py-1 text-xs font-black text-cyan-100">{economyAverage}%</span>
              {hudOpen.economy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>
        {hudOpen.economy && (
          <div className="pointer-events-auto w-[350px] rounded-2xl bg-slate-950/92 border border-white/15 shadow-2xl text-white backdrop-blur-md overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-orange-500/25 to-sky-500/20">
              <div className="text-[11px] uppercase tracking-[0.25em] text-slate-300 font-black">Commissioner Economy Meters</div>
              <div className="text-lg font-black">Every system has a visible loop</div>
            </div>
            <div className="p-4 space-y-3 text-xs">
              {economyMeters.slice(0, 5).map((meter) => (
                <div key={meter.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-black text-amber-200 uppercase tracking-wider">{meter.label}</div>
                    <div className="font-black text-white">{meter.progress}%</div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${Math.max(0, Math.min(100, meter.progress))}%` }} /></div>
                  <div className="mt-1 text-slate-300 leading-snug">{meter.description}</div>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4 text-[11px] leading-snug text-emerald-100">
              Economy HUD is collapsed by default so the world stays readable. Open it only when tuning funding, restocks, scarcity, and reward pools.
            </div>
          </div>
        )}
      </div>

      {/* Daily quests: compact bottom-left drawer instead of permanent card. */}
      <div className="absolute left-4 bottom-24 z-[7] max-w-[calc(100vw-2rem)] pointer-events-none">
        <button
          type="button"
          onClick={() => setHudOpen((prev) => ({ ...prev, quests: !prev.quests }))}
          className="pointer-events-auto rounded-2xl bg-slate-900/90 border border-white/20 shadow-2xl text-white px-4 py-3 backdrop-blur-md flex items-center gap-3 hover:-translate-y-0.5 transition-transform"
          aria-expanded={hudOpen.quests}
        >
          <Target className="w-4 h-4 text-orange-300" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-300 font-black">Daily Sports Quests</div>
            <div className="text-sm font-black">{completedQuestCount}/{Math.max(quests.length, 1)} complete • {openQuestCount} active</div>
          </div>
          {hudOpen.quests ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        {hudOpen.quests && (
          <div className="pointer-events-auto mt-2 w-[330px] rounded-2xl bg-slate-900/92 border border-white/20 shadow-2xl text-white overflow-hidden backdrop-blur-md">
            <div className="p-4 space-y-3">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-[11px] leading-snug text-emerald-100">
                Complete these objectives to unlock today’s payout eligibility. CASH is earned from games, not from quest claims.
              </div>
              {quests.length === 0 && <div className="text-xs text-slate-300">Loading server-backed quests...</div>}
              {quests.map((q) => (
                <div key={q.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center justify-between text-xs mb-1 gap-2">
                    <span className="font-bold truncate">{q.label}</span>
                    <span className="text-slate-300 shrink-0">{q.progress}/{q.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-400 to-yellow-300" style={{ width: `${Math.min(100, (q.progress / Math.max(1, q.total)) * 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="text-[11px] text-emerald-300 font-bold">{q.rewardLabel}</div>
                    {q.completed && !q.claimed && (
                      <button onClick={() => claimQuest(q)} className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-black hover:bg-emerald-400">UNLOCK</button>
                    )}
                    {q.claimed && <span className="text-[10px] text-slate-400 font-black">UNLOCKED</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat: minimized bar by default so it does not compete with movement/hotbar controls. */}
      <div className="absolute left-4 bottom-4 z-[7] w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none">
        <button
          type="button"
          onClick={() => setHudOpen((prev) => ({ ...prev, chat: !prev.chat }))}
          className="pointer-events-auto w-full rounded-2xl bg-slate-900/90 border border-white/20 shadow-2xl text-white px-4 py-3 backdrop-blur-md flex items-center gap-3 hover:-translate-y-0.5 transition-transform"
          aria-expanded={hudOpen.chat}
        >
          <MessageCircle className="w-4 h-4 text-sky-300" />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-300 font-black">Realm Chat</div>
            <div className="text-sm font-black truncate">{latestChat ? `${latestChat.user}: ${latestChat.msg}` : 'No realm messages yet'}</div>
          </div>
          <span className="rounded-full bg-orange-500 px-2 py-1 text-xs font-black">{chatMessages.length}</span>
          {hudOpen.chat ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        {hudOpen.chat && (
          <div className="pointer-events-auto mt-2 rounded-2xl bg-slate-900/92 border border-white/20 shadow-2xl text-white overflow-hidden backdrop-blur-md">
            <div className="px-3 pt-3 flex gap-2 text-xs font-black">
              <span className="px-3 py-1 rounded-full bg-orange-500">Realm</span>
              <span className="px-3 py-1 rounded-full bg-white/10 text-slate-300">Global</span>
              <span className="px-3 py-1 rounded-full bg-white/10 text-slate-300">Trade</span>
            </div>
            <div className="px-4 py-2 space-y-1 max-h-28 overflow-y-auto text-xs">
              {chatMessages.length === 0 && <div className="text-slate-400">No realm messages yet. Say hello.</div>}
              {chatMessages.map((m, idx) => (
                <div key={m.id || `${m.user}-${idx}`}><span className="text-sky-300 font-black">[{m.channel}] {m.user}:</span> <span className="text-slate-100">{m.msg}</span></div>
              ))}
            </div>
            <form className="px-3 pb-3" onSubmit={sendChat}>
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                maxLength={240}
                className="h-9 w-full rounded-xl bg-slate-800 border border-white/10 px-3 text-xs text-slate-100 placeholder:text-slate-400 outline-none focus:border-orange-400"
                placeholder="Type realm message..."
              />
            </form>
          </div>
        )}
      </div>

      {/* Hotbar */}
      <div className="absolute left-1/2 bottom-5 -translate-x-1/2 z-[6] flex items-end gap-2">
        {HOTBAR.map((slot, idx) => (
          <button
            key={slot.key}
            onClick={() => playHotbarMiniGame(slot)}
            title={`Run server-backed ${slot.label}`}
            className={`relative w-16 h-16 rounded-2xl border-2 ${idx === 0 ? 'border-yellow-300 bg-slate-800' : 'border-white/25 bg-slate-900/90'} text-white shadow-2xl flex flex-col items-center justify-center hover:-translate-y-1 transition-transform`}
          >
            <span className="absolute left-1.5 top-1 text-[10px] text-slate-300 font-black">{slot.key}</span>
            <span className="text-2xl leading-none">{slot.icon}</span>
            <span className="text-[9px] font-bold text-slate-300 mt-1">{slot.label}</span>
          </button>
        ))}
      </div>

      {/* Context prompt */}
      <div className="absolute left-1/2 bottom-24 -translate-x-1/2 z-[6]">
        <div className="rounded-full bg-slate-900/90 border border-white/25 px-5 py-2 text-white shadow-xl flex items-center gap-2 text-sm font-bold">
          <Hand className="w-4 h-4 text-yellow-300" />
          {nearby ? <>Press <span className="px-2 py-0.5 rounded bg-white/15">E</span> to enter {nearby.label}</> : nearbyGate ? <>Press <span className="px-2 py-0.5 rounded bg-white/15">E</span> for {nearbyGate.name}</> : 'Click ground or use WASD to move — edges are league gates'}
        </div>
      </div>

      {/* Mini sports status card */}
      <div className="absolute bottom-4 right-4 z-[6] hidden md:block xl:hidden rounded-2xl bg-white/92 border border-slate-200 px-4 py-3 shadow-2xl text-slate-900 w-72">
        <div className="text-xs uppercase tracking-widest text-slate-500 font-black">My Venue</div>
        <div className="text-lg font-black truncate">{myStadium?.venueName || 'Community Stadium'}</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 p-2"><div className="text-sm font-black text-emerald-700">{myStadium?.condition ?? 92}%</div><div className="text-[10px] text-slate-500">Condition</div></div>
          <div className="rounded-xl bg-sky-50 p-2"><div className="text-sm font-black text-sky-700">{(myStadium?.capacity ?? 5000).toLocaleString()}</div><div className="text-[10px] text-slate-500">Seats</div></div>
          <div className="rounded-xl bg-orange-50 p-2"><div className="text-sm font-black text-orange-700">${myStadium?.ticketPrice ?? 25}</div><div className="text-[10px] text-slate-500">Ticket</div></div>
        </div>
      </div>
    </div>
  );
}
