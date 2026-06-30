import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Coins,
  Compass,
  Dumbbell,
  Hand,
  MapPin,
  MessageSquare,
  Shirt,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { fetchApi } from '../../lib/api';
import { socket } from '../../lib/socket';
import { useWorld } from './WorldSystem';
import { usePanels } from './PanelSystem';
import CityPage from '../../pages/CityPage';
import MarketplacePage from '../../pages/MarketplacePage';
import LeaderboardPage from '../../pages/LeaderboardPage';
import WalletPage from '../../pages/WalletPage';
import TrainingPage from '../../pages/TrainingPage';
import StadiumInteriorPage from '../../pages/StadiumInteriorPage';
import WorldMapPage from '../../pages/WorldMapPage';
import TransportGaragePage from '../../pages/TransportGaragePage';
import TeamPage from '../../pages/TeamPage';
import MatchesPage from '../../pages/MatchesPage';
import PlayerProgressionPage from '../../pages/PlayerProgressionPage';

const TILE_W = 66;
const TILE_H = 34;

function iso(tileX: number, tileY: number) {
  return {
    x: (tileX - tileY) * (TILE_W / 2),
    y: (tileX + tileY) * (TILE_H / 2),
  };
}

const WORLD_BOUNDS = {
  topY: -430,
  centerY: -90,
  bottomY: 350,
  halfWidth: 690,
  avatarMargin: 34,
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
  tx: number;
  ty: number;
  color: string;
  accent: string;
  kind: BuildingKind;
}

const BUILDINGS: SportsBuilding[] = [
  { id: 'stadium', panelId: 'stadium', label: 'Home Stadium', subtitle: 'Enter Matchday', tx: 0, ty: -6, color: '#ef4444', accent: '#991b1b', kind: 'stadium' },
  { id: 'practice', panelId: 'matches', label: 'Practice Field', subtitle: 'Play / Schedule', tx: -6, ty: -2, color: '#22c55e', accent: '#15803d', kind: 'field' },
  { id: 'training', panelId: 'training', label: 'Training Gym', subtitle: 'Run Drills', tx: 5, ty: -2, color: '#8b5cf6', accent: '#5b21b6', kind: 'gym' },
  { id: 'clubhouse', panelId: 'dashboard', label: 'Clubhouse HQ', subtitle: 'Daily Office', tx: -2, ty: 1, color: '#f97316', accent: '#9a3412', kind: 'clubhouse' },
  { id: 'team', panelId: 'team', label: 'Locker Room', subtitle: 'Manage Team', tx: 3, ty: 1, color: '#38bdf8', accent: '#0369a1', kind: 'team' },
  { id: 'market', panelId: 'market', label: 'Sports Market', subtitle: 'Trade Assets', tx: -7, ty: 4, color: '#fbbf24', accent: '#b45309', kind: 'shop' },
  { id: 'medical', panelId: 'progression', label: 'Medical Center', subtitle: 'Recovery', tx: 7, ty: 4, color: '#f8fafc', accent: '#ef4444', kind: 'medical' },
  { id: 'scout', panelId: 'world', label: 'Scout Tower', subtitle: 'Find Talent', tx: -4, ty: 7, color: '#14b8a6', accent: '#0f766e', kind: 'scout' },
  { id: 'hall', panelId: 'leaderboard', label: 'Trophy Hall', subtitle: 'Rankings', tx: 2, ty: 7, color: '#fde047', accent: '#ca8a04', kind: 'trophy' },
  { id: 'garage', panelId: 'transport', label: 'Team Garage', subtitle: 'Travel Fleet', tx: 8, ty: -1, color: '#94a3b8', accent: '#475569', kind: 'garage' },
  { id: 'bank', panelId: 'wallet', label: 'Sponsor Bank', subtitle: 'CASH / DYN', tx: -9, ty: 0, color: '#0ea5e9', accent: '#075985', kind: 'bank' },
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
    tx: -12,
    ty: 0,
    route: [[0, 0], [-3, 0], [-6, 0], [-9, 0], [-12, 0]],
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
    ty: -10,
    route: [[0, 0], [0, -2], [0, -5], [0, -8], [0, -10]],
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
    tx: 12,
    ty: 0,
    route: [[0, 0], [3, 0], [6, 0], [9, 0], [12, 0]],
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
    ty: 10,
    route: [[0, 0], [0, 2], [0, 5], [0, 8], [0, 10]],
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

const NPCS = [
  { name: 'Coach Mills', role: 'Daily Drills', tx: -5, ty: -1, color: '#f97316', marker: '?' },
  { name: 'Scout Ava', role: 'Prospects', tx: -3, ty: 6, color: '#14b8a6', marker: '!' },
  { name: 'Medic Jo', role: 'Recovery', tx: 6, ty: 3, color: '#ef4444', marker: '+' },
  { name: 'Ticket Sam', role: 'Revenue', tx: -6, ty: 3, color: '#fbbf24', marker: '$' },
];

const HOTBAR: Array<{ key: string; icon: string; label: string; miniGameType?: 'TEAM_DRILL' | 'SCOUTING' | 'STADIUM_MATCH'; panelId?: string }> = [
  { key: '1', icon: '🏈', label: 'Scrim', miniGameType: 'STADIUM_MATCH' },
  { key: '2', icon: '📋', label: 'Playbook', miniGameType: 'TEAM_DRILL' },
  { key: '3', icon: '💪', label: 'Drill', miniGameType: 'TEAM_DRILL' },
  { key: '4', icon: '🔭', label: 'Scout', miniGameType: 'SCOUTING' },
  { key: '5', icon: '🩹', label: 'Recovery', panelId: 'progression' },
  { key: '6', icon: '🚌', label: 'Travel', panelId: 'transport' },
];

function darker(hex: string, amount = 34) {
  const raw = hex.replace('#', '');
  const n = parseInt(raw, 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) - amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) - amount));
  const b = Math.min(255, Math.max(0, (n & 255) - amount));
  return `rgb(${r}, ${g}, ${b})`;
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
      <ellipse cx={0} cy={7} rx={19} ry={9} fill="rgba(0,0,0,0.18)" />
      <rect x={-4} y={-17} width={8} height={24} fill="#8b5a2b" />
      <polygon points="0,-66 30,-35 0,-22 -30,-35" fill="#1f8f45" stroke="#176d34" />
      <polygon points="0,-52 34,-21 0,-8 -34,-21" fill="#27ad52" stroke="#176d34" />
      <polygon points="0,-36 28,-9 0,3 -28,-9" fill="#3bc263" stroke="#176d34" />
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

function StadiumBuilding({ building }: { building: SportsBuilding }) {
  const { x, y } = iso(building.tx, building.ty);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={0} cy={17} rx={118} ry={50} fill="rgba(0,0,0,0.2)" />
      <ellipse cx={0} cy={-20} rx={116} ry={54} fill={building.accent} stroke="#111827" strokeWidth={2} />
      <ellipse cx={0} cy={-31} rx={96} ry={43} fill={building.color} stroke="#fee2e2" strokeWidth={2} />
      <ellipse cx={0} cy={-31} rx={63} ry={27} fill="#30c85f" stroke="#dcfce7" strokeWidth={2} />
      {[-40, -20, 0, 20, 40].map((lx) => (
        <line key={lx} x1={lx} y1={-55} x2={lx} y2={-8} stroke="#ffffff" strokeWidth={1} opacity={0.7} />
      ))}
      <rect x={-36} y={-94} width={72} height={22} rx={4} fill="#0f172a" stroke="#64748b" strokeWidth={2} />
      <text x={0} y={-80} textAnchor="middle" fill="#fff" fontSize={8} fontWeight={900}>GRID 00 - 00 GUEST</text>
      {[[-95, -86], [95, -86], [-105, -4], [105, -4]].map(([lx, ly], idx) => (
        <g key={idx}>
          <rect x={lx - 3} y={ly} width={6} height={70} fill="#475569" />
          <circle cx={lx} cy={ly - 3} r={9} fill="#fde047" opacity={0.86} />
        </g>
      ))}
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

function BoxBuilding({ building }: { building: SportsBuilding }) {
  const { x, y } = iso(building.tx, building.ty);
  const w = building.kind === 'gym' ? 86 : building.kind === 'garage' ? 96 : building.kind === 'bank' ? 82 : 68;
  const h = building.kind === 'clubhouse' ? 86 : building.kind === 'scout' ? 112 : building.kind === 'trophy' ? 78 : 64;
  const d = building.kind === 'garage' ? 58 : 46;
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
    </g>
  );
}

function BuildingLabel({ building }: { building: SportsBuilding }) {
  const { x, y } = iso(building.tx, building.ty);
  return (
    <g transform={`translate(${x}, ${y + 58})`} style={{ pointerEvents: 'none' }}>
      <rect x={-58} y={-18} width={116} height={34} rx={10} fill="rgba(15,23,42,0.85)" stroke={building.accent} />
      <text x={0} y={-4} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={900}>{building.label}</text>
      <text x={0} y={9} textAnchor="middle" fill="#cbd5e1" fontSize={8} fontWeight={700}>{building.subtitle}</text>
    </g>
  );
}

function SportsBuildingView({ building, onClick }: { building: SportsBuilding; onClick: (building: SportsBuilding) => void }) {
  const { x, y } = iso(building.tx, building.ty);
  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(building); }}
      className="cursor-pointer"
    >
      <g className="transition-transform duration-150 hover:scale-105" style={{ transformOrigin: `${x}px ${y}px` }}>
        {building.kind === 'stadium' ? <StadiumBuilding building={building} /> : building.kind === 'field' ? <FieldBuilding building={building} /> : <BoxBuilding building={building} />}
        <BuildingLabel building={building} />
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

function MiniMap({ player }: { player: { x: number; y: number } }) {
  const px = 54 + player.x / 13;
  const py = 54 + player.y / 10;
  return (
    <div className="absolute top-4 right-4 z-[6]">
      <div className="relative w-40 h-40 rounded-full border-[5px] border-slate-800 bg-[#70bd48] shadow-2xl overflow-hidden">
        <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.16) 1px,transparent 1px)', backgroundSize: '16px 16px' }} />
        <div className="absolute left-1/2 top-0 bottom-0 w-2 bg-amber-700/55 -translate-x-1/2 rotate-45" />
        <div className="absolute left-0 right-0 top-1/2 h-2 bg-amber-700/55 -translate-y-1/2 -rotate-45" />
        {BUILDINGS.map((b) => {
          const p = iso(b.tx, b.ty);
          return <div key={b.id} className="absolute w-2 h-2 rounded-sm bg-slate-900" style={{ left: 72 + p.x / 10, top: 72 + p.y / 7 }} />;
        })}
        {LEAGUE_GATES.map((gate) => {
          const p = leagueGatePoint(gate);
          return <div key={gate.id} className="absolute w-3 h-3 rounded-full border border-white" style={{ left: 72 + p.x / 10, top: 72 + p.y / 7, backgroundColor: gate.color }} />;
        })}
        <div className="absolute w-3 h-3 rounded-full bg-yellow-300 border-2 border-white shadow" style={{ left: Math.max(10, Math.min(130, px)), top: Math.max(10, Math.min(130, py)) }} />
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
  const { onlinePlayers, myStadium, moveAvatar, refreshWorld } = useWorld();
  const { openPanel } = usePanels();
  const [player, setPlayer] = useState(() => ({ x: 0, y: 95 }));
  const [nearby, setNearby] = useState<SportsBuilding | null>(null);
  const [nearbyGate, setNearbyGate] = useState<LeagueGate | null>(null);
  const [quests, setQuests] = useState<DailyQuestHudItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatHudMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [worldStatus, setWorldStatus] = useState('Live world connected');
  const [walletOverride, setWalletOverride] = useState<WalletSnapshot | null>(null);

  const tiles = useMemo(() => {
    const all: Array<{ key: string; x: number; y: number; fill: string; stroke: string }> = [];
    for (let tx = -12; tx <= 12; tx += 1) {
      for (let ty = -9; ty <= 10; ty += 1) {
        const p = iso(tx, ty);
        const onMainRoad = Math.abs(tx) <= 1 || Math.abs(ty) <= 1 || Math.abs(tx + ty) <= 1;
        const onLeagueRoad = isLeaguePathTile(tx, ty);
        const onPlaza = Math.abs(tx) <= 2 && Math.abs(ty) <= 2;
        const nearStadium = tx >= -3 && tx <= 3 && ty >= -8 && ty <= -4;
        const fill = onPlaza ? '#d1d5db' : onLeagueRoad ? '#f2c078' : onMainRoad ? '#b77943' : nearStadium ? '#86efac' : (tx + ty) % 2 === 0 ? '#78c74f' : '#6fbd45';
        const stroke = onLeagueRoad ? '#f59e0b' : onMainRoad ? '#8b5a2b' : '#5fa83f';
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

  useEffect(() => {
    loadQuests();
    loadChat();
  }, [loadChat, loadQuests]);

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
      .filter(({ dist }) => dist < 118)
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
      case 'stadium': return { title: 'Home Stadium', content: <StadiumInteriorPage /> };
      case 'world': return { title: 'Scout Office', content: <WorldMapPage /> };
      case 'transport': return { title: 'Team Garage', content: <TransportGaragePage /> };
      case 'matches': return { title: 'Practice Field', content: <MatchesPage /> };
      case 'progression': return { title: 'Medical Center', content: <PlayerProgressionPage /> };
      default: return { title: building.label, content: <CityPage /> };
    }
  };

  const openBuilding = (building: SportsBuilding) => {
    const panel = panelForBuilding(building);
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
      content: panel.content,
    });
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
      setWorldStatus(`${quest.label} reward claimed`);
      await loadQuests();
    } catch (error) {
      setWorldStatus(error instanceof Error ? error.message : 'Quest claim failed');
    }
  };

  const playHotbarMiniGame = async (slot: (typeof HOTBAR)[number]) => {
    if (slot.panelId) {
      const building = BUILDINGS.find((b) => b.panelId === slot.panelId);
      if (building) openBuilding(building);
      return;
    }
    if (!slot.miniGameType) return;

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

  const username = user?.displayName || user?.username || 'Owner';
  const cash = walletOverride?.cash ?? user?.wallet?.cash ?? 0;
  const dyn = walletOverride?.dynTokens ?? user?.wallet?.dynTokens ?? 0;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#8ed5f5] select-none">
      <div className="absolute inset-0 bg-gradient-to-b from-[#8ed5f5] via-[#bcefc1] to-[#7bc65a]" />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0 5%, transparent 18%), radial-gradient(circle at 72% 18%, white 0 4%, transparent 16%)' }} />

      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        viewBox="-760 -520 1520 980"
        onClick={(e) => moveToSvgPoint(e.clientX, e.clientY)}
        role="img"
        aria-label="Interactive isometric sports world"
      >
        <defs>
          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity="0.22" />
          </filter>
        </defs>

        <g filter="url(#softShadow)">
          <polygon points="0,-470 745,-90 0,386 -745,-90" fill="#5fb844" stroke="#3f8f2f" strokeWidth={6} />
          <polygon points="0,386 745,-90 745,-40 0,440" fill="#407e33" opacity={0.7} />
          <polygon points="0,386 -745,-90 -745,-40 0,440" fill="#386f2f" opacity={0.8} />
        </g>

        <g>
          {tiles.map((t) => <Tile key={t.key} x={t.x} y={t.y} fill={t.fill} stroke={t.stroke} />)}
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
        {[-10, -8, -5, 6, 8, 10].map((tx, i) => {
          const p = iso(tx, -8 + (i % 3));
          return <BlockTree key={`top-tree-${i}`} x={p.x} y={p.y} />;
        })}
        {[-9, -6, -3, 4, 7, 10].map((tx, i) => {
          const p = iso(tx, 9 - (i % 4));
          return <BlockTree key={`bottom-tree-${i}`} x={p.x} y={p.y} />;
        })}

        {BUILDINGS.map((building) => <SportsBuildingView key={building.id} building={building} onClick={openBuilding} />)}

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

      {/* Top-left MMO buttons */}
      <div className="absolute top-4 left-4 z-[6] flex flex-col gap-2">
        <div className="flex gap-2">
          {['☰', '↻', '⚙'].map((item) => (
            <button key={item} className="w-11 h-11 rounded-full bg-slate-900/85 border border-white/30 text-white shadow-xl hover:scale-105 transition-transform font-black">
              {item}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 rounded-xl bg-slate-900/85 text-white border border-white/20 shadow-xl">
          <div className="text-xs uppercase tracking-widest text-slate-300">Grid City Club 4</div>
          <div className="text-sm font-black">{worldStatus}</div>
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

      {/* Economy loop card */}
      <div className="absolute right-4 top-52 z-[6] hidden xl:block w-[330px] rounded-2xl bg-slate-950/88 border border-white/15 shadow-2xl text-white backdrop-blur-md overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-orange-500/25 to-sky-500/20">
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-300 font-black">Return + Volume Loop</div>
          <div className="text-lg font-black">Build, Trade, Host, Advance</div>
        </div>
        <div className="p-4 grid grid-cols-2 gap-2 text-xs">
          {[
            ['Make', 'Tickets, sponsors, player sales, league rewards'],
            ['Spend', 'Training, recovery, travel, stadium upgrades'],
            ['Trade', 'Players, gear, passes, facility slots'],
            ['Own', 'Custom leagues, venues, tournaments, media'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="font-black text-amber-200 uppercase tracking-wider">{label}</div>
              <div className="mt-1 text-slate-200 leading-snug">{value}</div>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 text-[11px] leading-snug text-emerald-100">
          Better user leagues attract outside teams; owners earn revenue while paying maintenance and game tax, creating repeat play and platform sinks.
        </div>
      </div>

      {/* Right action buttons */}
      <div className="absolute right-5 top-[31rem] z-[6] hidden 2xl:grid grid-cols-2 gap-3">
        {[
          { icon: <Users className="w-5 h-5" />, badge: '' },
          { icon: <Shirt className="w-5 h-5" />, badge: '3' },
          { icon: <Dumbbell className="w-5 h-5" />, badge: '' },
          { icon: <Trophy className="w-5 h-5" />, badge: '1' },
          { icon: <MapPin className="w-5 h-5" />, badge: '' },
          { icon: <MessageSquare className="w-5 h-5" />, badge: chatMessages.length ? String(Math.min(chatMessages.length, 99)) : '' },
        ].map((button, idx) => (
          <button key={idx} className="relative w-12 h-12 rounded-full bg-slate-900/90 border border-white/30 text-white flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
            {button.icon}
            {button.badge && <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-red-500 border-2 border-white text-[10px] font-black flex items-center justify-center">{button.badge}</span>}
          </button>
        ))}
      </div>

      {/* Daily quests */}
      <div className="absolute left-4 bottom-36 z-[6] w-[330px] max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900/88 border border-white/20 shadow-2xl text-white overflow-hidden backdrop-blur-md">
        <div className="px-4 py-3 bg-slate-800/90 border-b border-white/10 flex items-center gap-2">
          <Target className="w-4 h-4 text-orange-300" />
          <span className="text-sm font-black tracking-wider">DAILY SPORTS QUESTS</span>
        </div>
        <div className="p-4 space-y-3">
          {quests.length === 0 && <div className="text-xs text-slate-300">Loading server-backed quests...</div>}
          {quests.map((q) => (
            <div key={q.id}>
              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                <span className="font-bold truncate">{q.label}</span>
                <span className="text-slate-300 shrink-0">{q.progress}/{q.total}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-400 to-yellow-300" style={{ width: `${Math.min(100, (q.progress / q.total) * 100)}%` }} />
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <div className="text-[11px] text-emerald-300 font-bold">{q.rewardLabel}</div>
                {q.completed && !q.claimed && (
                  <button onClick={() => claimQuest(q)} className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-black hover:bg-emerald-400">CLAIM</button>
                )}
                {q.claimed && <span className="text-[10px] text-slate-400 font-black">CLAIMED</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="absolute left-4 bottom-4 z-[6] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900/88 border border-white/20 shadow-2xl text-white overflow-hidden backdrop-blur-md">
        <div className="px-3 pt-3 flex gap-2 text-xs font-black">
          <span className="px-3 py-1 rounded-full bg-orange-500">Realm</span>
          <span className="px-3 py-1 rounded-full bg-white/10 text-slate-300">Global</span>
          <span className="px-3 py-1 rounded-full bg-white/10 text-slate-300">Trade</span>
        </div>
        <div className="px-4 py-2 space-y-1 max-h-24 overflow-y-auto text-xs">
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

      {/* Hotbar */}
      <div className="absolute left-1/2 bottom-5 -translate-x-1/2 z-[6] flex items-end gap-2">
        {HOTBAR.map((slot, idx) => (
          <button
            key={slot.key}
            onClick={() => playHotbarMiniGame(slot)}
            title={slot.miniGameType ? `Run server-backed ${slot.label}` : `Open ${slot.label}`}
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
