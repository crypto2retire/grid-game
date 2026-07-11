import { lazy, Suspense, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Dumbbell,
  Home,
  Landmark,
  Menu,
  Shield,
  ShoppingCart,
  Trophy,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import TeamPage from '../../pages/TeamPage';
import { useGameStore } from '../../store/gameStore';
import WorldRouter from '../world/WorldRouter';
import './FranchiseCommandCenter.css';

const MatchesPage = lazy(() => import('../../pages/MatchesPage'));
const MarketplacePage = lazy(() => import('../../pages/MarketplacePage'));
const StadiumInteriorPage = lazy(() => import('../../pages/StadiumInteriorPage'));
const TransportGaragePage = lazy(() => import('../../pages/TransportGaragePage'));
const WalletPage = lazy(() => import('../../pages/WalletPage'));
const LeaderboardPage = lazy(() => import('../../pages/LeaderboardPage'));

export type CommandSection =
  | 'home'
  | 'team'
  | 'development'
  | 'games'
  | 'league'
  | 'market'
  | 'facilities'
  | 'finance'
  | 'campus';

type NavItem = {
  id: CommandSection;
  label: string;
  icon: typeof Home;
  description: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, description: 'Franchise priorities' },
  { id: 'team', label: 'Team', icon: Users, description: 'Roster and lineup' },
  { id: 'development', label: 'Development', icon: Dumbbell, description: 'Train, recover, equip' },
  { id: 'games', label: 'Games', icon: CalendarDays, description: 'Prepare and play' },
  { id: 'league', label: 'League', icon: Trophy, description: 'Standings and progress' },
  { id: 'market', label: 'Market', icon: ShoppingCart, description: 'Trade players and assets' },
  { id: 'facilities', label: 'Facilities', icon: Building2, description: 'Stadium and transport' },
  { id: 'finance', label: 'Finance', icon: WalletCards, description: 'Wallet and economy' },
  { id: 'campus', label: 'Campus', icon: Landmark, description: 'Optional visual overview' },
];

function LoadingPage() {
  return (
    <div className="fcc-loading">
      <div className="fcc-loading-ring" />
      <strong>Loading franchise operations…</strong>
    </div>
  );
}

function DashboardCard({ title, eyebrow, children, action }: { title: string; eyebrow: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="fcc-card">
      <div className="fcc-card-header">
        <div><span>{eyebrow}</span><h2>{title}</h2></div>
        {action}
      </div>
      {children}
    </section>
  );
}

function FranchiseDashboard({ onNavigate }: { onNavigate: (section: CommandSection) => void }) {
  const { teams, selectedTeamId, wallet } = useGameStore();
  const team: any = teams.find((item) => item.id === selectedTeamId) || teams[0] || null;

  const players = useMemo(() => (team?.teamPlayers || []).map((entry: any) => entry.player), [team]);
  const injured = players.filter((player: any) => player.injuryStatus && player.injuryStatus !== 'HEALTHY');
  const fatigued = players.filter((player: any) => Number(player.fatigue || 0) >= 30);
  const overall = players.length ? Math.round(players.reduce((sum: number, player: any) => sum + Number(player.overall || 0), 0) / players.length) : 0;
  const rosterSize = players.length;
  const record = team ? `${team.wins || 0}-${team.losses || 0}-${team.draws || 0}` : '—';

  const priorities = [
    injured.length ? { label: `Treat ${injured.length} injured player${injured.length === 1 ? '' : 's'}`, section: 'development' as CommandSection, tone: 'danger' } : null,
    fatigued.length ? { label: `Recover ${fatigued.length} fatigued player${fatigued.length === 1 ? '' : 's'}`, section: 'development' as CommandSection, tone: 'warning' } : null,
    rosterSize < 22 ? { label: `Fill ${22 - rosterSize} open roster spots`, section: 'market' as CommandSection, tone: 'info' } : null,
    { label: 'Prepare for the next matchup', section: 'games' as CommandSection, tone: 'primary' },
  ].filter(Boolean) as Array<{ label: string; section: CommandSection; tone: string }>;

  return (
    <div className="fcc-dashboard">
      <div className="fcc-hero">
        <div>
          <span className="fcc-kicker">Franchise command center</span>
          <h1>{team?.name || 'Build your franchise'}</h1>
          <p>Make the next useful decision without navigating a map.</p>
        </div>
        <button className="fcc-primary-action" onClick={() => onNavigate('games')}><Activity className="h-4 w-4" /> Prepare next game</button>
      </div>

      <div className="fcc-metric-grid">
        <div><span>Team OVR</span><strong>{overall || '—'}</strong></div>
        <div><span>Record</span><strong>{record}</strong></div>
        <div><span>Roster</span><strong>{rosterSize}/22</strong></div>
        <div><span>CASH</span><strong>{Number(wallet.cash || 0).toLocaleString()}</strong></div>
        <div><span>DYN</span><strong>{Number(wallet.dynTokens || 0).toLocaleString()}</strong></div>
      </div>

      <div className="fcc-dashboard-grid">
        <DashboardCard title="Next actions" eyebrow="Priority queue">
          <div className="fcc-priority-list">
            {priorities.map((priority) => (
              <button key={priority.label} className={`fcc-priority fcc-priority-${priority.tone}`} onClick={() => onNavigate(priority.section)}>
                <span>{priority.label}</span><ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard title="Team readiness" eyebrow="Health and availability" action={<button onClick={() => onNavigate('development')}>Open development</button>}>
          <div className="fcc-readiness-grid">
            <div><HeartPulseIcon /><strong>{injured.length}</strong><span>Injured</span></div>
            <div><Activity className="h-5 w-5" /><strong>{fatigued.length}</strong><span>High fatigue</span></div>
            <div><Shield className="h-5 w-5" /><strong>{Math.max(0, rosterSize - injured.length)}</strong><span>Available</span></div>
          </div>
        </DashboardCard>

        <DashboardCard title="Game center" eyebrow="Prepare · play · review" action={<button onClick={() => onNavigate('games')}>Open games</button>}>
          <div className="fcc-feature-block">
            <div className="fcc-feature-icon"><ClipboardList className="h-6 w-6" /></div>
            <div><strong>Match preparation</strong><p>Review lineup, fatigue, opponent strength and tactics before starting.</p></div>
          </div>
        </DashboardCard>

        <DashboardCard title="Franchise growth" eyebrow="Infrastructure and economy" action={<button onClick={() => onNavigate('facilities')}>Manage facilities</button>}>
          <div className="fcc-feature-block">
            <div className="fcc-feature-icon"><BarChart3 className="h-6 w-6" /></div>
            <div><strong>Invest with purpose</strong><p>Compare upgrade costs, maintenance and expected gameplay impact.</p></div>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}

function HeartPulseIcon() {
  return <Activity className="h-5 w-5" />;
}

function FacilitiesPage() {
  const [tab, setTab] = useState<'stadium' | 'transport'>('stadium');
  return (
    <div className="fcc-subpage">
      <div className="fcc-page-heading"><span>Infrastructure</span><h1>Facilities</h1><p>Manage assets as investments, not destinations.</p></div>
      <div className="fcc-segmented">
        <button className={tab === 'stadium' ? 'active' : ''} onClick={() => setTab('stadium')}>Stadium</button>
        <button className={tab === 'transport' ? 'active' : ''} onClick={() => setTab('transport')}>Transport</button>
      </div>
      <Suspense fallback={<LoadingPage />}>
        {tab === 'stadium' ? <StadiumInteriorPage /> : <TransportGaragePage />}
      </Suspense>
    </div>
  );
}

function DevelopmentPage() {
  const [tab, setTab] = useState<'training' | 'medical' | 'equipment'>('training');
  return (
    <div className="fcc-subpage">
      <div className="fcc-page-heading"><span>Player performance</span><h1>Development</h1><p>Train, recover and equip players from one focused workspace.</p></div>
      <div className="fcc-segmented">
        <button className={tab === 'training' ? 'active' : ''} onClick={() => setTab('training')}>Training</button>
        <button className={tab === 'medical' ? 'active' : ''} onClick={() => setTab('medical')}>Recovery</button>
        <button className={tab === 'equipment' ? 'active' : ''} onClick={() => setTab('equipment')}>Equipment</button>
      </div>
      <TeamPage initialTab={tab} />
    </div>
  );
}

function SectionContent({ section, onNavigate }: { section: CommandSection; onNavigate: (section: CommandSection) => void }) {
  if (section === 'home') return <FranchiseDashboard onNavigate={onNavigate} />;
  if (section === 'team') return <TeamPage initialTab="roster" />;
  if (section === 'development') return <DevelopmentPage />;
  if (section === 'games') return <Suspense fallback={<LoadingPage />}><MatchesPage /></Suspense>;
  if (section === 'league') return <Suspense fallback={<LoadingPage />}><LeaderboardPage /></Suspense>;
  if (section === 'market') return <Suspense fallback={<LoadingPage />}><MarketplacePage /></Suspense>;
  if (section === 'facilities') return <FacilitiesPage />;
  if (section === 'finance') return <Suspense fallback={<LoadingPage />}><WalletPage /></Suspense>;
  return <WorldRouter />;
}

export default function FranchiseCommandCenter() {
  const { teams, selectedTeamId, setSelectedTeamId, wallet } = useGameStore();
  const [section, setSection] = useState<CommandSection>('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const selectedTeam: any = teams.find((team) => team.id === selectedTeamId) || teams[0] || null;

  const navigate = (next: CommandSection) => {
    setSection(next);
    setMobileNavOpen(false);
  };

  return (
    <div className="fcc-shell">
      <aside className={`fcc-sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="fcc-brand"><div>G</div><span><strong>GRID Dynasty</strong><small>Franchise Management</small></span></div>
        <nav>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
                <Icon className="h-5 w-5" /><span><strong>{item.label}</strong><small>{item.description}</small></span>
              </button>
            );
          })}
        </nav>
        <div className="fcc-sidebar-footer"><span>Season operations</span><strong>Daily plan · Franchise growth</strong></div>
      </aside>

      {mobileNavOpen && <button className="fcc-mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <div className="fcc-main">
        <header className="fcc-topbar">
          <button className="fcc-mobile-menu" onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? <X /> : <Menu />}</button>
          <div className="fcc-team-select">
            <span>Active team</span>
            <select value={selectedTeam?.id || ''} onChange={(event) => setSelectedTeamId(event.target.value)}>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
          <div className="fcc-balances">
            <span><CircleDollarSign className="h-4 w-4" /> {Number(wallet.cash || 0).toLocaleString()} CASH</span>
            <span><Landmark className="h-4 w-4" /> {Number(wallet.dynTokens || 0).toLocaleString()} DYN</span>
          </div>
        </header>
        <main className={`fcc-content ${section === 'campus' ? 'is-campus' : ''}`}>
          <SectionContent section={section} onNavigate={navigate} />
        </main>
      </div>
    </div>
  );
}
