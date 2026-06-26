import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Shield, Bus, Dumbbell, ShoppingCart, Trophy, Wallet, Store, Globe,
} from 'lucide-react';

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
  tier: number; // 1-3 for building size
}

const BUILDINGS: Building[] = [
  {
    id: 'stadium', label: 'Stadium', route: '/stadium/interior', icon: Shield, x: 420, y: 80, width: 160, height: 120, color: '#1e3a5f', accent: '#22c55e', tier: 3,
  },
  {
    id: 'transport', label: 'Garage', route: '/garage', icon: Bus, x: 80, y: 280, width: 140, height: 100, color: '#451a03', accent: '#fbbf24', tier: 2,
  },
  {
    id: 'training', label: 'Training', route: '/training', icon: Dumbbell, x: 780, y: 280, width: 140, height: 100, color: '#3f0f3f', accent: '#a855f7', tier: 2,
  },
  {
    id: 'market', label: 'Market', route: '/marketplace', icon: ShoppingCart, x: 80, y: 480, width: 140, height: 100, color: '#3f2e0f', accent: '#f59e0b', tier: 2,
  },
  {
    id: 'team', label: 'Team Office', route: '/team', icon: Store, x: 430, y: 480, width: 140, height: 100, color: '#1e293b', accent: '#3b82f6', tier: 2,
  },
  {
    id: 'wallet', label: 'Bank', route: '/wallet', icon: Wallet, x: 780, y: 480, width: 140, height: 100, color: '#3f2e0f', accent: '#eab308', tier: 2,
  },
  {
    id: 'dashboard', label: 'HQ', route: '/dashboard', icon: LayoutDashboard, x: 80, y: 80, width: 120, height: 90, color: '#0f172a', accent: '#E94560', tier: 1,
  },
  {
    id: 'world', label: 'World Map', route: '/world-map', icon: Globe, x: 820, y: 80, width: 120, height: 90, color: '#0c2e4e', accent: '#06b6d4', tier: 1,
  },
  {
    id: 'leaderboard', label: 'Hall of Fame', route: '/leaderboard', icon: Trophy, x: 430, y: 280, width: 140, height: 100, color: '#2a1a0a', accent: '#fbbf24', tier: 2,
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
  { from: 'market', to: 'team' },
  { from: 'team', to: 'wallet' },
  { from: 'leaderboard', to: 'team' },
  { from: 'transport', to: 'leaderboard' },
  { from: 'training', to: 'leaderboard' },
];

function hashToColor(str: string): string {
  const h = str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = ['#E94560', '#3b82f6', '#22c55e', '#fbbf24', '#a855f7', '#06b6d4', '#f97316'];
  return colors[h % colors.length];
}

// ─── Building SVG Components ───

function StadiumSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      {/* Stadium base */}
      <rect x="0" y="30" width={w} height={h - 30} rx="8" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {/* Stadium tiers */}
      <rect x="10" y="20" width={w - 20} height="15" rx="4" fill={color} stroke={accent} strokeWidth="1.5" opacity="0.85" />
      <rect x="25" y="5" width={w - 50} height="20" rx="4" fill={color} stroke={accent} strokeWidth="1.5" opacity="0.8" />
      {/* Roof */}
      <path d={`M 5 5 Q ${w / 2} -5 ${w - 5} 5`} fill="none" stroke={accent} strokeWidth="2" opacity="0.7" />
      {/* Field indicator */}
      <rect x="30" y="55" width={w - 60} height="25" rx="4" fill="#14532d" opacity="0.6" />
      <line x1={w / 2} y1="55" x2={w / 2} y2="80" stroke="#fff" strokeWidth="1" opacity="0.3" />
      {/* Lights */}
      <line x1="15" y1="5" x2="15" y2="-8" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <circle cx="15" cy="-8" r="3" fill="#fbbf24" opacity={isHovered ? 0.8 : 0.3}>
        <animate attributeName="opacity" values={isHovered ? '0.8;0.4;0.8' : '0.3;0.1;0.3'} dur="2s" repeatCount="indefinite" />
      </circle>
      <line x1={w - 15} y1="5" x2={w - 15} y2="-8" stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <circle cx={w - 15} cy="-8" r="3" fill="#fbbf24" opacity={isHovered ? 0.8 : 0.3}>
        <animate attributeName="opacity" values={isHovered ? '0.8;0.4;0.8' : '0.3;0.1;0.3'} dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Label */}
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
      {/* Main building */}
      <rect x="0" y="25" width={w} height={h - 25} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {/* Garage doors */}
      <rect x="15" y="45" width="35" height="40" rx="2" fill="#1a1a1a" opacity="0.7" />
      <rect x="18" y="48" width="29" height="34" rx="1" fill="#334155" opacity="0.5" />
      <line x1="18" y1="55" x2="47" y2="55" stroke={accent} strokeWidth="0.5" opacity="0.3" />
      <line x1="18" y1="65" x2="47" y2="65" stroke={accent} strokeWidth="0.5" opacity="0.3" />
      <rect x="60" y="45" width="35" height="40" rx="2" fill="#1a1a1a" opacity="0.7" />
      <rect x="63" y="48" width="29" height="34" rx="1" fill="#334155" opacity="0.5" />
      <line x1="63" y1="55" x2="92" y2="55" stroke={accent} strokeWidth="0.5" opacity="0.3" />
      <line x1="63" y1="65" x2="92" y2="65" stroke={accent} strokeWidth="0.5" opacity="0.3" />
      {/* Roof sign */}
      <rect x="20" y="8" width={w - 40} height="18" rx="3" fill={accent} opacity="0.3" />
      <text x={w / 2} y="20" textAnchor="middle" fill={accent} fontSize="8" fontWeight="700" opacity="0.8">GARAGE</text>
      {/* Small vehicle indicator */}
      <rect x="75" y="85" width="20" height="10" rx="3" fill={accent} opacity={isHovered ? 0.6 : 0.3} />
      <circle cx="80" cy="95" r="3" fill="#1a1a1a" />
      <circle cx="90" cy="95" r="3" fill="#1a1a1a" />
      {/* Label */}
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function TrainingSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  const { color, accent, x, y, width: w, height: h } = building;
  const glow = isHovered ? 1 : 0.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
      <rect x="-5" y="-5" width={w + 10} height={h + 10} rx="12" fill={accent} opacity={glow * 0.15} />
      {/* Dome building */}
      <rect x="0" y="35" width={w} height={h - 35} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      <path d={`M 0 35 Q ${w / 2} 5 ${w} 35`} fill={color} stroke={accent} strokeWidth="2" opacity="0.85" />
      {/* Entrance */}
      <rect x={w / 2 - 15} y="55" width="30" height="35" rx="3" fill="#1a1a1a" opacity="0.6" />
      <rect x={w / 2 - 12} y="58" width="24" height="30" rx="2" fill="#334155" opacity="0.4" />
      {/* Dumbbell icon */}
      <rect x={w / 2 - 8} y="30" width="16" height="4" rx="2" fill={accent} opacity="0.7" />
      <rect x={w / 2 - 12} y="28" width="4" height="8" rx="1" fill={accent} opacity="0.7" />
      <rect x={w / 2 + 8} y="28" width="4" height="8" rx="1" fill={accent} opacity="0.7" />
      {/* Label */}
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
      {/* Open market stalls */}
      <rect x="0" y="30" width={w} height={h - 30} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {/* Stall 1 */}
      <rect x="10" y="40" width="35" height="35" rx="2" fill="#1a1a1a" opacity="0.5" />
      <path d="M 10 40 L 27 25 L 45 40" fill={accent} opacity="0.4" />
      {/* Stall 2 */}
      <rect x="55" y="40" width="35" height="35" rx="2" fill="#1a1a1a" opacity="0.5" />
      <path d="M 55 40 L 72 25 L 90 40" fill={accent} opacity="0.4" />
      {/* Items on display */}
      <circle cx="27" cy="55" r="4" fill="#fbbf24" opacity="0.5" />
      <circle cx="72" cy="55" r="4" fill="#22c55e" opacity="0.5" />
      <circle cx="27" cy="68" r="3" fill="#3b82f6" opacity="0.5" />
      <circle cx="72" cy="68" r="3" fill="#ef4444" opacity="0.5" />
      {/* Label */}
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
      {/* Modern office building */}
      <rect x="0" y="20" width={w} height={h - 20} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {/* Windows grid */}
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
      {/* Door */}
      <rect x={w / 2 - 12} y="70" width="24" height="25" rx="3" fill="#1a1a1a" opacity="0.6" />
      <rect x={w / 2 - 9} y="73" width="18" height="20" rx="2" fill="#334155" opacity="0.4" />
      {/* Label */}
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
      {/* Classical bank with columns */}
      <rect x="0" y="30" width={w} height={h - 30} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {/* Triangle roof */}
      <path d={`M 0 30 L ${w / 2} 10 L ${w} 30`} fill={color} stroke={accent} strokeWidth="2" opacity="0.85" />
      {/* Columns */}
      <rect x="20" y="35" width="12" height="55" rx="1" fill="#1a1a1a" opacity="0.4" />
      <rect x="45" y="35" width="12" height="55" rx="1" fill="#1a1a1a" opacity="0.4" />
      <rect x="70" y="35" width="12" height="55" rx="1" fill="#1a1a1a" opacity="0.4" />
      <rect x="95" y="35" width="12" height="55" rx="1" fill="#1a1a1a" opacity="0.4" />
      {/* Gold coin symbol */}
      <circle cx={w / 2} cy="22" r="6" fill="#eab308" opacity={isHovered ? 0.8 : 0.4}>
        <animate attributeName="opacity" values={isHovered ? '0.8;0.5;0.8' : '0.4;0.2;0.4'} dur="2s" repeatCount="indefinite" />
      </circle>
      <text x={w / 2} y="24" textAnchor="middle" fill="#1a1a1a" fontSize="6" fontWeight="900">$</text>
      {/* Label */}
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
      {/* Command center building */}
      <rect x="0" y="25" width={w} height={h - 25} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {/* Antenna / tower */}
      <line x1={w / 2} y1="25" x2={w / 2} y2="5" stroke={accent} strokeWidth="2" opacity="0.6" />
      <circle cx={w / 2} cy="5" r="3" fill="#ef4444" opacity={isHovered ? 0.8 : 0.4}>
        <animate attributeName="opacity" values={isHovered ? '0.8;0.3;0.8' : '0.4;0.1;0.4'} dur="1.5s" repeatCount="indefinite" />
      </circle>
      {/* Screen/display */}
      <rect x="15" y="38" width={w - 30} height="22" rx="2" fill="#1a1a1a" opacity="0.6" />
      <rect x="18" y="41" width={w - 36} height="4" rx="1" fill="#22c55e" opacity="0.4" />
      <rect x="18" y="48" width={w - 50} height="3" rx="1" fill="#3b82f6" opacity="0.3" />
      {/* Label */}
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
      {/* Map/portal building */}
      <rect x="0" y="25" width={w} height={h - 25} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {/* Globe icon */}
      <circle cx={w / 2} cy="45" r="18" fill="#0c2e4e" stroke={accent} strokeWidth="1.5" opacity="0.8" />
      <ellipse cx={w / 2} cy="45" rx="8" ry="18" fill="none" stroke={accent} strokeWidth="1" opacity="0.4" />
      <line x1={w / 2 - 18} y1="45" x2={w / 2 + 18} y2="45" stroke={accent} strokeWidth="1" opacity="0.4" />
      <line x1={w / 2} y1="27" x2={w / 2} y2="63" stroke={accent} strokeWidth="1" opacity="0.4" />
      {/* Label */}
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
      {/* Trophy hall */}
      <rect x="0" y="25" width={w} height={h - 25} rx="6" fill={color} stroke={accent} strokeWidth="2" opacity="0.9" />
      {/* Trophy icon */}
      <path d={`M ${w / 2 - 10} 55 L ${w / 2 - 10} 40 L ${w / 2 - 14} 35 L ${w / 2 + 14} 35 L ${w / 2 + 10} 40 L ${w / 2 + 10} 55 Q ${w / 2} 62 ${w / 2 - 10} 55`} fill="#fbbf24" opacity={isHovered ? 0.7 : 0.4} />
      <rect x={w / 2 - 3} y="55" width="6" height="8" fill="#fbbf24" opacity={isHovered ? 0.7 : 0.4} />
      <rect x={w / 2 - 6} y="63" width="12" height="3" rx="1" fill="#fbbf24" opacity={isHovered ? 0.7 : 0.4} />
      {/* Sparkles */}
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
      {/* Label */}
      <rect x="10" y={h - 18} width={w - 20} height="14" rx="4" fill="#0f172a" opacity="0.8" />
      <text x={w / 2} y={h - 7} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{building.label}</text>
    </g>
  );
}

function BuildingSVG({ building, isHovered }: { building: Building; isHovered: boolean }) {
  switch (building.id) {
    case 'stadium': return <StadiumSVG building={building} isHovered={isHovered} />;
    case 'transport': return <GarageSVG building={building} isHovered={isHovered} />;
    case 'training': return <TrainingSVG building={building} isHovered={isHovered} />;
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

// ─── Main GameWorld Component ───

export default function GameWorld() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [avatarPos, setAvatarPos] = useState({ x: 140, y: 125 }); // Start at HQ
  const [isMoving, setIsMoving] = useState(false);
  const avatarColorRef = useRef(hashToColor(localStorage.getItem('token') || 'guest'));

  // Find current building based on route
  const currentBuilding = BUILDINGS.find((b) => location.pathname === b.route) || BUILDINGS[0];

  const handleBuildingClick = (building: Building) => {
    if (isMoving) return;
    setIsMoving(true);
    setHoveredBuilding(null);

    // Animate avatar to building entrance
    const targetX = building.x + building.width / 2;
    const targetY = building.y + building.height - 10;

    setAvatarPos({ x: targetX, y: targetY });

    // Navigate after animation completes
    setTimeout(() => {
      setIsMoving(false);
      navigate(building.route);
    }, 600);
  };

  // Get road path between two buildings
  const getRoadPath = (fromId: string, toId: string): string | null => {
    const from = BUILDINGS.find((b) => b.id === fromId);
    const to = BUILDINGS.find((b) => b.id === toId);
    if (!from || !to) return null;

    const x1 = from.x + from.width / 2;
    const y1 = from.y + from.height - 5;
    const x2 = to.x + to.width / 2;
    const y2 = to.y + to.height - 5;

    // Bezier curve for road
    const midX = (x1 + x2) / 2;
    const midY = Math.max(y1, y2) + 20;

    return `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
  };

  return (
    <div className="w-full h-full min-h-[600px] relative">
      <svg viewBox="0 0 1000 620" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Ground pattern */}
          <pattern id="grass" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#0f172a" />
            <circle cx="20" cy="20" r="1" fill="#1e293b" opacity="0.5" />
          </pattern>
          <pattern id="road" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#1e293b" />
            <line x1="10" y1="0" x2="10" y2="20" stroke="#334155" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.3" />
          </pattern>
          <radialGradient id="worldGlow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect width="1000" height="620" fill="url(#grass)" rx="16" />
        <rect width="1000" height="620" fill="url(#worldGlow)" rx="16" />

        {/* Decorative city skyline silhouette */}
        <g opacity="0.08">
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
              <path
                key={i}
                d={path}
                fill="none"
                stroke="#334155"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.5"
              />
            );
          })}
          {/* Road center lines */}
          {ROADS.map((road, i) => {
            const path = getRoadPath(road.from, road.to);
            if (!path) return null;
            return (
              <path
                key={`center-${i}`}
                d={path}
                fill="none"
                stroke="#475569"
                strokeWidth="2"
                strokeDasharray="4 6"
                strokeLinecap="round"
                opacity="0.3"
              />
            );
          })}
        </g>

        {/* Buildings */}
        <g>
          {BUILDINGS.map((building) => (
            <g
              key={building.id}
              onMouseEnter={() => setHoveredBuilding(building.id)}
              onMouseLeave={() => setHoveredBuilding(null)}
              onClick={() => handleBuildingClick(building)}
            >
              <BuildingSVG building={building} isHovered={hoveredBuilding === building.id || currentBuilding.id === building.id} />
            </g>
          ))}
        </g>

        {/* Avatar */}
        <AnimatePresence>
          <motion.g
            initial={false}
            animate={{ x: 0, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            <AvatarSVG x={avatarPos.x} y={avatarPos.y} color={avatarColorRef.current} isMoving={isMoving} />
          </motion.g>
        </AnimatePresence>

        {/* Top info bar */}
        <rect x="20" y="10" width="200" height="28" rx="8" fill="#0f172a" opacity="0.8" />
        <text x="35" y="28" fill="#94a3b8" fontSize="10" fontWeight="600">Click a building to navigate</text>

        {/* Current location indicator */}
        <rect x="780" y="10" width="200" height="28" rx="8" fill="#0f172a" opacity="0.8" />
        <text x="800" y="28" fill="#94a3b8" fontSize="10" fontWeight="600">
          Now at: <tspan fill="#fff" fontWeight="700">{currentBuilding.label}</tspan>
        </text>
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredBuilding && !isMoving && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-card/90 backdrop-blur-md border border-white/10 text-sm text-white font-bold"
          >
            Click to enter {BUILDINGS.find((b) => b.id === hoveredBuilding)?.label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
