import { motion } from 'framer-motion';
import { useMemo } from 'react';

export interface AvatarState {
  x: number;
  y: number;
  isMoving: boolean;
  facing: 'left' | 'right' | 'up' | 'down';
  username: string;
  color: string;
  teamColor?: string;
}

interface IsometricAvatarProps {
  player: AvatarState;
  onClick?: () => void;
  scale?: number;
}

// Predefined character skin tones and accent colors for variety
const SKIN_TONES = ['#f5d0b0', '#e8b89a', '#d4a373', '#8d5524', '#c68642'];

export default function IsometricAvatar({ player, onClick, scale = 1 }: IsometricAvatarProps) {
  const skinTone = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < player.username.length; i++) {
      hash = ((hash << 5) - hash + player.username.charCodeAt(i)) | 0;
    }
    return SKIN_TONES[Math.abs(hash) % SKIN_TONES.length];
  }, [player.username]);

  const isMoving = player.isMoving;
  const facingRight = player.facing === 'right' || player.facing === 'down';

  // Bobbing motion when walking
  const bobY = isMoving ? [0, -3, 0] : 0;
  const bobDuration = isMoving ? 0.4 : 0;

  return (
    <motion.g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      initial={false}
      animate={{ x: player.x, y: player.y }}
      transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.8 }}
    >
      {/* Shadow */}
      <ellipse cx={0} cy={0} rx={10 * scale} ry={4 * scale} fill="rgba(0,0,0,0.4)" />

      {/* Name tag */}
      <text
        x={0}
        y={-42 * scale}
        textAnchor="middle"
        fill="white"
        fontSize={9 * scale}
        fontWeight="bold"
        style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        {player.username}
      </text>

      {/* Character body group with bobbing */}
      <motion.g
        animate={{ y: bobY }}
        transition={{ duration: bobDuration, repeat: isMoving ? Infinity : 0, ease: 'easeInOut' }}
      >
        {/* Back leg (swings when walking) */}
        {isMoving && (
          <motion.g
            animate={{ rotate: facingRight ? [12, -12, 12] : [-12, 12, -12] }}
            transition={{ duration: 0.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <rect
              x={facingRight ? 2 * scale : -6 * scale}
              y={-2 * scale}
              width={4 * scale}
              height={10 * scale}
              rx={1}
              fill={player.teamColor || '#334155'}
            />
          </motion.g>
        )}
        {!isMoving && (
          <rect
            x={facingRight ? 2 * scale : -6 * scale}
            y={-2 * scale}
            width={4 * scale}
            height={10 * scale}
            rx={1}
            fill={player.teamColor || '#334155'}
          />
        )}

        {/* Front leg (swings opposite) */}
        {isMoving && (
          <motion.g
            animate={{ rotate: facingRight ? [-12, 12, -12] : [12, -12, 12] }}
            transition={{ duration: 0.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <rect
              x={facingRight ? -6 * scale : 2 * scale}
              y={-2 * scale}
              width={4 * scale}
              height={10 * scale}
              rx={1}
              fill={player.teamColor || '#475569'}
            />
          </motion.g>
        )}
        {!isMoving && (
          <rect
            x={facingRight ? -6 * scale : 2 * scale}
            y={-2 * scale}
            width={4 * scale}
            height={10 * scale}
            rx={1}
            fill={player.teamColor || '#475569'}
          />
        )}

        {/* Torso / Shirt */}
        <rect
          x={-7 * scale}
          y={-22 * scale}
          width={14 * scale}
          height={16 * scale}
          rx={3}
          fill={player.color}
        />
        {/* Jersey number stripe */}
        <rect
          x={-3 * scale}
          y={-20 * scale}
          width={6 * scale}
          height={2 * scale}
          rx={0.5}
          fill="rgba(255,255,255,0.4)"
        />

        {/* Arms */}
        <motion.g
          animate={{ rotate: isMoving ? (facingRight ? [-8, 8, -8] : [8, -8, 8]) : 0 }}
          transition={{ duration: 0.4, repeat: isMoving ? Infinity : 0, ease: 'easeInOut' }}
        >
          {/* Back arm */}
          <rect
            x={facingRight ? 7 * scale : -11 * scale}
            y={-20 * scale}
            width={4 * scale}
            height={12 * scale}
            rx={2}
            fill={skinTone}
          />
        </motion.g>
        <motion.g
          animate={{ rotate: isMoving ? (facingRight ? [8, -8, 8] : [-8, 8, -8]) : 0 }}
          transition={{ duration: 0.4, repeat: isMoving ? Infinity : 0, ease: 'easeInOut' }}
        >
          {/* Front arm */}
          <rect
            x={facingRight ? -11 * scale : 7 * scale}
            y={-20 * scale}
            width={4 * scale}
            height={12 * scale}
            rx={2}
            fill={skinTone}
          />
        </motion.g>

        {/* Head */}
        <circle cx={0} cy={-30 * scale} r={7 * scale} fill={skinTone} />
        {/* Hair */}
        <circle cx={0} cy={-33 * scale} r={6.5 * scale} fill={player.teamColor || '#1e293b'} />
        <circle cx={0} cy={-32 * scale} r={5 * scale} fill={player.teamColor || '#1e293b'} />
        {/* Eyes */}
        <circle cx={facingRight ? 2.5 * scale : -2.5 * scale} cy={-30.5 * scale} r={1.2 * scale} fill="#1e293b" />
        {/* Eye highlight */}
        <circle cx={facingRight ? 2.8 * scale : -2.2 * scale} cy={-31 * scale} r={0.4 * scale} fill="white" opacity={0.6} />
      </motion.g>

      {/* Walking dust particles */}
      {isMoving && (
        <motion.g
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'easeOut' }}
        >
          <circle cx={-8 * scale} cy={2 * scale} r={1.5 * scale} fill="#94a3b8" opacity={0.5} />
          <circle cx={8 * scale} cy={3 * scale} r={1 * scale} fill="#94a3b8" opacity={0.3} />
        </motion.g>
      )}
    </motion.g>
  );
}
