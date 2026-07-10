const TILE_W = 74;
const TILE_H = 38;

function iso(tileX: number, tileY: number) {
  return { x: (tileX - tileY) * (TILE_W / 2), y: (tileX + tileY) * (TILE_H / 2) };
}

type CampusBuildingProps = {
  tx: number;
  ty: number;
  width?: number;
  depth?: number;
  height?: number;
  label: string;
  accent: string;
  roof?: 'flat' | 'saw' | 'glass';
  icon?: string;
};

function GroundPad({ width, depth, accent }: { width: number; depth: number; accent: string }) {
  return (
    <g>
      <ellipse cx="0" cy="22" rx={width * .59} ry={depth * .42} fill="rgba(15,23,42,.22)" />
      <path d={`M ${-width / 2} 0 L 0 ${depth / 2} L ${width / 2} 0 L 0 ${-depth / 2} Z`} fill="#d6d3cb" stroke="#334155" strokeWidth="3" />
      <path d={`M ${-width / 2 + 10} 0 L 0 ${depth / 2 - 8} L ${width / 2 - 10} 0 L 0 ${-depth / 2 + 8} Z`} fill="#ece9df" stroke={accent} strokeWidth="2" />
    </g>
  );
}

function CampusBuilding({ tx, ty, width = 128, depth = 62, height = 92, label, accent, roof = 'flat', icon }: CampusBuildingProps) {
  const { x, y } = iso(tx, ty);
  const left = -width / 2;
  const right = width / 2;
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusSoftShadow)">
      <GroundPad width={width + 54} depth={depth + 38} accent={accent} />

      <path d={`M ${left} 0 L ${left} ${-height} L 0 ${-height + depth / 2} L 0 ${depth / 2} Z`} fill="#d7d2c8" stroke="#334155" strokeWidth="2" />
      <path d={`M 0 ${depth / 2} L 0 ${-height + depth / 2} L ${right} ${-height} L ${right} 0 Z`} fill="#aaa69d" stroke="#334155" strokeWidth="2" />

      {roof === 'flat' && (
        <path d={`M ${left} ${-height} L 0 ${-height - depth / 2} L ${right} ${-height} L 0 ${-height + depth / 2} Z`} fill="#27313d" stroke="#111827" strokeWidth="3" />
      )}
      {roof === 'glass' && (
        <>
          <path d={`M ${left} ${-height} L 0 ${-height - depth / 2} L ${right} ${-height} L 0 ${-height + depth / 2} Z`} fill="#9dd6df" stroke="#155e75" strokeWidth="3" />
          <path d={`M ${left + 18} ${-height} L 0 ${-height - depth / 2 + 8} L ${right - 18} ${-height}`} fill="none" stroke="#e0f2fe" strokeWidth="3" opacity=".85" />
        </>
      )}
      {roof === 'saw' && (
        <path d={`M ${left} ${-height} L ${-width * .22} ${-height - 22} L 0 ${-height} L ${width * .22} ${-height - 22} L ${right} ${-height} L 0 ${-height + depth / 2} Z`} fill="#3f4852" stroke="#111827" strokeWidth="3" />
      )}

      {[-.32, 0, .32].map((ratio) => (
        <g key={ratio}>
          <rect x={left + 12} y={-height * (.72 + ratio / 10)} width={width / 5} height="18" rx="2" fill="#77b8c8" stroke="#164e63" />
          <rect x={right - width / 5 - 12} y={-height * (.58 + ratio / 10)} width={width / 5} height="18" rx="2" fill="#5f9eae" stroke="#164e63" />
        </g>
      ))}

      <rect x="-25" y="-31" width="50" height="31" rx="4" fill="#202a35" stroke="#0f172a" />
      <rect x="-8" y="-24" width="16" height="24" rx="2" fill={accent} opacity=".9" />

      <g transform={`translate(0, ${-height - depth / 2 - 18})`}>
        <rect x="-43" y="-13" width="86" height="24" rx="5" fill="#f6f1e7" stroke="#334155" strokeWidth="2" />
        <rect x="-43" y="-13" width="6" height="24" rx="3" fill={accent} />
        <text x="3" y="3" textAnchor="middle" fill="#1e293b" fontSize="9" fontWeight="900" letterSpacing="1">{label}</text>
      </g>

      {icon && <text x={right - 26} y={-height - 15} textAnchor="middle" fontSize="19">{icon}</text>}
    </g>
  );
}

function Arena() {
  const { x, y } = iso(0, -10);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusSoftShadow)">
      <ellipse cx="0" cy="30" rx="172" ry="69" fill="rgba(15,23,42,.24)" />
      <ellipse cx="0" cy="-18" rx="162" ry="68" fill="#2b3540" stroke="#111827" strokeWidth="4" />
      <ellipse cx="0" cy="-31" rx="142" ry="56" fill="#c9c6bd" stroke="#334155" strokeWidth="3" />
      <ellipse cx="0" cy="-35" rx="116" ry="45" fill="#17212b" stroke="#64748b" strokeWidth="3" />
      <ellipse cx="0" cy="-35" rx="76" ry="28" fill="#3d9b58" stroke="#d1fae5" strokeWidth="2" />
      <rect x="-52" y="-47" width="104" height="24" rx="7" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".8" />
      <path d="M -128 -71 Q 0 -132 128 -71" fill="none" stroke="#d7d2c8" strokeWidth="11" />
      <path d="M -108 -72 Q 0 -116 108 -72" fill="none" stroke="#334155" strokeWidth="4" />
      {[-128, -83, 83, 128].map((lx) => (
        <g key={lx} transform={`translate(${lx},-70)`}>
          <rect x="-4" y="0" width="8" height="74" fill="#475569" />
          <circle cx="0" cy="-3" r="9" fill="#fff8d6" stroke="#334155" strokeWidth="2" />
        </g>
      ))}
      <g transform="translate(0,-132)">
        <rect x="-62" y="-16" width="124" height="31" rx="5" fill="#f6f1e7" stroke="#334155" strokeWidth="3" />
        <rect x="-62" y="-16" width="8" height="31" fill="#d9a126" />
        <text x="5" y="4" textAnchor="middle" fill="#1e293b" fontSize="12" fontWeight="950" letterSpacing="1.6">GRID ARENA</text>
      </g>
    </g>
  );
}

function PracticeField() {
  const { x, y } = iso(-10, -5);
  return (
    <g transform={`translate(${x}, ${y})`} filter="url(#campusSoftShadow)">
      <GroundPad width={220} depth={114} accent="#4f8f58" />
      <path d="M -88 0 L 0 42 L 88 0 L 0 -42 Z" fill="#3f9856" stroke="#1f5f34" strokeWidth="3" />
      <path d="M -68 0 L 0 32 L 68 0 L 0 -32 Z" fill="#57ad68" stroke="#e8f5e9" strokeWidth="2" />
      {[-40,-20,0,20,40].map((lx) => <line key={lx} x1={lx} y1="-19" x2={lx} y2="19" stroke="#fff" opacity=".7" />)}
      <path d="M -94 -12 Q 0 -88 94 -12" fill="none" stroke="#48515b" strokeWidth="9" />
      <path d="M -72 -12 Q 0 -66 72 -12" fill="none" stroke="#d7d2c8" strokeWidth="5" />
      <g transform="translate(0,-78)">
        <rect x="-53" y="-14" width="106" height="26" rx="5" fill="#f6f1e7" stroke="#334155" strokeWidth="2" />
        <rect x="-53" y="-14" width="7" height="26" fill="#4f8f58" />
        <text x="4" y="3" textAnchor="middle" fill="#1e293b" fontSize="10" fontWeight="900">PRACTICE FIELD</text>
      </g>
    </g>
  );
}

function CampusEnvironment() {
  const lights = [[-8,-1],[-4,-3],[4,-3],[8,-1],[-7,6],[-2,8],[3,8],[8,5]];
  const trees = [[-15,-8],[-13,-3],[-9,11],[-4,13],[8,11],[13,8],[15,2],[11,-8]];
  return (
    <g pointerEvents="none">
      <path d="M -690 70 L -220 -170 L 0 -58 L 220 -170 L 690 70" fill="none" stroke="#d9d4ca" strokeWidth="34" opacity=".96" />
      <path d="M -690 70 L -220 -170 L 0 -58 L 220 -170 L 690 70" fill="none" stroke="#aaa69d" strokeWidth="3" opacity=".8" />
      {lights.map(([tx,ty], index) => { const p=iso(tx,ty); return <g key={index} transform={`translate(${p.x},${p.y})`}><ellipse cx="0" cy="4" rx="8" ry="4" fill="rgba(15,23,42,.2)"/><rect x="-2" y="-31" width="4" height="34" fill="#475569"/><circle cx="0" cy="-34" r="6" fill="#fff7cc" stroke="#334155"/></g>; })}
      {trees.map(([tx,ty], index) => { const p=iso(tx,ty); return <g key={index} transform={`translate(${p.x},${p.y})`}><ellipse cx="0" cy="8" rx="13" ry="6" fill="rgba(15,23,42,.18)"/><rect x="-4" y="-25" width="8" height="30" fill="#73553b"/><rect x="-18" y="-51" width="36" height="24" rx="4" fill="#2f7d45"/><rect x="-13" y="-67" width="26" height="20" rx="4" fill="#3f9655"/></g>; })}
      <g transform="translate(0,-18)">
        <ellipse cx="0" cy="15" rx="54" ry="25" fill="rgba(15,23,42,.2)" />
        <ellipse cx="0" cy="0" rx="46" ry="22" fill="#c9c6bd" stroke="#334155" strokeWidth="2" />
        <ellipse cx="0" cy="-3" rx="32" ry="15" fill="#69b8d1" stroke="#e0f2fe" strokeWidth="2" />
        <rect x="-6" y="-34" width="12" height="28" rx="3" fill="#475569" />
        <circle cx="0" cy="-39" r="6" fill="#fbbf24" />
      </g>
    </g>
  );
}

export default function ModernSportsCampus() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      viewBox="-1120 -750 2240 1420"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="campusSoftShadow" x="-35%" y="-35%" width="170%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#0f172a" floodOpacity=".24" />
        </filter>
      </defs>

      <CampusEnvironment />
      <Arena />
      <PracticeField />
      <CampusBuilding tx={10} ty={-5} width={150} depth={70} height={104} label="PERFORMANCE" accent="#7556a7" roof="glass" icon="🏋" />
      <CampusBuilding tx={5} ty={2} width={138} depth={66} height={96} label="TEAM HQ" accent="#277fa3" roof="flat" icon="G" />
      <CampusBuilding tx={-5} ty={2} width={132} depth={64} height={88} label="MEDIA" accent="#b6672d" roof="flat" icon="▶" />
      <CampusBuilding tx={-13} ty={7} width={164} depth={76} height={74} label="SPORTS MARKET" accent="#c08a22" roof="saw" icon="★" />
      <CampusBuilding tx={13} ty={7} width={132} depth={64} height={94} label="SPORT SCIENCE" accent="#b64141" roof="glass" icon="+" />
      <CampusBuilding tx={-7} ty={12} width={122} depth={58} height={92} label="LEAGUE OFFICE" accent="#347f76" roof="flat" />
      <CampusBuilding tx={4} ty={12} width={128} depth={62} height={84} label="LEGACY HALL" accent="#b28a24" roof="flat" icon="★" />
      <CampusBuilding tx={14} ty={0} width={154} depth={72} height={66} label="MOBILITY" accent="#596675" roof="saw" />
      <CampusBuilding tx={-14} ty={0} width={136} depth={66} height={88} label="PARTNERS" accent="#277fa3" roof="flat" />
    </svg>
  );
}
