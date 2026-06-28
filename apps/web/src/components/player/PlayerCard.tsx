import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, ShoppingCart } from 'lucide-react';
import { usePlayerProgression } from './PlayerProgressionSystem';

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

const RARITY_CONFIG: Record<string, { border: string; bg: string; text: string; tier: number; glow: string }> = {
  COMMON: { border: 'border-gray-500/40', bg: 'bg-gray-500/5', text: 'text-gray-400', tier: 1, glow: 'rgba(148,163,184,0.15)' },
  BRONZE: { border: 'border-amber-700/40', bg: 'bg-amber-900/10', text: 'text-amber-600', tier: 2, glow: 'rgba(180,83,9,0.2)' },
  SILVER: { border: 'border-slate-300/40', bg: 'bg-slate-300/5', text: 'text-slate-300', tier: 3, glow: 'rgba(203,213,225,0.25)' },
  GOLD: { border: 'border-yellow-400/50', bg: 'bg-yellow-400/10', text: 'text-yellow-400', tier: 4, glow: 'rgba(250,204,21,0.3)' },
  ELITE: { border: 'border-purple-400/50', bg: 'bg-purple-400/10', text: 'text-purple-400', tier: 5, glow: 'rgba(192,132,252,0.35)' },
  LEGEND: { border: 'border-red-400/60', bg: 'bg-red-400/10', text: 'text-red-400', tier: 6, glow: 'rgba(248,113,113,0.4)' },
};

const POSITION_COLORS: Record<string, string> = {
  QB: '#E94560', RB: '#22c55e', WR: '#3b82f6', TE: '#a855f7', OL: '#eab308',
  DL: '#ef4444', LB: '#f97316', CB: '#06b6d4', S: '#ec4899', K: '#64748b',
};

const POSITION_LABELS: Record<string, string> = {
  QB: 'Quarterback', RB: 'Running Back', WR: 'Wide Receiver', TE: 'Tight End',
  OL: 'Offensive Line', DL: 'Defensive Line', LB: 'Linebacker',
  CB: 'Cornerback', S: 'Safety', K: 'Kicker',
};

// ─── Procedural Player Visual System ───

const SKIN_TONES = ['#f5d0b5', '#e8b89a', '#d4a06d', '#c28b5b', '#a6704b', '#8b5a3a', '#6b4226'];
const HAIR_COLORS = ['#1a1a1a', '#3d2314', '#6b4226', '#c4956a', '#e8d5b7', '#a52a2a', '#d4a017'];
const JERSEY_COLORS = ['#1e3a8a', '#991b1b', '#14532d', '#713f12', '#581c87', '#be123c', '#0f172a', '#b45309'];
const JERSEY_TRIM_COLORS = ['#fbbf24', '#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'];

// Deterministic hash from a string
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Extract a value in range [0, max) from a hash
function hashRange(hash: number, offset: number, max: number): number {
  return ((hash >> (offset * 8)) & 0xff) % max;
}

function hashBool(hash: number, offset: number): boolean {
  return hashRange(hash, offset, 2) === 1;
}

interface VisualTraits {
  skinTone: string;
  hairColor: string;
  hairStyle: number; // 0-5: bald, buzz, short, medium, long, afro
  jerseyColor: string;
  jerseyTrim: string;
  jerseyNumber: number;
  hasGloves: boolean;
  hasSleeves: boolean;
  hasHeadband: boolean;
  hasVisor: boolean;
  hasNeckRoll: boolean;
  hasTape: boolean;
  eyeDirection: number; // -2 to 2
  mouthType: number; // 0-2: neutral, smile, determined
  bodyWidth: number; // 0.85-1.2
  bodyHeight: number; // 0.9-1.1
}

function generateVisualTraits(playerId: string, position: string, rarity: string): VisualTraits {
  const h = hashString(playerId + position);
  const rarityTier = RARITY_CONFIG[rarity]?.tier || 1;

  return {
    skinTone: SKIN_TONES[hashRange(h, 0, SKIN_TONES.length)],
    hairColor: HAIR_COLORS[hashRange(h, 1, HAIR_COLORS.length)],
    hairStyle: hashRange(h, 2, 6),
    jerseyColor: JERSEY_COLORS[hashRange(h, 3, JERSEY_COLORS.length)],
    jerseyTrim: JERSEY_TRIM_COLORS[hashRange(h, 4, JERSEY_TRIM_COLORS.length)],
    jerseyNumber: (hashRange(h, 5, 99) + 1),
    hasGloves: hashBool(h, 6) || rarityTier >= 4,
    hasSleeves: hashBool(h, 7) || rarityTier >= 3,
    hasHeadband: hashBool(h, 8) && rarityTier >= 2,
    hasVisor: hashBool(h, 9) && rarityTier >= 3,
    hasNeckRoll: hashBool(h, 10) && (position === 'OL' || position === 'DL' || position === 'LB'),
    hasTape: hashBool(h, 11) && rarityTier >= 3,
    eyeDirection: hashRange(h, 12, 5) - 2,
    mouthType: hashRange(h, 13, 3),
    bodyWidth: 0.85 + hashRange(h, 14, 35) / 100,
    bodyHeight: 0.9 + hashRange(h, 15, 20) / 100,
  };
}

function PlayerVisual({ playerId, position, rarity }: { playerId: string; position: string; rarity: string }) {
  const traits = useMemo(() => generateVisualTraits(playerId, position, rarity), [playerId, position, rarity]);
  const posColor = POSITION_COLORS[position] || '#94a3b8';
  const rarityTier = RARITY_CONFIG[rarity]?.tier || 1;

  const bw = traits.bodyWidth;
  const bh = traits.bodyHeight;
  const cx = 50;
  const headY = 22;
  const headR = 10 * bw;
  const shoulderY = headY + headR + 2;
  const torsoH = 32 * bh;
  const hipY = shoulderY + torsoH;
  const legLen = 30 * bh;
  const armLen = 26 * bh;

  const skin = traits.skinTone;
  const hair = traits.hairColor;
  const jc = traits.jerseyColor;
  const jt = traits.jerseyTrim;
  const num = traits.jerseyNumber.toString().padStart(2, '0');

  const eyeDx = traits.eyeDirection * 1.5;

  const renderHair = () => {
    const h = traits.hairStyle;
    if (h === 0) return null; // bald
    if (h === 1) { // buzz
      return <circle cx={cx} cy={headY} r={headR + 1.5} fill={hair} opacity="0.9" />;
    }
    if (h === 2) { // short
      return <path d={`M ${cx - headR - 1} ${headY - 2} Q ${cx} ${headY - headR - 4} ${cx + headR + 1} ${headY - 2} L ${cx + headR + 1} ${headY + 2} Q ${cx} ${headY - headR} ${cx - headR - 1} ${headY + 2} Z`} fill={hair} opacity="0.9" />;
    }
    if (h === 3) { // medium
      return <path d={`M ${cx - headR - 2} ${headY + 2} Q ${cx - headR - 4} ${headY - 10} ${cx} ${headY - headR - 6} Q ${cx + headR + 4} ${headY - 10} ${cx + headR + 2} ${headY + 2} Q ${cx} ${headY - 4} ${cx - headR - 2} ${headY + 2}`} fill={hair} opacity="0.9" />;
    }
    if (h === 4) { // long
      return <path d={`M ${cx - headR - 2} ${headY + 5} Q ${cx - headR - 5} ${headY - 12} ${cx} ${headY - headR - 7} Q ${cx + headR + 5} ${headY - 12} ${cx + headR + 2} ${headY + 5} L ${cx + headR + 3} ${headY + 14} Q ${cx + headR} ${headY + 8} ${cx + headR - 1} ${headY + 12} L ${cx - headR + 1} ${headY + 12} Q ${cx - headR} ${headY + 8} ${cx - headR - 3} ${headY + 14} Z`} fill={hair} opacity="0.9" />;
    }
    // afro
    return <circle cx={cx} cy={headY} r={headR + 3} fill={hair} opacity="0.9" />;
  };

  const renderFace = () => (
    <g>
      {/* Eyes */}
      <ellipse cx={cx - 3 + eyeDx} cy={headY - 1} rx={2} ry={1.5} fill="#fff" opacity="0.9" />
      <ellipse cx={cx + 3 + eyeDx} cy={headY - 1} rx={2} ry={1.5} fill="#fff" opacity="0.9" />
      <circle cx={cx - 3 + eyeDx} cy={headY - 1} r={1} fill="#1a1a1a" />
      <circle cx={cx + 3 + eyeDx} cy={headY - 1} r={1} fill="#1a1a1a" />
      {/* Eyebrows */}
      <path d={`M ${cx - 6 + eyeDx} ${headY - 4} Q ${cx - 3 + eyeDx} ${headY - 5} ${cx - 1 + eyeDx} ${headY - 4}`} stroke={hair} strokeWidth="1" fill="none" opacity="0.8" />
      <path d={`M ${cx + 1 + eyeDx} ${headY - 4} Q ${cx + 3 + eyeDx} ${headY - 5} ${cx + 6 + eyeDx} ${headY - 4}`} stroke={hair} strokeWidth="1" fill="none" opacity="0.8" />
      {/* Nose */}
      <path d={`M ${cx} ${headY + 1} L ${cx - 1} ${headY + 5} L ${cx + 1} ${headY + 5}`} fill="none" stroke={skin} strokeWidth="0.8" opacity="0.6" style={{ filter: 'brightness(0.7)' }} />
      {/* Mouth */}
      {traits.mouthType === 0 && (
        <path d={`M ${cx - 3} ${headY + 8} Q ${cx} ${headY + 9} ${cx + 3} ${headY + 8}`} stroke="#8b5a3a" strokeWidth="1" fill="none" opacity="0.7" />
      )}
      {traits.mouthType === 1 && (
        <path d={`M ${cx - 3} ${headY + 7} Q ${cx} ${headY + 10} ${cx + 3} ${headY + 7} Z`} fill="#c28b5b" opacity="0.6" />
      )}
      {traits.mouthType === 2 && (
        <path d={`M ${cx - 3} ${headY + 8} L ${cx} ${headY + 7} L ${cx + 3} ${headY + 8}`} stroke="#8b5a3a" strokeWidth="1.2" fill="none" opacity="0.7" />
      )}
    </g>
  );

  const renderHeadband = () => {
    if (!traits.hasHeadband) return null;
    return <rect x={cx - headR - 1} y={headY - 6} width={(headR + 1) * 2} height={3} rx={1} fill={jt} opacity="0.9" />;
  };

  const renderVisor = () => {
    if (!traits.hasVisor) return null;
    return <path d={`M ${cx - headR + 2} ${headY + 3} Q ${cx} ${headY + 8} ${cx + headR - 2} ${headY + 3}`} fill="#1a1a1a" opacity="0.5" />;
  };

  const renderNeckRoll = () => {
    if (!traits.hasNeckRoll) return null;
    return <rect x={cx - 8 * bw} y={shoulderY - 3} width={16 * bw} height={5} rx={2} fill="#1a1a1a" opacity="0.8" />;
  };

  const renderTorso = () => {
    const w = 18 * bw;
    const h = torsoH;
    const x = cx - w / 2;

    return (
      <g>
        {/* Main jersey body */}
        <rect x={x} y={shoulderY} width={w} height={h} rx={4} fill={jc} />
        {/* Jersey trim */}
        <rect x={x} y={shoulderY} width={w} height={3} rx={1} fill={jt} />
        <rect x={x} y={shoulderY + h - 3} width={w} height={3} rx={1} fill={jt} />
        {/* Side stripes */}
        <rect x={x + 2} y={shoulderY + 4} width={2} height={h - 8} rx={1} fill={jt} opacity="0.6" />
        <rect x={x + w - 4} y={shoulderY + 4} width={2} height={h - 8} rx={1} fill={jt} opacity="0.6" />
        {/* Jersey number */}
        <text x={cx} y={shoulderY + h / 2 + 4} textAnchor="middle" fill={jt} fontSize="14" fontWeight="900" opacity="0.9" fontFamily="Arial, sans-serif">{num}</text>
        {/* Shoulder pads outline for higher rarity */}
        {rarityTier >= 4 && (
          <>
            <ellipse cx={cx - w / 2 - 1} cy={shoulderY + 4} rx={3} ry={5} fill={jc} opacity="0.7" />
            <ellipse cx={cx + w / 2 + 1} cy={shoulderY + 4} rx={3} ry={5} fill={jc} opacity="0.7" />
          </>
        )}
      </g>
    );
  };

  const renderArms = () => {
    const armW = 5 * bw;
    const skinArms = (
      <g>
        {/* Left arm */}
        <rect x={cx - 18 * bw} y={shoulderY + 2} width={armW} height={armLen} rx={2} fill={skin} />
        {/* Right arm */}
        <rect x={cx + 13 * bw} y={shoulderY + 2} width={armW} height={armLen} rx={2} fill={skin} />
      </g>
    );

    const sleeveArms = (
      <g>
        {/* Jersey sleeves */}
        <rect x={cx - 18 * bw} y={shoulderY + 2} width={armW + 1} height={10 * bh} rx={2} fill={jc} />
        <rect x={cx + 12 * bw - 1} y={shoulderY + 2} width={armW + 1} height={10 * bh} rx={2} fill={jc} />
        {/* Skin below sleeves */}
        <rect x={cx - 18 * bw} y={shoulderY + 2 + 10 * bh} width={armW} height={armLen - 10 * bh} rx={2} fill={skin} />
        <rect x={cx + 13 * bw} y={shoulderY + 2 + 10 * bh} width={armW} height={armLen - 10 * bh} rx={2} fill={skin} />
        {/* Sleeve trim */}
        <rect x={cx - 18 * bw} y={shoulderY + 2 + 10 * bh - 1} width={armW + 1} height={2} rx={1} fill={jt} opacity="0.8" />
        <rect x={cx + 12 * bw - 1} y={shoulderY + 2 + 10 * bh - 1} width={armW + 1} height={2} rx={1} fill={jt} opacity="0.8" />
      </g>
    );

    const gloves = (
      <g>
        <rect x={cx - 19 * bw} y={shoulderY + 2 + armLen - 3} width={armW + 2} height={5} rx={2} fill={jt} opacity="0.9" />
        <rect x={cx + 12 * bw - 1} y={shoulderY + 2 + armLen - 3} width={armW + 2} height={5} rx={2} fill={jt} opacity="0.9" />
      </g>
    );

    return (
      <g>
        {traits.hasSleeves ? sleeveArms : skinArms}
        {traits.hasGloves && gloves}
      </g>
    );
  };

  const renderLegs = () => {
    const pantW = 7 * bw;
    const pantColor = jc;

    return (
      <g>
        {/* Pants */}
        <rect x={cx - 12 * bw} y={hipY} width={pantW} height={legLen} rx={2} fill={pantColor} opacity="0.9" />
        <rect x={cx + 5 * bw} y={hipY} width={pantW} height={legLen} rx={2} fill={pantColor} opacity="0.9" />
        {/* Pant stripe */}
        <rect x={cx - 12 * bw + 1} y={hipY} width={1.5} height={legLen} rx={0.5} fill={jt} opacity="0.6" />
        <rect x={cx + 5 * bw + pantW - 2.5} y={hipY} width={1.5} height={legLen} rx={0.5} fill={jt} opacity="0.6" />
        {/* Cleats */}
        <rect x={cx - 13 * bw} y={hipY + legLen - 2} width={pantW + 2} height={4} rx={1} fill="#1a1a1a" />
        <rect x={cx + 4 * bw} y={hipY + legLen - 2} width={pantW + 2} height={4} rx={1} fill="#1a1a1a" />
        {/* Cleat studs */}
        <circle cx={cx - 11 * bw} cy={hipY + legLen + 1} r={1} fill={jt} opacity="0.7" />
        <circle cx={cx - 7 * bw} cy={hipY + legLen + 1} r={1} fill={jt} opacity="0.7" />
        <circle cx={cx + 7 * bw} cy={hipY + legLen + 1} r={1} fill={jt} opacity="0.7" />
        <circle cx={cx + 11 * bw} cy={hipY + legLen + 1} r={1} fill={jt} opacity="0.7" />
        {/* Tape on legs */}
        {traits.hasTape && (
          <>
            <rect x={cx - 12 * bw} y={hipY + legLen / 2} width={pantW} height={2} rx={1} fill="#f5f5f5" opacity="0.6" />
            <rect x={cx + 5 * bw} y={hipY + legLen / 2} width={pantW} height={2} rx={1} fill="#f5f5f5" opacity="0.6" />
          </>
        )}
      </g>
    );
  };

  const renderPositionAccessory = () => {
    switch (position) {
      case 'QB':
        return (
          <g>
            {/* Football in right hand */}
            <ellipse cx={cx + 22 * bw} cy={shoulderY + armLen - 2} rx={4} ry={6} fill="#8B4513" opacity="0.9" transform={`rotate(45 ${cx + 22 * bw} ${shoulderY + armLen - 2})`} />
            <line x1={cx + 20 * bw} y1={shoulderY + armLen - 5} x2={cx + 24 * bw} y2={shoulderY + armLen + 1} stroke="#d4a06d" strokeWidth="1.5" opacity="0.6" />
          </g>
        );
      case 'RB':
        return (
          <g>
            {/* Speed lines behind left side */}
            <line x1={cx - 30 * bw} y1={shoulderY + 10} x2={cx - 20 * bw} y2={shoulderY + 12} stroke={posColor} strokeWidth="1.5" opacity="0.3" />
            <line x1={cx - 32 * bw} y1={shoulderY + 18} x2={cx - 22 * bw} y2={shoulderY + 20} stroke={posColor} strokeWidth="1.5" opacity="0.2" />
            <line x1={cx - 28 * bw} y1={shoulderY + 26} x2={cx - 18 * bw} y2={shoulderY + 28} stroke={posColor} strokeWidth="1.5" opacity="0.25" />
          </g>
        );
      case 'WR':
        return (
          <g>
            {/* Gloves catching pose */}
            <circle cx={cx - 22 * bw} cy={shoulderY - 2} r={4} fill={jt} opacity="0.8" />
            <circle cx={cx - 26 * bw} cy={shoulderY + 2} r={4} fill={jt} opacity="0.8" />
            <circle cx={cx - 24 * bw} cy={shoulderY} r={3} fill="#fff" opacity="0.3" />
          </g>
        );
      case 'K':
        return (
          <g>
            {/* Football on tee */}
            <ellipse cx={cx + 20 * bw} cy={hipY + 8} rx={3} ry={5} fill="#8B4513" opacity="0.8" transform={`rotate(90 ${cx + 20 * bw} ${hipY + 8})`} />
            <rect x={cx + 19 * bw} y={hipY + 12} width={2} height={3} rx={1} fill="#d4a06d" opacity="0.6" />
          </g>
        );
      case 'DL':
        return (
          <g>
            {/* Angry motion lines */}
            <line x1={cx - 6} y1={headY - 6} x2={cx - 10} y2={headY - 10} stroke={posColor} strokeWidth="1" opacity="0.4" />
            <line x1={cx + 6} y1={headY - 6} x2={cx + 10} y2={headY - 10} stroke={posColor} strokeWidth="1" opacity="0.4" />
          </g>
        );
      default:
        return null;
    }
  };

  const renderRarityEffects = () => {
    if (rarityTier <= 2) return null;
    return (
      <g>
        {/* Glow ring behind head */}
        <circle cx={cx} cy={headY} r={headR + 6} fill="none" stroke={posColor} strokeWidth="1" opacity={0.1 + rarityTier * 0.05}>
          <animate attributeName="r" values={`${headR + 6};${headR + 8};${headR + 6}`} dur="2s" repeatCount="indefinite" />
        </circle>
        {/* Sparkles for ELITE+ */}
        {rarityTier >= 5 && (
          <>
            <circle cx={cx - 25} cy={headY - 12} r={1} fill={jt} opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx + 28} cy={headY + 8} r={1.2} fill={jt} opacity="0.5">
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx={cx - 20} cy={headY + 15} r={0.8} fill={jt} opacity="0.4">
              <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
          </>
        )}
        {/* Legendary aura */}
        {rarityTier >= 6 && (
          <circle cx={cx} cy={headY + 25} r={headR + 15} fill="none" stroke={jt} strokeWidth="0.5" opacity="0.15">
            <animate attributeName="r" values={`${headR + 15};${headR + 20};${headR + 15}`} dur="3s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 100 120" className="w-full h-full">
      <defs>
        <radialGradient id={`bg-${playerId}`} cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor={posColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
        </radialGradient>
        <filter id={`glow-${playerId}`}>
          <feGaussianBlur stdDeviation={rarityTier >= 5 ? 2 : 1.5} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="100" height="120" fill={`url(#bg-${playerId})`} rx="8" />
      <line x1="5" y1="108" x2="95" y2="108" stroke={posColor} strokeWidth="1" opacity="0.3" />
      <g filter={`url(#glow-${playerId})`}>
        {renderRarityEffects()}
        {renderLegs()}
        {renderArms()}
        {renderTorso()}
        {renderNeckRoll()}
        {/* Head */}
        <circle cx={cx} cy={headY} r={headR} fill={skin} />
        {renderHair()}
        {renderHeadband()}
        {renderVisor()}
        {renderFace()}
        {renderPositionAccessory()}
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
  const { getPlayerProgression, getOverallBonus } = usePlayerProgression();
  const rarity = RARITY_CONFIG[player.rarity] || RARITY_CONFIG.COMMON;
  const posColor = POSITION_COLORS[player.position] || '#94a3b8';
  
  const progression = getPlayerProgression(player.id);
  const overallBonus = getOverallBonus(player.id);
  const totalOVR = player.overall + overallBonus;

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
            <PlayerVisual playerId={player.id} position={player.position} rarity={player.rarity} />
            {player.isStarter && (
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#E94560]/90 px-2 py-0.5 rounded-full">
                <Star className="w-3 h-3 text-white fill-white" />
                <span className="text-[10px] font-bold text-white">STARTER</span>
              </div>
            )}
            <div className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm border-2 flex items-center justify-center" style={{ borderColor: posColor }}>
              <div className="text-center">
                <div className="text-lg font-black text-white leading-none">{totalOVR}</div>
                <div className="text-[8px] text-slate-400 uppercase">OVR</div>
              </div>
            </div>
            {progression && (
              <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xs font-black text-amber-400 leading-none">{progression.level}</div>
                </div>
              </div>
            )}
          </div>

          <h3 className="text-sm font-bold text-white truncate mb-1">{player.name}</h3>
          <p className="text-[10px] text-slate-500 mb-2">{POSITION_LABELS[player.position] || player.position} • Age {player.age}</p>
          
          {/* XP Bar */}
          {progression && progression.xpToNextLevel > 0 && (
            <div className="mb-2">
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E94560] to-amber-400 rounded-full"
                  style={{ width: `${(progression.xp / progression.xpToNextLevel) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-white/30 mt-0.5">
                <span>Level {progression.level}</span>
                <span>{progression.xp}/{progression.xpToNextLevel} XP</span>
              </div>
            </div>
          )}

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
