import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TravelVehicles from '../../components/travel/TravelVehicles';
import { useMatchDay } from '../../components/match/MatchDaySystem';
import { useTraining } from '../../components/training/TrainingSystem';
import { useAuthStore } from '../../store/authStore';
import { useWorld } from './WorldSystem';
import { usePanels, PanelOverlay } from './PanelSystem';
import IslandWorldMap from './IslandWorldMap';
import CommunityBuildingSVG from './CommunityBuildingSVG';
import PlayerStadiumSVG from './PlayerStadiumSVG';
import PlayerAvatarSVG from './PlayerAvatarSVG';
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
  color: string;
  accent: string;
  panelWidth: number;
  panelHeight: number;
  getContent: () => React.ReactNode;
}

const COMMUNITY_BUILDINGS: CommunityBuilding[] = [
  {
    id: 'dashboard', label: 'HQ', route: '/dashboard', icon: LayoutDashboard,
    x: 60, y: 40, width: 100, height: 75, color: '#0f172a', accent: '#E94560',
    panelWidth: 700, panelHeight: 500,
    getContent: () => <CityPage />,
  },
  {
    id: 'market', label: 'Market', route: '/marketplace', icon: ShoppingCart,
    x: 190, y: 40, width: 100, height: 75, color: '#3f2e0f', accent: '#f59e0b',
    panelWidth: 800, panelHeight: 600,
    getContent: () => <MarketplacePage />,
  },
  {
    id: 'training', label: 'Training', route: '/training', icon: Dumbbell,
    x: 320, y: 40, width: 100, height: 75, color: '#3f0f3f', accent: '#a855f7',
    panelWidth: 700, panelHeight: 550,
    getContent: () => <TrainingPage />,
  },
  {
    id: 'leaderboard', label: 'Hall of Fame', route: '/leaderboard', icon: Trophy,
    x: 450, y: 40, width: 110, height: 75, color: '#2a1a0a', accent: '#fbbf24',
    panelWidth: 700, panelHeight: 550,
    getContent: () => <LeaderboardPage />,
  },
  {
    id: 'wallet', label: 'Bank', route: '/wallet', icon: Wallet,
    x: 590, y: 40, width: 100, height: 75, color: '#3f2e0f', accent: '#eab308',
    panelWidth: 600, panelHeight: 500,
    getContent: () => <WalletPage />,
  },
  {
    id: 'world', label: 'Travel Hub', route: '/world-map', icon: Globe,
    x: 720, y: 40, width: 100, height: 75, color: '#0c2e4e', accent: '#06b6d4',
    panelWidth: 900, panelHeight: 600,
    getContent: () => <WorldMapPage />,
  },
  {
    id: 'locker', label: 'Locker', route: '/locker', icon: Shirt,
    x: 850, y: 40, width: 90, height: 75, color: '#1a1a2e', accent: '#64748b',
    panelWidth: 800, panelHeight: 600,
    getContent: () => <EquipmentPage />,
  },
];

const COMMUNITY_ROADS = [
  { from: 'dashboard', to: 'market' },
  { from: 'market', to: 'training' },
  { from: 'training', to: 'leaderboard' },
  { from: 'leaderboard', to: 'wallet' },
  { from: 'wallet', to: 'world' },
  { from: 'world', to: 'locker' },
];

// Generate road path between two points
function getRoadPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  const midY = Math.max(y1, y2) + 15;
  return `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
}

function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

export default function GameShell() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { openPanel } = usePanels();
  const { myHomeMatches } = useMatchDay();
  const { isTraining } = useTraining();
  const { onlinePlayers, myStadium, otherStadiums } = useWorld();
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [avatarPos, setAvatarPos] = useState({ x: 110, y: 77 });
  const [isMoving, setIsMoving] = useState(false);
  const [activeView, setActiveView] = useState<'hub' | 'islands'>('islands');
  const avatarColor = useMemo(() => hashToColor(user?.id || 'guest'), [user?.id]);

  const handleBuildingClick = useCallback((building: CommunityBuilding) => {
    if (isMoving) return;
    setIsMoving(true);
    setHoveredBuilding(null);

    const targetX = building.x + building.width / 2;
    const targetY = building.y + building.height - 10;
    setAvatarPos({ x: targetX, y: targetY });

    setTimeout(() => {
      setIsMoving(false);
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
    }, 600);
  }, [isMoving, openPanel]);

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
      pos[b.id] = { x: b.x + b.width / 2, y: b.y + b.height - 5, width: b.width, height: b.height };
    });
    return pos;
  }, []);

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
            <svg viewBox="0 0 1000 700" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="grass" width="40" height="40" patternUnits="userSpaceOnUse">
                  <rect width="40" height="40" fill="#0a0f1a" />
                  <circle cx="20" cy="20" r="1" fill="#1a2332" opacity="0.5" />
                  <circle cx="5" cy="5" r="0.5" fill="#1a2332" opacity="0.3" />
                  <circle cx="35" cy="35" r="0.5" fill="#1a2332" opacity="0.3" />
                </pattern>
                <pattern id="stars" width="100" height="100" patternUnits="userSpaceOnUse">
                  <circle cx="50" cy="50" r="0.8" fill="#ffffff" opacity="0.15" />
                  <circle cx="20" cy="80" r="0.5" fill="#ffffff" opacity="0.1" />
                  <circle cx="80" cy="20" r="0.5" fill="#ffffff" opacity="0.1" />
                  <circle cx="10" cy="30" r="0.3" fill="#ffffff" opacity="0.2" />
                  <circle cx="70" cy="70" r="0.3" fill="#ffffff" opacity="0.2" />
                  <circle cx="90" cy="10" r="0.6" fill="#ffffff" opacity="0.1" />
                </pattern>
              </defs>

              <rect width="1000" height="700" fill="url(#grass)" />
              <rect width="1000" height="700" fill="url(#stars)" />

              <text x="500" y="22" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold" letterSpacing="2">
                COMMUNITY DISTRICT
              </text>
              <text x="500" y="200" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold" letterSpacing="2">
                MY STADIUM
              </text>
              <text x="500" y="500" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold" letterSpacing="2">
                OTHER STADIUMS
              </text>

              <line x1="20" y1="150" x2="980" y2="150" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
              <line x1="20" y1="480" x2="980" y2="480" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

              <g opacity="0.4">
                {COMMUNITY_ROADS.map((road, i) => {
                  const from = buildingPositions[road.from];
                  const to = buildingPositions[road.to];
                  if (!from || !to) return null;
                  return (
                    <path
                      key={i}
                      d={getRoadPath(from.x, from.y, to.x, to.y)}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                    />
                  );
                })}
              </g>

              <TravelVehicles buildingPositions={buildingPositions} roadPaths={{}} />

              {COMMUNITY_BUILDINGS.map((building) => (
                <CommunityBuildingSVG
                  key={building.id}
                  {...building}
                  isHovered={hoveredBuilding === building.id}
                  onClick={() => handleBuildingClick(building)}
                  onHover={setHoveredBuilding}
                  isActive={building.id === 'training' && isTraining}
                />
              ))}

              {myStadium ? (
                <PlayerStadiumSVG
                  stadium={myStadium}
                  x={380}
                  y={220}
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
                  <rect x="380" y="220" width="120" height="85" rx="8" fill="#1e293b" stroke="#64748b" strokeWidth="1" opacity="0.5" />
                  <text x="440" y="265" textAnchor="middle" fill="#64748b" fontSize="12">No Stadium Yet</text>
                </g>
              )}

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

              {onlinePlayers.map((player) => (
                <PlayerAvatarSVG
                  key={player.userId}
                  player={player}
                />
              ))}

              <g transform={`translate(${avatarPos.x}, ${avatarPos.y})`} style={{ cursor: 'pointer' }}>
                <text x="0" y="-18" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="bold">You</text>
                <circle cx="0" cy="-8" r="7" fill={avatarColor} opacity="0.9" />
                <circle cx="0" cy="-16" r="5" fill={avatarColor} />
                {isMoving && (
                  <motion.g animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 0.8, repeat: Infinity }}>
                    <circle cx="0" cy="4" r="2" fill={avatarColor} opacity="0.5" />
                    <circle cx="-6" cy="6" r="1.5" fill={avatarColor} opacity="0.3" />
                    <circle cx="6" cy="6" r="1.5" fill={avatarColor} opacity="0.3" />
                  </motion.g>
                )}
              </g>

              <AnimatePresence>
                {myStadium?.liveMatch?.status === 'PLAYING' && (
                  <motion.g initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                    <polygon points="500,220 480,300 520,300" fill="#E94560" opacity="0.15" />
                    <polygon points="500,220 450,300 480,300" fill="#E94560" opacity="0.1" />
                    <polygon points="500,220 520,300 550,300" fill="#E94560" opacity="0.1" />
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
