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

type TeamSection = 'roster' | 'training' | 'medical' | 'equipment';
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
  teamSection?: TeamSection;
};
type BuildingStationConfig = {
  title: string;
  subtitle: string;
  stations: StationAction[];
};

const buildingStations: Record<string, BuildingStationConfig> = {
  team: {
    title: 'Team Headquarters',
    subtitle: 'Roster, lineup and player decisions',
    stations: [
      { id: 'roster', label: 'Roster', description: 'Players, starters and lineup decisions', targets: ['Roster'], icon: Users, teamSection: 'roster' },
    ],
  },
  training: {
    title: 'Training Center',
    subtitle: 'Player development and equipment',
    stations: [
      { id: 'training', label: 'Training Programs', description: 'Position-specific stat development', targets: ['Training'], icon: Dumbbell, teamSection: 'training' },
      { id: 'equipment', label: 'Player Equipment', description: 'Buy and assign gear to players', targets: ['Equipment'], icon: ShoppingBag, teamSection: 'equipment' },
    ],
  },
  medical: {
    title: 'Medical Center',
    subtitle: 'Treatment, fatigue and recovery',
    stations: [
      { id: 'medical', label: 'Treatment Room', description: 'Injuries, fatigue and recovery plans', targets: ['Medical'], icon: HeartPulse, teamSection: 'medical' },
    ],
  },
  stadium: {
    title: 'Home Stadium', subtitle: 'Venue operations and matchday business', stations: [
      { id: 'venue', label: 'Venue Overview', description: 'Capacity, condition and stadium sections', targets: ['Venue'], icon: Building2 },
      { id: 'match-office', label: 'Match Office', description: 'Schedule and manage home fixtures', targets: ['Match Office', 'Schedule Match'], icon: Trophy },
      { id: 'game-plan', label: 'Game Plan', description: 'Tactics and match preparation', targets: ['Game Plan', 'Tactics'], icon: ClipboardList },
      { id: 'upgrades', label: 'Upgrade Center', description: 'Improve stadium sections', targets: ['Open Upgrades', 'Upgrade Section', 'Upgrade'], icon: Wrench },
      { id: 'economy', label: 'Stadium Economy', description: 'Revenue, attendance and costs', targets: ['View Economy', 'Economy', 'Revenue'], icon: Gauge },
    ],
  },
  practice: {
    title: 'Practice Field', subtitle: 'Games and match preparation', stations: [
      { id: 'play', label: 'Play Game', description: 'Start the next playable matchup', targets: ['Play Game', 'Start Match', 'Play Match'], icon: Trophy },
      { id: 'schedule', label: 'Schedule', description: 'Create or find the next fixture', targets: ['Schedule', 'Schedule Match', 'Find Opponent'], icon: ClipboardList },
      { id: 'live', label: 'Live Games', description: 'View games currently in progress', targets: ['Live', 'Live Matches', 'In Progress'], icon: Activity },
      { id: 'results', label: 'Results', description: 'Review completed games', targets: ['Results', 'Completed', 'History'], icon: Award },
    ],
  },
  clubhouse: {
    title: 'Clubhouse', subtitle: 'Daily franchise command center', stations: [
      { id: 'dashboard', label: 'Dashboard', description: 'Current priorities and status', targets: ['Dashboard', 'Overview'], icon: Gauge },
      { id: 'journey', label: 'Daily Journey', description: 'Today’s goals and progress', targets: ['Daily Journey', 'Daily Plan', 'Objectives'], icon: Sparkles },
      { id: 'league', label: 'League Progress', description: 'Promotion and standings', targets: ['League', 'Promotion', 'Standings'], icon: Trophy },
    ],
  },
  market: {
    title: 'Sports Market', subtitle: 'Player trading and listings', stations: [
      { id: 'players', label: 'Player Market', description: 'Browse available players', targets: ['Players', 'Player Market', 'Marketplace'], icon: Users },
      { id: 'listings', label: 'My Listings', description: 'Manage active sale listings', targets: ['My Listings', 'Listings'], icon: Store },
      { id: 'offers', label: 'Offers', description: 'Review incoming and outgoing offers', targets: ['Offers'], icon: Coins },
      { id: 'refresh', label: 'Refresh Market', description: 'Reload prices and inventory', targets: ['Refresh'], icon: RefreshCw },
    ],
  },
  commissioner: {
    title: 'Commissioner Office', subtitle: 'Funding cycles and limited drops', stations: [
      { id: 'overview', label: 'Cycle Overview', description: 'Current phase, funding and meters', targets: ['Overview', 'Current Phase'], icon: Gauge },
      { id: 'fund', label: 'Fund Cycle', description: 'Contribute to the next release', targets: ['Fund Commissioner Cycle', 'Contribution', 'Fund'], icon: Coins },
      { id: 'inventory', label: 'Limited Inventory', description: 'Unlocked and upcoming drops', targets: ['Limited Restock Inventory', 'Inventory'], icon: Package },
      { id: 'rewards', label: 'My Rewards', description: 'Contribution and reward totals', targets: ['My Funded', 'Rewards'], icon: Award },
    ],
  },
  hall: {
    title: 'Hall of Fame', subtitle: 'Records and franchise legacy', stations: [
      { id: 'legacy', label: 'Franchise Legacy', description: 'Prestige and achievements', targets: ['Legacy', 'Prestige', 'Overview'], icon: Trophy },
      { id: 'records', label: 'Records', description: 'Team and player records', targets: ['Records', 'History'], icon: Award },
      { id: 'leaders', label: 'Leaderboards', description: 'Compare top franchises', targets: ['Leaderboard', 'Rankings'], icon: Users },
    ],
  },
  garage: {
    title: 'Team Garage', subtitle: 'Transport, maintenance and upgrades', stations: [
      { id: 'fleet', label: 'Fleet Overview', description: 'Current team transportation', targets: ['Transportation', 'Fleet', 'Overview'], icon: Bus },
      { id: 'maintenance', label: 'Maintenance', description: 'Condition and operating costs', targets: ['Maintenance', 'Operating Cost', 'Costs'], icon: Gauge },
      { id: 'upgrade', label: 'Transport Upgrades', description: 'Improve comfort and fatigue reduction', targets: ['Upgrade Transportation', 'Upgrade'], icon: Wrench },
    ],
  },
  bank: {
    title: 'Sponsor Bank', subtitle: 'Sponsors, wallet and treasury', stations: [
      { id: 'wallet', label: 'Wallet', description: 'CASH and DYN balances', targets: ['Wallet', 'Balance'], icon: WalletCards },
      { id: 'sponsors', label: 'Sponsorships', description: 'Active deals and offers', targets: ['Sponsorships', 'Sponsors'], icon: Shield },
      { id: 'treasury', label: 'Treasury', description: 'Revenue and economic activity', targets: ['Treasury', 'Economy'], icon: Landmark },
      { id: 'rewards', label: 'Rewards', description: 'Claims and reward history', targets: ['Rewards', 'Claim'], icon: Award },
    ],
  },
};

const positionNeeds: Record<string, string[]> = {
  QB: ['ARM', 'IQ', 'AGI'], RB: ['SPD', 'AGI', 'STR'], WR: ['SPD', 'AGI', 'IQ'], TE: ['STR', 'IQ', 'AGI'],
  OL: ['STR', 'IQ'], DL: ['STR', 'TCK'], LB: ['TCK', 'SPD', 'IQ'], CB: ['SPD', 'AGI', 'TCK'], S: ['TCK', 'IQ', 'SPD'], K: ['ARM', 'IQ'],
};
const normalizeText = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

function activateInteriorControl(targets: string[]) {
  const root = document.querySelector('.building-interior-content');
  if (!root) return false;
  const wanted = targets.map(normalizeText);
  const control = Array.from(root.querySelectorAll<HTMLElement>('button, [role="tab"], a')).find((candidate) => {
    const text = normalizeText(candidate.textContent);
    return wanted.some((target) => text === target || text.includes(target));
  });
  if (control) {
    control.click();
    control.focus({ preventScroll: true });
    return true;
  }
  const section = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, section, article, .glass-card')).find((candidate) => {
    const text = normalizeText(candidate.textContent);
    return wanted.some((target) => text.includes(target));
  });
  section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  return Boolean(section);
}

function applyBuildingScope(buildingId: string) {
  const root = document.querySelector<HTMLElement>('.building-interior-content');
  if (!root) return;
  root.dataset.interiorScope = buildingId;
  const duplicateTabs = new Set(['roster', 'training', 'medical', 'equipment', 'assets', 'sponsorships']);
  root.querySelectorAll<HTMLElement>('button').forEach((button) => {
    const text = normalizeText(button.textContent);
    if (duplicateTabs.has(text)) button.dataset.duplicateInteriorTab = 'true';
  });
}

function applyTrainingFiltering() {
  const root = document.querySelector('.building-interior-content');
  if (!root) return;
  const selectedPlayer = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.className.includes('border-[#E94560]/70'));
  const position = selectedPlayer?.querySelector('span.rounded-md')?.textContent?.trim();
  root.querySelectorAll<HTMLElement>('.glass-card').forEach((card) => {
    const text = card.textContent || '';
    if (!text.includes('Start Training')) return;
    card.style.display = Boolean(position) && text.includes(`Does not target ${position}`) ? 'none' : '';
  });
}

export default function InteriorMenuExperience() {
  const { panels } = usePanels();
  const { teams, selectedTeamId, refreshTeams, refreshWallet } = useGameStore();
  const topPanel = panels.length ? [...panels].sort((a, b) => b.zIndex - a.zIndex)[0] : null;
  const buildingId = topPanel?.buildingId || '';
  const config = buildingStations[buildingId];
  const selectedTeam: any = teams.find((team) => team.id === selectedTeamId) || teams[0] || null;
  const initialStation = config?.stations[0]?.id || '';
  const [activeStation, setActiveStation] = useState(initialStation);
  const [stationMessage, setStationMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<MarketItem[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [gearBusy, setGearBusy] = useState<string | null>(null);
  const [gearMessage, setGearMessage] = useState<string | null>(null);
  const activeAction = config?.stations.find((station) => station.id === activeStation);
  const isEquipment = buildingId === 'training' && activeAction?.teamSection === 'equipment';

  useEffect(() => {
    setActiveStation(initialStation);
    setStationMessage(null);
    const run = () => {
      applyBuildingScope(buildingId);
      const initial = config?.stations[0];
      if (initial) activateInteriorControl(initial.targets);
    };
    const timer = window.setTimeout(run, 0);
    const root = document.querySelector('.building-interior-content');
    const observer = new MutationObserver(run);
    if (root) observer.observe(root, { subtree: true, childList: true });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [topPanel?.id, buildingId, initialStation]);

  useEffect(() => {
    if (buildingId !== 'training' || activeAction?.teamSection !== 'training') return;
    const rerun = () => window.setTimeout(applyTrainingFiltering, 0);
    rerun();
    const root = document.querySelector('.building-interior-content');
    root?.addEventListener('click', rerun);
    return () => root?.removeEventListener('click', rerun);
  }, [buildingId, activeAction?.teamSection]);

  useEffect(() => {
    if (!isEquipment) return;
    const token = localStorage.getItem('token');
    fetch('/api/market/items', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load player gear')))
      .then((payload) => setCatalog(payload.data || []))
      .catch((error: Error) => setGearMessage(error.message));
  }, [isEquipment]);

  const players = useMemo(() => (selectedTeam?.teamPlayers || []).map((entry: any) => entry.player), [selectedTeam]);
  const selectedPlayer = players.find((player: any) => player.id === selectedPlayerId) || players[0] || null;
  const ownedGear = useMemo(() => players.flatMap((player: any) => (player.playerItems || []).map((owned: any) => ({ ...owned, player }))), [players]);
  if (!config || !topPanel) return null;

  const chooseStation = (station: StationAction) => {
    setActiveStation(station.id);
    setStationMessage(null);
    requestAnimationFrame(() => {
      if (!activateInteriorControl(station.targets)) setStationMessage(`${station.label} is not available in this building yet.`);
      applyBuildingScope(buildingId);
    });
  };

  const buyGear = async (item: MarketItem) => {
    if (!selectedPlayer) return;
    const token = localStorage.getItem('token');
    setGearBusy(item.id);
    setGearMessage(null);
    try {
      const response = await fetch('/api/market/buy', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, playerId: selectedPlayer.id, currency: 'CASH' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Purchase failed');
      setGearMessage(`${item.name} added to ${selectedPlayer.name}'s inventory.`);
      await Promise.all([refreshTeams(), refreshWallet()]);
    } catch (error) {
      setGearMessage(error instanceof Error ? error.message : 'Purchase failed');
    } finally { setGearBusy(null); }
  };

  return (
    <div className="interior-menu-experience pointer-events-none fixed inset-0 z-[35] text-white">
      <nav className="interior-station-rail pointer-events-auto flex flex-col overflow-hidden border-r border-white/10 bg-slate-950 shadow-2xl">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Working Stations</div>
          <div className="mt-1 text-lg font-black">{config.title}</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{config.subtitle}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {config.stations.map((item) => {
            const Icon = item.icon;
            const active = activeStation === item.id;
            return <button key={item.id} type="button" onClick={() => chooseStation(item)} className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${active ? 'border-cyan-300/50 bg-cyan-400 text-slate-950' : 'border-white/5 bg-white/[0.04] text-slate-200 hover:bg-white/[0.09]'}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active ? 'bg-slate-950/15' : 'bg-slate-800 text-cyan-300'}`}><Icon className="h-4 w-4" /></span>
              <span><span className="block text-sm font-black">{item.label}</span><span className={`mt-0.5 block text-[11px] ${active ? 'text-slate-800' : 'text-slate-400'}`}>{item.description}</span></span>
            </button>;
          })}
        </div>
        <div className="border-t border-white/10 p-3 text-[10px] font-bold uppercase tracking-wider text-emerald-300">{stationMessage || 'Station online'}</div>
      </nav>

      {buildingId === 'training' && activeAction?.teamSection === 'training' && <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-emerald-300/20 bg-slate-950/90 px-4 py-2 text-xs text-emerald-100">Only programs that benefit the selected player are shown.</div>}

      {isEquipment && <aside className="equipment-workspace pointer-events-auto fixed bottom-0 right-0 top-16 flex flex-col overflow-hidden bg-slate-950 shadow-2xl">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-slate-950"><ShoppingBag className="h-5 w-5" /></div><div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Training Center</div><div className="text-lg font-black">Player Equipment</div></div></div>
          <select value={selectedPlayer?.id || ''} onChange={(event) => setSelectedPlayerId(event.target.value)} className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">{players.map((player: any) => <option key={player.id} value={player.id}>{player.name} · {player.position} · OVR {player.overall}</option>)}</select>
          {selectedPlayer && <div className="mt-2 text-xs text-slate-400">Best development focus: {(positionNeeds[selectedPlayer.position] || ['SPD', 'IQ', 'STR']).join(' / ')}</div>}
          {gearMessage && <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">{gearMessage}</div>}
        </div>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[0.8fr_1.2fr]">
          <section><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><Package className="h-4 w-4" /> Owned gear ({ownedGear.length})</div>{ownedGear.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No player gear owned yet.</div> : <div className="space-y-2">{ownedGear.map((owned: any) => <div key={owned.id} className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex justify-between gap-3"><span className="font-bold">{owned.item?.name}</span><span className="text-xs text-cyan-300">{owned.player.name}</span></div><div className="mt-1 text-xs text-slate-400">{owned.item?.slot} · {owned.item?.rarity} {owned.equipped ? '· Equipped' : ''}</div></div>)}</div>}</section>
          <section><div className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Available player gear</div><div className="grid gap-3 xl:grid-cols-2">{catalog.map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900/80 p-3"><div className="flex justify-between gap-3"><div><div className="font-bold">{item.name}</div><div className="text-xs text-slate-400">{item.slot} · {item.rarity}</div></div><div className="text-sm font-black text-amber-300">{item.marketPriceCash.toLocaleString()} CASH</div></div><div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(item.statBoosts || {}).filter(([, value]) => Number(value) > 0).map(([stat, value]) => <span key={stat} className="rounded-md bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">+{Number(value)} {stat.toUpperCase()}</span>)}</div><button type="button" disabled={!selectedPlayer || gearBusy === item.id} onClick={() => buyGear(item)} className="mt-3 w-full rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50">{gearBusy === item.id ? 'Purchasing…' : `Buy for ${selectedPlayer?.name || 'player'}`}</button></div>)}</div></section>
        </div>
      </aside>}
    </div>
  );
}
