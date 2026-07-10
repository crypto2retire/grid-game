import { useEffect, useMemo, useState } from 'react';
import { Activity, Dumbbell, HeartPulse, Home, Package, Shield, ShoppingBag, Users, Wrench } from 'lucide-react';
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

const sections: Array<{ id: TeamSection; label: string; icon: typeof Users }> = [
  { id: 'roster', label: 'Roster', icon: Users },
  { id: 'training', label: 'Training', icon: Dumbbell },
  { id: 'medical', label: 'Medical', icon: HeartPulse },
  { id: 'equipment', label: 'Equipment', icon: Wrench },
  { id: 'assets', label: 'Assets', icon: Home },
  { id: 'sponsorships', label: 'Sponsorships', icon: Shield },
];

const positionNeeds: Record<string, string[]> = {
  QB: ['ARM', 'IQ', 'AGI'], RB: ['SPD', 'AGI', 'STR'], WR: ['SPD', 'AGI', 'IQ'],
  TE: ['STR', 'IQ', 'AGI'], OL: ['STR', 'IQ'], DL: ['STR', 'TCK'],
  LB: ['TCK', 'SPD', 'IQ'], CB: ['SPD', 'AGI', 'TCK'], S: ['TCK', 'IQ', 'SPD'], K: ['ARM', 'IQ'],
};

function clickTeamTab(label: string) {
  const root = document.querySelector('.building-interior-content');
  if (!root) return false;
  const candidates = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  const target = candidates.find((button) => button.textContent?.trim() === label);
  if (!target) return false;
  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  target.click();
  return true;
}

function applyTrainingFiltering() {
  const root = document.querySelector('.building-interior-content');
  if (!root) return;
  const playerButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  const selectedPlayer = playerButtons.find((button) => button.className.includes('border-[#E94560]/70'));
  const position = selectedPlayer?.querySelector('span.rounded-md')?.textContent?.trim();
  const cards = Array.from(root.querySelectorAll<HTMLElement>('.glass-card'));
  cards.forEach((card) => {
    const text = card.textContent || '';
    if (!text.includes('Start Training')) return;
    const isBadFit = Boolean(position) && text.includes(`Does not target ${position}`);
    card.style.display = isBadFit ? 'none' : '';
    card.dataset.trainingFit = text.includes(`Good for ${position}`) ? 'recommended' : 'available';
  });
  const container = cards.find((card) => card.textContent?.includes('Select Player (Individual Training)'))?.parentElement;
  if (container) {
    const packageCards = Array.from(container.querySelectorAll<HTMLElement>('[data-training-fit]'));
    packageCards.sort((a, b) => (a.dataset.trainingFit === 'recommended' ? -1 : 1) - (b.dataset.trainingFit === 'recommended' ? -1 : 1));
    packageCards.forEach((card) => card.parentElement?.appendChild(card));
  }
}

export default function InteriorMenuExperience() {
  const { panels } = usePanels();
  const { teams, selectedTeamId, refreshTeams, refreshWallet } = useGameStore();
  const topPanel = panels.length ? [...panels].sort((a, b) => b.zIndex - a.zIndex)[0] : null;
  const selectedTeam: any = teams.find((team) => team.id === selectedTeamId) || teams[0] || null;
  const supported = ['team', 'training', 'medical'].includes(topPanel?.buildingId || '');
  const initialSection: TeamSection = topPanel?.buildingId === 'training' ? 'training' : topPanel?.buildingId === 'medical' ? 'medical' : 'roster';
  const [section, setSection] = useState<TeamSection>(initialSection);
  const [catalog, setCatalog] = useState<MarketItem[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [gearBusy, setGearBusy] = useState<string | null>(null);
  const [gearMessage, setGearMessage] = useState<string | null>(null);

  useEffect(() => setSection(initialSection), [topPanel?.id, initialSection]);

  useEffect(() => {
    if (!supported || section !== 'training') return;
    applyTrainingFiltering();
    const observer = new MutationObserver(applyTrainingFiltering);
    const root = document.querySelector('.building-interior-content');
    if (root) observer.observe(root, { subtree: true, attributes: true, childList: true });
    return () => observer.disconnect();
  }, [supported, section]);

  useEffect(() => {
    if (!supported || section !== 'equipment') return;
    const token = localStorage.getItem('token');
    fetch('/api/market/items', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load player gear')))
      .then((payload) => setCatalog(payload.data || []))
      .catch((error) => setGearMessage(error.message));
  }, [supported, section]);

  const players = useMemo(() => (selectedTeam?.teamPlayers || []).map((entry: any) => entry.player), [selectedTeam]);
  const selectedPlayer = players.find((player: any) => player.id === selectedPlayerId) || players[0] || null;
  const ownedGear = useMemo(() => players.flatMap((player: any) => (player.playerItems || []).map((owned: any) => ({ ...owned, player }))), [players]);

  if (!supported || !topPanel) return null;

  const chooseSection = (next: TeamSection, label: string) => {
    setSection(next);
    requestAnimationFrame(() => clickTeamTab(label));
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

  return (
    <div className="pointer-events-none fixed inset-0 z-[35] text-white">
      <nav className="pointer-events-auto absolute left-5 top-24 w-52 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/10 px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Team Operations</div>
          <div className="mt-1 truncate text-sm font-bold">{selectedTeam?.name || 'Franchise'}</div>
        </div>
        <div className="p-2">
          {sections.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button key={item.id} type="button" onClick={() => chooseSection(item.id, item.label)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {section === 'training' && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-emerald-300/20 bg-slate-950/90 px-4 py-2 text-xs text-emerald-100 shadow-xl">
          Select a player to automatically show only useful training programs. Recommended programs appear first.
        </div>
      )}

      {section === 'equipment' && (
        <aside className="pointer-events-auto absolute bottom-5 right-5 top-24 flex w-[390px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/96 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-slate-950"><ShoppingBag className="h-5 w-5" /></div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Player Equipment</div>
                <div className="text-base font-black">Gear Shop & Inventory</div>
              </div>
            </div>
            <select value={selectedPlayer?.id || ''} onChange={(event) => setSelectedPlayerId(event.target.value)} className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">
              {players.map((player: any) => <option key={player.id} value={player.id}>{player.name} · {player.position} · OVR {player.overall}</option>)}
            </select>
            {selectedPlayer && <div className="mt-2 text-xs text-slate-400">Best development focus: {(positionNeeds[selectedPlayer.position] || ['SPD', 'IQ', 'STR']).join(' / ')}</div>}
            {gearMessage && <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">{gearMessage}</div>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><Package className="h-4 w-4" /> Owned gear ({ownedGear.length})</div>
            {ownedGear.length === 0 ? (
              <div className="mb-5 rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No player gear owned yet. Purchase an item below and assign it directly to a player.</div>
            ) : (
              <div className="mb-5 space-y-2">
                {ownedGear.slice(0, 8).map((owned: any) => (
                  <div key={owned.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex justify-between gap-3"><span className="font-bold">{owned.item?.name}</span><span className="text-xs text-cyan-300">{owned.player.name}</span></div>
                    <div className="mt-1 text-xs text-slate-400">{owned.item?.slot} · {owned.item?.rarity} {owned.equipped ? '· Equipped' : ''}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Available player gear</div>
            <div className="space-y-3">
              {catalog.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="font-bold">{item.name}</div><div className="text-xs text-slate-400">{item.slot} · {item.rarity}</div></div>
                    <div className="text-sm font-black text-amber-300">{item.marketPriceCash.toLocaleString()} CASH</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(item.statBoosts || {}).filter(([, value]) => value > 0).map(([stat, value]) => <span key={stat} className="rounded-md bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">+{value} {stat.toUpperCase()}</span>)}
                  </div>
                  <button type="button" disabled={!selectedPlayer || gearBusy === item.id} onClick={() => buyGear(item)} className="mt-3 w-full rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-50">{gearBusy === item.id ? 'Purchasing…' : `Buy for ${selectedPlayer?.name || 'player'}`}</button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
