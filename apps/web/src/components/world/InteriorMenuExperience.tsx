import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Building2,
  Bus,
  ClipboardList,
  Coins,
  Dumbbell,
  Gauge,
  HeartPulse,
  Home,
  Landmark,
  Package,
  RefreshCw,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Trophy,
  Users,
  WalletCards,
  Wrench,
} from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { usePanels } from './PanelSystem';

type TeamSection = 'roster' | 'training' | 'medical' | 'equipment' | 'assets' | 'sponsorships';

type MarketItem = {
  id: string;
  name: string;
  slot: string;
  rarity: string;
  statBoosts: Record<string, number>;
  marketPriceCash: number;
  marketPriceGrid: number;
};

type StationAction = {
  id: string;
  label: string;
  description: string;
  targets: string[];
  icon: typeof Users;
};

type BuildingStationConfig = {
  title: string;
  subtitle: string;
  stations: StationAction[];
};

const teamSections: Array<{ id: TeamSection; label: string; icon: typeof Users }> = [
  { id: 'roster', label: 'Roster', icon: Users },
  { id: 'training', label: 'Training', icon: Dumbbell },
  { id: 'medical', label: 'Medical', icon: HeartPulse },
  { id: 'equipment', label: 'Equipment', icon: Wrench },
  { id: 'assets', label: 'Assets', icon: Home },
  { id: 'sponsorships', label: 'Sponsorships', icon: Shield },
];

const buildingStations: Record<string, BuildingStationConfig> = {
  stadium: {
    title: 'Home Stadium', subtitle: 'Venue operations and matchday business', stations: [
      { id: 'venue', label: 'Venue Overview', description: 'Capacity, condition and stadium sections', targets: ['Venue'], icon: Building2 },
      { id: 'match-office', label: 'Match Office', description: 'Schedule and manage home fixtures', targets: ['Match Office', 'Schedule Match'], icon: Trophy },
      { id: 'game-plan', label: 'Game Plan', description: 'Tactics and match preparation', targets: ['Game Plan', 'Tactics'], icon: ClipboardList },
      { id: 'upgrades', label: 'Upgrade Center', description: 'Improve the selected stadium section', targets: ['Open Upgrades', 'Upgrade Section', 'Upgrade'], icon: Wrench },
      { id: 'economy', label: 'Stadium Economy', description: 'Revenue, attendance and operating costs', targets: ['View Economy', 'Economy', 'Revenue'], icon: Gauge },
      { id: 'assets', label: 'Back to Assets', description: 'Return to franchise infrastructure', targets: ['Back to Assets', 'Assets'], icon: Home },
    ],
  },
  practice: {
    title: 'Practice Field', subtitle: 'Play, schedule and review games', stations: [
      { id: 'play', label: 'Play Game', description: 'Start the next playable matchup', targets: ['Play Game', 'Start Match', 'Play Match'], icon: Trophy },
      { id: 'schedule', label: 'Schedule', description: 'Create or find the next fixture', targets: ['Schedule', 'Schedule Match', 'Find Opponent'], icon: ClipboardList },
      { id: 'live', label: 'Live Games', description: 'View games currently in progress', targets: ['Live', 'Live Matches', 'In Progress'], icon: Activity },
      { id: 'results', label: 'Results', description: 'Review completed games and outcomes', targets: ['Results', 'Completed', 'History'], icon: Award },
    ],
  },
  clubhouse: {
    title: 'Clubhouse', subtitle: 'Daily franchise command center', stations: [
      { id: 'dashboard', label: 'Dashboard', description: 'Current franchise priorities and status', targets: ['Dashboard', 'Overview'], icon: Gauge },
      { id: 'journey', label: 'Daily Journey', description: 'Today’s goals and completion progress', targets: ['Daily Journey', 'Daily Plan', 'Objectives'], icon: Sparkles },
      { id: 'team', label: 'Team Operations', description: 'Roster, training and medical management', targets: ['Team', 'Roster'], icon: Users },
      { id: 'finances', label: 'Finances', description: 'Wallet, revenue and operating costs', targets: ['Finances', 'Wallet', 'Economy'], icon: WalletCards },
      { id: 'league', label: 'League Progress', description: 'Promotion requirements and standings', targets: ['League', 'Promotion', 'Standings'], icon: Trophy },
    ],
  },
  market: {
    title: 'Sports Market', subtitle: 'Players, gear and limited inventory', stations: [
      { id: 'players', label: 'Player Market', description: 'Browse available players and listings', targets: ['Players', 'Player Market', 'Marketplace'], icon: Users },
      { id: 'gear', label: 'Player Gear', description: 'Buy equipment for a selected player', targets: ['Equipment', 'Gear', 'Items'], icon: ShoppingBag },
      { id: 'listings', label: 'My Listings', description: 'Manage active sale listings', targets: ['My Listings', 'Listings'], icon: Store },
      { id: 'offers', label: 'Offers', description: 'Review incoming and outgoing offers', targets: ['Offers'], icon: Coins },
      { id: 'refresh', label: 'Refresh Market', description: 'Reload current prices and inventory', targets: ['Refresh'], icon: RefreshCw },
    ],
  },
  commissioner: {
    title: 'Commissioner Office', subtitle: 'Funding cycles and limited drops', stations: [
      { id: 'overview', label: 'Cycle Overview', description: 'Current phase, funding and meters', targets: ['Overview', 'Current Phase', 'Sports Commissioner Cycle'], icon: Gauge },
      { id: 'fund', label: 'Fund Cycle', description: 'Contribute toward the next inventory release', targets: ['Fund Commissioner Cycle', 'Contribution', 'Fund'], icon: Coins },
      { id: 'inventory', label: 'Limited Inventory', description: 'View unlocked and upcoming drops', targets: ['Limited Restock Inventory', 'Inventory'], icon: Package },
      { id: 'rewards', label: 'My Rewards', description: 'Review contribution and reward totals', targets: ['My Funded', 'Rewards'], icon: Award },
      { id: 'refresh', label: 'Refresh', description: 'Reload commissioner status', targets: ['Refresh'], icon: RefreshCw },
    ],
  },
  hall: {
    title: 'Hall of Fame', subtitle: 'Prestige, records and franchise legacy', stations: [
      { id: 'legacy', label: 'Franchise Legacy', description: 'Prestige and historical achievements', targets: ['Legacy', 'Prestige', 'Overview'], icon: Trophy },
      { id: 'records', label: 'Records', description: 'Team and player performance records', targets: ['Records', 'History'], icon: Award },
      { id: 'leaders', label: 'Leaderboards', description: 'Compare against top franchises', targets: ['Leaderboard', 'Rankings'], icon: Users },
      { id: 'milestones', label: 'Milestones', description: 'Season and career achievement progress', targets: ['Milestones', 'Achievements'], icon: Sparkles },
    ],
  },
  garage: {
    title: 'Team Garage', subtitle: 'Travel fleet and road operations', stations: [
      { id: 'fleet', label: 'Fleet Overview', description: 'Current transportation assets', targets: ['Transportation', 'Fleet', 'Overview'], icon: Bus },
      { id: 'upgrade', label: 'Upgrade Transport', description: 'Improve speed, comfort and fatigue reduction', targets: ['Upgrade Transportation', 'Upgrade'], icon: Wrench },
      { id: 'costs', label: 'Operating Costs', description: 'Review travel and maintenance costs', targets: ['Operating Cost', 'Costs', 'Economy'], icon: Gauge },
      { id: 'assets', label: 'Back to Assets', description: 'Return to franchise infrastructure', targets: ['Back to Assets', 'Assets'], icon: Home },
    ],
  },
  bank: {
    title: 'Sponsor Bank', subtitle: 'Wallet, sponsors and treasury activity', stations: [
      { id: 'wallet', label: 'Wallet', description: 'CASH and DYN balances', targets: ['Wallet', 'Balance'], icon: WalletCards },
      { id: 'sponsors', label: 'Sponsorships', description: 'Active deals and available offers', targets: ['Sponsorships', 'Sponsors'], icon: Shield },
      { id: 'treasury', label: 'Treasury', description: 'Revenue flows and economic activity', targets: ['Treasury', 'Economy'], icon: Landmark },
      { id: 'rewards', label: 'Rewards', description: 'Claims, staking and reward history', targets: ['Rewards', 'Claim'], icon: Award },
    ],
  },
};

const positionNeeds: Record<string, string[]> = {
  QB: ['ARM', 'IQ', 'AGI'], RB: ['SPD', 'AGI', 'STR'], WR: ['SPD', 'AGI', 'IQ'],
  TE: ['STR', 'IQ', 'AGI'], OL: ['STR', 'IQ'], DL: ['STR', 'TCK'],
  LB: ['TCK', 'SPD', 'IQ'], CB: ['SPD', 'AGI', 'TCK'], S: ['TCK', 'IQ', 'SPD'], K: ['ARM', 'IQ'],
};

function normalizeText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function activateInteriorControl(targets: string[]) {
  const root = document.querySelector('.building-interior-content');
  if (!root) return false;
  const normalizedTargets = targets.map(normalizeText);
  const controls = Array.from(root.querySelectorAll<HTMLElement>('button, [role="tab"], a'));
  const control = controls.find((candidate) => {
    const text = normalizeText(candidate.textContent);
    return normalizedTargets.some((wanted) => text === wanted || text.includes(wanted));
  });
  if (control) {
    control.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    control.click();
    control.focus({ preventScroll: true });
    return true;
  }

  const sections = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, section, article, .glass-card'));
  const section = sections.find((candidate) => {
    const text = normalizeText(candidate.textContent);
    return normalizedTargets.some((wanted) => text.includes(wanted));
  });
  if (!section) return false;
  section.scrollIntoView({ block: 'start', behavior: 'smooth' });
  section.animate(
    [{ outline: '2px solid rgba(103,232,249,.9)', outlineOffset: '4px' }, { outline: '2px solid transparent', outlineOffset: '12px' }],
    { duration: 1100, easing: 'ease-out' },
  );
  return true;
}

function applyTrainingFiltering() {
  const root = document.querySelector('.building-interior-content');
  if (!root) return;
  const selectedPlayer = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.className.includes('border-[#E94560]/70'));
  const position = selectedPlayer?.querySelector('span.rounded-md')?.textContent?.trim();
  const cards = Array.from(root.querySelectorAll<HTMLElement>('.glass-card'));
  const packageCards: HTMLElement[] = [];
  cards.forEach((card) => {
    const text = card.textContent || '';
    if (!text.includes('Start Training')) return;
    const isBadFit = Boolean(position) && text.includes(`Does not target ${position}`);
    card.style.display = isBadFit ? 'none' : '';
    card.dataset.trainingFit = text.includes(`Good for ${position}`) ? 'recommended' : 'available';
    packageCards.push(card);
  });
  packageCards
    .sort((a, b) => Number(b.dataset.trainingFit === 'recommended') - Number(a.dataset.trainingFit === 'recommended'))
    .forEach((card) => card.parentElement?.appendChild(card));
}

export default function InteriorMenuExperience() {
  const { panels } = usePanels();
  const { teams, selectedTeamId, refreshTeams, refreshWallet } = useGameStore();
  const topPanel = panels.length ? [...panels].sort((a, b) => b.zIndex - a.zIndex)[0] : null;
  const selectedTeam: any = teams.find((team) => team.id === selectedTeamId) || teams[0] || null;
  const buildingId = topPanel?.buildingId || '';
  const isTeamInterior = ['team', 'training', 'medical'].includes(buildingId);
  const config = buildingStations[buildingId];
  const supported = isTeamInterior || Boolean(config);
  const initialSection: TeamSection = buildingId === 'training' ? 'training' : buildingId === 'medical' ? 'medical' : 'roster';
  const initialStation = isTeamInterior ? initialSection : config?.stations[0]?.id || '';
  const [section, setSection] = useState<TeamSection>(initialSection);
  const [activeStation, setActiveStation] = useState(initialStation);
  const [stationMessage, setStationMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<MarketItem[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [gearBusy, setGearBusy] = useState<string | null>(null);
  const [gearMessage, setGearMessage] = useState<string | null>(null);

  useEffect(() => {
    setSection(initialSection);
    setActiveStation(initialStation);
    setStationMessage(null);
  }, [topPanel?.id, initialSection, initialStation]);

  useEffect(() => {
    if (!isTeamInterior || section !== 'training') return;
    const rerun = () => window.setTimeout(applyTrainingFiltering, 0);
    applyTrainingFiltering();
    const observer = new MutationObserver(rerun);
    const root = document.querySelector('.building-interior-content');
    if (root) {
      observer.observe(root, { subtree: true, childList: true });
      root.addEventListener('click', rerun);
    }
    return () => {
      observer.disconnect();
      root?.removeEventListener('click', rerun);
    };
  }, [isTeamInterior, section]);

  useEffect(() => {
    if (!isTeamInterior || section !== 'equipment') return;
    const token = localStorage.getItem('token');
    fetch('/api/market/items', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load player gear')))
      .then((payload) => setCatalog(payload.data || []))
      .catch((error: Error) => setGearMessage(error.message));
  }, [isTeamInterior, section]);

  const players = useMemo(() => (selectedTeam?.teamPlayers || []).map((entry: any) => entry.player), [selectedTeam]);
  const selectedPlayer = players.find((player: any) => player.id === selectedPlayerId) || players[0] || null;
  const ownedGear = useMemo(() => players.flatMap((player: any) => (player.playerItems || []).map((owned: any) => ({ ...owned, player }))), [players]);

  if (!supported || !topPanel) return null;

  const stationItems: StationAction[] = isTeamInterior
    ? teamSections.map((item) => ({
        id: item.id,
        label: item.label,
        description: item.id === 'roster' ? 'Players, lineup and roster decisions' : item.id === 'training' ? 'Position-specific development plans' : item.id === 'medical' ? 'Health, fatigue and recovery' : item.id === 'equipment' ? 'Player gear and facility equipment' : item.id === 'assets' ? 'Stadium and transportation assets' : 'Sponsor offers and active deals',
        targets: [item.label],
        icon: item.icon,
      }))
    : config.stations;

  const chooseStation = (station: StationAction) => {
    setActiveStation(station.id);
    setStationMessage(null);
    if (isTeamInterior) setSection(station.id as TeamSection);
    requestAnimationFrame(() => {
      if (!activateInteriorControl(station.targets)) {
        setStationMessage(`${station.label} is not available in this view yet.`);
      }
    });
  };

  const buyGear = async (item: MarketItem) => {
    if (!selectedPlayer) return;
    const token = localStorage.getItem('token');
    setGearBusy(item.id);
    setGearMessage(null);
    try {
      const response = await fetch('/api/market/buy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, playerId: selectedPlayer.id, currency: 'CASH' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Purchase failed');
      setGearMessage(`${item.name} added to ${selectedPlayer.name}'s inventory.`);
      await Promise.all([refreshTeams(), refreshWallet()]);
    } catch (error) {
      setGearMessage(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setGearBusy(null);
    }
  };

  const railTitle = isTeamInterior ? selectedTeam?.name || 'Franchise' : config.title;
  const railSubtitle = isTeamInterior ? 'Team operations and player management' : config.subtitle;

  return (
    <div className="pointer-events-none fixed inset-0 z-[35] text-white">
      <nav className="pointer-events-auto absolute bottom-5 left-5 top-24 flex w-64 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/96 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/10 px-4 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Working Stations</div>
          <div className="mt-1 truncate text-base font-black">{railTitle}</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{railSubtitle}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {stationItems.map((item) => {
            const Icon = item.icon;
            const active = activeStation === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseStation(item)}
                className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${active ? 'border-cyan-300/50 bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/30' : 'border-white/5 bg-white/[0.035] text-slate-200 hover:border-cyan-300/30 hover:bg-white/[0.08] hover:text-white'}`}
              >
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? 'bg-slate-950/15' : 'bg-slate-800 text-cyan-300 group-hover:bg-slate-700'}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className={`mt-0.5 block text-[11px] leading-snug ${active ? 'text-slate-800' : 'text-slate-400'}`}>{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-white/10 p-3">
          {stationMessage ? (
            <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{stationMessage}</div>
          ) : (
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Stations online</div>
          )}
        </div>
      </nav>

      {isTeamInterior && section === 'training' && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-emerald-300/20 bg-slate-950/90 px-4 py-2 text-xs text-emerald-100 shadow-xl">
          Select a player to show only training programs that benefit that position. Recommended programs appear first.
        </div>
      )}

      {isTeamInterior && section === 'equipment' && (
        <aside className="pointer-events-auto absolute bottom-5 right-5 top-24 flex w-[390px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/96 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-slate-950"><ShoppingBag className="h-5 w-5" /></div>
              <div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Player Equipment</div><div className="text-base font-black">Gear Shop & Inventory</div></div>
            </div>
            <select value={selectedPlayer?.id || ''} onChange={(event) => setSelectedPlayerId(event.target.value)} className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">
              {players.map((player: any) => <option key={player.id} value={player.id}>{player.name} · {player.position} · OVR {player.overall}</option>)}
            </select>
            {selectedPlayer && <div className="mt-2 text-xs text-slate-400">Best development focus: {(positionNeeds[selectedPlayer.position] || ['SPD', 'IQ', 'STR']).join(' / ')}</div>}
            {gearMessage && <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">{gearMessage}</div>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><Package className="h-4 w-4" /> Owned gear ({ownedGear.length})</div>
            {ownedGear.length === 0 ? <div className="mb-5 rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No player gear owned yet. Purchase an item below and assign it directly to a player.</div> : (
              <div className="mb-5 space-y-2">{ownedGear.slice(0, 8).map((owned: any) => <div key={owned.id} className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex justify-between gap-3"><span className="font-bold">{owned.item?.name}</span><span className="text-xs text-cyan-300">{owned.player.name}</span></div><div className="mt-1 text-xs text-slate-400">{owned.item?.slot} · {owned.item?.rarity} {owned.equipped ? '· Equipped' : ''}</div></div>)}</div>
            )}
            <div className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Available player gear</div>
            <div className="space-y-3">{catalog.map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900/80 p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-bold">{item.name}</div><div className="text-xs text-slate-400">{item.slot} · {item.rarity}</div></div><div className="text-sm font-black text-amber-300">{item.marketPriceCash.toLocaleString()} CASH</div></div><div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(item.statBoosts || {}).filter(([, value]) => Number(value) > 0).map(([stat, value]) => <span key={stat} className="rounded-md bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">+{Number(value)} {stat.toUpperCase()}</span>)}</div><button type="button" disabled={!selectedPlayer || gearBusy === item.id} onClick={() => buyGear(item)} className="mt-3 w-full rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-50">{gearBusy === item.id ? 'Purchasing…' : `Buy for ${selectedPlayer?.name || 'player'}`}</button></div>)}</div>
          </div>
        </aside>
      )}
    </div>
  );
}
