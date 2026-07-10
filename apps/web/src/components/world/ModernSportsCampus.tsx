const TILE_W = 74;
const TILE_H = 38;

function iso(tileX: number, tileY: number) {
  return {
    x: (tileX - tileY) * (TILE_W / 2),
    y: (tileX + tileY) * (TILE_H / 2),
  };
}

function CampusBase({ tx, ty, width = 180, depth = 92, accent = '#22d3ee' }: { tx: number; ty: number; width?: number; depth?: number; accent?: string }) {
  const { x, y } = iso(tx, ty);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx="0" cy="26" rx={width * 0.62} ry={depth * 0.42} fill="rgba(2,6,23,.30)" />
      <path d={`M ${-width / 2} 0 L 0 ${depth / 2} L ${width / 2} 0 L 0 ${-depth / 2} Z`} fill="#dbeafe" stroke="#0f172a" strokeWidth="3" />
      <path d={`M ${-width / 2 + 10} 0 L 0 ${depth / 2 - 8} L ${width / 2 - 10} 0 L 0 ${-depth / 2 + 8} Z`} fill="#e2e8f0" stroke={accent} strokeWidth="2" opacity=".95" />
      <path d={`M ${-width / 2 + 22} 0 L 0 ${depth / 2 - 17} L ${width / 2 - 22} 0 L 0 ${-depth / 2 + 17} Z`} fill="none" stroke="#ffffff" strokeWidth="2" opacity=".75" />
    </g>
  );
}

function GlassTower({ x, y, width, height, depth, accent, label }: { x: number; y: number; width: number; height: number; depth: number; accent: string; label: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d={`M ${-width / 2} 0 L ${-width / 2} ${-height} L 0 ${-height + depth / 2} L 0 ${depth / 2} Z`} fill="#0f2740" stroke="#082f49" strokeWidth="2" />
      <path d={`M 0 ${depth / 2} L 0 ${-height + depth / 2} L ${width / 2} ${-height} L ${width / 2} 0 Z`} fill="#0b1d31" stroke="#082f49" strokeWidth="2" />
      <path d={`M ${-width / 2} ${-height} L 0 ${-height - depth / 2} L ${width / 2} ${-height} L 0 ${-height + depth / 2} Z`} fill="#bae6fd" stroke={accent} strokeWidth="2" />
      {[-0.34, -0.1, 0.14, 0.38].map((ratio) => (
        <line key={ratio} x1={-width / 2} y1={-height * (0.25 + ratio / 5)} x2="0" y2={-height * (0.25 + ratio / 5) + depth / 2} stroke="#38bdf8" strokeWidth="2" opacity=".55" />
      ))}
      {[-0.34, -0.1, 0.14, 0.38].map((ratio) => (
        <line key={`r-${ratio}`} x1="0" y1={-height * (0.25 + ratio / 5) + depth / 2} x2={width / 2} y2={-height * (0.25 + ratio / 5)} stroke="#0ea5e9" strokeWidth="2" opacity=".38" />
      ))}
      <rect x={-34} y={-height - 18} width="68" height="18" rx="6" fill="#020617" stroke={accent} strokeWidth="2" />
      <text x="0" y={-height - 6} textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="900" letterSpacing="1.4">{label}</text>
    </g>
  );
}

function PremiumArena() {
  const { x, y } = iso(0, -10);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusShadow)">
      <ellipse cx="0" cy="30" rx="174" ry="72" fill="rgba(2,6,23,.34)" />
      <ellipse cx="0" cy="-24" rx="160" ry="70" fill="#071525" stroke="#22d3ee" strokeWidth="5" />
      <ellipse cx="0" cy="-38" rx="138" ry="57" fill="#e2e8f0" stroke="#f8fafc" strokeWidth="3" />
      <ellipse cx="0" cy="-42" rx="108" ry="43" fill="#0f172a" stroke="#38bdf8" strokeWidth="4" />
      <ellipse cx="0" cy="-42" rx="72" ry="28" fill="#22c55e" stroke="#dcfce7" strokeWidth="2" />
      <rect x="-50" y="-54" width="100" height="24" rx="8" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity=".8" />
      {[-146, -110, -72, 72, 110, 146].map((lx, index) => (
        <g key={lx} transform={`translate(${lx}, ${index % 2 ? -72 : -48})`}>
          <rect x="-5" y="0" width="10" height="82" rx="4" fill="#334155" />
          <circle cx="0" cy="-5" r="12" fill="#f8fafc" stroke="#22d3ee" strokeWidth="3" filter="url(#campusGlow)" />
        </g>
      ))}
      <path d="M -132 -77 Q 0 -151 132 -77" fill="none" stroke="#bae6fd" strokeWidth="12" opacity=".95" />
      <path d="M -112 -79 Q 0 -132 112 -79" fill="none" stroke="#0ea5e9" strokeWidth="5" opacity=".8" />
      <rect x="-72" y="-151" width="144" height="34" rx="8" fill="#020617" stroke="#facc15" strokeWidth="3" />
      <text x="0" y="-129" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="900" letterSpacing="2">GRID ARENA</text>
      <g transform="translate(0,34)">
        <rect x="-52" y="-12" width="104" height="27" rx="10" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
        <text x="0" y="6" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="900">PREMIUM VENUE</text>
      </g>
    </g>
  );
}

function TrainingComplex() {
  const { x, y } = iso(10, -5);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusShadow)">
      <CampusBase tx={0} ty={0} width={210} depth={104} accent="#a78bfa" />
      <GlassTower x={-30} y={0} width={118} height={110} depth={54} accent="#a78bfa" label="PERFORMANCE" />
      <g transform="translate(64,-14)">
        <path d="M -54 0 L 0 28 L 54 0 L 0 -28 Z" fill="#16a34a" stroke="#dcfce7" strokeWidth="2" />
        {[-24, -8, 8, 24].map((lx) => <line key={lx} x1={lx} y1="-18" x2={lx} y2="18" stroke="#fff" opacity=".7" />)}
        <rect x="-34" y="-10" width="68" height="20" rx="8" fill="none" stroke="#fff" opacity=".8" />
      </g>
      <path d="M -94 -24 Q 0 -80 94 -24" fill="none" stroke="#c4b5fd" strokeWidth="6" opacity=".75" />
    </g>
  );
}

function PerformanceLab() {
  const { x, y } = iso(13, 7);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusShadow)">
      <CampusBase tx={0} ty={0} width={180} depth={88} accent="#ef4444" />
      <GlassTower x={0} y={0} width={112} height={102} depth={52} accent="#ef4444" label="SPORT SCIENCE" />
      <g transform="translate(0,-55)">
        <circle r="22" fill="#f8fafc" stroke="#ef4444" strokeWidth="4" />
        <path d="M -11 0 H 11 M 0 -11 V 11" stroke="#ef4444" strokeWidth="7" strokeLinecap="round" />
      </g>
      <g transform="translate(61,6)">
        <ellipse cx="0" cy="0" rx="30" ry="13" fill="#cffafe" stroke="#0891b2" strokeWidth="2" />
        <path d="M -18 0 Q 0 -30 18 0" fill="#67e8f9" opacity=".55" />
      </g>
    </g>
  );
}

function TeamHeadquarters() {
  const { x, y } = iso(5, 2);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusShadow)">
      <CampusBase tx={0} ty={0} width={186} depth={90} accent="#38bdf8" />
      <GlassTower x={0} y={0} width={124} height={118} depth={58} accent="#38bdf8" label="TEAM HQ" />
      <path d="M -47 -72 L 0 -102 L 47 -72 L 0 -44 Z" fill="#0284c7" opacity=".65" />
      <text x="0" y="-65" textAnchor="middle" fill="#f8fafc" fontSize="22" fontWeight="900">G</text>
      <g transform="translate(-68,9)">
        <rect x="-25" y="-20" width="50" height="26" rx="7" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
        <text x="0" y="-3" textAnchor="middle" fill="#bae6fd" fontSize="8" fontWeight="900">LOCKER WING</text>
      </g>
    </g>
  );
}

function MediaCenter() {
  const { x, y } = iso(-5, 2);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusShadow)">
      <CampusBase tx={0} ty={0} width={174} depth={86} accent="#fb923c" />
      <GlassTower x={0} y={0} width={116} height={105} depth={56} accent="#fb923c" label="MEDIA CENTER" />
      <g transform="translate(0,-55)">
        <circle r="18" fill="#fb923c" stroke="#fed7aa" strokeWidth="3" />
        <path d="M -7 -9 L 10 0 L -7 9 Z" fill="#fff" />
      </g>
      <g transform="translate(60,-5)">
        <rect x="-28" y="-25" width="56" height="34" rx="6" fill="#020617" stroke="#fb923c" strokeWidth="2" />
        <circle cx="0" cy="-8" r="8" fill="#38bdf8" />
        <rect x="-12" y="5" width="24" height="3" rx="2" fill="#f8fafc" />
      </g>
    </g>
  );
}

function RetailDistrict() {
  const { x, y } = iso(-13, 7);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusShadow)">
      <CampusBase tx={0} ty={0} width={220} depth={106} accent="#f59e0b" />
      {[-62, 0, 62].map((lx, index) => (
        <g key={lx} transform={`translate(${lx}, ${index === 1 ? -7 : 2})`}>
          <path d="M -42 0 L -42 -66 L 0 -86 L 42 -66 L 42 0 L 0 22 Z" fill={index === 1 ? '#172554' : '#0f172a'} stroke="#f59e0b" strokeWidth="2" />
          <path d="M -42 -66 L 0 -88 L 42 -66 L 0 -45 Z" fill={index === 1 ? '#f59e0b' : '#f8fafc'} stroke="#fbbf24" strokeWidth="2" />
          <rect x="-30" y="-48" width="60" height="28" rx="5" fill="#020617" stroke="#fde68a" />
          <text x="0" y="-30" textAnchor="middle" fill="#fde68a" fontSize="8" fontWeight="900">{index === 0 ? 'GEAR' : index === 1 ? 'MARKET' : 'CARDS'}</text>
          <path d="M -35 -13 H 35" stroke="#fb923c" strokeWidth="5" />
        </g>
      ))}
      <path d="M -105 24 Q 0 62 105 24" fill="none" stroke="#fde68a" strokeWidth="6" opacity=".75" />
    </g>
  );
}

function PracticePavilion() {
  const { x, y } = iso(-10, -5);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusShadow)">
      <CampusBase tx={0} ty={0} width={216} depth={108} accent="#22c55e" />
      <path d="M -88 0 L 0 43 L 88 0 L 0 -43 Z" fill="#16a34a" stroke="#dcfce7" strokeWidth="3" />
      <path d="M -65 0 L 0 31 L 65 0 L 0 -31 Z" fill="#22c55e" stroke="#fff" strokeWidth="2" />
      {[-42, -21, 0, 21, 42].map((lx) => <line key={lx} x1={lx} y1="-20" x2={lx} y2="20" stroke="#fff" opacity=".75" />)}
      <path d="M -92 -30 Q 0 -104 92 -30" fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <path d="M -83 -31 Q 0 -88 83 -31" fill="none" stroke="#38bdf8" strokeWidth="4" />
      <rect x="-48" y="-101" width="96" height="22" rx="6" fill="#020617" stroke="#22c55e" strokeWidth="2" />
      <text x="0" y="-86" textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="900">PRACTICE PAVILION</text>
    </g>
  );
}

function CampusSupportBuilding({ tx, ty, label, accent, icon }: { tx: number; ty: number; label: string; accent: string; icon: string }) {
  const { x, y } = iso(tx, ty);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusShadow)">
      <CampusBase tx={0} ty={0} width={150} depth={76} accent={accent} />
      <GlassTower x={0} y={0} width={96} height={86} depth={46} accent={accent} label={label} />
      <circle cx="0" cy="-45" r="18" fill="#020617" stroke={accent} strokeWidth="3" />
      <text x="0" y="-38" textAnchor="middle" fontSize="19">{icon}</text>
    </g>
  );
}

function CampusEnvironment() {
  const plazaLights = [
    [-6, -1], [-3, -4], [3, -4], [6, -1], [-7, 5], [7, 5], [-2, 9], [2, 9],
  ];
  const trees = [
    [-15, -8], [-12, -11], [-8, -13], [8, -13], [12, -11], [15, -8],
    [-16, 9], [-11, 13], [-6, 15], [7, 15], [12, 13], [16, 9],
  ];
  return (
    <g>
      <g transform="translate(0,0)" filter="url(#campusShadow)">
        <ellipse cx="0" cy="4" rx="94" ry="43" fill="#cbd5e1" stroke="#f8fafc" strokeWidth="4" />
        <ellipse cx="0" cy="0" rx="68" ry="31" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />
        <circle cx="0" cy="-8" r="23" fill="#38bdf8" opacity=".75" filter="url(#campusGlow)" />
        <path d="M -16 -10 L 0 -36 L 16 -10 L 0 9 Z" fill="#f8fafc" stroke="#38bdf8" strokeWidth="2" />
        <text x="0" y="-8" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="900">G</text>
      </g>
      {plazaLights.map(([tx, ty], index) => {
        const p = iso(tx, ty);
        return (
          <g key={`light-${index}`} transform={`translate(${p.x}, ${p.y})`}>
            <ellipse cx="0" cy="5" rx="16" ry="7" fill="rgba(14,165,233,.18)" />
            <rect x="-2" y="-29" width="4" height="34" rx="2" fill="#334155" />
            <circle cx="0" cy="-32" r="7" fill="#f8fafc" stroke="#22d3ee" strokeWidth="2" filter="url(#campusGlow)" />
          </g>
        );
      })}
      {trees.map(([tx, ty], index) => {
        const p = iso(tx, ty);
        return (
          <g key={`campus-tree-${index}`} transform={`translate(${p.x}, ${p.y})`}>
            <ellipse cx="0" cy="8" rx="22" ry="9" fill="rgba(15,23,42,.18)" />
            <rect x="-4" y="-24" width="8" height="30" rx="3" fill="#92400e" />
            <circle cx="0" cy="-35" r="19" fill="#0f766e" stroke="#99f6e4" strokeWidth="2" />
            <circle cx="-10" cy="-43" r="11" fill="#14b8a6" />
            <circle cx="11" cy="-42" r="12" fill="#0d9488" />
          </g>
        );
      })}
      {[-10, -5, 5, 10].map((tx, index) => {
        const p = iso(tx, 11);
        return (
          <g key={`banner-${tx}`} transform={`translate(${p.x}, ${p.y})`}>
            <rect x="-3" y="-72" width="6" height="78" fill="#334155" />
            <path d="M 3 -68 L 44 -57 L 3 -43 Z" fill={index % 2 ? '#38bdf8' : '#f97316'} stroke="#f8fafc" strokeWidth="1.5" />
            <text x="17" y="-53" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900">GRID</text>
          </g>
        );
      })}
      <g opacity=".65">
        <path d="M -780 390 Q -420 230 0 390 T 780 390" fill="none" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
        <path d="M -780 390 Q -420 230 0 390 T 780 390" fill="none" stroke="#38bdf8" strokeWidth="4" strokeDasharray="18 16" strokeLinecap="round" />
      </g>
    </g>
  );
}

export default function ModernSportsCampus() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      viewBox="-1120 -750 2240 1420"
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <filter id="campusShadow" x="-35%" y="-45%" width="170%" height="190%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#020617" floodOpacity=".30" />
        </filter>
        <filter id="campusGlow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <CampusEnvironment />
      <PremiumArena />
      <PracticePavilion />
      <TrainingComplex />
      <MediaCenter />
      <TeamHeadquarters />
      <RetailDistrict />
      <PerformanceLab />
      <CampusSupportBuilding tx={-7} ty={12} label="LEAGUE OPS" accent="#14b8a6" icon="📡" />
      <CampusSupportBuilding tx={4} ty={12} label="LEGACY HALL" accent="#facc15" icon="🏆" />
      <CampusSupportBuilding tx={14} ty={0} label="MOBILITY" accent="#94a3b8" icon="🚌" />
      <CampusSupportBuilding tx={-14} ty={0} label="PARTNERS" accent="#0ea5e9" icon="◆" />
    </svg>
  );
}
