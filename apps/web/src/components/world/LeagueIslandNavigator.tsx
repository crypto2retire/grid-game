import { useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
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
  direction: 'north' | 'east' | 'south' | 'west';
  accent: string;
};

type HeadquartersFacility = {
  id: string;
  name: string;
  purpose: string;
  icon: typeof Building2;
  x: string;
  y: string;
  accent: string;
};

const DESTINATIONS: LeagueDestination[] = [
  { id: 'regional', name: 'Regional League', tier: 'REGIONAL_PRO', direction: 'north', accent: '#38bdf8' },
  { id: 'elite', name: 'Elite Franchise Circuit', tier: 'PRO_ELITE', direction: 'east', accent: '#a855f7' },
  { id: 'college', name: 'College Conference', tier: 'TOP_COLLEGE', direction: 'west', accent: '#22c55e' },
  { id: 'entry', name: 'Pro Entry League', tier: 'PRO_ENTRY', direction: 'south', accent: '#f59e0b' },
];

const HEADQUARTERS_FACILITIES: HeadquartersFacility[] = [
  { id: 'commissioner', name: 'League Office', purpose: 'League administration', icon: Landmark, x: '18%', y: '25%', accent: '#14b8a6' },
  { id: 'market', name: 'Sports Market', purpose: 'Teams and asset trading', icon: ShoppingBag, x: '18%', y: '63%', accent: '#f59e0b' },
  { id: 'media', name: 'Media Center', purpose: 'News and broadcasts', icon: Radio, x: '39%', y: '19%', accent: '#f97316' },
  { id: 'team', name: 'Team Headquarters', purpose: 'Roster management', icon: Users, x: '61%', y: '19%', accent: '#38bdf8' },
  { id: 'training', name: 'Training Complex', purpose: 'Development and equipment', icon: Dumbbell, x: '82%', y: '25%', accent: '#8b5cf6' },
  { id: 'medical', name: 'Sports Medicine', purpose: 'Treatment and recovery', icon: HeartPulse, x: '82%', y: '63%', accent: '#ef4444' },
  { id: 'garage', name: 'Mobility Depot', purpose: 'Transport and maintenance', icon: Truck, x: '61%', y: '77%', accent: '#64748b' },
  { id: 'bank', name: 'Sponsor Bank', purpose: 'Wallet and sponsorships', icon: CircleDollarSign, x: '39%', y: '77%', accent: '#0ea5e9' },
];

function LeagueArrow({ league, onSelect }: { league: LeagueDestination; onSelect: () => void }) {
  const Icon = league.direction === 'north' ? ArrowUp : league.direction === 'south' ? ArrowDown : league.direction === 'west' ? ArrowLeft : ArrowRight;
  return (
    <button type="button" className={`league-route league-route-${league.direction}`} onClick={onSelect}>
      <span className="league-route-icon"><Icon className="h-5 w-5" /></span>
      <span><strong>{league.name}</strong><small>{league.tier.replaceAll('_', ' ')}</small></span>
    </button>
  );
}

function HeadquartersView({ onSelectLeague }: { onSelectLeague: (league: LeagueDestination) => void }) {
  return (
    <div className="league-hq-view fixed inset-0 z-[18] overflow-hidden text-white">
      <div className="league-hq-sky" />
      <header className="league-hq-header">
        <div><span>World Hub</span><h1>League Headquarters</h1></div>
        <p>Shared league services and franchise operations. Use a route arrow to travel to a league stadium island.</p>
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
              >
                <span className="league-hq-building"><Icon className="h-7 w-7" /></span>
                <strong>{facility.name}</strong>
                <small>{facility.purpose}</small>
              </button>
            );
          })}
          {DESTINATIONS.map((league) => <LeagueArrow key={league.id} league={league} onSelect={() => onSelectLeague(league)} />)}
        </div>
      </main>
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
    <div className="league-island-view fixed inset-0 z-[18] overflow-hidden text-white">
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
