import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TravelVehicles from '../../components/travel/TravelVehicles';
import { useMatchDay } from '../../components/match/MatchDaySystem';
import { useTraining } from '../../components/training/TrainingSystem';
import { useAuthStore } from '../../store/authStore';
import { useWorld } from './WorldSystem';
import { usePanels, PanelOverlay } from './PanelSystem';
import IslandWorldMap from './IslandWorldMap';
import IsometricBuilding from './IsometricBuilding';
import IsometricAvatar, { type AvatarState } from './IsometricAvatar';
import PlayerStadiumSVG from './PlayerStadiumSVG';
import { FloatingParticles, Fireflies, SmokePuff, GrassTufts } from './AmbientEffects';
import {
  LayoutDashboard, Dumbbell, ShoppingCart, Trophy, Wallet, Globe, Shirt, Map
} from 'lucide-react';

// Import all page components for panels
import CityPage from '../../pages/CityPage';
import MarketplacePage from '../../pages/MarketplacePage';
import LeaderboardPage from '../../pages/LeaderboardPage';
import WalletPage from '../../pages/WalletPage';
import TrainingPage from '../../pages/TrainingPage';
import EquipmentPage from '../../pages/EquipmentPage';
import WorldMapPage from '../../pages/WorldMapPage';
import StadiumInteriorPage from '../../pages/StadiumInteriorPage';

interface CommunityBuilding {
  id: string;
  label: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  color: string;
  accent: string;
  variant: 'hq' | 'shop' | 'training' | 'bank' | 'generic' | 'stadium';
  panelWidth: number;
  panelHeight: number;
  getContent: () => React.ReactNode;
}

const COMMUNITY_BUILDINGS: CommunityBuilding[] = [
  {
    id: 'dashboard', label: 'HQ', route: '/dashboard', icon: LayoutDashboard,
    x: 130, y: 90, width: 70, height: 55, depth: 35, color: '#0f172a', accent: '#E94560',
    variant: 'hq', panelWidth: 700, panelHeight: 500,
    getContent: () => <CityPage />,
  },
  {
    id: 'market', label: 'Market', route: '/marketplace', icon: ShoppingCart,
    x: 280, y: 70, width: 70, height: 50, depth: 35, color: '#3f2e0f', accent: '#f59e0b',
    variant: 'shop', panelWidth: 800, panelHeight: 600,
    getContent: () => <MarketplacePage />,
  },
  {
    id: 'training', label: 'Training', route: '/training', icon: Dumbbell,
    x: 430, y: 90, width: 70, height: 52, depth: 35, color: '#3f0f3f', accent: '#a855f7',
    variant: 'training', panelWidth: 700, panelHeight: 550,
    getContent: () => <TrainingPage />,
  },
  {
    id: 'leaderboard', label: 'Hall of Fame', route: '/leaderboard', icon: Trophy,
    x: 570, y: 70, width: 75, height: 58, depth: 38, color: '#2a1a0a', accent: '#fbbf24',
    variant: 'generic', panelWidth: 700, panelHeight: 550,
    getContent: () => <LeaderboardPage />,
  },
  {
    id: 'wallet', label: 'Bank', route: '/wallet', icon: Wallet,
    x: 720, y: 90, width: 70, height: 55, depth: 35, color: '#3f2e0f', accent: '#eab308',
    variant: 'bank', panelWidth: 600, panelHeight: 500,
    getContent: () => <WalletPage />,
  },
  {
    id: 'world', label: 'Travel Hub', route: '/world-map', icon: Globe,
    x: 860, y: 70, width: 70, height: 50, depth: 35, color: '#0c2e4e', accent: '#06b6d4',
    variant: 'generic', panelWidth: 900, panelHeight: 600,
    getContent: () => <WorldMapPage />,
  },
  {
    id: 'locker', label: 'Locker', route: '/locker', icon: Shirt,
    x: 130, y: 200, width: 70, height: 50, depth: 35, color: '#1a1a2e', accent: '#64748b',
    variant: 'generic', panelWidth: 800, panelHeight: 600,
    getContent: () => <EquipmentPage />,
  },
];

const COMMUNITY_ROADS = [
  { from: 'dashboard', to: 'market' },
  { from: 'market', to: 'training' },
  { from: 'training', to: 'leaderboard' },
  { from: 'leaderboard', to: 'wallet' },
  { from: 'wallet', to: 'world' },
];

function getRoadPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  const midY = Math.max(y1, y2) + 15;
  return `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
}

function getFacingDirection(fromX: number, fromY: number, toX: number, toY: number): 'left' | 'right' | 'up' | 'down' {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

export default function GameShell() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { openPanel } = usePanels();
  const { myHomeMatches } = useMatchDay();
  const { isTraining } = useTraining();
  const { onlinePlayers, myStadium, otherStadiums } = useWorld();
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>({
    x: 130, y: 77, isMoving: false, facing: 'right', username: 'You', color: '#E94560',
  });
  const [isMoving, setIsMoving] = useState(false);
  const [activeView, setActiveView] = useState<'hub' | 'islands'>('islands');

  const handleBuildingClick = useCallback((building: CommunityBuilding) => {
    if (isMoving) return;
    setIsMoving(true);
    setHoveredBuilding(null);

    const targetX = building.x;
    const targetY = building.y + building.depth * 0.5;
    const facing = getFacingDirection(avatarState.x, avatarState.y, targetX, targetY);

    setAvatarState(prev => ({ ...prev, isMoving: true, facing, x: targetX, y: targetY }));

    setTimeout(() => {
      setIsMoving(false);
      setAvatarState(prev => ({ ...prev, isMoving: false }));
      openPanel({
        id: building.id,
        title: building.label,
        buildingId: building.id,
        x: 100 + Math.random() * 200,
        y: 60 + Math.random() * 100,
        width: building.panelWidth,
        height: building.panelHeight,
        minimized: false,
        maximized: false,
        content: building.getContent(),
      });
    }, 700);
  }, [isMoving, openPanel, avatarState.x, avatarState.y]);

  const handleStadiumClick = useCallback(() => {
    openPanel({
      id: 'my-stadium',
      title: 'My Stadium',
      buildingId: 'stadium',
      x: 150 + Math.random() * 100,
      y: 80 + Math.random() * 50,
      width: 900,
      height: 650,
      minimized: false,
      maximized: false,
      content: <StadiumInteriorPage />,
    });
  }, [openPanel]);

  const handleOtherStadiumClick = useCallback((stadium: any) => {
    openPanel({
      id: `stadium-${stadium.venueId}`,
      title: stadium.venueName,
      buildingId: 'stadium',
      x: 150 + Math.random() * 100,
      y: 80 + Math.random() * 50,
      width: 700,
      height: 500,
      minimized: false,
      maximized: false,
      content: (
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-4">{stadium.venueName}</h2>
          <p className="text-white/60">Owner: {stadium.ownerUsername}</p>
          <p className="text-white/60">Capacity: {stadium.capacity.toLocaleString()}</p>
          <p className="text-white/60">Condition: {stadium.condition}%</p>
          <p className="text-white/60">Tier: {stadium.tier}</p>
          {stadium.liveMatch && (
            <div className="mt-4 p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <p className="text-red-400 font-bold">LIVE MATCH</p>
              <p className="text-white">{stadium.liveMatch.homeTeamName} {stadium.liveMatch.homeScore} - {stadium.liveMatch.awayScore} {stadium.liveMatch.awayTeamName}</p>
            </div>
          )}
        </div>
      ),
    });
  }, [openPanel]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E94560]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  const buildingPositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number; width: number; height: number }> = {};
    COMMUNITY_BUILDINGS.forEach((b) => {
      pos[b.id] = { x: b.x, y: b.y + b.depth * 0.5, width: b.width, height: b.height };
    });
    return pos;
  }, []);

  // Convert online players to AvatarState format
  const worldPlayers: AvatarState[] = useMemo(() => {
    return onlinePlayers.map(p => ({
      x: p.x,
      y: p.y,
      isMoving: p.isMoving,
      facing: p.targetX > p.x ? 'right' : p.targetX < p.x ? 'left' : p.targetY > p.y ? 'down' : 'up',
      username: p.username,
      color: p.avatarColor,
      teamColor: p.avatarColor,
    }));
  }, [onlinePlayers]);

  // Ground decoration points
  const grassPoints = useMemo(() => [
    { x: 200, y: 300 }, { x: 450, y: 320 }, { x: 700, y: 280 },
    { x: 850, y: 340 }, { x: 100, y: 350 }, { x: 600, y: 380 },
  ], []);

  const smokePoints = useMemo(() => [
    { x: 430, y: 55 }, { x: 570, y: 45 }, { x: 280, y: 45 },
  ], []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0f1a]">
      {/* Top Navigation */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2 bg-[#0a0f1a]/80 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="text-white font-black text-lg tracking-tight">
            GRID <span className="text-[#E94560]">SPORTS</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('islands')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeView === 'islands' ? 'bg-[#E94560] text-white' : 'bg-white/5 text-white/40 hover:text-white/60'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            World Map
          </button>
          <button
            onClick={() => setActiveView('hub')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeView === 'hub' ? 'bg-[#E94560] text-white' : 'bg-white/5 text-white/40 hover:text-white/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Community Hub
          </button>
        </div>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {activeView === 'islands' ? (
          <motion.div
            key="islands"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pt-10"
          >
            <IslandWorldMap />
          </motion.div>
        ) : (
          <motion.div
            key="hub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pt-10"
          >
            <svg viewBox="0 0 1000 500" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                {/* Ground tile pattern */}
                <pattern id="grass" width="60" height="60" patternUnits="userSpaceOnUse">
                  <rect width="60" height="60" fill="#0d1520" />
                  <path d="M 0 30 L 30 0 L 60 30 L 30 60 Z" fill="#0f1725" opacity="0.5" />
                  <circle cx="30" cy="30" r="1" fill="#1a2535" opacity="0.4" />
                  <circle cx="15" cy="15" r="0.5" fill="#1a2535" opacity="0.2" />
                  <circle cx="45" cy="45" r="0.5" fill="#1a2535" opacity="0.2" />
                </pattern>
                
                {/* Atmospheric vignette */}
                <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stopColor="rgba(0,0,0,0)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
                </radialGradient>
                
                {/* Glow filter for active buildings */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background ground */}
              <rect width="1000" height="500" fill="url(#grass)" />
              <rect width="1000" height="500" fill="url(#vignette)" pointerEvents="none" />
              
              {/* District labels */}
              <text x="500" y="22" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold" letterSpacing="2" style={{ pointerEvents: 'none' }}>
                COMMUNITY DISTRICT
              </text>
              <text x="500" y="200" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold" letterSpacing="2" style={{ pointerEvents: 'none' }}>
                MY STADIUM
              </text>
              <text x="500" y="420" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold" letterSpacing="2" style={{ pointerEvents: 'none' }}>
                OTHER STADIUMS
              </text>

              <line x1="20" y1="150" x2="980" y2="150" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
              <line x1="20" y1="400" x2="980" y2="400" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

              {/* Ambient floating particles */}
              <FloatingParticles width={1000} height={500} particleCount={25} />
              <Fireflies width={1000} height={500} fireflies={12} />

              {/* Road paths */}
              <g opacity="0.3">
                {COMMUNITY_ROADS.map((road, i) => {
                  const from = buildingPositions[road.from];
                  const to = buildingPositions[road.to];
                  if (!from || !to) return null;
                  return (
                    <path
                      key={i}
                      d={getRoadPath(from.x, from.y, to.x, to.y)}
                      fill="none"
                      stroke="#475569"
                      strokeWidth="4"
                      strokeDasharray="6 4"
                      opacity="0.6"
                    />
                  );
                })}
              </g>

              <TravelVehicles buildingPositions={buildingPositions} roadPaths={{}} />

              {/* Grass tufts */}
              {grassPoints.map((gp, i) => (
                <GrassTufts key={i} x={gp.x} y={gp.y} count={4 + (i % 3)} />
              ))}

              {/* Community Buildings */}
              {COMMUNITY_BUILDINGS.map((building) => (
                <IsometricBuilding
                  key={building.id}
                  id={building.id}
                  label={building.label}
                  x={building.x}
                  y={building.y}
                  width={building.width}
                  height={building.height}
                  depth={building.depth}
                  color={building.color}
                  accent={building.accent}
                  variant={building.variant}
                  isHovered={hoveredBuilding === building.id}
                  isActive={building.id === 'training' && isTraining}
                  onClick={() => handleBuildingClick(building)}
                  onHover={setHoveredBuilding}
                />
              ))}

              {/* Smoke from buildings */}
              {smokePoints.map((sp, i) => (
                <SmokePuff key={i} x={sp.x} y={sp.y} color="#475569" />
              ))}

              {/* My Stadium */}
              {myStadium ? (
                <PlayerStadiumSVG
                  stadium={myStadium}
                  x={500}
                  y={250}
                  isMyStadium={true}
                  isHovered={hoveredBuilding === 'my-stadium'}
                  onClick={handleStadiumClick}
                  onHover={setHoveredBuilding}
                />
              ) : (
                <g
                  onClick={handleStadiumClick}
                  onMouseEnter={() => setHoveredBuilding('my-stadium')}
                  onMouseLeave={() => setHoveredBuilding(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect x="440" y="200" width="120" height="85" rx="8" fill="#1e293b" stroke="#64748b" strokeWidth="1" opacity="0.5" />
                  <text x="500" y="245" textAnchor="middle" fill="#64748b" fontSize="12">No Stadium Yet</text>
                </g>
              )}

              {/* Other Stadiums */}
              {otherStadiums.map((stadium) => (
                <PlayerStadiumSVG
                  key={stadium.venueId}
                  stadium={stadium}
                  x={stadium.x}
                  y={stadium.y}
                  isMyStadium={false}
                  isHovered={hoveredBuilding === `stadium-${stadium.venueId}`}
                  onClick={() => handleOtherStadiumClick(stadium)}
                  onHover={setHoveredBuilding}
                />
              ))}

              {/* Other players with isometric avatars */}
              {worldPlayers.map((player) => (
                <IsometricAvatar
                  key={player.username}
                  player={player}
                  scale={0.8}
                />
              ))}

              {/* Player avatar (You) */}
              <IsometricAvatar
                player={avatarState}
                scale={1}
              />

              {/* Live match light beams */}
              <AnimatePresence>
                {myStadium?.liveMatch?.status === 'PLAYING' && (
                  <motion.g initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                    <polygon points="500,200 480,280 520,280" fill="#E94560" opacity="0.15" />
                    <polygon points="500,200 450,280 480,280" fill="#E94560" opacity="0.1" />
                    <polygon points="500,200 520,280 550,280" fill="#E94560" opacity="0.1" />
                  </motion.g>
                )}
              </AnimatePresence>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 h-10 bg-[#0a0f1a]/80 border-t border-white/5 flex items-center px-4 gap-6 text-xs text-slate-500 z-10">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          {onlinePlayers.length + 1} players online
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#E94560]"></span>
          {myHomeMatches.length} home matches
        </span>
        <span className="ml-auto text-slate-600">Press ESC to close panels</span>
      </div>

      <PanelOverlay />
    </div>
  );
}
