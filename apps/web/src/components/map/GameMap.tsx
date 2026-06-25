import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CityNode {
  id: string;
  name: string;
  x: number;
  y: number;
  region: string;
  stadium?: {
    name: string;
    tier: string;
    capacity: number;
    prestige?: number;
    ownerName?: string;
    isLeased: boolean;
  } | null;
}

export interface TravelRoute {
  from: string;
  to: string;
  distance: number; // travel time in hours
}

export interface BusTravelState {
  fromCityId: string;
  toCityId: string;
  progress: number; // 0-1
  transportTier: string;
}

interface GameMapProps {
  cities: CityNode[];
  routes: TravelRoute[];
  homeCityId: string;
  busTravel?: BusTravelState | null;
  selectedCityId: string | null;
  onCityClick: (cityId: string) => void;
  className?: string;
}

// Stadium SVG visual by tier
function StadiumSVG({ tier, isHome, isSelected, isLeased }: { tier: string; isHome: boolean; isSelected: boolean; isLeased: boolean }) {
  const scale = isSelected ? 1.15 : 1;
  
  // Different stadium visuals based on tier
  const getStadiumPath = () => {
    switch (tier) {
      case 'PARK_FIELD':
        return (
          <g>
            <ellipse cx="0" cy="8" rx="14" ry="6" fill="#4ade80" opacity="0.6" />
            <rect x="-8" y="-4" width="16" height="10" rx="1" fill="#64748b" />
            <rect x="-6" y="-2" width="12" height="6" fill="#94a3b8" />
            <rect x="-2" y="-8" width="4" height="4" fill="#e2e8f0" />
          </g>
        );
      case 'COMMUNITY_FIELD':
        return (
          <g>
            <ellipse cx="0" cy="10" rx="18" ry="7" fill="#4ade80" opacity="0.6" />
            <rect x="-12" y="-6" width="24" height="14" rx="2" fill="#64748b" />
            <rect x="-10" y="-4" width="20" height="10" fill="#94a3b8" />
            <rect x="-3" y="-12" width="6" height="6" fill="#e2e8f0" />
            <rect x="-14" y="-2" width="4" height="8" fill="#475569" />
            <rect x="10" y="-2" width="4" height="8" fill="#475569" />
          </g>
        );
      case 'SMALL_STADIUM':
        return (
          <g>
            <ellipse cx="0" cy="12" rx="22" ry="8" fill="#4ade80" opacity="0.6" />
            <rect x="-16" y="-8" width="32" height="18" rx="2" fill="#64748b" />
            <rect x="-14" y="-6" width="28" height="14" fill="#94a3b8" />
            <rect x="-4" y="-16" width="8" height="8" fill="#e2e8f0" />
            <rect x="-18" y="-4" width="5" height="10" fill="#475569" />
            <rect x="13" y="-4" width="5" height="10" fill="#475569" />
            <rect x="-8" y="-14" width="4" height="6" fill="#cbd5e1" />
            <rect x="4" y="-14" width="4" height="6" fill="#cbd5e1" />
          </g>
        );
      case 'REGIONAL_STADIUM':
        return (
          <g>
            <ellipse cx="0" cy="14" rx="26" ry="9" fill="#4ade80" opacity="0.6" />
            <rect x="-20" y="-10" width="40" height="22" rx="3" fill="#64748b" />
            <rect x="-18" y="-8" width="36" height="18" fill="#94a3b8" />
            <rect x="-5" y="-20" width="10" height="10" fill="#e2e8f0" />
            <rect x="-22" y="-6" width="6" height="12" fill="#475569" />
            <rect x="16" y="-6" width="6" height="12" fill="#475569" />
            <rect x="-10" y="-18" width="5" height="8" fill="#cbd5e1" />
            <rect x="5" y="-18" width="5" height="8" fill="#cbd5e1" />
            <rect x="-2" y="-26" width="4" height="6" fill="#fbbf24" />
          </g>
        );
      case 'PRO_STADIUM':
        return (
          <g>
            <ellipse cx="0" cy="16" rx="30" ry="10" fill="#4ade80" opacity="0.6" />
            <rect x="-24" y="-12" width="48" height="26" rx="4" fill="#475569" />
            <rect x="-22" y="-10" width="44" height="22" fill="#64748b" />
            <rect x="-20" y="-8" width="40" height="18" fill="#94a3b8" />
            <rect x="-6" y="-24" width="12" height="12" fill="#e2e8f0" />
            <rect x="-26" y="-8" width="7" height="14" fill="#334155" />
            <rect x="19" y="-8" width="7" height="14" fill="#334155" />
            <rect x="-12" y="-22" width="6" height="10" fill="#cbd5e1" />
            <rect x="6" y="-22" width="6" height="10" fill="#cbd5e1" />
            <rect x="-3" y="-30" width="6" height="8" fill="#fbbf24" />
            <rect x="-16" y="-6" width="4" height="4" fill="#60a5fa" opacity="0.8" />
            <rect x="12" y="-6" width="4" height="4" fill="#60a5fa" opacity="0.8" />
          </g>
        );
      case 'ELITE':
      default:
        return (
          <g>
            <ellipse cx="0" cy="18" rx="34" ry="11" fill="#4ade80" opacity="0.6" />
            <rect x="-28" y="-14" width="56" height="30" rx="5" fill="#334155" />
            <rect x="-26" y="-12" width="52" height="26" fill="#475569" />
            <rect x="-24" y="-10" width="48" height="22" fill="#64748b" />
            <rect x="-22" y="-8" width="44" height="18" fill="#94a3b8" />
            <rect x="-8" y="-28" width="16" height="14" fill="#e2e8f0" />
            <rect x="-30" y="-10" width="8" height="16" fill="#1e293b" />
            <rect x="22" y="-10" width="8" height="16" fill="#1e293b" />
            <rect x="-16" y="-26" width="7" height="12" fill="#cbd5e1" />
            <rect x="9" y="-26" width="7" height="12" fill="#cbd5e1" />
            <rect x="-4" y="-36" width="8" height="10" fill="#fbbf24" />
            <rect x="-20" y="-8" width="5" height="5" fill="#60a5fa" opacity="0.9" />
            <rect x="15" y="-8" width="5" height="5" fill="#60a5fa" opacity="0.9" />
            <rect x="-8" y="-6" width="5" height="5" fill="#f472b6" opacity="0.9" />
            <rect x="3" y="-6" width="5" height="5" fill="#f472b6" opacity="0.9" />
          </g>
        );
    }
  };

  const color = isHome ? '#E94560' : isLeased ? '#fbbf24' : '#4ade80';
  
  return (
    <motion.g
      initial={{ scale: 0 }}
      animate={{ scale }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      {/* Glow ring for home stadium */}
      {isHome && (
        <circle cx="0" cy="0" r="28" fill="none" stroke={color} strokeWidth="1" opacity="0.3">
          <animate attributeName="r" values="28;32;28" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Selection ring */}
      {isSelected && (
        <circle cx="0" cy="0" r="30" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 2" opacity="0.8" />
      )}
      {/* Owned/Leased indicator */}
      <circle cx="0" cy="0" r="24" fill={isHome ? `${color}15` : '#1e293b'} stroke={color} strokeWidth={isHome ? 2 : 1} opacity="0.9" />
      {getStadiumPath()}
      {/* Small dot indicator for lease status */}
      {!isHome && isLeased && (
        <circle cx="18" cy="-18" r="4" fill="#fbbf24" stroke="#1e293b" strokeWidth="1" />
      )}
      {!isHome && !isLeased && tier !== 'NONE' && (
        <circle cx="18" cy="-18" r="4" fill="#4ade80" stroke="#1e293b" strokeWidth="1" />
      )}
    </motion.g>
  );
}

// Bus SVG
function BusSVG({ transportTier }: { transportTier: string }) {
  const getBusColor = () => {
    switch (transportTier) {
      case 'LUXURY_COACH': return '#fbbf24';
      case 'CHARTER_FLIGHT': return '#a78bfa';
      case 'TEAM_AIRCRAFT': return '#60a5fa';
      case 'CUSTOM_JET': return '#f472b6';
      default: return '#fb923c';
    }
  };
  
  const color = getBusColor();
  
  return (
    <g>
      <rect x="-10" y="-6" width="20" height="12" rx="3" fill={color} stroke="#1e293b" strokeWidth="1.5" />
      <rect x="-8" y="-4" width="6" height="4" rx="1" fill="#1e293b" opacity="0.3" />
      <rect x="-1" y="-4" width="6" height="4" rx="1" fill="#1e293b" opacity="0.3" />
      <circle cx="-6" cy="6" r="2.5" fill="#1e293b" />
      <circle cx="6" cy="6" r="2.5" fill="#1e293b" />
      {/* Small exhaust puff */}
      <circle cx="-10" cy="0" r="2" fill="#94a3b8" opacity="0.5">
        <animate attributeName="r" values="2;4;2" dur="1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0;0.5" dur="1s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

export default function GameMap({ cities, routes, homeCityId, busTravel, selectedCityId, onCityClick, className = '' }: GameMapProps) {
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  
  // Responsive sizing
  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('game-map-container');
      if (container) {
        const width = Math.min(container.clientWidth, 1000);
        setDimensions({ width, height: width * 0.625 });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getCity = (id: string) => cities.find(c => c.id === id);
  
  const getRoutePath = (from: CityNode, to: CityNode) => {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 30; // slight curve upward
    return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
  };

  // Calculate bus position along route
  const getBusPosition = () => {
    if (!busTravel) return null;
    const from = getCity(busTravel.fromCityId);
    const to = getCity(busTravel.toCityId);
    if (!from || !to) return null;
    
    const t = busTravel.progress;
    // Quadratic bezier interpolation
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 30;
    
    const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * midX + t * t * to.x;
    const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * midY + t * t * to.y;
    
    // Calculate rotation angle
    const dx = 2 * (1 - t) * (midX - from.x) + 2 * t * (to.x - midX);
    const dy = 2 * (1 - t) * (midY - from.y) + 2 * t * (to.y - midY);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    return { x, y, angle };
  };

  const busPos = getBusPosition();

  return (
    <div id="game-map-container" className={`w-full ${className}`}>
      <svg
        viewBox={`0 0 800 500`}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-auto"
        style={{ maxWidth: '100%' }}
      >
        <defs>
          {/* Map background gradient */}
          <radialGradient id="mapBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
          
          {/* Grid pattern */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
          
          {/* Route glow */}
          <filter id="routeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Shadow for stadiums */}
          <filter id="stadiumShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Background */}
        <rect width="800" height="500" fill="url(#mapBg)" rx="12" />
        <rect width="800" height="500" fill="url(#grid)" rx="12" />
        
        {/* Decorative continent-like shapes */}
        <g opacity="0.08">
          <ellipse cx="200" cy="150" rx="120" ry="80" fill="#22d3ee" />
          <ellipse cx="550" cy="200" rx="150" ry="100" fill="#E94560" />
          <ellipse cx="350" cy="380" rx="100" ry="70" fill="#4ade80" />
          <ellipse cx="650" cy="350" rx="80" ry="60" fill="#a78bfa" />
        </g>

        {/* Travel Routes */}
        <g opacity="0.4">
          {routes.map((route) => {
            const from = getCity(route.from);
            const to = getCity(route.to);
            if (!from || !to) return null;
            const isActive = busTravel && 
              ((busTravel.fromCityId === route.from && busTravel.toCityId === route.to) ||
               (busTravel.fromCityId === route.to && busTravel.toCityId === route.from));
            
            return (
              <g key={`${route.from}-${route.to}`}>
                <path
                  d={getRoutePath(from, to)}
                  fill="none"
                  stroke={isActive ? '#E94560' : '#475569'}
                  strokeWidth={isActive ? 2.5 : 1}
                  strokeDasharray={isActive ? "8 4" : "4 4"}
                  opacity={isActive ? 0.9 : 0.4}
                  filter={isActive ? 'url(#routeGlow)' : undefined}
                >
                  {isActive && (
                    <animate attributeName="stroke-dashoffset" values="0;-24" dur="1s" repeatCount="indefinite" />
                  )}
                </path>
                {/* Distance label */}
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 35}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {route.distance}h
                </text>
              </g>
            );
          })}
        </g>

        {/* City Labels (behind stadiums) */}
        <g>
          {cities.map((city) => (
            <text
              key={`label-${city.id}`}
              x={city.x}
              y={city.y + 42}
              textAnchor="middle"
              fill={city.id === homeCityId ? '#E94560' : '#94a3b8'}
              fontSize="11"
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: 'none' }}
            >
              {city.name}
            </text>
          ))}
        </g>

        {/* Region Labels */}
        <g opacity="0.15">
          <text x="200" y="100" textAnchor="middle" fill="#22d3ee" fontSize="24" fontWeight="900" fontFamily="system-ui">NORTH</text>
          <text x="550" y="140" textAnchor="middle" fill="#E94560" fontSize="24" fontWeight="900" fontFamily="system-ui">EAST</text>
          <text x="350" y="420" textAnchor="middle" fill="#4ade80" fontSize="24" fontWeight="900" fontFamily="system-ui">SOUTH</text>
          <text x="680" y="400" textAnchor="middle" fill="#a78bfa" fontSize="24" fontWeight="900" fontFamily="system-ui">WEST</text>
        </g>

        {/* Stadiums */}
        <g filter="url(#stadiumShadow)">
          {cities.map((city) => (
            <g
              key={city.id}
              transform={`translate(${city.x}, ${city.y})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onCityClick(city.id)}
              onMouseEnter={() => setHoveredCity(city.id)}
              onMouseLeave={() => setHoveredCity(null)}
            >
              <StadiumSVG
                tier={city.stadium?.tier || 'NONE'}
                isHome={city.id === homeCityId}
                isSelected={city.id === selectedCityId}
                isLeased={city.stadium?.isLeased || false}
              />
              {/* Hover tooltip */}
              <AnimatePresence>
                {hoveredCity === city.id && city.stadium && (
                  <motion.g
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.15 }}
                  >
                    <rect x="-50" y="-65" width="100" height="28" rx="6" fill="#1e293b" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <text x="0" y="-46" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="600">
                      {city.stadium.name}
                    </text>
                  </motion.g>
                )}
              </AnimatePresence>
            </g>
          ))}
        </g>

        {/* Traveling Bus */}
        <AnimatePresence>
          {busPos && busTravel && (
            <motion.g
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              transform={`translate(${busPos.x}, ${busPos.y}) rotate(${busPos.angle})`}
            >
              <BusSVG transportTier={busTravel.transportTier} />
              {/* Travel label */}
              <text y="-12" textAnchor="middle" fill="#fb923c" fontSize="9" fontWeight="600">
                On the road
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Home base indicator */}
        <g transform={`translate(${getCity(homeCityId)?.x || 0}, ${(getCity(homeCityId)?.y || 0) - 45})`}>
          <text textAnchor="middle" fill="#E94560" fontSize="9" fontWeight="700" letterSpacing="1">
            HOME
          </text>
        </g>
      </svg>
    </div>
  );
}
