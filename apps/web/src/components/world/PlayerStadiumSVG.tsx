import { motion, AnimatePresence } from 'framer-motion';
import type { OtherStadium, MyStadium } from './WorldSystem';

interface PlayerStadiumSVGProps {
  stadium: OtherStadium | MyStadium;
  x: number;
  y: number;
  isMyStadium?: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (id: string | null) => void;
}

// Stadium size scales with capacity
function getStadiumSize(capacity: number): { width: number; height: number } {
  if (capacity < 5000) return { width: 80, height: 60 };
  if (capacity < 15000) return { width: 100, height: 70 };
  if (capacity < 30000) return { width: 120, height: 85 };
  if (capacity < 60000) return { width: 140, height: 100 };
  return { width: 160, height: 115 };
}

// Color by tier
function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    shack: '#78716c',
    basic: '#22c55e',
    standard: '#3b82f6',
    premium: '#a855f7',
    elite: '#E94560',
    legendary: '#fbbf24',
  };
  return colors[tier] || '#64748b';
}

// Condition bar color
function getConditionColor(condition: number): string {
  if (condition >= 80) return '#22c55e';
  if (condition >= 50) return '#fbbf24';
  return '#E94560';
}

export default function PlayerStadiumSVG({
  stadium,
  x,
  y,
  isMyStadium = false,
  isHovered,
  onClick,
  onHover,
}: PlayerStadiumSVGProps) {
  const size = getStadiumSize(stadium.capacity);
  const { width, height } = size;
  const tierColor = getTierColor(stadium.tier);
  const conditionColor = getConditionColor(stadium.condition);
  const hasLiveMatch = stadium.liveMatch?.status === 'PLAYING';
  const hasUpcomingMatch = stadium.liveMatch?.status === 'SCHEDULED' || stadium.liveMatch?.status === 'TRAVELING' || stadium.liveMatch?.status === 'PREGAME';
  const glowOpacity = isHovered ? 0.6 : hasLiveMatch ? 0.5 : 0.15;
  const scale = isHovered ? 1.08 : 1;

  return (
    <motion.g
      onClick={onClick}
      onMouseEnter={() => onHover('stadium-' + (stadium as any).venueId)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
      animate={{ scale }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Glow effect */}
      <rect
        x={x - 8}
        y={y - 8}
        width={width + 16}
        height={height + 16}
        rx={14}
        fill={hasLiveMatch ? '#E94560' : tierColor}
        opacity={glowOpacity}
      />
      
      {/* Stadium body (bowl shape) */}
      <ellipse
        cx={x + width / 2}
        cy={y + height - 10}
        rx={width / 2}
        ry={height / 2 - 5}
        fill="#1a1a2e"
        stroke={tierColor}
        strokeWidth={isHovered ? 2.5 : 1.5}
      />
      
      {/* Stadium inner bowl */}
      <ellipse
        cx={x + width / 2}
        cy={y + height - 10}
        rx={width / 2 - 8}
        ry={height / 2 - 13}
        fill="#0f172a"
        stroke={tierColor}
        strokeWidth={0.5}
        opacity={0.6}
      />
      
      {/* Crowd dots (seats) */}
      <AnimatePresence>
        {hasLiveMatch && (
          <>
            {/* Animated crowd dots */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI;
              const rx = (width / 2 - 12) * Math.cos(angle);
              const ry = (height / 2 - 15) * Math.sin(angle);
              return (
                <motion.circle
                  key={`crowd-${i}`}
                  cx={x + width / 2 + rx}
                  cy={y + height - 10 + ry}
                  r={2}
                  fill="#fbbf24"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: i * 0.1 }}
                />
              );
            })}
          </>
        )}
        {!hasLiveMatch && (
          /* Static sparse crowd for idle */
          <>
            {Array.from({ length: 6 }).map((_, i) => {
              const angle = (i / 6) * Math.PI;
              const rx = (width / 2 - 14) * Math.cos(angle);
              const ry = (height / 2 - 17) * Math.sin(angle);
              return (
                <circle
                  key={`idle-crowd-${i}`}
                  cx={x + width / 2 + rx}
                  cy={y + height - 10 + ry}
                  r={1.5}
                  fill="#64748b"
                  opacity={0.3}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>
      
      {/* Scoreboard for live match */}
      {hasLiveMatch && stadium.liveMatch && (
        <g>
          {/* Scoreboard background */}
          <rect
            x={x + width / 2 - 30}
            y={y - 18}
            width={60}
            height={22}
            rx={4}
            fill="#0f172a"
            stroke={tierColor}
            strokeWidth={1}
          />
          {/* Home score */}
          <text
            x={x + width / 2 - 18}
            y={y - 3}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="10"
            fontWeight="bold"
          >
            {stadium.liveMatch.homeScore}
          </text>
          {/* VS */}
          <text
            x={x + width / 2}
            y={y - 3}
            textAnchor="middle"
            fill={tierColor}
            fontSize="8"
          >
            -
          </text>
          {/* Away score */}
          <text
            x={x + width / 2 + 18}
            y={y - 3}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="10"
            fontWeight="bold"
          >
            {stadium.liveMatch.awayScore}
          </text>
        </g>
      )}
      
      {/* LIVE badge */}
      {hasLiveMatch && (
        <motion.g
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <rect
            x={x + width - 28}
            y={y + 2}
            width={26}
            height={14}
            rx={3}
            fill="#E94560"
          />
          <text
            x={x + width - 15}
            y={y + 12}
            textAnchor="middle"
            fill="#fff"
            fontSize="8"
            fontWeight="bold"
          >
            LIVE
          </text>
        </motion.g>
      )}
      
      {/* UPCOMING badge */}
      {hasUpcomingMatch && !hasLiveMatch && (
        <rect
          x={x + width - 36}
          y={y + 2}
          width={34}
          height={14}
          rx={3}
          fill="#3b82f6"
          opacity={0.8}
        >
          <text
            x={x + width - 19}
            y={y + 12}
            textAnchor="middle"
            fill="#fff"
            fontSize="7"
            fontWeight="bold"
          >
            SOON
          </text>
        </rect>
      )}
      
      {/* Owner name label */}
      <text
        x={x + width / 2}
        y={y + height + 14}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize="10"
        fontWeight={isMyStadium ? 'bold' : 'normal'}
      >
        {(stadium as any).venueName || (stadium as any).ownerUsername || 'Stadium'}
      </text>
      
      {/* Capacity label */}
      <text
        x={x + width / 2}
        y={y + height + 26}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize="8"
      >
        {(stadium.capacity || 0).toLocaleString()} seats
      </text>
      
      {/* Condition bar */}
      <rect
        x={x + 4}
        y={y + height + 32}
        width={width - 8}
        height={4}
        rx={2}
        fill="#1e293b"
      />
      <rect
        x={x + 4}
        y={y + height + 32}
        width={Math.max(4, (width - 8) * (stadium.condition / 100))}
        height={4}
        rx={2}
        fill={conditionColor}
      />
      
      {/* My stadium indicator */}
      {isMyStadium && (
        <>
          <rect
            x={x - 4}
            y={y - 4}
            width={width + 8}
            height={height + 8}
            rx={12}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2}
            strokeDasharray="4 4"
            opacity={0.6}
          />
          <text
            x={x + width / 2}
            y={y - 24}
            textAnchor="middle"
            fill="#fbbf24"
            fontSize="9"
            fontWeight="bold"
          >
            MY STADIUM
          </text>
        </>
      )}
    </motion.g>
  );
}
