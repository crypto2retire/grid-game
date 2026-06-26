import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface VehicleAsset {
  id: string;
  name: string;
  tier: string;
  condition: number;
  operatingCost: number;
  fatigueReduction: number;
  prestige: number;
  isLeased: boolean;
  capacity: number;
  speed: number;
  upgradeCount: number;
  maxUpgrade: number;
  yearAcquired: number;
  tripsTaken: number;
}

interface TransportGarageProps {
  vehicles: VehicleAsset[];
  selectedVehicleId: string | null;
  onVehicleClick: (id: string) => void;
}

const TIER_LABELS: Record<string, string> = {
  CARPOOL: 'Carpool Vans',
  USED_BUS: 'Used Bus',
  TEAM_BUS: 'Team Bus',
  LUXURY_COACH: 'Luxury Coach',
  CHARTER_FLIGHT: 'Charter Flight',
  TEAM_AIRCRAFT: 'Team Aircraft',
  CUSTOM_JET: 'Custom Jet',
};

const TIER_COLORS: Record<string, string> = {
  CARPOOL: '#64748b',
  USED_BUS: '#94a3b8',
  TEAM_BUS: '#3b82f6',
  LUXURY_COACH: '#fbbf24',
  CHARTER_FLIGHT: '#a78bfa',
  TEAM_AIRCRAFT: '#06b6d4',
  CUSTOM_JET: '#E94560',
};

function VehicleSVG({ tier, condition, isSelected }: { tier: string; condition: number; isSelected: boolean }) {
  const color = TIER_COLORS[tier] || '#94a3b8';
  const scale = isSelected ? 1.08 : 1;
  const conditionFactor = condition / 100;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const dimR = Math.floor(r * (0.4 + conditionFactor * 0.6));
  const dimG = Math.floor(g * (0.4 + conditionFactor * 0.6));
  const dimB = Math.floor(b * (0.4 + conditionFactor * 0.6));
  const dimColor = `rgb(${dimR}, ${dimG}, ${dimB})`;

  const renderVehicle = () => {
    switch (tier) {
      case 'CARPOOL':
        return (
          <g>
            <rect x="-35" y="-20" width="70" height="40" rx="8" fill={dimColor} opacity="0.9" />
            <rect x="-30" y="-15" width="20" height="15" rx="2" fill="#1e293b" opacity="0.5" />
            <rect x="-5" y="-15" width="20" height="15" rx="2" fill="#1e293b" opacity="0.5" />
            <rect x="20" y="-15" width="10" height="15" rx="2" fill="#1e293b" opacity="0.5" />
            <circle cx="-20" cy="20" r="8" fill="#1e293b" />
            <circle cx="20" cy="20" r="8" fill="#1e293b" />
            <circle cx="-20" cy="20" r="4" fill="#475569" />
            <circle cx="20" cy="20" r="4" fill="#475569" />
            <rect x="-38" y="-5" width="4" height="8" rx="2" fill="#fbbf24" opacity="0.6" />
            {condition < 50 && (
              <>
                <circle cx="-25" cy="0" r="3" fill="#7c2d12" opacity="0.4" />
                <circle cx="10" cy="10" r="2" fill="#7c2d12" opacity="0.3" />
              </>
            )}
          </g>
        );
      case 'USED_BUS':
        return (
          <g>
            <rect x="-45" y="-25" width="90" height="50" rx="6" fill={dimColor} opacity="0.85" />
            <rect x="-40" y="-20" width="18" height="18" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="-18" y="-20" width="18" height="18" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="4" y="-20" width="18" height="18" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="26" y="-20" width="14" height="18" rx="2" fill="#1e293b" opacity="0.4" />
            <circle cx="-30" cy="25" r="9" fill="#1e293b" />
            <circle cx="30" cy="25" r="9" fill="#1e293b" />
            <circle cx="-30" cy="25" r="5" fill="#475569" />
            <circle cx="30" cy="25" r="5" fill="#475569" />
            <rect x="-48" y="-5" width="4" height="10" rx="2" fill="#fbbf24" opacity="0.5" />
            {condition < 50 && (
              <>
                <circle cx="-35" cy="5" r="4" fill="#7c2d12" opacity="0.4" />
                <circle cx="20" cy="15" r="3" fill="#7c2d12" opacity="0.3" />
                <rect x="-10" y="20" width="20" height="2" fill="#7c2d12" opacity="0.3" />
              </>
            )}
          </g>
        );
      case 'TEAM_BUS':
        return (
          <g>
            <rect x="-50" y="-28" width="100" height="56" rx="8" fill={dimColor} opacity="0.9" />
            <rect x="-45" y="-22" width="20" height="20" rx="3" fill="#1e293b" opacity="0.4" />
            <rect x="-22" y="-22" width="20" height="20" rx="3" fill="#1e293b" opacity="0.4" />
            <rect x="1" y="-22" width="20" height="20" rx="3" fill="#1e293b" opacity="0.4" />
            <rect x="24" y="-22" width="20" height="20" rx="3" fill="#1e293b" opacity="0.4" />
            <circle cx="-35" cy="28" r="10" fill="#1e293b" />
            <circle cx="35" cy="28" r="10" fill="#1e293b" />
            <circle cx="-35" cy="28" r="6" fill="#64748b" />
            <circle cx="35" cy="28" r="6" fill="#64748b" />
            <rect x="-53" y="-5" width="5" height="10" rx="2" fill="#fbbf24" opacity="0.7" />
            <rect x="-50" y="0" width="100" height="4" fill="white" opacity="0.3" />
            <circle cx="0" cy="-8" r="8" fill="white" opacity="0.2" />
            {condition < 50 && <circle cx="-40" cy="10" r="3" fill="#7c2d12" opacity="0.3" />}
          </g>
        );
      case 'LUXURY_COACH':
        return (
          <g>
            <rect x="-55" y="-30" width="110" height="60" rx="10" fill={dimColor} opacity="0.9" />
            <rect x="-50" y="-24" width="22" height="22" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="-25" y="-24" width="22" height="22" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="0" y="-24" width="22" height="22" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="25" y="-24" width="22" height="22" rx="3" fill="#1e293b" opacity="0.3" />
            <circle cx="-38" cy="30" r="10" fill="#1e293b" />
            <circle cx="38" cy="30" r="10" fill="#1e293b" />
            <circle cx="-38" cy="30" r="6" fill="#fbbf24" opacity="0.8" />
            <circle cx="38" cy="30" r="6" fill="#fbbf24" opacity="0.8" />
            <rect x="-58" y="-5" width="5" height="10" rx="2" fill="#fbbf24" opacity="0.8" />
            <rect x="-55" y="2" width="110" height="3" fill="white" opacity="0.4" />
            <rect x="-55" y="8" width="110" height="2" fill="white" opacity="0.2" />
            <rect x="-55" y="-30" width="110" height="4" rx="2" fill="#e2e8f0" opacity="0.5" />
            {condition < 50 && <circle cx="45" cy="12" r="2" fill="#7c2d12" opacity="0.2" />}
          </g>
        );
      case 'CHARTER_FLIGHT':
        return (
          <g>
            <ellipse cx="0" cy="0" rx="60" ry="18" fill={dimColor} opacity="0.9" />
            <polygon points="-20,-5 20,-5 30,-25 -30,-25" fill={dimColor} opacity="0.7" />
            <polygon points="40,-5 55,-5 55,-20 45,-20" fill={dimColor} opacity="0.8" />
            <rect x="-50" y="-8" width="8" height="6" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="-38" y="-8" width="8" height="6" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="-26" y="-8" width="8" height="6" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="-14" y="-8" width="8" height="6" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="-2" y="-8" width="8" height="6" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="10" y="-8" width="8" height="6" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="22" y="-8" width="8" height="6" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="34" y="-8" width="8" height="6" rx="2" fill="#1e293b" opacity="0.4" />
            <rect x="-15" y="15" width="12" height="8" rx="4" fill="#475569" opacity="0.8" />
            <rect x="15" y="15" width="12" height="8" rx="4" fill="#475569" opacity="0.8" />
            <polygon points="-60,5 -80,0 -60,-2" fill="#94a3b8" opacity="0.2" />
          </g>
        );
      case 'TEAM_AIRCRAFT':
        return (
          <g>
            <ellipse cx="0" cy="0" rx="70" ry="20" fill={dimColor} opacity="0.9" />
            <polygon points="-25,-5 25,-5 35,-30 -35,-30" fill={dimColor} opacity="0.7" />
            <polygon points="50,-5 65,-5 65,-22 55,-22" fill={dimColor} opacity="0.8" />
            <rect x="-60" y="-10" width="10" height="7" rx="2" fill="#1e293b" opacity="0.3" />
            <rect x="-46" y="-10" width="10" height="7" rx="2" fill="#1e293b" opacity="0.3" />
            <rect x="-32" y="-10" width="10" height="7" rx="2" fill="#1e293b" opacity="0.3" />
            <rect x="-18" y="-10" width="10" height="7" rx="2" fill="#1e293b" opacity="0.3" />
            <rect x="-4" y="-10" width="10" height="7" rx="2" fill="#1e293b" opacity="0.3" />
            <rect x="10" y="-10" width="10" height="7" rx="2" fill="#1e293b" opacity="0.3" />
            <rect x="24" y="-10" width="10" height="7" rx="2" fill="#1e293b" opacity="0.3" />
            <rect x="38" y="-10" width="10" height="7" rx="2" fill="#1e293b" opacity="0.3" />
            <rect x="-20" y="18" width="14" height="9" rx="5" fill="#475569" opacity="0.8" />
            <rect x="20" y="18" width="14" height="9" rx="5" fill="#475569" opacity="0.8" />
            <rect x="-70" y="5" width="15" height="4" rx="2" fill="#fbbf24" opacity="0.6" />
            <rect x="-70" y="3" width="140" height="3" fill="white" opacity="0.3" />
            <polygon points="-70,8 -90,2 -70,0" fill="#94a3b8" opacity="0.15" />
          </g>
        );
      case 'CUSTOM_JET':
      default:
        return (
          <g>
            <ellipse cx="0" cy="0" rx="80" ry="22" fill={dimColor} opacity="0.9" />
            <polygon points="-30,-5 30,-5 40,-35 -40,-35" fill={dimColor} opacity="0.7" />
            <polygon points="60,-5 75,-5 75,-25 65,-25" fill={dimColor} opacity="0.8" />
            <rect x="-70" y="-12" width="12" height="8" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="-54" y="-12" width="12" height="8" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="-38" y="-12" width="12" height="8" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="-22" y="-12" width="12" height="8" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="-6" y="-12" width="12" height="8" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="10" y="-12" width="12" height="8" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="26" y="-12" width="12" height="8" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="42" y="-12" width="12" height="8" rx="3" fill="#1e293b" opacity="0.3" />
            <rect x="-25" y="20" width="16" height="10" rx="6" fill="#475569" opacity="0.8" />
            <rect x="25" y="20" width="16" height="10" rx="6" fill="#475569" opacity="0.8" />
            <rect x="-80" y="5" width="18" height="5" rx="2" fill="#fbbf24" opacity="0.8" />
            <rect x="-80" y="3" width="160" height="4" fill="white" opacity="0.4" />
            <rect x="-80" y="10" width="160" height="2" fill="white" opacity="0.2" />
            <polygon points="-80,10 -100,3 -80,0" fill="#94a3b8" opacity="0.2" />
            <rect x="55" y="-8" width="20" height="10" rx="3" fill="#fbbf24" opacity="0.8" />
            <text x="65" y="-1" textAnchor="middle" fill="#1e293b" fontSize="6" fontWeight="900">VIP</text>
          </g>
        );
    }
  };

  return (
    <motion.g
      initial={{ scale: 0 }}
      animate={{ scale }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{ cursor: 'pointer' }}
    >
      {isSelected && (
        <circle cx="0" cy="0" r="55" fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 2" opacity="0.6">
          <animate attributeName="r" values="55;60;55" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      <ellipse cx="0" cy="38" rx="40" ry="6" fill="black" opacity="0.2" />
      {renderVehicle()}
      <circle cx="42" cy="-30" r="5" fill={condition > 70 ? '#22c55e' : condition > 40 ? '#fbbf24' : '#ef4444'} opacity="0.8" />
      <circle cx="-42" cy="-30" r="5" fill="#fbbf24" opacity="0.6" />
    </motion.g>
  );
}

export default function TransportGarage({ vehicles, selectedVehicleId, onVehicleClick }: TransportGarageProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getVehiclePosition = (index: number) => {
    const gap = 120;
    const startX = 100;
    const y = vehicles.length <= 3 ? 200 : index % 2 === 0 ? 160 : 280;
    return { x: startX + index * gap, y };
  };

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox="0 0 900 500" className="w-full h-auto" style={{ maxWidth: '100%' }}>
        <defs>
          <pattern id="garageFloor" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#1e293b" />
            <line x1="0" y1="20" x2="40" y2="20" stroke="#334155" strokeWidth="0.5" />
            <line x1="20" y1="0" x2="20" y2="40" stroke="#334155" strokeWidth="0.5" />
          </pattern>
          <pattern id="ceilingLights" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect x="40" y="0" width="20" height="4" fill="#fbbf24" opacity="0.3" />
          </pattern>
          <linearGradient id="floorGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>

        <rect width="900" height="500" fill="url(#floorGradient)" rx="12" />
        <rect x="0" y="0" width="900" height="60" fill="#0f172a" />
        <rect x="0" y="0" width="900" height="60" fill="url(#ceilingLights)" />

        <line x1="50" y1="10" x2="50" y2="400" stroke="#fbbf24" strokeWidth="40" opacity="0.03" />
        <line x1="250" y1="10" x2="250" y2="400" stroke="#fbbf24" strokeWidth="40" opacity="0.03" />
        <line x1="450" y1="10" x2="450" y2="400" stroke="#fbbf24" strokeWidth="40" opacity="0.03" />
        <line x1="650" y1="10" x2="650" y2="400" stroke="#fbbf24" strokeWidth="40" opacity="0.03" />
        <line x1="850" y1="10" x2="850" y2="400" stroke="#fbbf24" strokeWidth="40" opacity="0.03" />

        <text x="450" y="35" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="700" letterSpacing="4">
          TRANSPORT GARAGE
        </text>

        <rect x="20" y="80" width="860" height="400" fill="url(#garageFloor)" rx="8" opacity="0.5" />

        {vehicles.map((_, i) => {
          const pos = getVehiclePosition(i);
          return (
            <g key={`parking-${i}`}>
              <rect x={pos.x - 50} y={pos.y - 60} width="100" height="130" rx="8" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={pos.x} y={pos.y + 65} textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="10" fontWeight="700">{i + 1}</text>
            </g>
          );
        })}

        <g>
          {vehicles.map((vehicle, i) => {
            const pos = getVehiclePosition(i);
            const isSelected = vehicle.id === selectedVehicleId;
            const isHovered = vehicle.id === hoveredId;
            return (
              <g key={vehicle.id} transform={`translate(${pos.x}, ${pos.y})`} onClick={() => onVehicleClick(vehicle.id)} onMouseEnter={() => setHoveredId(vehicle.id)} onMouseLeave={() => setHoveredId(null)} style={{ cursor: 'pointer' }}>
                <VehicleSVG tier={vehicle.tier} condition={vehicle.condition} isSelected={isSelected || isHovered} />
                <AnimatePresence>
                  {(isSelected || isHovered) && (
                    <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.15 }}>
                      <rect x="-50" y="-90" width="100" height="24" rx="6" fill="#1e293b" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <text x="0" y="-74" textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="600">{TIER_LABELS[vehicle.tier] || vehicle.tier}</text>
                    </motion.g>
                  )}
                </AnimatePresence>
              </g>
            );
          })}
        </g>

        <g transform="translate(800, 420)">
          <rect x="-40" y="-15" width="80" height="30" rx="4" fill="#475569" opacity="0.5" />
          <rect x="-35" y="-10" width="20" height="10" rx="2" fill="#fbbf24" opacity="0.3" />
          <rect x="-10" y="-10" width="15" height="10" rx="2" fill="#22c55e" opacity="0.3" />
          <rect x="10" y="-10" width="20" height="10" rx="2" fill="#3b82f6" opacity="0.3" />
          <text x="0" y="35" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="8" fontWeight="700">MAINTENANCE</text>
        </g>
      </svg>
    </div>
  );
}
