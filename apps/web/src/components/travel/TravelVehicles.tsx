import { useMemo, useState } from 'react';
import { useTravel, type Trip } from './TravelSystem';

interface TravelVehicleProps {
  buildingPositions: Record<string, { x: number; y: number; width: number; height: number }>;
  roadPaths: Record<string, string>;
}

function VehicleSVG({ type }: { type: string }) {
  const color = type === 'jet' ? '#06b6d4' : type === 'coach' ? '#fbbf24' : '#3b82f6';
  
  if (type === 'jet') {
    return (
      <g>
        <ellipse cx="0" cy="0" rx="14" ry="6" fill={color} opacity="0.9" />
        <polygon points="0,-5 12,-2 14,0 12,2 0,5" fill={color} opacity="0.8" />
        <polygon points="-8,-2 -14,0 -8,2" fill={color} opacity="0.6" />
        <circle cx="-5" cy="0" r="1.5" fill="#fff" opacity="0.6" />
        <circle cx="0" cy="0" r="1.5" fill="#fff" opacity="0.6" />
        <circle cx="5" cy="0" r="1.5" fill="#fff" opacity="0.6" />
        {/* Contrail */}
        <line x1="-20" y1="0" x2="-35" y2="0" stroke="#fff" strokeWidth="0.5" opacity="0.3">
          <animate attributeName="x2" values="-35;-50;-35" dur="0.5s" repeatCount="indefinite" />
        </line>
      </g>
    );
  }
  
  if (type === 'coach') {
    return (
      <g>
        <rect x="-16" y="-7" width="32" height="14" rx="3" fill={color} opacity="0.9" />
        <rect x="-14" y="-5" width="8" height="5" rx="1" fill="#1a1a1a" opacity="0.4" />
        <rect x="-4" y="-5" width="8" height="5" rx="1" fill="#1a1a1a" opacity="0.4" />
        <rect x="6" y="-5" width="8" height="5" rx="1" fill="#1a1a1a" opacity="0.4" />
        <circle cx="-10" cy="7" r="4" fill="#1a1a1a" />
        <circle cx="10" cy="7" r="4" fill="#1a1a1a" />
        <circle cx="-10" cy="7" r="2" fill="#475569" />
        <circle cx="10" cy="7" r="2" fill="#475569" />
        <rect x="-17" y="-2" width="2" height="3" rx="1" fill="#fbbf24" opacity="0.6" />
      </g>
    );
  }
  
  // Default bus/van
  return (
    <g>
      <rect x="-12" y="-6" width="24" height="12" rx="2" fill={color} opacity="0.9" />
      <rect x="-10" y="-4" width="6" height="4" rx="1" fill="#1a1a1a" opacity="0.4" />
      <rect x="-2" y="-4" width="6" height="4" rx="1" fill="#1a1a1a" opacity="0.4" />
      <rect x="6" y="-4" width="4" height="4" rx="1" fill="#1a1a1a" opacity="0.4" />
      <circle cx="-7" cy="6" r="3" fill="#1a1a1a" />
      <circle cx="7" cy="6" r="3" fill="#1a1a1a" />
      <circle cx="-7" cy="6" r="1.5" fill="#475569" />
      <circle cx="7" cy="6" r="1.5" fill="#475569" />
      <rect x="-13" y="-1" width="2" height="2" rx="1" fill="#fbbf24" opacity="0.5" />
      {/* Exhaust smoke */}
      <circle cx="-16" cy="2" r="2" fill="#64748b" opacity="0.2">
        <animate attributeName="cx" values="-16;-20;-16" dur="0.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0;0.2" dur="0.8s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

export default function TravelVehicles({ buildingPositions, roadPaths }: TravelVehicleProps) {
  const { trips } = useTravel();
  
  const activeTrips = useMemo(() => 
    trips.filter((t) => t.status === 'traveling' || t.status === 'departing'),
  [trips]);

  return (
    <g>
      {activeTrips.map((trip) => {
        const pathKey = `${trip.fromBuildingId}-${trip.toBuildingId}`;
        const reversePathKey = `${trip.toBuildingId}-${trip.fromBuildingId}`;
        
        // Try to find the road path in either direction
        let roadPath = roadPaths[pathKey] || roadPaths[reversePathKey];
        
        if (!roadPath) {
          // Fallback: generate a direct path if no road exists
          const from = buildingPositions[trip.fromBuildingId];
          const to = buildingPositions[trip.toBuildingId];
          if (!from || !to) return null;
          const x1 = from.x + from.width / 2;
          const y1 = from.y + from.height - 5;
          const x2 = to.x + to.width / 2;
          const y2 = to.y + to.height - 5;
          const midX = (x1 + x2) / 2;
          const midY = Math.max(y1, y2) + 20;
          roadPath = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
        }

        const duration = (trip.estimatedDuration / 1000).toFixed(2);
        const isDeparting = trip.status === 'departing';
        const delay = isDeparting ? '0.5s' : '0s';

        return (
          <g key={trip.id}>
            {/* Ghost path indicator (subtle) */}
            <path d={roadPath} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" strokeDasharray="2 4" />
            
            {/* Vehicle traveling along path */}
            <g>
              <animateMotion
                dur={`${duration}s`}
                begin={delay}
                fill="freeze"
                calcMode="linear"
                keyPoints={trip.returnTrip ? "1;0" : "0;1"}
                keyTimes="0;1"
              >
                <mpath href={`#path-${trip.id}`} />
              </animateMotion>
              <VehicleSVG type={trip.vehicleType} />
            </g>
            
            {/* Define the path for animateMotion */}
            <defs>
              <path id={`path-${trip.id}`} d={roadPath} />
            </defs>
            
            {/* ETA label above vehicle */}
            <g opacity="0.7">
              <rect x="-20" y="-20" width="40" height="12" rx="4" fill="#0f172a" />
              <text y="-12" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700">
                {trip.returnTrip ? 'Returning' : 'En route'}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

// ─── Trip Scheduler UI ───

export function TravelScheduler({ fromBuildingId, toBuildingId }: { fromBuildingId: string; toBuildingId: string }) {
  const { scheduleTrip, trips } = useTravel();
  const [vehicleType, setVehicleType] = useState<Trip['vehicleType']>('bus');
  const [tripId, setTripId] = useState<string | null>(null);

  const activeTrip = trips.find((t) => 
    (t.fromBuildingId === fromBuildingId && t.toBuildingId === toBuildingId && t.status !== 'arrived') ||
    t.id === tripId
  );

  const handleSchedule = () => {
    const id = scheduleTrip(fromBuildingId, toBuildingId, vehicleType);
    setTripId(id);
  };

  if (activeTrip) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-white font-medium">
            {activeTrip.status === 'departing' ? 'Departing...' : 'Traveling'}
          </span>
        </div>
        <div className="text-xs text-slate-400 mt-1">
          ETA: {Math.max(0, Math.ceil((activeTrip.arrivalTime - Date.now()) / 1000))}s
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="text-sm font-bold text-white mb-2">Travel</div>
      <div className="flex gap-2 mb-3">
        {(['van', 'bus', 'coach', 'jet'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setVehicleType(type)}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
              vehicleType === type
                ? 'bg-[#E94560] text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
      <button
        onClick={handleSchedule}
        className="w-full py-2 rounded-lg bg-[#E94560] text-white text-sm font-bold hover:bg-[#E94560]/90 transition-colors"
      >
        Depart
      </button>
    </div>
  );
}
