import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTravel } from '../../components/travel/TravelSystem';
import TravelVehicles from '../../components/travel/TravelVehicles';
import { useMatchDay } from '../../components/match/MatchDaySystem';
import { useMatchSchedule } from '../../components/match/MatchScheduleSystem';
import { useTraining } from '../../components/training/TrainingSystem';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard, Shield, Bus, Dumbbell, ShoppingCart, Trophy, Wallet, Store, Globe, Shirt,
} from 'lucide-react';
import { usePanels } from './PanelSystem';

// Import all page components for panels
import CityPage from '../../pages/CityPage';
import TeamPage from '../../pages/TeamPage';
import MarketplacePage from '../../pages/MarketplacePage';
import LeaderboardPage from '../../pages/LeaderboardPage';
import WalletPage from '../../pages/WalletPage';
import TrainingPage from '../../pages/TrainingPage';
import EquipmentPage from '../../pages/EquipmentPage';
import WorldMapPage from '../../pages/WorldMapPage';
import StadiumInteriorPage from '../../pages/StadiumInteriorPage';
import TransportGaragePage from '../../pages/TransportGaragePage';

interface Building {
  id: string;
  label: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  accent: string;
  panelWidth: number;
  panelHeight: number;
  getContent: () => React.ReactNode;
}

const BUILDINGS: Building[] = [
  {
    id: 'stadium', label: 'Stadium', route: '/stadium/interior', icon: Shield,
    x: 420, y: 60, width: 160, height: 120, color: '#1e3a5f', accent: '#22c55e',
    panelWidth: 800, panelHeight: 600,
    getContent: () => <StadiumInteriorPage />,
  },
  {
    id: 'transport', label: 'Garage', route: '/garage', icon: Bus,
    x: 80, y: 240, width: 140, height: 100, color: '#451a03', accent: '#fbbf24',
    panelWidth: 900, panelHeight: 550,
    getContent: () => <TransportGaragePage />,
  },
  {
    id: 'training', label: 'Training', route: '/training', icon: Dumbbell,
    x: 780, y: 240, width: 140, height: 100, color: '#3f0f3f', accent: '#a855f7',
    panelWidth: 700, panelHeight: 550,
    getContent: () => <TrainingPage />,
  },
  {
    id: 'market', label: 'Market', route: '/marketplace', icon: ShoppingCart,
    x: 80, y: 420, width: 140, height: 100, color: '#3f2e0f', accent: '#f59e0b',
    panelWidth: 800, panelHeight: 600,
    getContent: () => <MarketplacePage />,
  },
  {
    id: 'team', label: 'Team Office', route: '/team', icon: Store,
    x: 430, y: 420, width: 140, height: 100, color: '#1e293b', accent: '#3b82f6',
    panelWidth: 750, panelHeight: 580,
    getContent: () => <TeamPage />,
  },
  {
    id: 'wallet', label: 'Bank', route: '/wallet', icon: Wallet,
    x: 780, y: 420, width: 140, height: 100, color: '#3f2e0f', accent: '#eab308',
    panelWidth: 600, panelHeight: 500,
    getContent: () => <WalletPage />,
  },
  {
    id: 'dashboard', label: 'HQ', route: '/dashboard', icon: LayoutDashboard,
    x: 80, y: 60, width: 120, height: 90, color: '#0f172a', accent: '#E94560',
    panelWidth: 700, panelHeight: 500,
    getContent: () => <CityPage />,
  },
  {
    id: 'world', label: 'World Map', route: '/world-map', icon: Globe,
    x: 820, y: 60, width: 120, height: 90, color: '#0c2e4e', accent: '#06b6d4',
    panelWidth: 900, panelHeight: 600,
    getContent: () => <WorldMapPage />,
  },
  {
    id: 'leaderboard', label: 'Hall of Fame', route: '/leaderboard', icon: Trophy,
    x: 430, y: 240, width: 140, height: 100, color: '#2a1a0a', accent: '#fbbf24',
    panelWidth: 700, panelHeight: 550,
    getContent: () => <LeaderboardPage />,
  },
  {
    id: 'locker', label: 'Locker Room', route: '/locker', icon: Shirt,
    x: 250, y: 240, width: 120, height: 90, color: '#1a1a2e', accent: '#64748b',
    panelWidth: 800, panelHeight: 600,
    getContent: () => <EquipmentPage />,
  },
];

const ROADS = [
  { from: 'dashboard', to: 'stadium' },
  { from: 'stadium', to: 'world' },
  { from: 'stadium', to: 'leaderboard' },
  { from: 'dashboard', to: 'transport' },
  { from: 'transport', to: 'market' },
  { from: 'stadium', to: 'training' },
  { from: 'training', to: 'wallet' },
  { from: 'training', to: 'locker' },
  { from: 'market', to: 'team' },
  { from: 'team', to: 'wallet' },
  { from: 'leaderboard', to: 'team' },
  { from: 'transport', to: 'leaderboard' },
  { from: 'training', to: 'leaderboard' },
  { from: 'locker', to: 'world' },
];

function hashToColor(str: string): string {
  const h = str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = ['#E94560', '#3b82f6', '#22c55e', '#fbbf24', '#a855f7', '#06b6d4', '#f97316'];
  return colors[h % colors.length];
}

// ─── Building SVG Components (same as before, abbreviated) ───

function StadiumSVG({ building, isHovered, activeMatch, scheduledMatch }: { building: Building; isHovered: boolean; activeMatch?: { awayTeamName: string; totalRevenue: number; elapsedSeconds: number; status: string }; scheduledMatch?: any }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const isMatchDay = activeMatch?.status === 'PLAYING';
  const isScheduled = scheduledMatch && (scheduledMatch.phase === 'SCHEDULED' || scheduledMatch.phase === 'TRAVELING');
  const glow = isHovered || isMatchDay || isScheduled ? 1 : 0.6;
  const crowdOpacity = isMatchDay ? 0.8 : 0.2;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="30" width={w} height={h - 30} rx="8" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      <rect x="10" y="20" width={w - 20} height="15" rx="4" fill={color} stroke={accent} strokeWidth="1.5" opacity="0.85" />
      <rect x="25" y="5" width={w - 50} height="20" rx="4" fill={color} stroke={accent} strokeWidth="1.5" opacity="0.8" />
      <path d={`M 5 5 Q ${w / 2} -5 ${w - 5} 5`} fill="none" stroke={accent} strokeWidth="2" opacity="0.7" />
      <rect x="30" y="55" width={w - 60} height="25" rx="4" fill="#14532d" opacity="0.6" />
      <line x1={w / 2} y1="55" x2={w / 2} y2="80" stroke="#fff" strokeWidth="1" opacity="0.3" />
      {/* Crowd dots in stands */}
      {(isMatchDay || isScheduled) && Array.from({ length: 20 }).map((_, i) => (
        <circle
          key={i}
          cx={15 + (i % 10) * 13}
          cy={8 + Math.floor(i / 10) * 8}
          r="1.5"
          fill="#fbbf24"
          opacity={crowdOpacity}
        >
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur={`${1 + Math.random()}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <line x1="15" y1="5" x2="15" y2="-8" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <circle cx="15" cy="-8" r="3" fill="#fbbf24" opacity={isHovered || isMatchDay ? 0.8 : 0.3}>
        <animate attributeName="opacity" values={isHovered || isMatchDay ? '0.8;0.4;0.8' : '0.3;0.1;0.3'} dur="2s" repeatCount="indefinite" />
      </circle>
      <line x1={w - 15} y1="5" x2={w - 15} y2="-8" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <circle cx={w - 15} cy="-8" r="3" fill="#fbbf24" opacity={isHovered || isMatchDay ? 0.8 : 0.3}>
        <animate attributeName="opacity" values={isHovered || isMatchDay ? '0.8;0.4;0.8' : '0.3;0.1;0.3'} dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Scheduled Match Banner */}
      {isScheduled && (
        <g>
          <rect x="20" y="-18" width={w - 40} height="16" rx="4" fill="#3b82f6" opacity="0.9" />
          <text x={w / 2} y="-7" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="900">SCHEDULED</text>
          <text x={w / 2} y="-22" textAnchor="middle" fill="#94a3b8" fontSize="6" fontWeight="700">vs {scheduledMatch.awayTeamName}</text>
        </g>
      )}
      {/* Match Day Banner */}
      {isMatchDay && (
        <g>
          <rect x="20" y="-18" width={w - 40} height="16" rx="4" fill="#E94560" opacity="0.9" />
          <text x={w / 2} y="-7" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="900">MATCH DAY</text>
          <text x={w / 2} y="-22" textAnchor="middle" fill="#fbbf24" fontSize="6" fontWeight="700">vs {activeMatch?.awayTeamName}</text>
        </g>
      )}
      {/* Revenue Counter */}
      {isMatchDay && (
        <g>
          <rect x={w / 2 - 35} y="-38" width="70" height="14" rx="4" fill="#0f172a" opacity="0.9" stroke="#22c55e" strokeWidth="0.5" />
          <text x={w / 2} y="-28" textAnchor="middle" fill="#22c55e" fontSize="7" fontWeight="900">
            +{(activeMatch?.totalRevenue || 0).toLocaleString()} CASH
          </text>
        </g>
      )}
      <rect x="10" y={h - 22} width={w - 20} height="16" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 10} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">{building.label}</text>
    </g>
  );
}

function GarageSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="25" width={w} height={h - 25} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      <rect x="15" y="45" width="35" height="40" rx="2" fill="#1a1a1a" opacity="0.7" />
      <rect x="18" y="48" width="29" height="34" rx="1" fill="#334155" opacity="0.5" />
      <line x1="18" y1="55" x2="47" y2="55" stroke={accent} strokeWidth="0.5" opacity="0.3" />
      <line x1="18" y1="65" x2="47" y2="65" stroke={accent} strokeWidth="0.5" opacity="0.3" />
      <rect x="60" y="45" width="35" height="40" rx="2" fill="#1a1a1a" opacity="0.7" />
      <rect x="63" y="48" width="29" height="34" rx="1" fill="#334155" opacity="0.5" />
      <line x1="63" y1="55" x2="92" y2="55" stroke={accent} strokeWidth="0.5" opacity="0.3" />
      <line x1="63" y1="65" x2="92" y2="65" stroke={accent} strokeWidth="0.5" opacity="0.3" />
      <rect x="20" y="8" width={w - 40} height="18" rx="3" fill={accent} opacity="0.3" />
      <text x={w / 2} y="20" textAnchor="middle" fill={accent} fontSize="8" fontWeight="700" opacity="0.8">GARAGE</text>
      <rect x="75" y="85" width="20" height="10" rx="3" fill={accent} opacity={isHovered ? 0.6 : 0.3} />
      <circle cx="80" cy="95" r="3" fill="#1a1a1a" />
      <circle cx="90" cy="95" r="3" fill="#1a1a1a" />
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function TrainingSVG({ building, isHovered, isTraining }: { building: Building; isHovered: boolean; isTraining?: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered || isTraining ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="35" width={w} height={h - 35} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      <path d={`M 0 35 Q ${w / 2} 5 ${w} 35`} fill={color} stroke={accent} strokeWidth="2" opacity="0.85" />
      <rect x={w / 2 - 15} y="55" width="30" height="35" rx="3" fill="#1a1a1a" opacity="0.6" />
      <rect x={w / 2 - 12} y="58" width="24" height="30" rx="2" fill="#334155" opacity="0.4" />
      <rect x={w / 2 - 8} y="30" width="16" height="4" rx="2" fill={accent} opacity="0.7" />
      <rect x={w / 2 - 12} y="28" width="4" height="8" rx="1" fill={accent} opacity="0.7" />
      <rect x={w / 2 + 8} y="28" width="4" height="8" rx="1" fill={accent} opacity="0.7" />
      {/* Active training indicator */}
      {isTraining && (
        <>
          <circle cx={w / 2} cy="12" r="5" fill="#22c55e" opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="indefinite" />
          </circle>
          <rect x="20" y="-8" width={w - 40} height="12" rx="4" fill="#0f172a" opacity="0.9" stroke="#22c55e" strokeWidth="0.5" />
          <text x={w / 2} y="0" textAnchor="middle" fill="#22c55e" fontSize="6" fontWeight="900">TRAINING</text>
        </>
      )}
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function MarketSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="30" width={w} height={h - 30} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      <rect x="10" y="40" width="35" height="35" rx="2" fill="#1a1a1a" opacity="0.5" />
      <path d="M 10 40 L 27 25 L 45 40" fill={accent} opacity="0.4" />
      <rect x="55" y="40" width="35" height="35" rx="2" fill="#1a1a1a" opacity="0.5" />
      <path d="M 55 40 L 72 25 L 90 40" fill={accent} opacity="0.4" />
      <circle cx="27" cy="55" r="4" fill="#fbbf24" opacity="0.5" />
      <circle cx="72" cy="55" r="4" fill="#22c55e" opacity="0.5" />
      <circle cx="27" cy="68" r="3" fill="#3b82f6" opacity="0.5" />
      <circle cx="72" cy="68" r="3" fill="#ef4444" opacity="0.5" />
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function OfficeSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="20" width={w} height={h - 20} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {Array.from({ length: 3 }).map((_, row) =>
        Array.from({ length: 4 }).map((_, col) => (
          <rect
            key={`${row}-${col}`}
            x={15 + col * 28}
            y={30 + row * 22}
            width="18"
            height="14"
            rx="2"
            fill="#fbbf24"
            opacity={isHovered ? 0.4 + Math.random() * 0.3 : 0.15}
          />
        ))
      )}
      <rect x={w / 2 - 12} y="70" width="24" height="25" rx="3" fill="#1a1a1a" opacity="0.6" />
      <rect x={w / 2 - 9} y="73" width="18" height="20" rx="2" fill="#334155" opacity="0.4" />
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function BankSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="30" width={w} height={h - 30} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      <path d={`M 0 30 L ${w / 2} 10 L ${w} 30`} fill={color} stroke={accent} strokeWidth="2" opacity="0.85" />
      <rect x="20" y="35" width="12" height="55" rx="1" fill="#1a1a1a" opacity="0.4" />
      <rect x="45" y="35" width="12" height="55" rx="1" fill="#1a1a1a" opacity="0.4" />
      <rect x="70" y="35" width="12" height="55" rx="1" fill="#1a1a1a" opacity="0.4" />
      <rect x="95" y="35" width="12" height="55" rx="1" fill="#1a1a1a" opacity="0.4" />
      <circle cx={w / 2} cy="22" r="6" fill="#eab308" opacity={isHovered ? 0.8 : 0.4}>
        <animate attributeName="opacity" values={isHovered ? '0.8;0.5;0.8' : '0.4;0.2;0.4'} dur="2s" repeatCount="indefinite" />
      </circle>
      <text x={w / 2} y="24" textAnchor="middle" fill="#1a1a1a" fontSize="6" fontWeight="900">$</text>
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function HQSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="25" width={w} height={h - 25} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      <line x1={w / 2} y1="25" x2={w / 2} y2="5" stroke={accent} strokeWidth="2" opacity="0.6" />
      <circle cx={w / 2} cy="5" r="3" fill="#ef4444" opacity={isHovered ? 0.8 : 0.4}>
        <animate attributeName="opacity" values={isHovered ? '0.8;0.3;0.8' : '0.4;0.1;0.4'} dur="1.5s" repeatCount="indefinite" />
      </circle>
      <rect x="15" y="38" width={w - 30} height="22" rx="2" fill="#1a1a1a" opacity="0.6" />
      <rect x="18" y="41" width={w - 36} height="4" rx="1" fill="#22c55e" opacity="0.4" />
      <rect x="18" y="48" width={w - 50} height="3" rx="1" fill="#3b82f6" opacity="0.3" />
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function WorldMapSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="25" width={w} height={h - 25} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      <circle cx={w / 2} cy="45" r="18" fill="#0c2e4e" stroke={accent} strokeWidth="1.5" opacity="0.8" />
      <ellipse cx={w / 2} cy="45" rx="8" ry="18" fill="none" stroke={accent} strokeWidth="1" opacity="0.4" />
      <line x1={w / 2 - 18} y1="45" x2={w / 2 + 18} y2="45" stroke={accent} strokeWidth="1" opacity="0.4" />
      <line x1={w / 2} y1="27" x2={w / 2} y2="63" stroke={accent} strokeWidth="1" opacity="0.4" />
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function LeaderboardSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="25" width={w} height={h - 25} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      <path d={`M ${w / 2 - 10} 55 L ${w / 2 - 10} 40 L ${w / 2 - 14} 35 L ${w / 2 + 14} 35 L ${w / 2 + 10} 40 L ${w / 2 + 10} 55 Q ${w / 2} 62 ${w / 2 - 10} 55`} fill="#fbbf24" opacity={isHovered ? 0.7 : 0.4} />
      <rect x={w / 2 - 3} y="55" width="6" height="8" fill="#fbbf24" opacity={isHovered ? 0.7 : 0.4} />
      <rect x={w / 2 - 6} y="63" width="12" height="3" rx="1" fill="#fbbf24" opacity={isHovered ? 0.7 : 0.4} />
      {isHovered && (
        <>
          <circle cx={w / 2 - 20} cy="35" r="2" fill="#fbbf24" opacity="0.6">
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={w / 2 + 20} cy="40" r="1.5" fill="#fbbf24" opacity="0.5">
            <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function LockerRoomSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      <rect x="0" y="25" width={w} height={h - 25} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {/* Lockers */}
      <rect x="10" y="35" width="20" height="40" rx="2" fill="#1a1a1a" opacity="0.6" />
      <rect x="35" y="35" width="20" height="40" rx="2" fill="#1a1a1a" opacity="0.6" />
      <rect x="60" y="35" width="20" height="40" rx="2" fill="#1a1a1a" opacity="0.6" />
      <rect x="85" y="35" width="20" height="40" rx="2" fill="#1a1a1a" opacity="0.6" />
      {/* Locker handles */}
      <circle cx="25" cy="45" r="2" fill={accent} opacity={isHovered ? 0.8 : 0.4} />
      <circle cx="50" cy="45" r="2" fill={accent} opacity={isHovered ? 0.8 : 0.4} />
      <circle cx="75" cy="45" r="2" fill={accent} opacity={isHovered ? 0.8 : 0.4} />
      <circle cx="100" cy="45" r="2" fill={accent} opacity={isHovered ? 0.8 : 0.4} />
      {/* Bench */}
      <rect x="15" y="80" width={w - 30} height="6" rx="3" fill={accent} opacity={0.3} />
      {/* Gear icon */}
      <circle cx={w / 2} cy="15" r="8" fill={accent} opacity={0.2} />
      <path d={`M ${w / 2 - 4} 15 L ${w / 2 + 4} 15 M ${w / 2} 11 L ${w / 2} 19`} stroke={accent} strokeWidth="2" opacity={0.6} />
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function BuildingSVG({ building, isHovered, activeMatch, scheduledMatch, isTraining }: { building: Building; isHovered: boolean; activeMatch?: any; scheduledMatch?: any; isTraining?: boolean }) {
  switch (building.id) {
    case 'stadium': return <StadiumSVG building={building} isHovered={isHovered} activeMatch={activeMatch} scheduledMatch={scheduledMatch} />;
    case 'transport': return <GarageSVG building={building} isHovered={isHovered} />;
    case 'training': return <TrainingSVG building={building} isHovered={isHovered} isTraining={isTraining} />;
    case 'locker': return <LockerRoomSVG building={building} isHovered={isHovered} />;
    case 'market': return <MarketSVG building={building} isHovered={isHovered} />;
    case 'team': return <OfficeSVG building={building} isHovered={isHovered} />;
    case 'wallet': return <BankSVG building={building} isHovered={isHovered} />;
    case 'dashboard': return <HQSVG building={building} isHovered={isHovered} />;
    case 'world': return <WorldMapSVG building={building} isHovered={isHovered} />;
    case 'leaderboard': return <LeaderboardSVG building={building} isHovered={isHovered} />;
    default: return null;
  }
}

// ─── Avatar Component ───

function AvatarSVG({ x, y, color, isMoving }: { x: number; y: number; color: string; isMoving: boolean }) {
  return (
    <g transform={`translate(${x - 15}, ${y - 30})`}>
      <circle cx="15" cy="8" r="8" fill={color} opacity="0.9" />
      <rect x="8" y="16" width="14" height="16" rx="3" fill={color} opacity="0.8" />
      <rect x="6" y="18" width="4" height="12" rx="2" fill={color} opacity="0.7" />
      <rect x="20" y="18" width="4" height="12" rx="2" fill={color} opacity="0.7" />
      <rect x="9" y="32" width="5" height="12" rx="2" fill="#1a1a1a" opacity="0.8" />
      <rect x="16" y="32" width="5" height="12" rx="2" fill="#1a1a1a" opacity="0.8" />
      {/* Headset for coach */}
      <path d="M 7 6 Q 15 0 23 6" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6" />
      <rect x="5" y="4" width="3" height="6" rx="1" fill="#fbbf24" opacity="0.5" />
      {/* Movement indicator */}
      {isMoving && (
        <>
          <circle cx="15" cy="-5" r="2" fill="#fff" opacity="0.5">
            <animate attributeName="cy" values="-5;-12;-5" dur="0.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="0.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="8" cy="-3" r="1.5" fill="#fff" opacity="0.4">
            <animate attributeName="cy" values="-3;-8;-3" dur="0.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="0.5s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {/* Shadow */}
      <ellipse cx="15" cy="46" rx="10" ry="3" fill="#000" opacity="0.2" />
    </g>
  );
}

// ─── Main GameShell Component ───

export default function GameShell() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { openPanel, panels } = usePanels();
  const { scheduleTrip, trips } = useTravel();
  const { myHomeMatches } = useMatchDay();
  const { getActiveMatch } = useMatchSchedule();
  const { isTraining } = useTraining();
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [avatarPos, setAvatarPos] = useState({ x: 140, y: 105 }); // Start at HQ
  const [isMoving, setIsMoving] = useState(false);
  const avatarColorRef = useState(() => hashToColor(localStorage.getItem('token') || 'guest'))[0];

  // Building position lookup for travel system
  const buildingPositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number; width: number; height: number }> = {};
    BUILDINGS.forEach((b) => {
      pos[b.id] = { x: b.x, y: b.y, width: b.width, height: b.height };
    });
    return pos;
  }, []);

  // Road path lookup for travel system
  const roadPaths = useMemo(() => {
    const paths: Record<string, string> = {};
    ROADS.forEach((road) => {
      const path = getRoadPath(road.from, road.to);
      if (path) {
        paths[`${road.from}-${road.to}`] = path;
        paths[`${road.to}-${road.from}`] = path;
      }
    });
    return paths;
  }, []);

  const handleBuildingClick = (building: Building) => {
    if (isMoving) return;
    setIsMoving(true);
    setHoveredBuilding(null);

    const targetX = building.x + building.width / 2;
    const targetY = building.y + building.height - 10;
    setAvatarPos({ x: targetX, y: targetY });

    setTimeout(() => {
      setIsMoving(false);
      // Open panel for this building
      openPanel({
        id: building.id,
        title: building.label,
        buildingId: building.id,
        x: 100 + Math.random() * 200,
        y: 80 + Math.random() * 100,
        width: building.panelWidth,
        height: building.panelHeight,
        minimized: false,
        maximized: false,
        content: building.getContent(),
      });
    }, 600);
  };

  const getRoadPath = (fromId: string, toId: string): string | null => {
    const from = BUILDINGS.find((b) => b.id === fromId);
    const to = BUILDINGS.find((b) => b.id === toId);
    if (!from || !to) return null;
    const x1 = from.x + from.width / 2;
    const y1 = from.y + from.height - 5;
    const x2 = to.x + to.width / 2;
    const y2 = to.y + to.height - 5;
    const midX = (x1 + x2) / 2;
    const midY = Math.max(y1, y2) + 20;
    return `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E94560]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0f1a]">
      {/* Full-viewport world map */}
      <svg viewBox="0 0 1000 700" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grass" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#0a0f1a" />
            <circle cx="20" cy="20" r="1" fill="#1a2332" opacity="0.5" />
          </pattern>
          <radialGradient id="worldGlow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0a0f1a" stopOpacity="0.95" />
          </radialGradient>
        </defs>

        <rect width="1000" height="700" fill="url(#grass)" rx="16" />
        <rect width="1000" height="700" fill="url(#worldGlow)" rx="16" />

        {/* Decorative city skyline silhouette */}
        <g opacity="0.06">
          <rect x="50" y="30" width="30" height="80" rx="2" fill="#334155" />
          <rect x="90" y="50" width="25" height="60" rx="2" fill="#334155" />
          <rect x="300" y="20" width="40" height="90" rx="2" fill="#334155" />
          <rect x="600" y="40" width="35" height="70" rx="2" fill="#334155" />
          <rect x="850" y="25" width="30" height="85" rx="2" fill="#334155" />
          <rect x="900" y="55" width="20" height="55" rx="2" fill="#334155" />
        </g>

        {/* Roads */}
        <g>
          {ROADS.map((road, i) => {
            const path = getRoadPath(road.from, road.to);
            if (!path) return null;
            return (
              <path key={i} d={path} fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" opacity="0.5" />
            );
          })}
          {ROADS.map((road, i) => {
            const path = getRoadPath(road.from, road.to);
            if (!path) return null;
            return (
              <path key={`center-${i}`} d={path} fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" opacity="0.3" />
            );
          })}
        </g>

        {/* Buildings */}
        <g>
          {BUILDINGS.map((building) => {
            const match = building.id === 'stadium'
              ? myHomeMatches.find(m => m.status === 'PLAYING')
              : undefined;
            const scheduledMatch = building.id === 'stadium' ? getActiveMatch() : undefined;
            return (
              <g
                key={building.id}
                onMouseEnter={() => setHoveredBuilding(building.id)}
                onMouseLeave={() => setHoveredBuilding(null)}
                onClick={() => handleBuildingClick(building)}
              >
                <BuildingSVG
                  building={building}
                  isHovered={hoveredBuilding === building.id}
                  activeMatch={match}
                  scheduledMatch={scheduledMatch}
                  isTraining={building.id === 'training' && isTraining}
                />
              </g>
            );
          })}
        </g>

        {/* Travel Vehicles */}
        <TravelVehicles buildingPositions={buildingPositions} roadPaths={roadPaths} />

        {/* Avatar */}
        <AvatarSVG x={avatarPos.x} y={avatarPos.y} color={avatarColorRef} isMoving={isMoving} />

        {/* Top HUD bar */}
        <rect x="20" y="10" width="220" height="28" rx="8" fill="#0f172a" opacity="0.8" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="35" y="28" fill="#94a3b8" fontSize="10" fontWeight="600">Click a building to open</text>

        {/* Active panels count */}
        <rect x="780" y="10" width="200" height="28" rx="8" fill="#0f172a" opacity="0.8" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x="800" y="28" fill="#94a3b8" fontSize="10" fontWeight="600">
          Open: <tspan fill="#fff" fontWeight="700">{panels.length}</tspan> panels • <tspan fill="#22c55e">{trips.filter(t => t.status === 'traveling' || t.status === 'departing').length}</tspan> traveling
        </text>
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredBuilding && !isMoving && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-card/90 backdrop-blur-md border border-white/10 text-xs text-white font-bold shadow-lg z-10"
          >
            Click to enter {BUILDINGS.find((b) => b.id === hoveredBuilding)?.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Travel Test Controls */}
      <div className="fixed bottom-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="text-xs text-slate-500 mb-1">Travel Test</div>
        <div className="flex gap-2">
          <button
            onClick={() => scheduleTrip('transport', 'stadium', 'bus')}
            className="px-3 py-2 rounded-xl bg-[#E94560]/10 border border-[#E94560]/30 text-[#E94560] text-xs font-bold hover:bg-[#E94560]/20 transition-colors"
          >
            Garage → Stadium
          </button>
          <button
            onClick={() => scheduleTrip('transport', 'world', 'jet')}
            className="px-3 py-2 rounded-xl bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-xs font-bold hover:bg-[#06b6d4]/20 transition-colors"
          >
            Garage → World (Jet)
          </button>
          <button
            onClick={() => scheduleTrip('dashboard', 'market', 'coach')}
            className="px-3 py-2 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/30 text-[#fbbf24] text-xs font-bold hover:bg-[#fbbf24]/20 transition-colors"
          >
            HQ → Market (Coach)
          </button>
        </div>
      </div>
    </div>
  );
}
