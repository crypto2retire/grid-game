import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface AmbientEffectsProps {
  width: number;
  height: number;
  particleCount?: number;
  fireflies?: number;
}

// Generate stable random positions
function useStableRandom(count: number, width: number, height: number) {
  return useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const seed = (i * 9301 + 49297) % 233280;
      return {
        x: (seed / 233280) * width,
        y: ((seed * 7 + 13) % 233280 / 233280) * height,
        size: 1 + ((seed * 3 + 7) % 233280 / 233280) * 2.5,
        duration: 3 + ((seed * 5 + 11) % 233280 / 233280) * 5,
        delay: ((seed * 2 + 3) % 233280 / 233280) * 4,
        opacity: 0.1 + ((seed * 11 + 17) % 233280 / 233280) * 0.3,
      };
    });
  }, [count, width, height]);
}

export function FloatingParticles({ width, height, particleCount = 30 }: AmbientEffectsProps) {
  const particles = useStableRandom(particleCount, width, height);

  return (
    <g>
      {particles.map((p, i) => (
        <motion.circle
          key={`p-${i}`}
          cx={p.x}
          cy={p.y}
          r={p.size}
          fill="#ffffff"
          opacity={p.opacity}
          animate={{
            y: [p.y, p.y - 30, p.y],
            x: [p.x, p.x + (i % 2 === 0 ? 10 : -10), p.x],
            opacity: [p.opacity, p.opacity * 2, p.opacity],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </g>
  );
}

export function Fireflies({ width, height, fireflies = 15 }: AmbientEffectsProps) {
  const flies = useStableRandom(fireflies, width, height);

  return (
    <g>
      {flies.map((f, i) => (
        <motion.circle
          key={`f-${i}`}
          cx={f.x}
          cy={f.y}
          r={f.size + 0.5}
          fill="#fbbf24"
          opacity={0.4}
          animate={{
            cx: [f.x, f.x + (Math.random() > 0.5 ? 40 : -40), f.x + (Math.random() > 0.5 ? -20 : 20), f.x],
            cy: [f.y, f.y - 20, f.y + 10, f.y],
            opacity: [0.2, 0.6, 0.3, 0.2],
            r: [f.size, f.size + 1, f.size - 0.5, f.size],
          }}
          transition={{
            duration: f.duration + 2,
            repeat: Infinity,
            delay: f.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </g>
  );
}

export function WaterRipples({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const ripples = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => ({
      delay: i * 0.8,
      duration: 3 + i * 0.5,
    }));
  }, []);

  return (
    <g transform={`translate(${x + width / 2}, ${y + height / 2})`}>
      {ripples.map((r, i) => (
        <motion.ellipse
          key={`r-${i}`}
          rx={10}
          ry={5}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={1}
          opacity={0.3}
          animate={{
            rx: [10, 40 + i * 10],
            ry: [5, 20 + i * 5],
            opacity: [0.3, 0],
          }}
          transition={{
            duration: r.duration,
            repeat: Infinity,
            delay: r.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </g>
  );
}

export function SmokePuff({ x, y, color = '#64748b' }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <motion.circle
        cx={0}
        cy={0}
        r={3}
        fill={color}
        opacity={0.4}
        animate={{
          cy: [0, -15, -30],
          cx: [0, 3, -2],
          r: [3, 6, 9],
          opacity: [0.4, 0.2, 0],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
      <motion.circle
        cx={4}
        cy={-5}
        r={2}
        fill={color}
        opacity={0.3}
        animate={{
          cy: [-5, -20, -40],
          cx: [4, 8, 5],
          r: [2, 5, 8],
          opacity: [0.3, 0.15, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          delay: 0.5,
          ease: 'easeOut',
        }}
      />
    </g>
  );
}

export function GrassTufts({ x, y, count = 5 }: { x: number; y: number; count?: number }) {
  const tufts = useMemo(() => {
    return Array.from({ length: count }, () => ({
      ox: (Math.random() - 0.5) * 20,
      oy: (Math.random() - 0.5) * 10,
      height: 3 + Math.random() * 4,
      sway: Math.random() > 0.5 ? 1 : -1,
      delay: Math.random() * 2,
    }));
  }, [count]);

  return (
    <g transform={`translate(${x}, ${y})`}>
      {tufts.map((t, idx) => (
        <motion.path
          key={`g-${idx}`}
          d={`M ${t.ox} ${t.oy} Q ${t.ox + t.sway * 2} ${t.oy - t.height / 2} ${t.ox + t.sway} ${t.oy - t.height}`}
          fill="none"
          stroke="#4ade80"
          strokeWidth={1}
          opacity={0.3}
          animate={{
            d: [
              `M ${t.ox} ${t.oy} Q ${t.ox + t.sway * 2} ${t.oy - t.height / 2} ${t.ox + t.sway} ${t.oy - t.height}`,
              `M ${t.ox} ${t.oy} Q ${t.ox - t.sway * 2} ${t.oy - t.height / 2} ${t.ox - t.sway} ${t.oy - t.height}`,
              `M ${t.ox} ${t.oy} Q ${t.ox + t.sway * 2} ${t.oy - t.height / 2} ${t.ox + t.sway} ${t.oy - t.height}`,
            ],
          }}
          transition={{
            duration: 2 + Math.random(),
            repeat: Infinity,
            delay: t.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </g>
  );
}
