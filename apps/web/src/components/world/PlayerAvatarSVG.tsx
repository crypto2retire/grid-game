import { motion } from 'framer-motion';
import type { WorldPlayer } from './WorldSystem';

interface PlayerAvatarProps {
  player: WorldPlayer;
  onClick?: () => void;
}

export default function PlayerAvatarSVG({ player, onClick }: PlayerAvatarProps) {
  return (
    <motion.g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      initial={false}
      animate={{ x: player.x, y: player.y }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {/* Tooltip name */}
      <text
        x={0}
        y={-18}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize="9"
        fontWeight="bold"
        style={{ pointerEvents: 'none' }}
      >
        {player.username}
      </text>
      
      {/* Avatar body */}
      <circle cx={0} cy={-8} r={6} fill={player.avatarColor} opacity={0.9} />
      
      {/* Avatar head */}
      <circle cx={0} cy={-16} r={4} fill={player.avatarColor} />
      
      {/* Movement indicator */}
      {player.isMoving && (
        <motion.g
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          <circle cx={0} cy={4} r={2} fill={player.avatarColor} opacity={0.5} />
          <circle cx={-6} cy={6} r={1.5} fill={player.avatarColor} opacity={0.3} />
          <circle cx={6} cy={6} r={1.5} fill={player.avatarColor} opacity={0.3} />
        </motion.g>
      )}
    </motion.g>
  );
}
