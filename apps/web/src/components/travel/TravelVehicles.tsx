import { useMemo, useState } from 'react';
import { useTravel, type Trip } from './TravelSystem';

interface TravelVehicleProps {
  buildingPositions: Record<string, { x: number; y: number; width: number; height: number }>;
  roadPaths: Record<string, string>;
}

function VehicleSVG({ type }: { type: string }) {
  if (type === 'jet') {
    return (
      <g>
        <ellipse cx="0" cy="0" rx="14" ry="6" fill="#06b6d4" opacity="0.9" />
        <polygon points="0,-5 12,-2 14,0 12,2 0,5" fill="#06b6d4" opacity="0.8" />
        <polygon points="-8,-2 -14,0 -8,2" fill="#0891b2" opacity="0.65" />
        <circle cx="-5" cy="0" r="1.5" fill="#fff" opacity="0.65" />
        <circle cx="0" cy="0" r="1.5" fill="#fff" opacity="0.65" />
        <circle cx="5" cy="0" r="1.5" fill="#fff" opacity="0.65" />
        {/* Air travel starts only after the road-bus progression. */}
        <line x1="-20" y1="0" x2="-35" y2="0" stroke="#fff" strokeWidth="0.5" opacity="0.3">
          <animate attributeName="x2" values="-35;-50;-35" dur="0.5s" repeatCount="indefinite" />
        </line>
      </g>
    );
  }

  if (type === 'team-bus') {
    return (
      <g>
        {/* Top road tier: custom team-logo bus, still clearly a bus before air travel. */}
        <rect x="-27" y="-12" width="54" height="22" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
        <rect x="-25" y="-16" width="45" height="9" rx="2" fill="#1d4ed8" stroke="#0f172a" strokeWidth="0.8" />
        <rect x="20" y="-10" width="5" height="12" rx="1" fill="#bae6fd" opacity="0.75" />
        {[-20, -11, -2, 7, 16].map((x) => (
          <rect key={x} x={x} y="-14" width="7" height="5" rx="1" fill="#bae6fd" stroke="#0f172a" strokeWidth="0.45" />
        ))}
        <path d="M -15 -2 h18 l5 4 -5 4 h-18 l-5 -4 Z" fill="#facc15" stroke="#0f172a" strokeWidth="0.7" />
        <text x="-6" y="4" textAnchor="middle" fill="#0f172a" fontSize="4.5" fontWeight="900">GRID</text>
        <circle cx="-16" cy="10" r="4.4" fill="#020617" />
        <circle cx="14" cy="10" r="4.4" fill="#020617" />
        <circle cx="-16" cy="10" r="2" fill="#e0f2fe" />
        <circle cx="14" cy="10" r="2" fill="#e0f2fe" />
        <rect x="23" y="-4" width="3" height="3" rx="1" fill="#fef08a" />
        <rect x="-28" y="2" width="3" height="3" rx="1" fill="#ef4444" />
      </g>
    );
  }

  if (type === 'coach') {
    return (
      <g>
        <rect x="-25" y="-11" width="50" height="21" rx="5" fill="#334155" stroke="#0f172a" strokeWidth="1.1" />
        <rect x="-23" y="-15" width="42" height="8" rx="3" fill="#64748b" stroke="#0f172a" strokeWidth="0.8" />
        <path d="M 18 -14 L 25 -8 L 25 8 L 18 9 Z" fill="#475569" stroke="#0f172a" strokeWidth="0.8" />
        {[-18, -9, 0, 9].map((x) => (
          <rect key={x} x={x} y="-13" width="7" height="5" rx="1" fill="#dbeafe" stroke="#0f172a" strokeWidth="0.45" />
        ))}
        <rect x="-18" y="-1" width="30" height="3" rx="1.5" fill="#fbbf24" />
        <rect x="15" y="-5" width="6" height="8" rx="1" fill="#0f172a" opacity="0.42" />
        <circle cx="-15" cy="10" r="4.2" fill="#0f172a" />
        <circle cx="14" cy="10" r="4.2" fill="#0f172a" />
        <circle cx="-15" cy="10" r="1.9" fill="#94a3b8" />
        <circle cx="14" cy="10" r="1.9" fill="#94a3b8" />
      </g>
    );
  }

  if (type === 'bus') {
    return (
      <g>
        {/* Low-level bus: yellow school bus, not a spaceship/blimp. */}
        <rect x="-25" y="-10" width="50" height="20" rx="2" fill="#facc15" stroke="#422006" strokeWidth="1.2" />
        <rect x="-23" y="-14" width="39" height="8" rx="2" fill="#fde047" stroke="#422006" strokeWidth="0.8" />
        <path d="M 16 -13 L 25 -7 L 25 9 L 16 9 Z" fill="#eab308" stroke="#422006" strokeWidth="0.8" />
        {[-20, -12, -4, 4, 12].map((x) => (
          <rect key={x} x={x} y="-12" width="6" height="5" rx="1" fill="#1e3a8a" opacity="0.7" />
        ))}
        <line x1="-24" y1="-2" x2="23" y2="-2" stroke="#422006" strokeWidth="1.1" />
        <line x1="-24" y1="4" x2="23" y2="4" stroke="#422006" strokeWidth="0.8" opacity="0.75" />
        <rect x="-4" y="-1" width="10" height="5" rx="1.5" fill="#422006" />
        <text x="1" y="3" textAnchor="middle" fill="#fde68a" fontSize="4" fontWeight="900">BUS</text>
        <circle cx="-15" cy="10" r="4.2" fill="#111827" />
        <circle cx="14" cy="10" r="4.2" fill="#111827" />
        <circle cx="-15" cy="10" r="1.8" fill="#94a3b8" />
        <circle cx="14" cy="10" r="1.8" fill="#94a3b8" />
        <rect x="22" y="-3" width="3" height="3" rx="1" fill="#fef08a" />
        <rect x="-27" y="2" width="3" height="3" rx="1" fill="#ef4444" />
        <rect x="-29" y="-5" width="5" height="5" rx="1" fill="#ef4444" stroke="#422006" strokeWidth="0.5" />
      </g>
    );
  }

  // Starter carpool/rental van: visibly smaller than the bus tiers.
  return (
    <g>
      <rect x="-14" y="-7" width="28" height="14" rx="3" fill="#64748b" stroke="#0f172a" strokeWidth="1" />
      <path d="M 5 -7 L 14 -2 L 14 7 L 5 7 Z" fill="#475569" stroke="#0f172a" strokeWidth="0.8" />
      <rect x="-11" y="-5" width="7" height="4" rx="1" fill="#bfdbfe" opacity="0.75" />
      <rect x="-2" y="-5" width="7" height="4" rx="1" fill="#bfdbfe" opacity="0.75" />
      <circle cx="-8" cy="7" r="3.2" fill="#111827" />
      <circle cx="8" cy="7" r="3.2" fill="#111827" />
      <circle cx="-8" cy="7" r="1.4" fill="#94a3b8" />
      <circle cx="8" cy="7" r="1.4" fill="#94a3b8" />
      <rect x="13" y="-2" width="2" height="2" rx="1" fill="#fef08a" />
    </g>
  );
}

const TRAVEL_VEHICLE_LABELS: Record<Trip['vehicleType'], string> = {
  van: 'Carpool Van',
  bus: 'School Bus',
  coach: 'Coach',
  'team-bus': 'Team Logo Bus',
  jet: 'Jet',
};

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
        {(['van', 'bus', 'coach', 'team-bus', 'jet'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setVehicleType(type)}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
              vehicleType === type
                ? 'bg-[#E94560] text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {TRAVEL_VEHICLE_LABELS[type]}
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
