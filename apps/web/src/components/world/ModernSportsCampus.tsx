const TILE_W = 74;
const TILE_H = 38;

function iso(tileX: number, tileY: number) {
  return { x: (tileX - tileY) * (TILE_W / 2), y: (tileX + tileY) * (TILE_H / 2) };
}

function Label({ text, y, accent, width = 110 }: { text: string; y: number; accent: string; width?: number }) {
  return (
    <g transform={`translate(0,${y})`}>
      <rect x={-width / 2} y="-14" width={width} height="27" rx="6" fill="#f7f3ea" stroke="#334155" strokeWidth="2" />
      <rect x={-width / 2} y="-14" width="7" height="27" rx="3" fill={accent} />
      <text x="4" y="4" textAnchor="middle" fill="#172033" fontSize="9" fontWeight="900" letterSpacing="1">{text}</text>
    </g>
  );
}

function Pad({ width, depth, accent }: { width: number; depth: number; accent: string }) {
  return <g><ellipse cy="23" rx={width * .58} ry={depth * .42} fill="rgba(15,23,42,.2)"/><path d={`M ${-width/2} 0 L 0 ${depth/2} L ${width/2} 0 L 0 ${-depth/2} Z`} fill="#ded9cf" stroke="#475569" strokeWidth="3"/><path d={`M ${-width/2+10} 0 L 0 ${depth/2-8} L ${width/2-10} 0 L 0 ${-depth/2+8} Z`} fill="#f0ede5" stroke={accent} strokeWidth="2"/></g>;
}

function Arena() {
  const { x, y } = iso(0, -10);
  return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><ellipse cy="28" rx="174" ry="70" fill="rgba(15,23,42,.24)"/><ellipse cy="-18" rx="162" ry="68" fill="#2c3642" stroke="#111827" strokeWidth="4"/><ellipse cy="-31" rx="142" ry="56" fill="#cac7bf" stroke="#475569" strokeWidth="3"/><ellipse cy="-35" rx="116" ry="45" fill="#17212b" stroke="#64748b" strokeWidth="3"/><ellipse cy="-35" rx="76" ry="28" fill="#3e9d59" stroke="#dcfce7" strokeWidth="2"/><path d="M-130-70Q0-135 130-70" fill="none" stroke="#ddd7cc" strokeWidth="12"/><path d="M-108-72Q0-116 108-72" fill="none" stroke="#334155" strokeWidth="4"/><Label text="GRID ARENA" y={-132} accent="#d7a229" width={126}/></g>;
}

function PracticeField() {
  const { x, y } = iso(-10, -5);
  return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={220} depth={114} accent="#4f8f58"/><path d="M-88 0L0 42L88 0L0-42Z" fill="#3f9856" stroke="#1f5f34" strokeWidth="3"/><path d="M-68 0L0 32L68 0L0-32Z" fill="#57ad68" stroke="#fff" strokeWidth="2"/>{[-40,-20,0,20,40].map(v=><line key={v} x1={v} y1="-19" x2={v} y2="19" stroke="#fff" opacity=".7"/>)}<path d="M-94-12Q0-88 94-12" fill="none" stroke="#48515b" strokeWidth="9"/><Label text="PRACTICE FIELD" y={-79} accent="#4f8f58" width={112}/></g>;
}

function PerformanceCenter() {
  const {x,y}=iso(10,-5); return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={214} depth={108} accent="#7556a7"/><path d="M-86 0L-86-82L-22-116L-22-16Z" fill="#cfc8d7" stroke="#43385e" strokeWidth="3"/><path d="M-22-16L-22-116L42-82L42 16Z" fill="#9b92a8" stroke="#43385e" strokeWidth="3"/><path d="M-86-82L-22-116L42-82L-22-48Z" fill="#a9dbe1" stroke="#25677a" strokeWidth="3"/><path d="M42 16L42-48L90-26L90 0L66 13Z" fill="#d8d2ca" stroke="#475569" strokeWidth="3"/><path d="M42-48L66-61L90-48L66-35Z" fill="#414b57"/><Label text="PERFORMANCE" y={-139} accent="#7556a7" width={116}/></g>;
}

function TeamHQ() {
  const {x,y}=iso(5,2); return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={196} depth={94} accent="#277fa3"/><path d="M-58 0V-112L0-143L0 30Z" fill="#d8d3ca" stroke="#334155" strokeWidth="3"/><path d="M0 30V-143L58-112V0Z" fill="#a9a59d" stroke="#334155" strokeWidth="3"/><path d="M-58-112L0-143L58-112L0-81Z" fill="#263543" stroke="#111827" strokeWidth="3"/><path d="M-90 8V-48L-58-66V0Z" fill="#c7c2b8" stroke="#475569" strokeWidth="2"/><path d="M58 0V-66L90-48V8Z" fill="#98948c" stroke="#475569" strokeWidth="2"/><text x="0" y="-89" textAnchor="middle" fontSize="28" fontWeight="950" fill="#277fa3">G</text><Label text="TEAM HQ" y={-166} accent="#277fa3" width={96}/></g>;
}

function MediaCenter() {
  const {x,y}=iso(-5,2); return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={190} depth={92} accent="#b6672d"/><path d="M-84 0V-62L0-98L84-62V0L0 38Z" fill="#bbb5ac" stroke="#4b5563" strokeWidth="3"/><path d="M-84-62L0-98L84-62L0-25Z" fill="#1f2937" stroke="#111827" strokeWidth="3"/><path d="M-44-71L0-89L44-71L0-52Z" fill="#d97732"/><circle cy="-61" r="20" fill="#f7f3ea" stroke="#b6672d" strokeWidth="4"/><path d="M-7-71L11-61L-7-51Z" fill="#b6672d"/><path d="M-72-38H72" stroke="#7dd3fc" strokeWidth="12" opacity=".75"/><Label text="MEDIA CENTER" y={-121} accent="#b6672d" width={118}/></g>;
}

function SportsMarket() {
  const {x,y}=iso(-13,7); return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={228} depth={112} accent="#c08a22"/>{[-66,0,66].map((cx,i)=><g key={cx} transform={`translate(${cx},${i===1?-9:0})`}><path d="M-38 0V-62L0-82L38-62V0L0 21Z" fill={i===1?'#4a3b22':'#d6d0c6'} stroke="#6b4f1d" strokeWidth="2.5"/><path d="M-38-62L0-82L38-62L0-41Z" fill={i===1?'#e1ad36':'#f4eee2'} stroke="#8a641d" strokeWidth="2"/><path d="M-31-44H31" stroke="#c08a22" strokeWidth="10"/><rect x="-23" y="-27" width="46" height="23" rx="4" fill="#26313c"/></g>)}<path d="M-108 26Q0 66 108 26" fill="none" stroke="#d8b45c" strokeWidth="7"/><Label text="SPORTS MARKET" y={-111} accent="#c08a22" width={126}/></g>;
}

function MedicalLab() {
  const {x,y}=iso(13,7); return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={190} depth={92} accent="#b64141"/><ellipse cy="-28" rx="74" ry="40" fill="#d9e9eb" stroke="#8aaab0" strokeWidth="3"/><path d="M-74-28V0L0 36L74 0V-28" fill="#b9c8ca" stroke="#64748b" strokeWidth="3"/><ellipse cy="-43" rx="56" ry="29" fill="#a7d9df" stroke="#2c7180" strokeWidth="3"/><circle cy="-48" r="20" fill="#f7f3ea" stroke="#b64141" strokeWidth="4"/><path d="M-11-48H11M0-59V-37" stroke="#b64141" strokeWidth="7" strokeLinecap="round"/><Label text="SPORT SCIENCE" y={-103} accent="#b64141" width={124}/></g>;
}

function LeagueOffice() {
  const {x,y}=iso(-7,12); return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={176} depth={86} accent="#347f76"/><path d="M-64 0V-74L0-107L64-74V0L0 34Z" fill="#d3cec5" stroke="#475569" strokeWidth="3"/><path d="M-64-74L0-107L64-74L0-41Z" fill="#3c4a54" stroke="#111827" strokeWidth="3"/><path d="M-82 4V-25L-64-36V0Z" fill="#a9a49b"/><path d="M64 0V-36L82-25V4Z" fill="#89857e"/><rect x="-30" y="-61" width="60" height="31" rx="5" fill="#347f76"/><text y="-41" textAnchor="middle" fill="white" fontSize="11" fontWeight="900">LEAGUE</text><Label text="LEAGUE OFFICE" y={-130} accent="#347f76" width={122}/></g>;
}

function LegacyHall() {
  const {x,y}=iso(4,12); return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={184} depth={88} accent="#b28a24"/><path d="M-72 0V-58L0-93L72-58V0L0 36Z" fill="#d8d1c2" stroke="#5f5540" strokeWidth="3"/><path d="M-72-58L0-93L72-58L0-23Z" fill="#645435" stroke="#3f321d" strokeWidth="3"/>{[-46,-15,15,46].map(v=><rect key={v} x={v-6} y="-50" width="12" height="50" fill="#efe7d2" stroke="#8c7a53"/>)}<path d="M-58 0H58" stroke="#b28a24" strokeWidth="7"/><text y="-62" textAnchor="middle" fontSize="22" fill="#d8ad39">★</text><Label text="LEGACY HALL" y={-116} accent="#b28a24" width={112}/></g>;
}

function MobilityDepot() {
  const {x,y}=iso(14,0); return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={222} depth={104} accent="#596675"/><path d="M-96 0V-52L0-83L96-52V0L0 39Z" fill="#aeb3b8" stroke="#374151" strokeWidth="3"/><path d="M-96-52L-48-76L0-52L48-76L96-52L0-18Z" fill="#3e4854" stroke="#111827" strokeWidth="3"/>{[-55,0,55].map(v=><rect key={v} x={v-22} y="-38" width="44" height="35" rx="5" fill="#24313d" stroke="#7dd3fc"/>)}<rect x="-78" y="10" width="156" height="18" rx="8" fill="#596675"/><Label text="MOBILITY DEPOT" y={-105} accent="#596675" width={126}/></g>;
}

function PartnerBank() {
  const {x,y}=iso(-14,0); return <g transform={`translate(${x},${y})`} filter="url(#campusSoftShadow)"><Pad width={188} depth={92} accent="#277fa3"/><path d="M-68 0V-70L0-105L68-70V0L0 35Z" fill="#d7d2c8" stroke="#475569" strokeWidth="3"/><path d="M-68-70L0-105L68-70L0-35Z" fill="#1f3446" stroke="#111827" strokeWidth="3"/><path d="M-56-47H56" stroke="#277fa3" strokeWidth="13"/><rect x="-28" y="-30" width="56" height="30" rx="5" fill="#20303c"/><circle cy="-62" r="18" fill="#f7f3ea" stroke="#277fa3" strokeWidth="4"/><text y="-56" textAnchor="middle" fill="#277fa3" fontSize="18" fontWeight="950">$</text><Label text="SPONSOR BANK" y={-128} accent="#277fa3" width={124}/></g>;
}

function CampusEnvironment() {
  const lights=[[-8,-1],[-4,-3],[4,-3],[8,-1],[-7,6],[-2,8],[3,8],[8,5]]; const trees=[[-15,-8],[-13,-3],[-9,11],[-4,13],[8,11],[13,8],[15,2],[11,-8]];
  return <g pointerEvents="none"><path d="M-690 70L-220-170L0-58L220-170L690 70" fill="none" stroke="#d9d4ca" strokeWidth="34"/><path d="M-690 70L-220-170L0-58L220-170L690 70" fill="none" stroke="#aaa69d" strokeWidth="3"/>{lights.map(([tx,ty],i)=>{const p=iso(tx,ty);return <g key={i} transform={`translate(${p.x},${p.y})`}><rect x="-2" y="-31" width="4" height="34" fill="#475569"/><circle cy="-34" r="6" fill="#fff7cc" stroke="#334155"/></g>})}{trees.map(([tx,ty],i)=>{const p=iso(tx,ty);return <g key={i} transform={`translate(${p.x},${p.y})`}><rect x="-4" y="-25" width="8" height="30" fill="#73553b"/><rect x="-18" y="-51" width="36" height="24" rx="4" fill="#2f7d45"/><rect x="-13" y="-67" width="26" height="20" rx="4" fill="#3f9655"/></g>})}</g>;
}

export default function ModernSportsCampus() {
  return <svg className="pointer-events-none absolute inset-0 z-[2] h-full w-full" viewBox="-1120 -750 2240 1420" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><defs><filter id="campusSoftShadow" x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#0f172a" floodOpacity=".24"/></filter></defs><CampusEnvironment/><Arena/><PracticeField/><PerformanceCenter/><TeamHQ/><MediaCenter/><SportsMarket/><MedicalLab/><LeagueOffice/><LegacyHall/><MobilityDepot/><PartnerBank/></svg>;
}
