import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Building2, ChevronLeft, Trophy } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import './LeagueIslandNavigator.css';

type LeagueDestination = {
  id: string;
  name: string;
  tier: string;
  direction: 'north' | 'east' | 'south' | 'west';
  accent: string;
};

const DESTINATIONS: LeagueDestination[] = [
  { id: 'regional', name: 'Regional League', tier: 'REGIONAL_PRO', direction: 'north', accent: '#38bdf8' },
  { id: 'elite', name: 'Elite Franchise Circuit', tier: 'PRO_ELITE', direction: 'east', accent: '#a855f7' },
  { id: 'college', name: 'College Conference', tier: 'TOP_COLLEGE', direction: 'west', accent: '#22c55e' },
  { id: 'entry', name: 'Pro Entry League', tier: 'PRO_ENTRY', direction: 'south', accent: '#f59e0b' },
];

function LeagueArrow({ league, onSelect }: { league: LeagueDestination; onSelect: () => void }) {
  const Icon = league.direction === 'north' ? ArrowUp : league.direction === 'south' ? ArrowDown : league.direction === 'west' ? ArrowLeft : ArrowRight;
  return (
    <button type="button" className={`league-route league-route-${league.direction}`} onClick={onSelect}>
      <span className="league-route-icon"><Icon className="h-5 w-5" /></span>
      <span>
        <strong>{league.name}</strong>
        <small>{league.tier.replaceAll('_', ' ')}</small>
      </span>
    </button>
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

  if (!destination) {
    return (
      <div className="league-world-nav pointer-events-none fixed inset-0 z-[8]" aria-label="League island navigation">
        <div className="hq-island-label">
          <Building2 className="h-4 w-4" />
          <span><strong>League Headquarters</strong><small>Shared services, offices and franchise facilities</small></span>
        </div>
        {DESTINATIONS.map((league) => <LeagueArrow key={league.id} league={league} onSelect={() => setDestination(league)} />)}
      </div>
    );
  }

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
          <div className="league-island-center">
            <Trophy className="h-7 w-7" />
            <strong>{destination.name}</strong>
            <small>Stadium district</small>
          </div>
          <div className="league-stadium-grid">
            {leagueTeams.map((team, index) => {
              const venue = team.venue;
              const selected = team.id === selectedTeamId;
              const capacity = venue?.capacity || 5000;
              const scale = Math.min(1.25, Math.max(.82, .82 + capacity / 100000));
              const stadiumStyle = { '--stadium-scale': scale, '--stadium-accent': destination.accent } as CSSProperties;
              return (
                <button
                  key={team.id}
                  type="button"
                  className={`league-stadium ${selected ? 'is-selected' : ''}`}
                  style={stadiumStyle}
                  onClick={() => setSelectedTeamId(team.id)}
                >
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
