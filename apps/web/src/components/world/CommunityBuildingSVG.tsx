import React from 'react';
import { motion } from 'framer-motion';

export interface CommunityBuildingProps {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
  isHovered: boolean;
  onClick: () => void;
  onHover: (id: string | null) => void;
  isActive?: boolean; // e.g., training center has active session
}

export default function CommunityBuildingSVG({
  id,
  label,
  x,
  y,
  width,
  height,
  color,
  accent,
  isHovered,
  onClick,
  onHover,
  isActive,
}: Omit<CommunityBuildingProps, 'icon'>) {
  const glowOpacity = isHovered ? 0.4 : 0.1;
  const scale = isHovered ? 1.05 : 1;
  const strokeWidth = isHovered ? 2 : 1;

  return (
    <motion.g
      onClick={onClick}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
      animate={{ scale }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Glow effect */}
      <rect
        x={x - 5}
        y={y - 5}
        width={width + 10}
        height={height + 10}
        rx={12}
        fill={accent}
        opacity={glowOpacity}
      />
      {/* Building base */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill={color}
        stroke={accent}
        strokeWidth={strokeWidth}
        opacity={0.95}
      />
      {/* Public awning / roof */}
      <path
        d={`M ${x - 5} ${y} Q ${x + width / 2} ${y - 12} ${x + width + 5} ${y}`}
        fill={accent}
        opacity={0.3}
      />
      {/* Small public flag indicator */}
      <circle cx={x + width - 12} cy={y + 12} r={4} fill={accent} opacity={0.6} />
      <rect x={x + width - 12} y={y + 8} width={1} height={10} fill={accent} opacity={0.4} />
      {/* Door */}
      <rect
        x={x + width / 2 - 12}
        y={y + height - 28}
        width={24}
        height={28}
        rx={4}
        fill={accent}
        opacity={0.25}
      />
      <rect
        x={x + width / 2 - 8}
        y={y + height - 24}
        width={16}
        height={24}
        rx={3}
        fill={accent}
        opacity={0.15}
      />
      {/* Windows */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={x + 12 + i * (width / 3 - 4)}
          y={y + 16}
          width={width / 3 - 12}
          height={14}
          rx={2}
          fill={accent}
          opacity={0.2}
        />
      ))}
      {/* Active indicator dot */}
      {isActive && (
        <motion.circle
          cx={x + 10}
          cy={y + 10}
          r={4}
          fill="#22c55e"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      {/* Label */}
      <text
        x={x + width / 2}
        y={y + height + 16}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize="11"
        fontWeight="600"
      >
        {label}
      </text>
    </motion.g>
  );
}
