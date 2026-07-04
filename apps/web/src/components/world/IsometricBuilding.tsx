import { motion } from 'framer-motion';
import { useState } from 'react';

interface IsometricBuildingProps {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth?: number;
  color: string;
  accent: string;
  isHovered?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  onHover?: (id: string | null) => void;
  variant?: 'shop' | 'stadium' | 'training-facility' | 'training' | 'medical' | 'scouting' | 'hq' | 'bank' | 'generic';
}

export default function IsometricBuilding({
  id,
  label,
  x,
  y,
  width = 80,
  height = 60,
  depth = 40,
  color,
  accent,
  isHovered = false,
  isActive = false,
  onClick,
  onHover,
  variant = 'generic',
}: IsometricBuildingProps) {
  const [localHover, setLocalHover] = useState(false);
  const hovered = isHovered || localHover;

  const handleMouseEnter = () => {
    setLocalHover(true);
    onHover?.(id);
  };

  const handleMouseLeave = () => {
    setLocalHover(false);
    onHover?.(null);
  };

  // Building-specific SVG details
  const renderBuildingDetails = () => {
    const w2 = width / 2;
    const d2 = depth / 2;

    switch (variant) {
      case 'stadium':
        return (
          <g>
            {/* Stadium outer wall ring */}
            <ellipse cx={0} cy={-height * 0.25} rx={w2 * 0.92} ry={d2 * 0.62} fill={`${color}aa`} stroke={accent} strokeWidth={1.5} />
            {/* Upper deck */}
            <ellipse cx={0} cy={-height * 0.35} rx={w2 * 0.78} ry={d2 * 0.5} fill={`${color}cc`} stroke={accent} strokeWidth={1} />
            {/* Inner field — bright green */}
            <ellipse cx={0} cy={-height * 0.3} rx={w2 * 0.55} ry={d2 * 0.34} fill="#4ade80" opacity={0.85} />
            {/* Field markings — yard lines */}
            {[-0.3, -0.15, 0, 0.15, 0.3].map((offset, i) => (
              <line key={i} x1={w2 * 0.35 * offset * 2} y1={-height * 0.3 - d2 * 0.28} x2={w2 * 0.35 * offset * 2} y2={-height * 0.3 + d2 * 0.28} stroke="white" strokeWidth={0.5} opacity={0.5} />
            ))}
            {/* Center circle */}
            <ellipse cx={0} cy={-height * 0.3} rx={w2 * 0.12} ry={d2 * 0.08} fill="none" stroke="white" strokeWidth={0.5} opacity={0.4} />
            {/* Light towers — 4 corners */}
            {[-1, 1].map(sx => [-1, 1].map((sy, i) => (
              <g key={`${sx}-${sy}`}>
                <rect x={sx * w2 * 0.88 - 2} y={-height * 0.85} width={3} height={height * 0.45} fill="#64748b" rx={1} />
                <circle cx={sx * w2 * 0.88 - 0.5} cy={-height * 0.86} r={2.5} fill="#fbbf24" opacity={0.9}>
                  <animate attributeName="opacity" values="0.9;0.5;0.9" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
                </circle>
              </g>
            )))}
            {/* Scoreboard */}
            <rect x={-w2 * 0.25} y={-height * 0.75} width={w2 * 0.5} height={d2 * 0.15} rx={2} fill="#1e293b" stroke="#475569" strokeWidth={0.5} />
            <text x={0} y={-height * 0.72} textAnchor="middle" fill="white" fontSize={4} fontWeight="bold" opacity={0.7}>HOME 0 - 0 AWAY</text>
          </g>
        );
      case 'training-facility':
      case 'training':
        return (
          <g>
            {/* Gym building with pitched roof */}
            <path d={`M ${-w2 + 6} ${-height * 0.5} L 0 ${-height * 0.75} L ${w2 - 6} ${-height * 0.5} Z`} fill={`${color}aa`} stroke={accent} strokeWidth={1} />
            {/* Weights icon */}
            <rect x={-10} y={-height * 0.6} width={20} height={3} rx={1.5} fill="#94a3b8" />
            <circle cx={-10} cy={-height * 0.6 + 1.5} r={4} fill="#64748b" />
            <circle cx={10} cy={-height * 0.6 + 1.5} r={4} fill="#64748b" />
            {/* Door */}
            <rect x={-6} y={-height * 0.35} width={12} height={height * 0.35} rx={2} fill={`${color}dd`} stroke={accent} strokeWidth={1} />
          </g>
        );
      case 'medical':
        return (
          <g>
            {/* Cross symbol on roof */}
            <rect x={-3} y={-height * 0.85} width={6} height={14} rx={1} fill="#ef4444" />
            <rect x={-7} y={-height * 0.81} width={14} height={6} rx={1} fill="#ef4444" />
            {/* White building */}
            <rect x={-w2 + 4} y={-height * 0.7} width={width - 8} height={height * 0.5} rx={2} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} />
            {/* Door */}
            <rect x={-5} y={-height * 0.3} width={10} height={height * 0.3} rx={2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
          </g>
        );
      case 'scouting':
        return (
          <g>
            {/* Binoculars / observation deck */}
            <rect x={-6} y={-height * 0.8} width={12} height={6} rx={3} fill="#1e293b" />
            <circle cx={-4} cy={-height * 0.8 + 3} r={2.5} fill="#38bdf8" opacity={0.7} />
            <circle cx={4} cy={-height * 0.8 + 3} r={2.5} fill="#38bdf8" opacity={0.7} />
            {/* Stand */}
            <rect x={-2} y={-height * 0.75} width={4} height={height * 0.15} fill="#475569" />
            {/* Building */}
            <rect x={-w2 + 4} y={-height * 0.6} width={width - 8} height={height * 0.6} rx={2} fill={`${color}cc`} stroke={accent} strokeWidth={1} />
          </g>
        );
      case 'shop':
        return (
          <g>
            {/* Awning */}
            <path d={`M ${-w2 + 4} ${-height * 0.4} L ${w2 - 4} ${-height * 0.4} L ${w2 - 4} ${-height * 0.2} L ${-w2 + 4} ${-height * 0.2} Z`} fill={accent} opacity={0.8} />
            {/* Door */}
            <rect x={-8} y={-height * 0.35} width={16} height={height * 0.35} rx={2} fill={`${color}cc`} stroke={accent} strokeWidth={1} />
            {/* Window */}
            <rect x={-w2 * 0.5} y={-height * 0.75} width={w2 * 0.4} height={height * 0.25} rx={1} fill="#fbbf24" opacity={0.3} stroke={accent} strokeWidth={0.5} />
            <rect x={w2 * 0.1} y={-height * 0.75} width={w2 * 0.4} height={height * 0.25} rx={1} fill="#fbbf24" opacity={0.3} stroke={accent} strokeWidth={0.5} />
          </g>
        );
      case 'hq':
        return (
          <g>
            {/* Flag pole */}
            <rect x={0} y={-height * 1.2} width={2} height={height * 0.3} fill="#94a3b8" />
            <motion.path
              d={`M 2 ${-height * 1.15} L ${12} ${-height * 1.1} L 2 ${-height * 1.05} Z`}
              fill={accent}
              animate={{ d: [`M 2 ${-height * 1.15} L 12 ${-height * 1.1} L 2 ${-height * 1.05} Z`, `M 2 ${-height * 1.15} L 10 ${-height * 1.08} L 2 ${-height * 1.05} Z`, `M 2 ${-height * 1.15} L 12 ${-height * 1.1} L 2 ${-height * 1.05} Z`] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Main entrance */}
            <rect x={-10} y={-height * 0.5} width={20} height={height * 0.5} rx={3} fill={`${color}aa`} stroke={accent} strokeWidth={1} />
            {/* Logo area */}
            <circle cx={0} cy={-height * 0.7} r={8} fill={accent} opacity={0.3} />
          </g>
        );
      case 'bank':
        return (
          <g>
            {/* Columns */}
            <rect x={-w2 * 0.6} y={-height * 0.85} width={6} height={height * 0.75} fill={`${color}dd`} stroke={accent} strokeWidth={0.5} />
            <rect x={-4} y={-height * 0.85} width={6} height={height * 0.75} fill={`${color}dd`} stroke={accent} strokeWidth={0.5} />
            <rect x={w2 * 0.6 - 6} y={-height * 0.85} width={6} height={height * 0.75} fill={`${color}dd`} stroke={accent} strokeWidth={0.5} />
            {/* Pediment */}
            <path d={`M ${-w2 * 0.8} ${-height * 0.85} L 0 ${-height} L ${w2 * 0.8} ${-height * 0.85} Z`} fill={accent} opacity={0.6} />
            {/* Door */}
            <rect x={-8} y={-height * 0.4} width={16} height={height * 0.4} rx={2} fill={`${color}cc`} stroke={accent} strokeWidth={1} />
          </g>
        );
      default:
        return (
          <g>
            {/* Generic door */}
            <rect x={-8} y={-height * 0.4} width={16} height={height * 0.4} rx={2} fill={`${color}cc`} stroke={accent} strokeWidth={1} />
            {/* Generic window */}
            <rect x={-w2 * 0.5} y={-height * 0.8} width={w2 * 0.35} height={height * 0.2} rx={1} fill="#fbbf24" opacity={0.3} stroke={accent} strokeWidth={0.5} />
            <rect x={w2 * 0.15} y={-height * 0.8} width={w2 * 0.35} height={height * 0.2} rx={1} fill="#fbbf24" opacity={0.3} stroke={accent} strokeWidth={0.5} />
          </g>
        );
    }
  };

  return (
    <motion.g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      animate={{ scale: hovered ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Selection glow */}
      {isActive && (
        <ellipse cx={0} cy={4} rx={width * 0.7} ry={depth * 0.5} fill="none" stroke={accent} strokeWidth={2} opacity={0.6}>
          <animate attributeName="rx" values={`${width * 0.7};${width * 0.8};${width * 0.7}`} dur="2s" repeatCount="indefinite" />
          <animate attributeName="ry" values={`${depth * 0.5};${depth * 0.6};${depth * 0.5}`} dur="2s" repeatCount="indefinite" />
        </ellipse>
      )}

      {/* Shadow */}
      <ellipse cx={0} cy={0} rx={width * 0.6} ry={depth * 0.4} fill="rgba(0,0,0,0.3)" />

      {/* Isometric base/foundation */}
      <path
        d={`M ${-width / 2} 0 L 0 ${depth / 2} L ${width / 2} 0 L 0 ${-depth / 2} Z`}
        fill={`${color}44`}
        stroke={accent}
        strokeWidth={1}
        opacity={0.6}
      />

      {/* Front face (visible when looking from front-right) */}
      <path
        d={`M ${-width / 2} 0 L ${-width / 2} ${-height} L 0 ${-height + depth / 2} L 0 ${depth / 2} Z`}
        fill={color}
        stroke={accent}
        strokeWidth={1}
        opacity={0.9}
      />

      {/* Right face */}
      <path
        d={`M 0 ${depth / 2} L 0 ${-height + depth / 2} L ${width / 2} ${-height} L ${width / 2} 0 Z`}
        fill={`${color}cc`}
        stroke={accent}
        strokeWidth={1}
        opacity={0.85}
      />

      {/* Roof top */}
      <path
        d={`M ${-width / 2} ${-height} L 0 ${-height + depth / 2} L ${width / 2} ${-height} L 0 ${-height - depth / 2} Z`}
        fill={`${color}ee`}
        stroke={accent}
        strokeWidth={1}
      />

      {/* Building details */}
      <g transform={`translate(0, ${depth / 4})`}>
        {renderBuildingDetails()}
      </g>

      {/* Label */}
      <text
        x={0}
        y={depth * 0.6}
        textAnchor="middle"
        fill={hovered ? 'white' : '#94a3b8'}
        fontSize={10}
        fontWeight={hovered ? 'bold' : '600'}
        style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {label}
      </text>

      {/* Hover tooltip */}
      {hovered && (
        <motion.g
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <rect x={-50} y={-height - 30} width={100} height={22} rx={6} fill="#1e293b" stroke={accent} strokeWidth={1} opacity={0.95} />
          <text x={0} y={-height - 14} textAnchor="middle" fill="#e2e8f0" fontSize={9} fontWeight="600">
            Click to enter
          </text>
        </motion.g>
      )}
    </motion.g>
  );
}
