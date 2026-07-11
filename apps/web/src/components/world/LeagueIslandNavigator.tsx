import { useMemo, useState, type CSSProperties } from 'react';
import {
  Building2,
  ChevronLeft,
  CircleDollarSign,
  Dumbbell,
  HeartPulse,
  Landmark,
  Radio,
  ShoppingBag,
  Trophy,
  Truck,
  Users,
} from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import './LeagueIslandNavigator.css';

type LeagueDestination = {
  id: string;
  name: string;
  tier: string;
  accent: string;
};

type HeadquartersFacility = {
  id: string;
  name: string;
  purpose: string;
  legacyLabel: string;
  icon: typeof Building2;
  x: string;
  y: string;
  accent: string;
};

const DESTINATIONS: LeagueDestination[] = [
  { id: 'regional', name: 'Regional League', tier: 'REGIONAL_PRO', accent: '#38bdf8' },
  { id: 'elite', name: 'Elite Franchise Circuit', tier: 'PRO_ELITE', accent: '#a855f7' },
  { id: 'college', name: 'College Conference', tier: 'TOP_COLLEGE', accent: '#22c55e' },
  { id: 'entry', name: 'Pro Entry League', tier: 'PRO_ENTRY', accent: '#f59e0b' },
];

const HEADQUARTERS_FACILITIES: HeadquartersFacility[] = [
  { id: 'commissioner', name: 'League Office', purpose: 'League administration', legacyLabel: 'Commissioner Office', icon: Landmark, x: '18%', y: '25%', accent: '#14b8a6' },
  { id: 'market', name: 'Sports Market', purpose: 'Teams and asset trading', legacyLabel: 'Sports Market', icon: ShoppingBag, x: '18%', y: '63%', accent: '#f59e0b' },
  { id: 'media', name: 'Media Center', purpose: 'News and broadcasts', legacyLabel: 'Clubhouse HQ', icon: Radio, x: '39%', y: '19%', accent: '#f97316' },
  { id: 'team', name: 'Team Headquarters', purpose: 'Roster management', legacyLabel: 'Locker Room', icon: Users, x: '61%', y: '19%', accent: '#38bdf8' },
  { id: 'training', name: 'Training Complex', purpose: 'Development and equipment', legacyLabel: 'Training Gym', icon: Dumbbell, x: '82%', y: '25%', accent: '#8b5cf6' },
  { id: 'medical', name: 'Sports Medicine', purpose: 'Treatment and recovery', legacyLabel: 'Medical Center', icon: HeartPulse, x: '82%', y: '63%', accent: '#ef4444' },
  { id: 'garage', name: 'Mobility Depot', purpose: 'Transport and maintenance', legacyLabel: 'Team Garage', icon: Truck, x: '61%', y: '77%', accent: '#64748b' },
  { id: 'bank', name: 'Sponsor Bank', purpose: 'Wallet and sponsorships', legacyLabel: 'Sponsor Bank', icon: CircleDollarSign, x: '39%', y: '77%', accent: '#0ea5e9' },
];

const CRITICAL_WORLD_CSS = `
  .league-hq-view,.league-island-view{position:fixed!important;inset:0!important;z-index:30!important;overflow:hidden!important;background:#72d7f5!important;color:white!important;isolation:isolate!important}
  .league-hq-sky,.league-island-sky{position:absolute!important;inset:0!important;z-index:-1!important;background:linear-gradient(#86def8 0 58%,#32acd4 58% 100%)!important}
  .league-hq-header,.league-island-header{position:relative!important;z-index:4!important;height:76px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:24px!important;padding:0 28px!important;background:#071321!important;border-bottom:1px solid rgba(255,255,255,.12)!important}
  .league-hq-header span,.league-island-header span{display:block!important;color:#67e8f9!important;font-size:9px!important;text-transform:uppercase!important;letter-spacing:.24em!important;font-weight:900!important}
  .league-hq-header h1,.league-island-header h1{margin:2px 0 0!important;font-size:22px!important}.league-hq-header p{max-width:520px!important;margin:0!important;color:#a7b5c7!important;font-size:12px!important;text-align:right!important}
  .league-hq-stage,.league-island-stage{position:relative!important;z-index:2!important;height:calc(100vh - 76px)!important;display:grid!important;place-items:center!important;padding:30px 30px 132px!important}
  .league-hq-island,.league-island-land{position:relative!important;width:min(1480px,94vw)!important;height:min(760px,74vh)!important;overflow:hidden!important;border:14px solid #f3e7bc!important;border-radius:42% 42% 38% 38%/18% 18% 24% 24%!important;background:linear-gradient(135deg,#54bd49,#8bd65d)!important;box-shadow:0 35px 0 #2b97a8,0 50px 80px rgba(2,6,23,.3)!important}
  .league-hq-ring-road{position:absolute!important;inset:12%!important;border:34px solid #d9d4ca!important;border-radius:44%!important}.league-hq-cross-road,.league-island-road{position:absolute!important;border:3px solid #9a958b!important;border-radius:999px!important;background:#d9d4ca!important}.league-hq-cross-road-a,.league-island-road-a{left:8%!important;right:8%!important;top:50%!important;height:34px!important;transform:rotate(-7deg)!important}.league-hq-cross-road-b,.league-island-road-b{top:8%!important;bottom:8%!important;left:50%!important;width:34px!important;transform:rotate(7deg)!important}
  .league-hq-center,.league-island-center{position:absolute!important;z-index:3!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;width:210px!important;height:136px!important;border:4px solid #e8eef5!important;border-radius:26px!important;background:#15243a!important;text-align:center!important}
  .league-hq-facility{position:absolute!important;z-index:3!important;transform:translate(-50%,-50%)!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:4px!important;border:0!important;background:transparent!important;color:#0f172a!important}.league-hq-building{display:grid!important;place-items:center!important;width:118px!important;height:84px!important;border:5px solid #334155!important;border-top-color:var(--facility-accent)!important;border-radius:22px 22px 12px 12px!important;background:linear-gradient(145deg,#f8fafc,#cbd5e1)!important;color:var(--facility-accent)!important}.league-hq-facility strong{margin-top:4px!important;font-size:12px!important}.league-hq-facility small{border-radius:999px!important;background:rgba(255,255,255,.9)!important;padding:3px 7px!important;color:#334155!important;font-size:8px!important}
  .league-route-dock{position:fixed!important;z-index:35!important;left:50%!important;bottom:18px!important;width:min(980px,calc(100vw - 36px))!important;transform:translateX(-50%)!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:18px!important;background:#071321!important;padding:10px!important}.league-route-dock-title{margin-bottom:7px!important;color:#94a3b8!important;font-size:9px!important;font-weight:900!important;letter-spacing:.2em!important;text-align:center!important;text-transform:uppercase!important}.league-route-dock-items{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important}.league-route-dock button{min-width:0!important;border:1px solid var(--league-accent)!important;border-radius:12px!important;background:rgba(255,255,255,.045)!important;color:white!important;padding:10px 12px!important;text-align:left!important}.league-route-dock strong,.league-route-dock small{display:block!important}.league-route-dock strong{font-size:11px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.league-route-dock small{margin-top:2px!important;color:#94a3b8!important;font-size:8px!important}
  .league-island-header{display:grid!important;grid-template-columns:1fr auto 1fr!important}.league-island-header button{justify-self:start!important;display:flex!important;align-items:center!important;gap:7px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:12px!important;background:#142238!important;color:white!important;padding:9px 12px!important}.league-tier-badge{justify-self:end!important;border:1px solid!important;border-radius:999px!important;padding:8px 12px!important}.league-stadium-grid{position:absolute!important;inset:58px 80px!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;align-items:center!important;gap:84px 64px!important}
`;

function openLegacyFacility(label: string) {
  const root = document.querySelector('.legacy-world-layer');
  if (!root) return false;
  const wanted = label.trim().toLowerCase();
  const textNode = Array.from(root.querySelectorAll<SVGTextElement>('svg text')).find((node) =>
    (node.textContent || '').trim().toLowerCase().includes(wanted),
  );
  if (!textNode) return false;
  let target: Element | null = textNode;
  while (target && target !== root) {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    target = target.parentElement;
  }
  return true;
}

function CriticalWorldStyles() {
  return <style>{CRITICAL_WORLD_CSS}</style>;
}

function HeadquartersView({ onSelectLeague }: { onSelectLeague: (league: LeagueDestination) => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const openFacility = (facility: HeadquartersFacility) => {
    setMessage(null);
    if (!openLegacyFacility(facility.legacyLabel)) setMessage(`${facility.name} is temporarily unavailable.`);
  };

  return (
    <div className="league-hq-view fixed inset-0 z-[30] overflow-hidden text-white" style={{ background: '#72d7f5' }}>
      <CriticalWorldStyles />
      <div className="league-hq-sky" />
      <header className="league-hq-header">
        <div><span>World Hub</span><h1>League Headquarters</h1></div>
        <p>Shared league services and franchise operations.</p>
      </header>
      <main className="league-hq-stage">
        <div className="league-hq-island">
          <div className="league-hq-ring-road" />
          <div className="league-hq-cross-road league-hq-cross-road-a" />
          <div className="league-hq-cross-road league-hq-cross-road-b" />
          <div className="league-hq-center"><Trophy className="h-8 w-8" /><strong>GRID League Council</strong><small>Headquarters plaza</small></div>
          {HEADQUARTERS_FACILITIES.map((facility) => {
            const Icon = facility.icon;
            return (
              <button key={facility.id} type="button" className="league-hq-facility" style={{ left: facility.x, top: facility.y, '--facility-accent': facility.accent } as CSSProperties} title={facility.purpose} onClick={() => openFacility(facility)}>
                <span className="league-hq-building"><Icon className="h-7 w-7" /></span>
                <strong>{facility.name}</strong><small>{facility.purpose}</small>
              </button>
            );
          })}
        </div>
      </main>
      <nav className="league-route-dock" aria-label="Travel to a league island">
        <div className="league-route-dock-title">League Routes</div>
        <div className="league-route-dock-items">
          {DESTINATIONS.map((league) => <button key={league.id} type="button" onClick={() => onSelectLeague(league)} style={{ '--league-accent': league.accent } as CSSProperties}><strong>{league.name}</strong><small>{league.tier.replaceAll('_', ' ')}</small></button>)}
        </div>
        {message && <div className="league-route-message">{message}</div>}
      </nav>
    </div>
  );
}

export default function LeagueIslandNavigator() {
  const { teams, selectedTeamId, setSelectedTeamId } = useGameStore();
  const [destination, setDestination] = useState<LeagueDestination | null>(null);
  const leagueTeams = useMemo(() => {
    if (!destination) return [];
    const exact = teams.filter((team) => team.tier === destination.tier);
    return exact.length ? exact : teams.slice(0, 8);
  }, [destination, teams]);

  if (!destination) return <HeadquartersView onSelectLeague={setDestination} />;

  return (
    <div className="league-island-view fixed inset-0 z-[30] overflow-hidden text-white" style={{ background: '#72d7f5' }}>
      <CriticalWorldStyles />
      <div className="league-island-sky" />
      <header className="league-island-header">
        <button type="button" onClick={() => setDestination(null)}><ChevronLeft className="h-4 w-4" /> Headquarters</button>
        <div><span>League Island</span><h1>{destination.name}</h1></div>
        <div className="league-tier-badge" style={{ borderColor: destination.accent }}>{destination.tier.replaceAll('_', ' ')}</div>
      </header>
      <main className="league-island-stage">
        <div className="league-island-land">
          <div className="league-island-road league-island-road-a" /><div className="league-island-road league-island-road-b" />
          <div className="league-island-center"><Trophy className="h-7 w-7" /><strong>{destination.name}</strong><small>Stadium district</small></div>
          <div className="league-stadium-grid">
            {leagueTeams.map((team, index) => {
              const venue = team.venue;
              const selected = team.id === selectedTeamId;
              const capacity = venue?.capacity || 5000;
              const scale = Math.min(1.25, Math.max(.82, .82 + capacity / 100000));
              return (
                <button key={team.id} type="button" className={`league-stadium ${selected ? 'is-selected' : ''}`} style={{ '--stadium-scale': scale, '--stadium-accent': destination.accent } as CSSProperties} onClick={() => setSelectedTeamId(team.id)}>
                  <span className="league-stadium-shell"><span className="league-stadium-field" /></span>
                  <strong>{team.name}</strong><small>{venue?.name || 'Team Stadium'} · {capacity.toLocaleString()} seats</small>
                  <span className="league-stadium-meta">{venue?.tier?.replaceAll('_', ' ') || 'PARK FIELD'} · Prestige {venue?.prestige || 0}</span>
                  <span className="league-sponsor-banner">Sponsor inventory</span><span className="league-upgrade-badge">Condition {venue?.condition ?? 70}%</span><span className="league-stadium-index">{index + 1}</span>
                </button>
              );
            })}
            {leagueTeams.length === 0 && <div className="league-empty">No teams are assigned to this league island yet.</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
