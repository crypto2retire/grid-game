import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePanels } from './PanelSystem';
import {
  LayoutDashboard, Dumbbell, ShoppingCart, Trophy, Wallet, Shirt, Swords, ArrowRight
} from 'lucide-react';
import CityPage from '../../pages/CityPage';
import MarketplacePage from '../../pages/MarketplacePage';
import LeaderboardPage from '../../pages/LeaderboardPage';
import WalletPage from '../../pages/WalletPage';
import TrainingPage from '../../pages/TrainingPage';
import EquipmentPage from '../../pages/EquipmentPage';
import LeagueIslandPage from '../../pages/LeagueIslandPage';

interface Island {
  id: string;
  name: string;
  type: 'HUB' | 'LEAGUE';
  x: number;
  y: number;
  size: number;
  color: string;
  theme: string;
  teamCount?: number;
  maxTeams?: number;
  league?: {
    id: string;
    name: string;
    tier: string;
    visibility: string;
    minOverall: number;
    maxOverall: number;
    creator?: { username: string; displayName: string | null };
  };
}

interface HubBuilding {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  x: number;
  y: number;
  color: string;
  accent: string;
  getContent: () => React.ReactNode;
}

const HUB_BUILDINGS: HubBuilding[] = [
  { id: 'dashboard', label: 'HQ', icon: LayoutDashboard, x: 30, y: 25, color: '#0f172a', accent: '#E94560', getContent: () => <CityPage /> },
  { id: 'market', label: 'Market', icon: ShoppingCart, x: 70, y: 15, color: '#3f2e0f', accent: '#f59e0b', getContent: () => <MarketplacePage /> },
  { id: 'training', label: 'Training', icon: Dumbbell, x: 80, y: 50, color: '#3f0f3f', accent: '#a855f7', getContent: () => <TrainingPage /> },
  { id: 'leaderboard', label: 'Hall of Fame', icon: Trophy, x: 50, y: 75, color: '#2a1a0a', accent: '#fbbf24', getContent: () => <LeaderboardPage /> },
  { id: 'wallet', label: 'Bank', icon: Wallet, x: 20, y: 60, color: '#3f2e0f', accent: '#eab308', getContent: () => <WalletPage /> },
  { id: 'locker', label: 'Locker', icon: Shirt, x: 45, y: 35, color: '#1a1a2e', accent: '#64748b', getContent: () => <EquipmentPage /> },
  { id: 'matches', label: 'Games', icon: Swords, x: 60, y: 55, color: '#1a1a2e', accent: '#E94560', getContent: () => <CityPage /> },
];

const TIER_LABELS: Record<string, string> = {
  STATE_COLLEGE: 'State College',
  MID_COLLEGE: 'Mid College',
  TOP_COLLEGE: 'Top College',
  REGIONAL_PRO: 'Regional Pro',
  PRO_ENTRY: 'Pro Entry',
  PRO_ELITE: 'Pro Elite',
};

// Animated wave layer for water
function WaveLayer({ amplitude, frequency, speed, opacity, yOffset }: {
  amplitude: number; frequency: number; speed: number; opacity: number; yOffset: number;
}) {
  const d = useMemo(() => {
    const points = [];
    for (let x = -400; x <= 400; x += 10) {
      const y = Math.sin(x * frequency) * amplitude + yOffset;
      points.push(`${x},${y}`);
    }
    return `M -400,${yOffset + amplitude} L ${points.join(' L ')} L 400,${yOffset + amplitude} Z`;
  }, [amplitude, frequency, yOffset]);

  return (
    <motion.path
      d={d}
      fill="#1e3a5f"
      opacity={opacity}
      animate={{
        d: [
          d,
          (() => {
            const points = [];
            for (let x = -400; x <= 400; x += 10) {
              const y = Math.sin(x * frequency + Math.PI) * amplitude + yOffset;
              points.push(`${x},${y}`);
            }
            return `M -400,${yOffset + amplitude} L ${points.join(' L ')} L 400,${yOffset + amplitude} Z`;
          })(),
          d,
        ],
      }}
      transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Small boat that travels between islands
function TravelingBoat({ fromX, fromY, toX, toY }: { fromX: number; fromY: number; toX: number; toY: number }) {
  return (
    <motion.g
      animate={{
        x: [fromX, toX, fromX],
        y: [fromY, toY, fromY],
      }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.g
        animate={{ rotate: [-3, 3, -3] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx={0} cy={2} rx={8} ry={3} fill="#64748b" />
        <rect x={-2} y={-4} width={4} height={6} fill="#475569" />
        <path d="M -2 -4 L 6 -2 L -2 0 Z" fill="#94a3b8" opacity={0.8} />
      </motion.g>
      {/* Wake */}
      <motion.ellipse
        cx={0}
        cy={4}
        rx={12}
        ry={2}
        fill="none"
        stroke="#334155"
        strokeWidth={0.5}
        opacity={0.3}
        animate={{ rx: [12, 18, 12], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </motion.g>
  );
}

export default function IslandWorldMap() {
  const { openPanel } = usePanels();
  const [islands, setIslands] = useState<Island[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIsland, setHoveredIsland] = useState<string | null>(null);

  const fetchIslands = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/islands', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setIslands(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch islands:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIslands();
  }, [fetchIslands]);

  const handleIslandClick = (island: Island) => {
    if (island.type === 'HUB') {
      // Hub click
    } else if (island.league) {
      openPanel({
        id: `league-${island.league.id}`,
        title: island.league.name,
        buildingId: 'league',
        x: 100 + Math.random() * 100,
        y: 60 + Math.random() * 50,
        width: 900,
        height: 650,
        minimized: false,
        maximized: false,
        content: <LeagueIslandPage islandId={island.id} leagueId={island.league.id} />,
      });
    }
  };

  const handleHubBuildingClick = (building: HubBuilding) => {
    openPanel({
      id: building.id,
      title: building.label,
      buildingId: building.id,
      x: 100 + Math.random() * 100,
      y: 60 + Math.random() * 50,
      width: 800,
      height: 600,
      minimized: false,
      maximized: false,
      content: building.getContent(),
    });
  };

  // Generate static wave seed — MUST be before any conditional return
  const waveSeed = useMemo(() => Math.random(), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E94560]" />
      </div>
    );
  }

  const hubIsland = islands.find((i) => i.type === 'HUB');
  const leagueIslands = islands.filter((i) => i.type === 'LEAGUE');

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a1628]">
      {/* Deep water background layers */}
      <div className="absolute inset-0">
        <svg width="100%" height="100%">
          <defs>
            <radialGradient id="deepWater" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#0c1e33" />
              <stop offset="50%" stopColor="#091625" />
              <stop offset="100%" stopColor="#060e1a" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#deepWater)" />
        </svg>
      </div>

      {/* Animated water waves */}
      <div className="absolute inset-0 opacity-40">
        <svg width="100%" height="100%" viewBox="-400 -300 800 600" preserveAspectRatio="xMidYMid meet">
          <WaveLayer amplitude={15} frequency={0.008} speed={4} opacity={0.15} yOffset={-200} />
          <WaveLayer amplitude={12} frequency={0.012} speed={3.5} opacity={0.12} yOffset={-100} />
          <WaveLayer amplitude={18} frequency={0.006} speed={5} opacity={0.1} yOffset={0} />
          <WaveLayer amplitude={10} frequency={0.015} speed={3} opacity={0.08} yOffset={100} />
          <WaveLayer amplitude={14} frequency={0.009} speed={4.5} opacity={0.1} yOffset={200} />
        </svg>
      </div>

      {/* Sparkles on water */}
      <div className="absolute inset-0">
        <svg width="100%" height="100%" viewBox="-400 -300 800 600" preserveAspectRatio="xMidYMid meet">
          {Array.from({ length: 20 }).map((_, idx) => {
            const sx = ((idx * 137.5 + waveSeed * 100) % 800) - 400;
            const sy = ((idx * 73.3 + waveSeed * 200) % 600) - 300;
            return (
              <motion.circle
                key={`sparkle-${idx}`}
                cx={sx}
                cy={sy}
                r={1 + (idx % 2)}
                fill="#38bdf8"
                opacity={0.2}
                animate={{
                  opacity: [0.1, 0.4, 0.1],
                  r: [1, 2, 1],
                }}
                transition={{
                  duration: 2 + (idx % 3),
                  repeat: Infinity,
                  delay: idx * 0.3,
                  ease: 'easeInOut',
                }}
              />
            );
          })}
        </svg>
      </div>

      {/* World Map SVG */}
      <svg viewBox="-400 -300 800 600" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="islandGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="4" dy="6" stdDeviation="4" floodColor="#000" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Water routes between islands */}
        {hubIsland && leagueIslands.map((island) => (
          <motion.path
            key={`route-${island.id}`}
            d={`M ${hubIsland.x} ${hubIsland.y} Q ${(hubIsland.x + island.x) / 2} ${(hubIsland.y + island.y) / 2 + 30} ${island.x} ${island.y}`}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="2"
            strokeDasharray="8 8"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 0.5 }}
          />
        ))}

        {/* Traveling boats */}
        {hubIsland && leagueIslands.slice(0, 3).map((island) => (
          <TravelingBoat
            key={`boat-${island.id}`}
            fromX={hubIsland.x}
            fromY={hubIsland.y}
            toX={island.x}
            toY={island.y}
          />
        ))}

        {/* Hub Island */}
        {hubIsland && (
          <g
            onClick={() => handleIslandClick(hubIsland)}
            onMouseEnter={() => setHoveredIsland(hubIsland.id)}
            onMouseLeave={() => setHoveredIsland(null)}
            className="cursor-pointer"
          >
            {/* Island shadow */}
            <ellipse cx={hubIsland.x + 10} cy={hubIsland.y + 12} rx={hubIsland.size * 65} ry={hubIsland.size * 42} fill="rgba(0,0,0,0.4)" filter="url(#shadow)" />
            
            {/* Animated waterline around island */}
            <motion.ellipse
              cx={hubIsland.x}
              cy={hubIsland.y + 2}
              rx={hubIsland.size * 62}
              ry={hubIsland.size * 42}
              fill="none"
              stroke="rgba(56, 189, 248, 0.2)"
              strokeWidth={2}
              animate={{ rx: [hubIsland.size * 62, hubIsland.size * 65, hubIsland.size * 62] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            
            {/* Island body with gentle bob */}
            <motion.g
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ellipse
                cx={hubIsland.x}
                cy={hubIsland.y}
                rx={hubIsland.size * 60}
                ry={hubIsland.size * 40}
                fill={hubIsland.color}
                stroke={hoveredIsland === hubIsland.id ? '#fff' : 'rgba(255,255,255,0.2)'}
                strokeWidth={hoveredIsland === hubIsland.id ? 3 : 1}
                filter="url(#islandGlow)"
              />
              
              {/* Island detail (beach ring) */}
              <ellipse
                cx={hubIsland.x}
                cy={hubIsland.y + 10}
                rx={hubIsland.size * 55}
                ry={hubIsland.size * 32}
                fill="rgba(255,255,255,0.08)"
              />
              
              {/* Trees / vegetation dots */}
              {Array.from({ length: 12 }).map((_, i) => {
                const tx = hubIsland.x + Math.sin(i * 2.1 + waveSeed * 10) * hubIsland.size * 35;
                const ty = hubIsland.y + Math.cos(i * 1.7 + waveSeed * 10) * hubIsland.size * 20;
                return (
                  <circle
                    key={i}
                    cx={tx}
                    cy={ty}
                    r={2 + (i % 3)}
                    fill="#4ade80"
                    opacity={0.3}
                  />
                );
              })}
            </motion.g>

            {/* Hub label */}
            <text x={hubIsland.x} y={hubIsland.y - hubIsland.size * 50} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" style={{ pointerEvents: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              {hubIsland.name}
            </text>
            <text x={hubIsland.x} y={hubIsland.y - hubIsland.size * 35} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10" style={{ pointerEvents: 'none' }}>
              Community Hub
            </text>

            {/* Hub buildings */}
            {HUB_BUILDINGS.map((building) => {
              const bx = hubIsland.x + (building.x - 50) * hubIsland.size * 0.8;
              const by = hubIsland.y + (building.y - 50) * hubIsland.size * 0.6;
              return (
                <g
                  key={building.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHubBuildingClick(building);
                  }}
                  className="cursor-pointer"
                  style={{ pointerEvents: 'all' }}
                >
                  <motion.rect
                    x={bx - 12}
                    y={by - 8}
                    width={24}
                    height={16}
                    rx={4}
                    fill={building.color}
                    stroke={building.accent}
                    strokeWidth={1}
                    opacity={0.9}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  />
                  <text x={bx} y={by + 20} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="6" style={{ pointerEvents: 'none' }}>
                    {building.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* League Islands */}
        {leagueIslands.map((island, islandIndex) => {
          const isHovered = hoveredIsland === island.id;
          const league = island.league;
          const isFull = (island.teamCount || 0) >= (island.maxTeams || 12);
          const bobDelay = islandIndex * 0.5;
          
          return (
            <g
              key={island.id}
              onClick={() => handleIslandClick(island)}
              onMouseEnter={() => setHoveredIsland(island.id)}
              onMouseLeave={() => setHoveredIsland(null)}
              className="cursor-pointer"
            >
              {/* Island shadow */}
              <ellipse cx={island.x + 6} cy={island.y + 8} rx={island.size * 52} ry={island.size * 36} fill="rgba(0,0,0,0.4)" filter="url(#shadow)" />
              
              {/* Animated waterline */}
              <motion.ellipse
                cx={island.x}
                cy={island.y + 2}
                rx={island.size * 52}
                ry={island.size * 36}
                fill="none"
                stroke="rgba(56, 189, 248, 0.15)"
                strokeWidth={1.5}
                animate={{ rx: [island.size * 52, island.size * 55, island.size * 52] }}
                transition={{ duration: 3 + islandIndex * 0.3, repeat: Infinity, ease: 'easeInOut', delay: bobDelay }}
              />
              
              {/* Island body with gentle bob (staggered) */}
              <motion.g
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 4 + islandIndex * 0.4, repeat: Infinity, ease: 'easeInOut', delay: bobDelay }}
              >
                <ellipse
                  cx={island.x}
                  cy={island.y}
                  rx={island.size * 50}
                  ry={island.size * 35}
                  fill={island.color}
                  stroke={isHovered ? '#fff' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={isHovered ? 2.5 : 1}
                  filter="url(#islandGlow)"
                />
                
                {/* Island texture */}
                <ellipse
                  cx={island.x}
                  cy={island.y + 8}
                  rx={island.size * 42}
                  ry={island.size * 25}
                  fill="rgba(255,255,255,0.08)"
                />
                
                {/* Vegetation */}
                {Array.from({ length: 8 }).map((_, i) => {
                  const tx = island.x + Math.sin(i * 2.4 + islandIndex) * island.size * 25;
                  const ty = island.y + Math.cos(i * 1.9 + islandIndex) * island.size * 15;
                  return (
                    <circle
                      key={i}
                      cx={tx}
                      cy={ty}
                      r={1.5 + (i % 2)}
                      fill="#4ade80"
                      opacity={0.25}
                    />
                  );
                })}

                {/* Stadium icon on island */}
                <g transform={`translate(${island.x - 8}, ${island.y - 12})`}>
                  <rect x={0} y={0} width={16} height={10} rx={2} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
                  <rect x={2} y={2} width={12} height={6} rx={1} fill="rgba(255,255,255,0.1)" />
                  {/* Small light on stadium */}
                  <motion.circle
                    cx={8}
                    cy={-2}
                    r={2}
                    fill="#fbbf24"
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </g>
              </motion.g>

              {/* Island name */}
              <text x={island.x} y={island.y - island.size * 42} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" style={{ pointerEvents: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                {island.name}
              </text>
              
              {/* Tier label */}
              {league && (
                <text x={island.x} y={island.y - island.size * 30} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" style={{ pointerEvents: 'none' }}>
                  {TIER_LABELS[league.tier] || league.tier}
                </text>
              )}

              {/* Team count / capacity */}
              <text x={island.x} y={island.y + island.size * 40} textAnchor="middle" fill={isFull ? '#f87171' : 'rgba(255,255,255,0.5)'} fontSize="8" style={{ pointerEvents: 'none' }}>
                {island.teamCount || 0} / {island.maxTeams || 12} teams
              </text>

              {/* Visibility badge */}
              {league && league.visibility !== 'PUBLIC' && (
                <g transform={`translate(${island.x + island.size * 35}, ${island.y - island.size * 25})`}>
                  <circle r={6} fill={league.visibility === 'PRIVATE' ? '#ef4444' : '#f59e0b'} />
                  <text y={2} textAnchor="middle" fill="white" fontSize={5}>
                    {league.visibility === 'PRIVATE' ? '🔒' : '⭐'}
                  </text>
                </g>
              )}

              {/* Animated player dots (small avatars walking around island) */}
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={island.x + (Math.sin(i * 2.1) * island.size * 25)}
                  cy={island.y + (Math.cos(i * 1.7) * island.size * 15)}
                  r={3}
                  fill={['#E94560', '#3b82f6', '#fbbf24'][i]}
                  opacity={0.7}
                  animate={{
                    cx: [
                      island.x + (Math.sin(i * 2.1) * island.size * 25),
                      island.x + (Math.sin(i * 2.1 + 0.5) * island.size * 25),
                      island.x + (Math.sin(i * 2.1) * island.size * 25),
                    ],
                    cy: [
                      island.y + (Math.cos(i * 1.7) * island.size * 15),
                      island.y + (Math.cos(i * 1.7 + 0.3) * island.size * 15),
                      island.y + (Math.cos(i * 1.7) * island.size * 15),
                    ],
                  }}
                  transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend / Info panel */}
      <div className="absolute bottom-4 left-4 glass-card px-4 py-3 rounded-xl">
        <div className="text-xs text-white/50 mb-2 font-semibold uppercase tracking-wider">World Map</div>
        <div className="flex items-center gap-4 text-xs text-white/60">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#4ade80]" /> Hub
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#fbbf24]" /> League
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#E94560]" /> Players
          </span>
        </div>
      </div>

      {/* Island tooltip on hover */}
      <AnimatePresence>
        {hoveredIsland && (() => {
          const island = islands.find((i) => i.id === hoveredIsland);
          if (!island || island.type === 'HUB') return null;
          const league = island.league;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-4 right-4 glass-card p-4 rounded-xl max-w-xs"
            >
              <h3 className="font-bold text-white text-sm">{island.name}</h3>
              {league && (
                <div className="mt-2 space-y-1 text-xs text-white/60">
                  <div className="flex justify-between">
                    <span>Tier</span>
                    <span className="text-white">{TIER_LABELS[league.tier] || league.tier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>OVR Range</span>
                    <span className="text-white">{league.minOverall}-{league.maxOverall}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Teams</span>
                    <span className="text-white">{island.teamCount || 0} / {island.maxTeams || 12}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Type</span>
                    <span className="text-white capitalize">{league.visibility.toLowerCase()}</span>
                  </div>
                  {league.creator && (
                    <div className="flex justify-between">
                      <span>Founder</span>
                      <span className="text-white">{league.creator.displayName || league.creator.username}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 text-xs text-[#E94560] font-medium flex items-center gap-1">
                Click to explore <ArrowRight className="w-3 h-3" />
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
