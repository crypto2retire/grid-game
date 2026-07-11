import { Suspense, lazy, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, Building2, Dumbbell, HeartPulse, Landmark, Radio, ShoppingBag, Trophy, Truck, Users, WalletCards } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { usePanels } from './PanelSystem';
import { HEADQUARTERS_BUILDINGS, LEAGUES, type BuildingDefinition, type BuildingId, type LeagueDefinition, type WorldId } from './worldRegistry';
import './WorldRouter.css';

const TeamPage = lazy(() => import('../../pages/TeamPage'));
const MarketplacePage = lazy(() => import('../../pages/MarketplacePage'));
const WalletPage = lazy(() => import('../../pages/WalletPage'));
const TransportGaragePage = lazy(() => import('../../pages/TransportGaragePage'));
const StadiumInteriorPage = lazy(() => import('../../pages/StadiumInteriorPage'));
const MatchesPage = lazy(() => import('../../pages/MatchesPage'));
const LeaderboardPage = lazy(() => import('../../pages/LeaderboardPage'));
const CityPage = lazy(() => import('../../pages/CityPage'));

const ICONS: Record<BuildingId, typeof Building2> = {
  commissioner: Landmark,
  market: ShoppingBag,
  media: Radio,
  team: Users,
  training: Dumbbell,
  medical: HeartPulse,
  garage: Truck,
  bank: WalletCards,
  stadium: Trophy,
  matches: Trophy,
};

function LoadingStation({ label }: { label: string }) {
  return <div className="grid min-h-screen place-items-center bg-slate-950 text-white"><div className="text-center"><div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-cyan-300/20"/><div className="mt-3 text-sm font-black">Loading {label}</div></div></div>;
}

function interiorFor(id: BuildingId): ReactNode {
  switch (id) {
    case 'team': return <TeamPage initialTab="roster" />;
    case 'training': return <TeamPage initialTab="training" />;
    case 'medical': return <TeamPage initialTab="medical" />;
    case 'market': return <MarketplacePage />;
    case 'garage': return <TransportGaragePage />;
    case 'bank': return <WalletPage />;
    case 'stadium': return <StadiumInteriorPage />;
    case 'matches': return <MatchesPage />;
    case 'media': return <LeaderboardPage />;
    case 'commissioner': return <CityPage />;
  }
}

function WorldHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <header className="world-router-header"><div><span>GRID World</span><h1>{title}</h1></div><p>{subtitle}</p></header>;
}

function Headquarters({ onTravel, onOpen }: { onTravel: (league: LeagueDefinition) => void; onOpen: (building: BuildingDefinition) => void }) {
  return <div className="world-router-screen">
    <WorldHeader title="League Headquarters" subtitle="Shared league services and franchise operations" />
    <main className="world-router-stage">
      <div className="world-island world-hq-island">
        <div className="world-road world-road-ring"/><div className="world-road world-road-a"/><div className="world-road world-road-b"/>
        <div className="world-center"><Trophy className="h-8 w-8"/><strong>GRID League Council</strong><small>Headquarters plaza</small></div>
        {HEADQUARTERS_BUILDINGS.map((building) => {
          const Icon = ICONS[building.id];
          return <button key={building.id} type="button" className="world-building" style={{ left: `${building.x}%`, top: `${building.y}%`, '--accent': building.accent } as CSSProperties} onClick={() => onOpen(building)}>
            <span className="world-building-art"><Icon className="h-7 w-7"/></span><strong>{building.name}</strong><small>{building.purpose}</small>
          </button>;
        })}
      </div>
    </main>
    <nav className="world-route-dock" aria-label="League travel"><div className="world-route-title">League Islands</div><div className="world-route-grid">{LEAGUES.map((league) => <button key={league.id} type="button" style={{ '--accent': league.accent } as CSSProperties} onClick={() => onTravel(league)}><strong>{league.name}</strong><small>{league.tier.replaceAll('_', ' ')}</small></button>)}</div></nav>
  </div>;
}

function LeagueIsland({ league, onBack, onOpen }: { league: LeagueDefinition; onBack: () => void; onOpen: (building: BuildingDefinition) => void }) {
  const { teams, selectedTeamId, setSelectedTeamId } = useGameStore();
  const leagueTeams = useMemo(() => {
    const exact = teams.filter((team) => team.tier === league.tier);
    return exact.length ? exact : teams.slice(0, 8);
  }, [league.tier, teams]);
  return <div className="world-router-screen">
    <header className="world-router-header world-router-league-header"><button type="button" onClick={onBack}><ArrowLeft className="h-4 w-4"/> Headquarters</button><div><span>League Island</span><h1>{league.name}</h1></div><p>{league.tier.replaceAll('_', ' ')}</p></header>
    <main className="world-router-stage"><div className="world-island world-league-island"><div className="world-road world-road-a"/><div className="world-road world-road-b"/><button type="button" className="world-center world-center-button" onClick={() => onOpen({ id: 'matches', name: 'League Match Center', purpose: 'Schedule and play league games', x: 50, y: 50, accent: league.accent })}><Trophy className="h-7 w-7"/><strong>{league.name}</strong><small>Match center</small></button><div className="world-stadium-grid">{leagueTeams.map((team, index) => { const venue = team.venue; const selected = team.id === selectedTeamId; return <button key={team.id} type="button" className={`world-stadium ${selected ? 'is-selected' : ''}`} style={{ '--accent': league.accent } as CSSProperties} onClick={() => { setSelectedTeamId(team.id); onOpen({ id: 'stadium', name: venue?.name || `${team.name} Stadium`, purpose: `${team.name} venue operations`, x: 0, y: 0, accent: league.accent }); }}><span className="world-stadium-shell"><span/></span><strong>{team.name}</strong><small>{venue?.name || 'Team Stadium'} · {(venue?.capacity || 5000).toLocaleString()} seats</small><em>{venue?.tier?.replaceAll('_', ' ') || 'PARK FIELD'} · Condition {venue?.condition ?? 70}%</em><b>{index + 1}</b></button>; })}{leagueTeams.length === 0 && <div className="world-empty">No teams are assigned to this league island yet.</div>}</div></div></main>
  </div>;
}

export default function WorldRouter() {
  const [world, setWorld] = useState<WorldId>('headquarters');
  const { openPanel } = usePanels();
  const league = LEAGUES.find((item) => item.id === world) || null;

  const openBuilding = (building: BuildingDefinition) => {
    openPanel({ id: `building-${building.id}`, title: building.name, buildingId: building.id, x: 0, y: 0, width: 1200, height: 820, minimized: false, maximized: true, mode: 'interior', content: <Suspense fallback={<LoadingStation label={building.name}/>}>{interiorFor(building.id)}</Suspense> });
  };

  return world === 'headquarters'
    ? <Headquarters onTravel={(next) => setWorld(next.id)} onOpen={openBuilding} />
    : <LeagueIsland league={league!} onBack={() => setWorld('headquarters')} onOpen={openBuilding} />;
}
