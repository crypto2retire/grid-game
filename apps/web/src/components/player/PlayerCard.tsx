import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, ShoppingCart } from 'lucide-react';

export interface PlayerCardData {
  id: string;
  name: string;
  position: string;
  overall: number;
  age?: number;
  nationality?: string;
  rarity: string;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  isStarter?: boolean;
  currentPrice?: number;
  demandMultiplier?: number;
}

interface PlayerCardProps {
  player: PlayerCardData;
  showBuyButton?: boolean;
  onBuy?: () => void;
  buying?: boolean;
  canAfford?: boolean;
  className?: string;
}

const RARITY_CONFIG: Record<string, { border: string; bg: string; text: string; tier: number }> = {
  COMMON: { border: 'border-gray-500/40', bg: 'bg-gray-500/5', text: 'text-gray-400', tier: 1 },
  BRONZE: { border: 'border-amber-700/40', bg: 'bg-amber-900/10', text: 'text-amber-600', tier: 2 },
  SILVER: { border: 'border-slate-300/40', bg: 'bg-slate-300/5', text: 'text-slate-300', tier: 3 },
  GOLD: { border: 'border-yellow-400/50', bg: 'bg-yellow-400/10', text: 'text-yellow-400', tier: 4 },
  ELITE: { border: 'border-purple-400/50', bg: 'bg-purple-400/10', text: 'text-purple-400', tier: 5 },
  LEGEND: { border: 'border-red-400/60', bg: 'bg-red-400/10', text: 'text-red-400', tier: 6 },
};

const POSITION_COLORS: Record<string, string> = {
  QB: '#E94560',
  RB: '#22c55e',
  WR: '#3b82f6',
  TE: '#a855f7',
  OL: '#eab308',
  DL: '#ef4444',
  LB: '#f97316',
  CB: '#06b6d4',
  S: '#ec4899',
  K: '#64748b',
};

const POSITION_LABELS: Record<string, string> = {
  QB: 'Quarterback',
  RB: 'Running Back',
  WR: 'Wide Receiver',
  TE: 'Tight End',
  OL: 'Offensive Line',
  DL: 'Defensive Line',
  LB: 'Linebacker',
  CB: 'Cornerback',
  S: 'Safety',
  K: 'Kicker',
};

// Position-specific SVG icon (player silhouette with gear)
function PositionSVG({ position }: { position: string }) {
  const color = POSITION_COLORS[position] || '#94a3b8';

  const common = {
    head: <circle cx="50" cy="35" r="12" fill={color} opacity="0.9" />,
    body: <rect x="38" y="48" width="24" height="40" rx="6" fill={color} opacity="0.8" />,
    legs: <rect x="40" y="85" width="8" height="25" rx="3" fill={color} opacity="0.7" />,
    leg2: <rect x="52" y="85" width="8" height="25" rx="3" fill={color} opacity="0.7" />,
  };

  const renderVisual = () => {
    switch (position) {
      case 'QB':
        return (
          <g>
            {common.head}
            <rect x="35" y="48" width="30" height="36" rx="8" fill={color} opacity="0.85" />
            <rect x="20" y="55" width="18" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(-20 20 55)" />
            <rect x="62" y="52" width="22" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(30 62 52)" />
            <rect x="40" y="82" width="8" height="25" rx="3" fill={color} opacity="0.7" />
            <rect x="52" y="82" width="8" height="22" rx="3" fill={color} opacity="0.7" />
            <ellipse cx="80" cy="58" rx="8" ry="5" fill="#8B4513" opacity="0.8" />
            <line x1="76" y1="58" x2="84" y2="58" stroke="white" strokeWidth="1" opacity="0.5" />
            <path d="M 38 28 Q 50 18 62 28" fill="none" stroke="white" strokeWidth="1.5" opacity="0.4" />
          </g>
        );
      case 'RB':
        return (
          <g>
            {common.head}
            <rect x="38" y="48" width="24" height="34" rx="6" fill={color} opacity="0.85" />
            <rect x="22" y="58" width="16" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(-15 22 58)" />
            <rect x="62" y="55" width="18" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(20 62 55)" />
            <rect x="38" y="80" width="8" height="28" rx="3" fill={color} opacity="0.7" transform="rotate(-5 38 80)" />
            <rect x="54" y="80" width="8" height="24" rx="3" fill={color} opacity="0.7" transform="rotate(10 54 80)" />
            <line x1="15" y1="70" x2="25" y2="70" stroke={color} strokeWidth="2" opacity="0.3" />
            <line x1="12" y1="78" x2="22" y2="78" stroke={color} strokeWidth="2" opacity="0.2" />
          </g>
        );
      case 'WR':
        return (
          <g>
            {common.head}
            <rect x="38" y="48" width="24" height="34" rx="6" fill={color} opacity="0.85" />
            <rect x="20" y="50" width="18" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(-35 20 50)" />
            <rect x="62" y="52" width="20" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(25 62 52)" />
            <rect x="40" y="80" width="8" height="26" rx="3" fill={color} opacity="0.7" />
            <rect x="52" y="80" width="8" height="26" rx="3" fill={color} opacity="0.7" />
            <circle cx="18" cy="45" r="4" fill={color} opacity="0.6" />
            <circle cx="14" cy="50" r="3" fill={color} opacity="0.5" />
          </g>
        );
      case 'TE':
        return (
          <g>
            {common.head}
            <rect x="36" y="48" width="28" height="38" rx="8" fill={color} opacity="0.85" />
            <rect x="20" y="55" width="16" height="7" rx="3" fill={color} opacity="0.7" transform="rotate(-10 20 55)" />
            <rect x="64" y="55" width="16" height="7" rx="3" fill={color} opacity="0.7" transform="rotate(10 64 55)" />
            <rect x="40" y="83" width="9" height="25" rx="3" fill={color} opacity="0.7" />
            <rect x="51" y="83" width="9" height="25" rx="3" fill={color} opacity="0.7" />
            <rect x="28" y="75" width="14" height="6" rx="3" fill={color} opacity="0.5" />
          </g>
        );
      case 'OL':
        return (
          <g>
            <circle cx="50" cy="30" r="13" fill={color} opacity="0.9" />
            <rect x="32" y="45" width="36" height="42" rx="10" fill={color} opacity="0.85" />
            <rect x="22" y="58" width="14" height="8" rx="4" fill={color} opacity="0.7" transform="rotate(-20 22 58)" />
            <rect x="64" y="58" width="14" height="8" rx="4" fill={color} opacity="0.7" transform="rotate(20 64 58)" />
            <rect x="38" y="85" width="10" height="22" rx="3" fill={color} opacity="0.7" />
            <rect x="52" y="85" width="10" height="22" rx="3" fill={color} opacity="0.7" />
            <rect x="28" y="48" width="44" height="8" rx="4" fill={color} opacity="0.6" />
          </g>
        );
      case 'DL':
        return (
          <g>
            <circle cx="50" cy="30" r="13" fill={color} opacity="0.9" />
            <rect x="34" y="45" width="32" height="40" rx="8" fill={color} opacity="0.85" />
            <rect x="18" y="60" width="18" height="7" rx="3" fill={color} opacity="0.7" transform="rotate(-25 18 60)" />
            <rect x="64" y="55" width="18" height="7" rx="3" fill={color} opacity="0.7" transform="rotate(25 64 55)" />
            <rect x="38" y="82" width="9" height="24" rx="3" fill={color} opacity="0.7" transform="rotate(-8 38 82)" />
            <rect x="53" y="82" width="9" height="24" rx="3" fill={color} opacity="0.7" transform="rotate(8 53 82)" />
            <line x1="25" y1="50" x2="15" y2="45" stroke={color} strokeWidth="2" opacity="0.3" />
          </g>
        );
      case 'LB':
        return (
          <g>
            {common.head}
            <rect x="36" y="48" width="28" height="38" rx="8" fill={color} opacity="0.85" />
            <rect x="18" y="56" width="18" height="7" rx="3" fill={color} opacity="0.7" transform="rotate(-20 18 56)" />
            <rect x="64" y="52" width="18" height="7" rx="3" fill={color} opacity="0.7" transform="rotate(20 64 52)" />
            <rect x="38" y="83" width="9" height="25" rx="3" fill={color} opacity="0.7" />
            <rect x="53" y="83" width="9" height="25" rx="3" fill={color} opacity="0.7" />
            <path d="M 72 70 L 82 75 L 78 82" fill="none" stroke={color} strokeWidth="2" opacity="0.4" strokeLinecap="round" />
          </g>
        );
      case 'CB':
        return (
          <g>
            {common.head}
            <rect x="38" y="48" width="24" height="34" rx="6" fill={color} opacity="0.85" />
            <rect x="22" y="52" width="16" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(-30 22 52)" />
            <rect x="62" y="55" width="18" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(20 62 55)" />
            <rect x="40" y="80" width="8" height="26" rx="3" fill={color} opacity="0.7" />
            <rect x="52" y="80" width="8" height="26" rx="3" fill={color} opacity="0.7" />
            <line x1="75" y1="65" x2="85" y2="60" stroke={color} strokeWidth="2" opacity="0.3" strokeLinecap="round" />
            <line x1="75" y1="72" x2="85" y2="67" stroke={color} strokeWidth="2" opacity="0.2" strokeLinecap="round" />
          </g>
        );
      case 'S':
        return (
          <g>
            {common.head}
            <rect x="38" y="48" width="24" height="34" rx="6" fill={color} opacity="0.85" />
            <rect x="22" y="55" width="16" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(-15 22 55)" />
            <rect x="62" y="55" width="18" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(15 62 55)" />
            <rect x="40" y="80" width="8" height="26" rx="3" fill={color} opacity="0.7" />
            <rect x="52" y="80" width="8" height="26" rx="3" fill={color} opacity="0.7" />
            <path d="M 15 90 Q 30 70 50 65 Q 70 70 85 90" fill="none" stroke={color} strokeWidth="1.5" opacity="0.2" strokeDasharray="3 2" />
          </g>
        );
      case 'K':
        return (
          <g>
            {common.head}
            <rect x="38" y="48" width="24" height="34" rx="6" fill={color} opacity="0.85" />
            <rect x="25" y="58" width="14" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(-10 25 58)" />
            <rect x="61" y="52" width="20" height="6" rx="3" fill={color} opacity="0.7" transform="rotate(45 61 52)" />
            <rect x="40" y="80" width="8" height="26" rx="3" fill={color} opacity="0.7" />
            <rect x="52" y="80" width="8" height="24" rx="3" fill={color} opacity="0.7" transform="rotate(15 52 80)" />
            <ellipse cx="70" cy="85" rx="6" ry="4" fill="#8B4513" opacity="0.6" />
            <rect x="68" y="88" width="4" height="3" fill="#d97706" opacity="0.5" />
          </g>
        );
      default:
        return (
          <g>
            {common.head}
            {common.body}
            {common.legs}
            {common.leg2}
          </g>
        );
    }
  };

  return (
    <svg viewBox="0 0 100 120" className="w-full h-full">
      <defs>
        <radialGradient id={`bg-${position}`} cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.8" />
        </radialGradient>
        <filter id="playerGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="100" height="120" fill={`url(#bg-${position})`} rx="8" />
      <line x1="5" y1="108" x2="95" y2="108" stroke={color} strokeWidth="1" opacity="0.3" />
      <g filter="url(#playerGlow)">
        {renderVisual()}
      </g>
    </svg>
  );
}

function StatHex({ label, value, color }: { label: string; value: number; color: string }) {
  const getColorClass = (val: number) => {
    if (val >= 80) return 'text-emerald-400';
    if (val >= 60) return 'text-blue-400';
    if (val >= 40) return 'text-yellow-400';
    return 'text-slate-400';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
          <polygon points="16,2 29,9 29,23 16,30 3,23 3,9" fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
        </svg>
        <span className={`text-xs font-black ${getColorClass(value)}`}>{value}</span>
      </div>
      <span className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

export default function PlayerCard({ player, showBuyButton, onBuy, buying, canAfford, className = '' }: PlayerCardProps) {
  const [flipped, setFlipped] = useState(false);
  const rarity = RARITY_CONFIG[player.rarity] || RARITY_CONFIG.COMMON;
  const posColor = POSITION_COLORS[player.position] || '#94a3b8';

  const handleFlip = () => {
    if (!buying) setFlipped(!flipped);
  };

  const statBars = [
    { label: 'SPD', value: player.pace, max: 99 },
    { label: 'ARM', value: player.shooting, max: 99 },
    { label: 'IQ', value: player.passing, max: 99 },
    { label: 'AGI', value: player.dribbling, max: 99 },
    { label: 'TCK', value: player.defending, max: 99 },
    { label: 'STR', value: player.physical, max: 99 },
  ];

  return (
    <div className={`relative ${className}`} style={{ perspective: '1000px' }}>
      <motion.div
        className={`relative rounded-2xl border ${rarity.border} ${rarity.bg} overflow-hidden cursor-pointer`}
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        onClick={handleFlip}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* FRONT */}
        <div className="p-4" style={{ backfaceVisibility: 'hidden' }}>
          <div className="flex items-center justify-between mb-3">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${rarity.text} bg-white/5 border border-white/10`}>
              {player.rarity}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {player.position}
            </span>
          </div>

          <div className="relative h-36 mb-3 rounded-xl overflow-hidden border border-white/5">
            <PositionSVG position={player.position} />
            {player.isStarter && (
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#E94560]/90 px-2 py-0.5 rounded-full">
                <Star className="w-3 h-3 text-white fill-white" />
                <span className="text-[10px] font-bold text-white">STARTER</span>
              </div>
            )}
            <div className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm border-2 flex items-center justify-center" style={{ borderColor: posColor }}>
              <div className="text-center">
                <div className="text-lg font-black text-white leading-none">{player.overall}</div>
                <div className="text-[8px] text-slate-400 uppercase">OVR</div>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-bold text-white truncate mb-1">{player.name}</h3>
          <p className="text-[10px] text-slate-500 mb-3">{POSITION_LABELS[player.position] || player.position} • Age {player.age}</p>

          <div className="flex items-center justify-center gap-2">
            {statBars.slice(0, 3).map((s) => (
              <StatHex key={s.label} label={s.label} value={s.value} color={posColor} />
            ))}
          </div>

          {showBuyButton && player.currentPrice !== undefined && (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <div>
                <div className="text-lg font-black text-[#FFD700]">{player.currentPrice.toLocaleString()}</div>
                <div className="text-[9px] text-slate-500">CASH</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBuy?.();
                }}
                disabled={buying || !canAfford}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E94560] text-white text-xs font-bold hover:bg-[#E94560]/90 disabled:opacity-40 transition-colors"
              >
                <ShoppingCart className="w-3 h-3" />
                {buying ? '...' : 'Hire'}
              </button>
            </div>
          )}
          {!showBuyButton && (
            <div className="mt-3 pt-3 border-t border-white/10 text-center text-[10px] text-slate-500">
              Click to flip for full stats
            </div>
          )}
        </div>

        {/* BACK */}
        <div
          className={`absolute inset-0 p-4 ${rarity.bg} rounded-2xl`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">{player.name}</h3>
              <p className="text-[10px] text-slate-500">{player.position} • {player.nationality}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2" style={{ borderColor: posColor }}>
              <span className="text-lg font-black text-white">{player.overall}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {statBars.map((s) => {
              const pct = (s.value / s.max) * 100;
              const barColor = s.value >= 80 ? 'bg-emerald-500' : s.value >= 60 ? 'bg-blue-500' : s.value >= 40 ? 'bg-yellow-500' : 'bg-slate-500';
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{s.label}</span>
                    <span className="text-[10px] font-bold text-white">{s.value}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <div className="text-[10px] text-slate-500">
              Age <span className="text-white font-bold">{player.age}</span>
            </div>
            {player.demandMultiplier !== undefined && (
              <div className="text-[10px] text-slate-500">
                Demand <span className={player.demandMultiplier > 1 ? 'text-green-400' : 'text-red-400'}>{player.demandMultiplier.toFixed(1)}x</span>
              </div>
            )}
            <div className="text-[10px] text-slate-500">
              Rarity <span className={`font-bold ${rarity.text}`}>{player.rarity}</span>
            </div>
          </div>

          <div className="mt-3 text-center text-[10px] text-slate-600">
            Click to flip back
          </div>
        </div>
      </motion.div>
    </div>
  );
}
