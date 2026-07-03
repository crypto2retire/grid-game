import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePanels } from './PanelSystem';
import { useAuthStore } from '../../store/authStore';
import { useWorld } from './WorldSystem';
import { useMatchDay } from '../../components/match/MatchDaySystem';
import IsometricBuilding from './IsometricBuilding';
import IsometricAvatar, { type AvatarState } from './IsometricAvatar';
import PlayerStadiumSVG from './PlayerStadiumSVG';
import { FloatingParticles, Fireflies } from './AmbientEffects';
import CityPage from '../../pages/CityPage';
import MarketplacePage from '../../pages/MarketplacePage';
import LeaderboardPage from '../../pages/LeaderboardPage';
import WalletPage from '../../pages/WalletPage';
import TrainingPage from '../../pages/TrainingPage';
import EquipmentPage from '../../pages/EquipmentPage';
import LeagueIslandPage from '../../pages/LeagueIslandPage';
import StadiumInteriorPage from '../../pages/StadiumInteriorPage';
import {
  MessageSquare, X, MapPin, Users, Compass, Hand
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
//  WORLD CONSTANTS
// ═══════════════════════════════════════════════════════════
const WW = 2400;
const WH = 1600;

// ═══════════════════════════════════════════════════════════
//  ISLANDS — Hub + 6 League Islands
// ═══════════════════════════════════════════════════════════
interface Island {
  id: string;
  name: string;
  type: 'HUB' | 'LEAGUE';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  accent: string;
  ground: string;
  tier?: string;
  stadiumSlots?: { x: number; y: number }[]; // pre-defined positions for stadiums on this island
}

const ISLANDS: Island[] = [
  { id: 'hub', name: 'Grid City Central', type: 'HUB', x: 0, y: 0, w: 600, h: 400, color: '#f97316', accent: '#ea580c', ground: '#7ec850', tier: undefined },
  { id: 'state', name: 'State College', type: 'LEAGUE', x: -550, y: -350, w: 280, h: 200, color: '#86efac', accent: '#22c55e', ground: '#6db840', tier: 'STATE_COLLEGE' },
  { id: 'mid', name: 'Mid-College', type: 'LEAGUE', x: 550, y: -350, w: 280, h: 200, color: '#67e8f9', accent: '#06b6d4', ground: '#6db840', tier: 'MID_COLLEGE' },
  { id: 'top', name: 'Top College', type: 'LEAGUE', x: 0, y: -550, w: 280, h: 200, color: '#fde047', accent: '#eab308', ground: '#6db840', tier: 'TOP_COLLEGE' },
  { id: 'regional', name: 'Regional Pro', type: 'LEAGUE', x: 550, y: 0, w: 280, h: 200, color: '#c4b5fd', accent: '#7c3aed', ground: '#6db840', tier: 'REGIONAL_PRO' },
  { id: 'pro', name: 'Pro Entry', type: 'LEAGUE', x: -550, y: 350, w: 280, h: 200, color: '#fda4af', accent: '#e11d48', ground: '#6db840', tier: 'PRO_ENTRY' },
  { id: 'elite', name: 'Pro Elite', type: 'LEAGUE', x: 550, y: 350, w: 280, h: 200, color: '#fca5a5', accent: '#dc2626', ground: '#6db840', tier: 'PRO_ELITE' },
];

// Map tier to island for placing stadiums
const TIER_TO_ISLAND: Record<string, string> = {
  'STATE_COLLEGE': 'state',
  'MID_COLLEGE': 'mid',
  'TOP_COLLEGE': 'top',
  'REGIONAL_PRO': 'regional',
  'PRO_ENTRY': 'pro',
  'PRO_ELITE': 'elite',
  'shack': 'state',
  'basic': 'state',
  'standard': 'mid',
  'premium': 'regional',
  'elite': 'pro',
  'legendary': 'elite',
};

function getIsland(id: string): Island {
  return ISLANDS.find(i => i.id === id) || ISLANDS[0];
}

function getIslandByPosition(x: number, y: number): Island | null {
  return ISLANDS.find(island => {
    const dx = x - island.x;
    const dy = y - island.y;
    return (dx * dx) / ((island.w / 2) * (island.w / 2)) + (dy * dy) / ((island.h / 2) * (island.h / 2)) <= 1;
  }) || null;
}

// Distribute stadiums in a scattered cluster around an island with varying distances
function getStadiumPositionOnIsland(island: Island, index: number, total: number): { x: number; y: number } {
  if (island.type === 'HUB') {
    // Place below the hub buildings
    const cols = Math.min(total, 3);
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      x: island.x - 120 + col * 120,
      y: island.y + 120 + row * 90,
    };
  }
  // Vary the radius so some stadiums are closer, some farther out
  // Use alternating radii to create a scattered cluster rather than a perfect circle
  const radii = [0.42, 0.58, 0.35, 0.72, 0.50, 0.65, 0.38, 0.80];
  const radiusFactor = radii[index % radii.length];
  // Spread angle with small jitter so it's not perfectly even
  const baseAngle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  const jitter = (index * 0.7) * 0.15; // each stadium gets a unique angular offset
  const angle = baseAngle + jitter;
  const rx = island.w * radiusFactor;
  const ry = island.h * radiusFactor;
  return {
    x: island.x + Math.cos(angle) * rx,
    y: island.y + Math.sin(angle) * ry,
  };
}

// ═══════════════════════════════════════════════════════════
//  BUILDINGS
// ═══════════════════════════════════════════════════════════
interface WorldBuilding {
  id: string;
  label: string;
  islandId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  color: string;
  accent: string;
  variant: 'hq' | 'shop' | 'training' | 'bank' | 'generic' | 'stadium';
  panelWidth: number;
  panelHeight: number;
  getContent: () => React.ReactNode;
}

const BUILDINGS: WorldBuilding[] = [
  { id: 'hq', label: 'HQ', islandId: 'hub', x: -180, y: -80, w: 70, h: 55, d: 35, color: '#0f172a', accent: '#E94560', variant: 'hq', panelWidth: 700, panelHeight: 500, getContent: () => <CityPage /> },
  { id: 'market', label: 'Market', islandId: 'hub', x: -60, y: -100, w: 70, h: 50, d: 35, color: '#3f2e0f', accent: '#f59e0b', variant: 'shop', panelWidth: 800, panelHeight: 600, getContent: () => <MarketplacePage /> },
  { id: 'training', label: 'Training', islandId: 'hub', x: 60, y: -100, w: 70, h: 52, d: 35, color: '#3f0f3f', accent: '#a855f7', variant: 'training', panelWidth: 700, panelHeight: 550, getContent: () => <TrainingPage /> },
  { id: 'hof', label: 'Hall of Fame', islandId: 'hub', x: 180, y: -80, w: 75, h: 58, d: 38, color: '#2a1a0a', accent: '#fbbf24', variant: 'generic', panelWidth: 700, panelHeight: 550, getContent: () => <LeaderboardPage /> },
  { id: 'bank', label: 'Bank', islandId: 'hub', x: 180, y: 60, w: 70, h: 55, d: 35, color: '#3f2e0f', accent: '#eab308', variant: 'bank', panelWidth: 600, panelHeight: 500, getContent: () => <WalletPage /> },
  { id: 'locker', label: 'Locker', islandId: 'hub', x: 60, y: 80, w: 70, h: 50, d: 35, color: '#1a1a2e', accent: '#64748b', variant: 'generic', panelWidth: 800, panelHeight: 600, getContent: () => <EquipmentPage /> },
  { id: 'travel', label: 'Travel', islandId: 'hub', x: -60, y: 80, w: 70, h: 50, d: 35, color: '#0c2e4e', accent: '#06b6d4', variant: 'generic', panelWidth: 900, panelHeight: 600, getContent: () => <CityPage /> },

  // League stadiums (admin/market buildings on league islands)
  { id: 'stm-state', label: 'State Stadium', islandId: 'state', x: 0, y: 0, w: 90, h: 70, d: 45, color: '#1a2e1a', accent: '#22c55e', variant: 'stadium', panelWidth: 900, panelHeight: 650, getContent: () => <LeagueIslandPage islandId="island-state-001" leagueId="league-state-001" /> },
  { id: 'stm-mid', label: 'Mid Stadium', islandId: 'mid', x: 0, y: 0, w: 90, h: 70, d: 45, color: '#0a2e2e', accent: '#06b6d4', variant: 'stadium', panelWidth: 900, panelHeight: 650, getContent: () => <LeagueIslandPage islandId="island-mid-001" leagueId="league-mid-001" /> },
  { id: 'stm-top', label: 'Top Stadium', islandId: 'top', x: 0, y: 0, w: 90, h: 70, d: 45, color: '#2e2a0a', accent: '#d97706', variant: 'stadium', panelWidth: 900, panelHeight: 650, getContent: () => <LeagueIslandPage islandId="island-top-001" leagueId="league-top-001" /> },
  { id: 'stm-regional', label: 'Regional Stadium', islandId: 'regional', x: 0, y: 0, w: 90, h: 70, d: 45, color: '#1a1a2e', accent: '#475569', variant: 'stadium', panelWidth: 900, panelHeight: 650, getContent: () => <LeagueIslandPage islandId="island-regional-001" leagueId="league-regional-001" /> },
  { id: 'stm-pro', label: 'Pro Stadium', islandId: 'pro', x: 0, y: 0, w: 90, h: 70, d: 45, color: '#2e2e3e', accent: '#64748b', variant: 'stadium', panelWidth: 900, panelHeight: 650, getContent: () => <LeagueIslandPage islandId="island-pro-001" leagueId="league-pro-001" /> },
  { id: 'stm-elite', label: 'Elite Stadium', islandId: 'elite', x: 0, y: 0, w: 90, h: 70, d: 45, color: '#2e1a1a', accent: '#dc2626', variant: 'stadium', panelWidth: 900, panelHeight: 650, getContent: () => <LeagueIslandPage islandId="island-elite-001" leagueId="league-elite-001" /> },
];

const BRIDGES = [
  { from: 'hub', to: 'state' },
  { from: 'hub', to: 'mid' },
  { from: 'hub', to: 'top' },
  { from: 'hub', to: 'regional' },
  { from: 'hub', to: 'pro' },
  { from: 'hub', to: 'elite' },
];

// ═══════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════
export default function IslandWorldMap() {
  const { openPanel } = usePanels();
  const { onlinePlayers, myStadium, otherStadiums } = useWorld();
  const { myHomeMatches } = useMatchDay();
  const { user } = useAuthStore();

  // Window size
  const [win, setWin] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1200,
    h: typeof window !== 'undefined' ? window.innerHeight : 750,
  });
  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Player state
  const [px, setPx] = useState(0);
  const [py, setPy] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [facing, setFacing] = useState<'left' | 'right' | 'up' | 'down'>('right');
  const [hovered, setHovered] = useState<string | null>(null);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<{ u: string; t: string }[]>([
    { u: 'System', t: 'Welcome to Gridiron Dynasty! Click anywhere on the ground to walk. Click and hold to drag the map. Click buildings to interact.' },
  ]);

  // Camera with drag support
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const dragStartScreenRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const dragThreshold = 5; // px threshold to distinguish click vs drag

  // Camera smooth follow (lerp) when not dragging
  const targetCamRef = useRef({ x: 0, y: 0 });
  useEffect(() => { targetCamRef.current = { x: px, y: py }; }, [px, py]);

  useEffect(() => {
    let raf: number;
    const smooth = () => {
      if (!isDragging) {
        setCam(prev => {
          const dx = targetCamRef.current.x - prev.x;
          const dy = targetCamRef.current.y - prev.y;
          let nx = prev.x + dx * 0.06;
          let ny = prev.y + dy * 0.06;
          const minX = -WW / 2 + win.w / 2;
          const maxX = WW / 2 - win.w / 2;
          const minY = -WH / 2 + win.h / 2;
          const maxY = WH / 2 - win.h / 2;
          nx = Math.max(minX, Math.min(maxX, nx));
          ny = Math.max(minY, Math.min(maxY, ny));
          return { x: nx, y: ny };
        });
      }
      raf = requestAnimationFrame(smooth);
    };
    raf = requestAnimationFrame(smooth);
    return () => cancelAnimationFrame(raf);
  }, [win.w, win.h, isDragging]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Only start drag on left mouse button and not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest('[data-building]') || target.closest('[data-stadium]')) return;

    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY, camX: cam.x, camY: cam.y };
    dragStartScreenRef.current = { x: e.clientX, y: e.clientY };
  }, [cam.x, cam.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    // Check if we've moved past the drag threshold
    const totalDx = e.clientX - dragStartScreenRef.current.x;
    const totalDy = e.clientY - dragStartScreenRef.current.y;
    if (Math.abs(totalDx) > dragThreshold || Math.abs(totalDy) > dragThreshold) {
      hasDraggedRef.current = true;
    }

    // Move camera by drag delta (inverse: dragging right moves world left, which moves camera right)
    let nx = dragStartRef.current.camX - dx;
    let ny = dragStartRef.current.camY - dy;

    const minX = -WW / 2 + win.w / 2;
    const maxX = WW / 2 - win.w / 2;
    const minY = -WH / 2 + win.h / 2;
    const maxY = WH / 2 - win.h / 2;
    nx = Math.max(minX, Math.min(maxX, nx));
    ny = Math.max(minY, Math.min(maxY, ny));

    setCam({ x: nx, y: ny });
  }, [isDragging, win.w, win.h]);

  const handleMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    // If we didn't drag past threshold, treat it as a click
    if (!hasDraggedRef.current) {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // Convert to world coordinates
      const worldX = sx - win.w / 2 + cam.x;
      const worldY = sy - win.h / 2 + cam.y;

      // Check if on an island or bridge
      const onIsland = ISLANDS.some(island => {
        const dx = worldX - island.x;
        const dy = worldY - island.y;
        return (dx * dx) / ((island.w / 2) * (island.w / 2)) + (dy * dy) / ((island.h / 2) * (island.h / 2)) <= 1;
      });

      const onBridge = BRIDGES.some(bridge => {
        const from = getIsland(bridge.from);
        const to = getIsland(bridge.to);
        const lineDx = to.x - from.x;
        const lineDy = to.y - from.y;
        const lineLenSq = lineDx * lineDx + lineDy * lineDy;
        if (lineLenSq === 0) return false;
        const t = Math.max(0, Math.min(1, ((worldX - from.x) * lineDx + (worldY - from.y) * lineDy) / lineLenSq));
        const projX = from.x + t * lineDx;
        const projY = from.y + t * lineDy;
        return Math.sqrt((worldX - projX) ** 2 + (worldY - projY) ** 2) < 30;
      });

      if (!onIsland && !onBridge) return;

      // Set facing and move player
      const dx = worldX - px;
      const dy = worldY - py;
      if (Math.abs(dx) > Math.abs(dy)) {
        setFacing(dx > 0 ? 'right' : 'left');
      } else {
        setFacing(dy > 0 ? 'down' : 'up');
      }

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
      setIsMoving(true);
      setPx(worldX);
      setPy(worldY);
      const duration = Math.min(dist / 150 + 0.3, 3);
      moveTimeoutRef.current = window.setTimeout(() => setIsMoving(false), duration * 1000);
    }
  }, [isDragging, win.w, win.h, cam.x, cam.y, px, py]);

  // Touch support for mobile drag
  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    const touch = e.touches[0];
    const target = e.target as Element;
    if (target.closest('[data-building]') || target.closest('[data-stadium]')) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = { x: touch.clientX, y: touch.clientY, camX: cam.x, camY: cam.y };
    dragStartScreenRef.current = { x: touch.clientX, y: touch.clientY };
  }, [cam.x, cam.y]);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;

    const totalDx = touch.clientX - dragStartScreenRef.current.x;
    const totalDy = touch.clientY - dragStartScreenRef.current.y;
    if (Math.abs(totalDx) > dragThreshold || Math.abs(totalDy) > dragThreshold) {
      hasDraggedRef.current = true;
    }

    let nx = dragStartRef.current.camX - dx;
    let ny = dragStartRef.current.camY - dy;
    const minX = -WW / 2 + win.w / 2;
    const maxX = WW / 2 - win.w / 2;
    const minY = -WH / 2 + win.h / 2;
    const maxY = WH / 2 - win.h / 2;
    nx = Math.max(minX, Math.min(maxX, nx));
    ny = Math.max(minY, Math.min(maxY, ny));
    setCam({ x: nx, y: ny });
  }, [isDragging, win.w, win.h]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    // Touch doesn't have a final position in changedTouches in this context, so skip click-to-move for touch
  }, [isDragging]);

  // Movement timeout ref
  const moveTimeoutRef = useRef<number | null>(null);

  // Building click
  const handleBuildingClick = useCallback((b: WorldBuilding) => {
    const island = getIsland(b.islandId);
    const worldX = island.x + b.x;
    const worldY = island.y + b.y;

    const dx = worldX - px;
    const dy = worldY - py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
    setIsMoving(true);
    setPx(worldX);
    setPy(worldY);

    if (Math.abs(dx) > Math.abs(dy)) {
      setFacing(dx > 0 ? 'right' : 'left');
    } else {
      setFacing(dy > 0 ? 'down' : 'up');
    }

    const duration = Math.min(dist / 150 + 0.3, 3);
    moveTimeoutRef.current = window.setTimeout(() => {
      setIsMoving(false);
      openPanel({
        id: b.id,
        title: b.label,
        buildingId: b.id,
        x: 100 + Math.random() * 200,
        y: 60 + Math.random() * 100,
        width: b.panelWidth,
        height: b.panelHeight,
        minimized: false,
        maximized: false,
        content: b.getContent(),
      });
    }, duration * 1000);
  }, [px, py, openPanel]);

  // Stadium click handlers
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
      content: <StadiumInteriorPage embedded />,
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
        </div>
      ),
    });
  }, [openPanel]);

  // Position other stadiums on their league islands
  const positionedStadiums = useMemo(() => {
    // Group by island
    const byIsland: Record<string, typeof otherStadiums> = {};
    for (const stadium of otherStadiums) {
      const islandId = TIER_TO_ISLAND[stadium.tier] || 'hub';
      if (!byIsland[islandId]) byIsland[islandId] = [];
      byIsland[islandId].push(stadium);
    }

    // Position each group on their island
    const result: (typeof otherStadiums[0] & { worldX: number; worldY: number })[] = [];
    for (const [islandId, stadiums] of Object.entries(byIsland)) {
      const island = getIsland(islandId);
      for (let i = 0; i < stadiums.length; i++) {
        const pos = getStadiumPositionOnIsland(island, i, stadiums.length);
        result.push({ ...stadiums[i], worldX: pos.x, worldY: pos.y });
      }
    }
    return result;
  }, [otherStadiums]);

  // Convert online players to avatar format
  const worldPlayers: AvatarState[] = useMemo(() => {
    return onlinePlayers.map((p: any) => ({
      x: p.x,
      y: p.y,
      isMoving: p.isMoving,
      facing: p.facing,
      username: p.username,
      color: p.avatarColor,
      teamColor: p.avatarColor,
    }));
  }, [onlinePlayers]);

  // Camera CSS translation
  const camTx = -cam.x + win.w / 2 - WW / 2;
  const camTy = -cam.y + win.h / 2 - WH / 2;

  const currentIsland = getIslandByPosition(px, py);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0f1a]">
      {/* World Camera Container */}
      <div
        style={{
          transform: `translate(${camTx}px, ${camTy}px)`,
          willChange: 'transform',
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <svg
          width={WW}
          height={WH}
          viewBox={`${-WW / 2} ${-WH / 2} ${WW} ${WH}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none' }}
        >
          <defs>
            <pattern id="grass" width="60" height="60" patternUnits="userSpaceOnUse">
              <rect width="60" height="60" fill="#0d1520" />
              <path d="M 0 30 L 30 0 L 60 30 L 30 60 Z" fill="#0f1725" opacity="0.5" />
              <circle cx="30" cy="30" r="1" fill="#1a2535" opacity="0.4" />
            </pattern>
            <pattern id="water" width="40" height="40" patternUnits="userSpaceOnUse">
              <rect width="40" height="40" fill="#0c1e33" />
              <path d="M 0 20 L 20 0 L 40 20 L 20 40 Z" fill="#0a1628" opacity="0.3" />
            </pattern>
          </defs>

          {/* Water background */}
          <rect x={-WW / 2} y={-WH / 2} width={WW} height={WH} fill="url(#water)" />

          {/* Islands */}
          {ISLANDS.map(island => (
            <g key={island.id}>
              <ellipse
                cx={island.x}
                cy={island.y}
                rx={island.w / 2}
                ry={island.h / 2}
                fill={island.ground}
                stroke={island.color}
                strokeWidth={2}
                opacity={0.9}
              />
              <ellipse
                cx={island.x}
                cy={island.y}
                rx={island.w / 2 - 10}
                ry={island.h / 2 - 10}
                fill="url(#grass)"
                opacity={0.5}
              />
              <text
                x={island.x}
                y={island.y - island.h / 2 - 18}
                textAnchor="middle"
                fill="white"
                fontSize="14"
                fontWeight="bold"
                style={{ pointerEvents: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
              >
                {island.name}
              </text>
              {island.type === 'LEAGUE' && island.tier && (
                <text
                  x={island.x}
                  y={island.y - island.h / 2 - 5}
                  textAnchor="middle"
                  fill={island.color}
                  fontSize="9"
                  style={{ pointerEvents: 'none' }}
                >
                  {island.tier.replace('_', ' ')}
                </text>
              )}
            </g>
          ))}

          {/* Bridges */}
          {BRIDGES.map((bridge, i) => {
            const from = getIsland(bridge.from);
            const to = getIsland(bridge.to);
            return (
              <g key={i}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#1e293b" strokeWidth={14} opacity={0.7} />
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#475569" strokeWidth={6} strokeDasharray="8 4" opacity={0.8} />
              </g>
            );
          })}

          {/* Buildings */}
          {BUILDINGS.map(b => {
            const island = getIsland(b.islandId);
            const wx = island.x + b.x;
            const wy = island.y + b.y;
            return (
              <g key={b.id} transform={`translate(${wx}, ${wy})`} data-building="true">
                <IsometricBuilding
                  id={b.id}
                  label={b.label}
                  x={0}
                  y={0}
                  width={b.w}
                  height={b.h}
                  depth={b.d}
                  color={b.color}
                  accent={b.accent}
                  variant={b.variant}
                  isHovered={hovered === b.id}
                  onClick={() => handleBuildingClick(b)}
                  onHover={setHovered}
                />
              </g>
            );
          })}

          {/* My Stadium — on hub island below buildings */}
          {myStadium && (
            <g data-stadium="true" transform={`translate(0, 150)`}>
              <PlayerStadiumSVG
                stadium={myStadium}
                x={0}
                y={0}
                isMyStadium={true}
                isHovered={hovered === 'my-stadium'}
                onClick={handleStadiumClick}
                onHover={setHovered}
              />
            </g>
          )}

          {/* Other Stadiums — positioned on their league islands */}
          {positionedStadiums.map((stadium) => (
            <g key={stadium.venueId} data-stadium="true" transform={`translate(${stadium.worldX}, ${stadium.worldY})`}>
              <PlayerStadiumSVG
                stadium={stadium}
                x={0}
                y={0}
                isMyStadium={false}
                isHovered={hovered === `stadium-${stadium.venueId}`}
                onClick={() => handleOtherStadiumClick(stadium)}
                onHover={setHovered}
              />
            </g>
          ))}

          {/* Other players */}
          {worldPlayers.map(player => (
            <IsometricAvatar key={player.username} player={player} scale={0.8} />
          ))}

          {/* Player avatar (You) */}
          <IsometricAvatar
            player={{
              x: px,
              y: py,
              isMoving,
              facing,
              username: user?.username || 'You',
              color: '#E94560',
              teamColor: '#E94560',
            }}
            scale={1}
          />

          {/* Ambient particles */}
          <FloatingParticles width={WW} height={WH} particleCount={40} />
          <Fireflies width={WW} height={WH} fireflies={20} />
        </svg>
      </div>

      {/* UI Overlays */}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2 bg-[#0a0f1a]/80 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#E94560]" />
          <div className="text-white font-black text-lg tracking-tight">
            GRIDIRON <span className="text-[#E94560]">DYNASTY</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#E94560]" />
            {currentIsland?.name || 'Open Water'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {onlinePlayers.length + 1} online
          </span>
        </div>
      </div>

      {/* Minimap */}
      <div className="absolute top-14 right-4 w-52 h-36 bg-black/60 rounded-xl border border-white/10 overflow-hidden z-20">
        <svg viewBox={`${-WW / 2} ${-WH / 2} ${WW} ${WH}`} className="w-full h-full">
          <rect x={-WW / 2} y={-WH / 2} width={WW} height={WH} fill="#0c1e33" />
          {ISLANDS.map(island => (
            <ellipse key={island.id} cx={island.x} cy={island.y} rx={island.w / 2} ry={island.h / 2} fill={island.color} opacity={0.6} />
          ))}
          {/* My stadium on minimap */}
          {myStadium && (
            <circle cx={0} cy={150} r={20} fill="#E94560" opacity={0.7} />
          )}
          {/* Other stadiums on minimap */}
          {positionedStadiums.map(s => (
            <circle key={s.venueId} cx={s.worldX} cy={s.worldY} r={12} fill="#64748b" opacity={0.5} />
          ))}
          <circle cx={px} cy={py} r={30} fill="#E94560" />
          <rect
            x={cam.x - win.w / 2}
            y={cam.y - win.h / 2}
            width={win.w}
            height={win.h}
            fill="none"
            stroke="white"
            strokeWidth={10}
            opacity={0.4}
          />
        </svg>
      </div>

      {/* Drag hint */}
      <div className="absolute top-14 left-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-lg text-xs text-white/50">
        <Hand className="w-3 h-3" />
        Click & drag to pan
      </div>

      {/* Chat toggle */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="absolute bottom-12 left-4 z-20 p-2.5 bg-black/60 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-colors"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-12 left-16 w-80 h-72 bg-black/80 rounded-xl border border-white/10 p-3 flex flex-col z-20"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-white/50 uppercase tracking-wider">Chat</div>
              <button onClick={() => setChatOpen(false)} className="text-white/50 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 text-xs pr-1">
              {msgs.map((msg, i) => (
                <div key={i} className="text-white/70">
                  <span className="text-[#E94560] font-bold">{msg.u}:</span> {msg.t}
                </div>
              ))}
            </div>
            <input
              type="text"
              placeholder="Type a message..."
              className="mt-2 px-2.5 py-1.5 bg-white/5 rounded-lg text-xs text-white placeholder-white/30 border border-white/10 focus:outline-none focus:border-white/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) {
                    setMsgs(prev => [...prev, { u: user?.username || 'You', t: input.value }]);
                    input.value = '';
                  }
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-[#0a0f1a]/80 border-t border-white/5 flex items-center px-4 gap-6 text-xs text-slate-500 z-20">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {onlinePlayers.length + 1} players online
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#E94560]" />
          {myHomeMatches.length} home matches
        </span>
        <span className="ml-auto text-slate-600">Click ground to walk • Click & drag to pan</span>
      </div>
    </div>
  );
}
