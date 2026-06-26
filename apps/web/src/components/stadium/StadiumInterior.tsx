import { useState } from 'react';

export interface StadiumSection {
  id: string;
  name: string;
  tier: string; // min stadium tier to have this section
  condition: number; // 0-100
  maxCapacity: number;
  currentUpgrade: number; // 0-5
  maxUpgrade: number; // based on stadium tier
  revenuePerGame: number; // base revenue
  upgradeCost: number;
  description: string;
}

export interface StadiumInteriorData {
  name: string;
  tier: string;
  capacity: number;
  ticketPrice: number;
  prestige: number;
  overallCondition: number;
  sections: StadiumSection[];
  totalRevenuePerGame: number;
  lastUpgradeDate: string | null;
}

interface StadiumInteriorProps {
  data: StadiumInteriorData;
  onSectionClick: (sectionId: string) => void;
  selectedSectionId: string | null;
}

const TIER_MAX_UPGRADES: Record<string, number> = {
  PARK_FIELD: 1,
  COMMUNITY_FIELD: 2,
  SMALL_STADIUM: 3,
  REGIONAL_STADIUM: 4,
  PRO_STADIUM: 5,
  ELITE: 6,
};

// Isometric-style 2.5D stadium cutaway
export default function StadiumInterior({ data, onSectionClick, selectedSectionId }: StadiumInteriorProps) {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  const tierNum = TIER_MAX_UPGRADES[data.tier] || 1;

  const sectionColor = (sectionId: string, baseColor: string) => {
    const section = data.sections.find((s) => s.id === sectionId);
    const condition = section?.condition || 100;
    const isSelected = selectedSectionId === sectionId;
    const isHovered = hoveredSection === sectionId;
    const dim = isSelected || isHovered ? 1 : 0.85;

    // Adjust color based on condition (100 = full color, 0 = dark/greyed)
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    const factor = 0.3 + (condition / 100) * 0.7;
    const gr = Math.floor(r * factor * dim);
    const gg = Math.floor(g * factor * dim);
    const gb = Math.floor(b * factor * dim);
    return `rgb(${gr}, ${gg}, ${gb})`;
  };

  const sectionStroke = (sectionId: string) => {
    const isSelected = selectedSectionId === sectionId;
    const isHovered = hoveredSection === sectionId;
    if (isSelected) return '#22d3ee'; // cyan
    if (isHovered) return '#E94560'; // accent
    return 'rgba(255,255,255,0.2)';
  };

  const sectionWidth = (sectionId: string) => {
    const isSelected = selectedSectionId === sectionId;
    const isHovered = hoveredSection === sectionId;
    return isSelected || isHovered ? 2 : 1;
  };

  // The stadium is drawn as a 2.5D cutaway from the right side looking left/down
  // Center field at origin, everything built around it
  const cx = 350; // center x
  const cy = 240; // center y
  const fw = 200; // field width (perspective)
  const fh = 120; // field height (perspective)

  const standWidth = 50;
  const luxuryBoxHeight = 20;

  // Only show sections that are available for the current tier
  const hasSection = (sectionId: string) => {
    const section = data.sections.find((s) => s.id === sectionId);
    if (!section) return false;
    return TIER_MAX_UPGRADES[section.tier] <= tierNum;
  };

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox="0 0 700 500" className="w-full h-auto" style={{ maxWidth: '100%' }}>
        <defs>
          <filter id="sectionShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.3" />
          </filter>
          <filter id="fieldGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="grass" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#16a34a" />
            <line x1="0" y1="10" x2="20" y2="10" stroke="#15803d" strokeWidth="0.5" opacity="0.3" />
            <line x1="10" y1="0" x2="10" y2="20" stroke="#15803d" strokeWidth="0.5" opacity="0.3" />
          </pattern>
          <pattern id="seats" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="currentColor" opacity="0.6" rx="1" />
          </pattern>
          <pattern id="luxury" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="currentColor" opacity="0.5" rx="2" />
            <rect x="2" y="2" width="3" height="3" fill="#fbbf24" opacity="0.8" />
          </pattern>
        </defs>

        {/* Background */}
        <rect width="700" height="500" fill="#0f172a" rx="12" />

        {/* Ground / Foundation */}
        <rect x={cx - fw / 2 - standWidth} y={cy + fh / 2} width={fw + standWidth * 2} height="20" fill="#334155" rx="2" />
        <text x={cx} y={cy + fh / 2 + 14} textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600">GROUND LEVEL</text>

        {/* --- STADIUM SECTIONS --- */}

        {/* 1. LOCKER ROOM (bottom area, left side) */}
        {hasSection('locker') && (
          <g
            style={{ cursor: 'pointer' }}
            onClick={() => onSectionClick('locker')}
            onMouseEnter={() => setHoveredSection('locker')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x={cx - fw / 2 - 80}
              y={cy + fh / 2 + 5}
              width="70"
              height="35"
              fill={sectionColor('locker', '#475569')}
              stroke={sectionStroke('locker')}
              strokeWidth={sectionWidth('locker')}
              rx="3"
              filter="url(#sectionShadow)"
            />
            <text x={cx - fw / 2 - 45} y={cy + fh / 2 + 26} textAnchor="middle" fill="white" fontSize="8" fontWeight="700" style={{ pointerEvents: 'none' }}>
              LOCKER ROOM
            </text>
          </g>
        )}

        {/* 2. CONCESSIONS (bottom area, right side) */}
        {hasSection('concessions') && (
          <g
            style={{ cursor: 'pointer' }}
            onClick={() => onSectionClick('concessions')}
            onMouseEnter={() => setHoveredSection('concessions')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x={cx + fw / 2 + 10}
              y={cy + fh / 2 + 5}
              width="70"
              height="35"
              fill={sectionColor('concessions', '#d97706')}
              stroke={sectionStroke('concessions')}
              strokeWidth={sectionWidth('concessions')}
              rx="3"
              filter="url(#sectionShadow)"
            />
            <text x={cx + fw / 2 + 45} y={cy + fh / 2 + 26} textAnchor="middle" fill="white" fontSize="8" fontWeight="700" style={{ pointerEvents: 'none' }}>
              CONCESSIONS
            </text>
          </g>
        )}

        {/* 3. FIELD */}
        <g>
          {/* Field base */}
          <rect
            x={cx - fw / 2}
            y={cy - fh / 2}
            width={fw}
            height={fh}
            fill="url(#grass)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            rx="4"
          />
          {/* Field lines */}
          <ellipse cx={cx} cy={cy} rx={fh / 2.5} ry={fh / 3.5} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 2" />
          <line x1={cx} y1={cy - fh / 2} x2={cx} y2={cy + fh / 2} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 2" />
          <line x1={cx - fw / 2} y1={cy} x2={cx + fw / 2} y2={cy} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 2" />
          {/* End zones */}
          <rect x={cx - fw / 2} y={cy - fh / 2} width="30" height={fh} fill="#E94560" opacity="0.3" rx="2" />
          <rect x={cx + fw / 2 - 30} y={cy - fh / 2} width="30" height={fh} fill="#E94560" opacity="0.3" rx="2" />
          <text x={cx - fw / 2 + 15} y={cy + 3} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontWeight="800" style={{ pointerEvents: 'none' }}>GRID</text>
          <text x={cx + fw / 2 - 15} y={cy + 3} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontWeight="800" style={{ pointerEvents: 'none' }}>CITY</text>
        </g>

        {/* 4. LOWER STANDS (surrounding the field) */}
        {hasSection('lower') && (
          <g
            style={{ cursor: 'pointer' }}
            onClick={() => onSectionClick('lower')}
            onMouseEnter={() => setHoveredSection('lower')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            {/* Left stands */}
            <rect
              x={cx - fw / 2 - standWidth}
              y={cy - fh / 2}
              width={standWidth}
              height={fh}
              fill={sectionColor('lower', '#3b82f6')}
              stroke={sectionStroke('lower')}
              strokeWidth={sectionWidth('lower')}
              rx="2"
            />
            <text x={cx - fw / 2 - standWidth / 2} y={cy} textAnchor="middle" fill="white" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>LOWER</text>

            {/* Right stands */}
            <rect
              x={cx + fw / 2}
              y={cy - fh / 2}
              width={standWidth}
              height={fh}
              fill={sectionColor('lower', '#3b82f6')}
              stroke={sectionStroke('lower')}
              strokeWidth={sectionWidth('lower')}
              rx="2"
            />
            <text x={cx + fw / 2 + standWidth / 2} y={cy} textAnchor="middle" fill="white" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>LOWER</text>

            {/* Top stands */}
            <rect
              x={cx - fw / 2}
              y={cy - fh / 2 - standWidth}
              width={fw}
              height={standWidth}
              fill={sectionColor('lower', '#3b82f6')}
              stroke={sectionStroke('lower')}
              strokeWidth={sectionWidth('lower')}
              rx="2"
            />
            <text x={cx} y={cy - fh / 2 - standWidth / 2 + 3} textAnchor="middle" fill="white" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>LOWER STANDS</text>

            {/* Bottom stands */}
            <rect
              x={cx - fw / 2}
              y={cy + fh / 2}
              width={fw}
              height={standWidth}
              fill={sectionColor('lower', '#3b82f6')}
              stroke={sectionStroke('lower')}
              strokeWidth={sectionWidth('lower')}
              rx="2"
            />
            <text x={cx} y={cy + fh / 2 + standWidth / 2 + 3} textAnchor="middle" fill="white" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>LOWER STANDS</text>
          </g>
        )}

        {/* 5. UPPER STANDS (above lower) */}
        {hasSection('upper') && (
          <g
            style={{ cursor: 'pointer' }}
            onClick={() => onSectionClick('upper')}
            onMouseEnter={() => setHoveredSection('upper')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            {/* Left upper */}
            <rect
              x={cx - fw / 2 - standWidth - 10}
              y={cy - fh / 2 - 10}
              width={standWidth + 10}
              height={fh + 20}
              fill={sectionColor('upper', '#8b5cf6')}
              stroke={sectionStroke('upper')}
              strokeWidth={sectionWidth('upper')}
              rx="2"
              opacity="0.9"
            />
            <text x={cx - fw / 2 - standWidth - 5} y={cy} textAnchor="middle" fill="white" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>UPPER</text>

            {/* Right upper */}
            <rect
              x={cx + fw / 2}
              y={cy - fh / 2 - 10}
              width={standWidth + 10}
              height={fh + 20}
              fill={sectionColor('upper', '#8b5cf6')}
              stroke={sectionStroke('upper')}
              strokeWidth={sectionWidth('upper')}
              rx="2"
              opacity="0.9"
            />
            <text x={cx + fw / 2 + standWidth + 5} y={cy} textAnchor="middle" fill="white" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>UPPER</text>

            {/* Top upper */}
            <rect
              x={cx - fw / 2 - 10}
              y={cy - fh / 2 - standWidth - 10}
              width={fw + 20}
              height={standWidth + 10}
              fill={sectionColor('upper', '#8b5cf6')}
              stroke={sectionStroke('upper')}
              strokeWidth={sectionWidth('upper')}
              rx="2"
              opacity="0.9"
            />
            <text x={cx} y={cy - fh / 2 - standWidth - 5 + 3} textAnchor="middle" fill="white" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>UPPER DECK</text>

            {/* Bottom upper */}
            <rect
              x={cx - fw / 2 - 10}
              y={cy + fh / 2}
              width={fw + 20}
              height={standWidth + 10}
              fill={sectionColor('upper', '#8b5cf6')}
              stroke={sectionStroke('upper')}
              strokeWidth={sectionWidth('upper')}
              rx="2"
              opacity="0.9"
            />
            <text x={cx} y={cy + fh / 2 + standWidth + 5 + 3} textAnchor="middle" fill="white" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>UPPER DECK</text>
          </g>
        )}

        {/* 6. LUXURY BOXES (top level) */}
        {hasSection('luxury') && (
          <g
            style={{ cursor: 'pointer' }}
            onClick={() => onSectionClick('luxury')}
            onMouseEnter={() => setHoveredSection('luxury')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x={cx - fw / 2 - 20}
              y={cy - fh / 2 - standWidth - 30}
              width={fw + 40}
              height={luxuryBoxHeight}
              fill={sectionColor('luxury', '#fbbf24')}
              stroke={sectionStroke('luxury')}
              strokeWidth={sectionWidth('luxury')}
              rx="3"
              filter="url(#sectionShadow)"
            />
            <text x={cx} y={cy - fh / 2 - standWidth - 18} textAnchor="middle" fill="#1e293b" fontSize="8" fontWeight="800" style={{ pointerEvents: 'none' }}>
              ★ LUXURY BOXES ★
            </text>

            {/* Luxury boxes on the sides too */}
            <rect
              x={cx - fw / 2 - standWidth - 20}
              y={cy - fh / 2 - 5}
              width={luxuryBoxHeight}
              height={fh + 10}
              fill={sectionColor('luxury', '#fbbf24')}
              stroke={sectionStroke('luxury')}
              strokeWidth={sectionWidth('luxury')}
              rx="3"
              filter="url(#sectionShadow)"
            />

            <rect
              x={cx + fw / 2 + standWidth + 5}
              y={cy - fh / 2 - 5}
              width={luxuryBoxHeight}
              height={fh + 10}
              fill={sectionColor('luxury', '#fbbf24')}
              stroke={sectionStroke('luxury')}
              strokeWidth={sectionWidth('luxury')}
              rx="3"
              filter="url(#sectionShadow)"
            />
          </g>
        )}

        {/* 7. PRESS BOX / SCOREBOARD (top) */}
        {hasSection('press') && (
          <g
            style={{ cursor: 'pointer' }}
            onClick={() => onSectionClick('press')}
            onMouseEnter={() => setHoveredSection('press')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x={cx - 40}
              y={cy - fh / 2 - standWidth - 55}
              width="80"
              height="20"
              fill={sectionColor('press', '#64748b')}
              stroke={sectionStroke('press')}
              strokeWidth={sectionWidth('press')}
              rx="2"
            />
            <text x={cx} y={cy - fh / 2 - standWidth - 42} textAnchor="middle" fill="white" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>
              PRESS BOX
            </text>

            {/* Scoreboard */}
            <rect
              x={cx - 30}
              y={cy + fh / 2 + 35}
              width="60"
              height="25"
              fill="#1e293b"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
              rx="3"
            />
            <text x={cx} y={cy + fh / 2 + 52} textAnchor="middle" fill="#E94560" fontSize="10" fontWeight="900" fontFamily="monospace" style={{ pointerEvents: 'none' }}>
              00 - 00
            </text>
            <text x={cx} y={cy + fh / 2 + 42} textAnchor="middle" fill="#fbbf24" fontSize="6" fontWeight="700" style={{ pointerEvents: 'none' }}>
              GRID LEAGUE
            </text>
          </g>
        )}

        {/* 8. PREMIUM CLUB (right side, larger tier) */}
        {hasSection('club') && (
          <g
            style={{ cursor: 'pointer' }}
            onClick={() => onSectionClick('club')}
            onMouseEnter={() => setHoveredSection('club')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <rect
              x={cx + fw / 2 + standWidth + 25}
              y={cy - fh / 4}
              width="40"
              height={fh / 2}
              fill={sectionColor('club', '#ec4899')}
              stroke={sectionStroke('club')}
              strokeWidth={sectionWidth('club')}
              rx="3"
              filter="url(#sectionShadow)"
            />
            <text
              x={cx + fw / 2 + standWidth + 45}
              y={cy + 3}
              textAnchor="middle"
              fill="white"
              fontSize="7"
              fontWeight="700"
              style={{ pointerEvents: 'none' }}
            >
              CLUB
            </text>
          </g>
        )}

        {/* Stadium name label */}
        <text x={cx} y="30" textAnchor="middle" fill="white" fontSize="16" fontWeight="900" style={{ pointerEvents: 'none' }}>
          {data.name}
        </text>
        <text x={cx} y="50" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600" style={{ pointerEvents: 'none' }}>
          {data.capacity.toLocaleString()} capacity • {data.prestige} prestige
        </text>

        {/* Condition meter bottom left */}
        <g transform={`translate(30, 470)`}>
          <rect x="0" y="0" width="120" height="12" rx="6" fill="rgba(255,255,255,0.1)" />
          <rect x="0" y="0" width={120 * (data.overallCondition / 100)} height="12" rx="6" fill={data.overallCondition > 70 ? '#22c55e' : data.overallCondition > 40 ? '#fbbf24' : '#ef4444'} />
          <text x="60" y="9" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" style={{ pointerEvents: 'none' }}>
            Overall {data.overallCondition}%
          </text>
        </g>
      </svg>
    </div>
  );
}
