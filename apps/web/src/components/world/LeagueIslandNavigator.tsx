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

function HeadquartersView({ onSelectLeague }: { onSelectLeague: (league: LeagueDestination) => void }) {
  const [message, setMessage] = useState<string | null>(null);

  const openFacility = (facility: HeadquartersFacility) => {
    setMessage(null);
    const opened = openLegacyFacility(facility.legacyLabel);
    if (!opened) setMessage(`${facility.name} is temporarily unavailable.`);
  };

  return (
    <div className="league-hq-view fixed inset-0 z-[30] overflow-hidden text-white">
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
          <div className="league-hq-center">
            <Trophy className="h-8 w-8" />
            <strong>GRID League Council</strong>
            <small>Headquarters plaza</small>
          </div>
          {HEADQUARTERS_FACILITIES.map((facility) => {
            const Icon = facility.icon;
            return (
              <button
                key={facility.id}
                type="button"
                className="league-hq-facility"
                style={{ left: facility.x, top: facility.y, '--facility-accent': facility.accent } as CSSProperties}
                title={facility.purpose}
                onClick={() => openFacility(facility)}
              >
                <span className="league-hq-building"><Icon className="h-7 w-7" /></span>
                <strong>{facility.name}</strong>
                <small>{facility.purpose}</small>
              </button>
            );
          })}
        </div>
      </main>

      <nav className="league-route-dock" aria-label="Travel to a league island">
        <div className="league-route-dock-title">League Routes</div>
        <div className="league-route-dock-items">
          {DESTINATIONS.map((league) => (
            <button key={league.id} type="button" onClick={() => onSelectLeague(league)} style={{ '--league-accent': league.accent } as CSSProperties}>
              <strong>{league.name}</strong>
              <small>{league.tier.replaceAll('_', ' ')}</small>
            </button>
          ))}
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
    <div className="league-island-view fixed inset-0 z-[30] overflow-hidden text-white">
      <div className="league-island-sky" />
      <header className="league-island-header">
        <button type="button" onClick={() => setDestination(null)}><ChevronLeft className="h-4 w-4" /> Headquarters</button>
        <div><span>League Island</span><h1>{destination.name}</h1></div>
        <div className="league-tier-badge" style={{ borderColor: destination.accent }}>{destination.tier.replaceAll('_', ' ')}</div>
      </header>
      <main className="league-island-stage">
        <div className="league-island-land">
          <div className="league-island-road league-island-road-a" />
          <div className="league-island-road league-island-road-b" />
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
                  <strong>{team.name}</strong>
                  <small>{venue?.name || 'Team Stadium'} · {capacity.toLocaleString()} seats</small>
                  <span className="league-stadium-meta">{venue?.tier?.replaceAll('_', ' ') || 'PARK FIELD'} · Prestige {venue?.prestige || 0}</span>
                  <span className="league-sponsor-banner">Sponsor inventory</span>
                  <span className="league-upgrade-badge">Condition {venue?.condition ?? 70}%</span>
                  <span className="league-stadium-index">{index + 1}</span>
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
