import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Shirt, Shield, Hand, Footprints, Gem, Star, Minus, Plus, AlertCircle } from 'lucide-react';

const SLOT_ICONS: Record<string, any> = {
  helmet: Shirt,
  pads: Shield,
  gloves: Hand,
  shoes: Footprints,
  accessory: Gem,
};

const RARITY_COLORS: Record<string, string> = {
  common: 'text-slate-400 border-slate-600',
  rare: 'text-blue-400 border-blue-600',
  epic: 'text-purple-400 border-purple-600',
  legendary: 'text-amber-400 border-amber-600',
};

const RARITY_BG: Record<string, string> = {
  common: 'bg-slate-400/10',
  rare: 'bg-blue-400/10',
  epic: 'bg-purple-400/10',
  legendary: 'bg-amber-400/10',
};

interface PlayerItem {
  id: string;
  itemId: string;
  item: {
    id: string;
    name: string;
    slot: string;
    rarity: string;
    statBoosts: Record<string, number>;
    durability: number;
  };
  equipped: boolean;
  durability: number;
}

interface Player {
  id: string;
  name: string;
  position: string;
  overall: number;
  playerItems: PlayerItem[];
}

export default function EquipmentPage() {
  const { teams, selectedTeamId, setSelectedTeamId } = useGameStore();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const activeTeam = teams.find((t: any) => t.id === selectedTeamId);
  const players: Player[] = activeTeam?.teamPlayers?.map((tp: any) => tp.player) || [];

  const allItems = players.flatMap((p) => p.playerItems || []);
  const equippedItems = allItems.filter((pi) => pi.equipped);

  const totalBoosts = equippedItems.reduce((sum, pi) => {
    return sum + Object.values(pi.item.statBoosts).reduce((a, b) => a + b, 0);
  }, 0);

  const handleEquip = async (playerItemId: string, playerId: string) => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/equipment/equip', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerItemId, playerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Item equipped!');
        // Refresh teams to get updated data
        const { refreshTeams } = useGameStore.getState();
        await refreshTeams();
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        setActionError(data.message || 'Failed to equip');
      }
    } catch (err) {
      setActionError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnequip = async (playerItemId: string) => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/equipment/unequip', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerItemId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Item unequipped!');
        const { refreshTeams } = useGameStore.getState();
        await refreshTeams();
        setTimeout(() => setActionMsg(null), 3000);
      } else {
        setActionError(data.message || 'Failed to unequip');
      }
    } catch (err) {
      setActionError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const getEquippedItem = (player: Player, slot: string): PlayerItem | null => {
    return player.playerItems?.find((pi) => pi.equipped && pi.item.slot === slot) || null;
  };

  const slots = ['helmet', 'pads', 'gloves', 'shoes', 'accessory'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Locker Room</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage gear and equipment for your players
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl text-sm">
          <Star className="w-4 h-4 text-amber-400" />
          <span className="text-white font-medium">+{totalBoosts} Total Boost</span>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          {actionMsg}
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {actionError}
        </div>
      )}

      {/* Team Selector */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Select Team</h3>
        <div className="flex gap-2 flex-wrap">
          {teams.length === 0 && (
            <p className="text-sm text-white/40">No teams available.</p>
          )}
          {teams.map((team: any) => (
            <button
              key={team.id}
              onClick={() => setSelectedTeamId(team.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedTeamId === team.id
                  ? 'bg-[#E94560] text-white'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
              }`}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      {/* Player Selector */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Select Player</h3>
        <div className="grid grid-cols-2 gap-2">
          {players.length === 0 && (
            <p className="text-sm text-white/40 col-span-full">No players on this team.</p>
          )}
          {players.map((player) => {
            const playerBoosts = player.playerItems
              ?.filter((pi) => pi.equipped)
              .reduce((sum, pi) => sum + Object.values(pi.item.statBoosts).reduce((a, b) => a + b, 0), 0) || 0;
            return (
              <button
                key={player.id}
                onClick={() => setSelectedPlayer(player)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedPlayer?.id === player.id
                    ? 'bg-[#E94560]/10 border-[#E94560]/40'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="font-medium text-white text-sm">{player.name}</div>
                <div className="text-xs text-white/50">{player.position} • OVR {player.overall}</div>
                {playerBoosts > 0 && (
                  <div className="text-xs text-amber-400 mt-1">+{playerBoosts} boost</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Player Equipment */}
      {selectedPlayer && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">{selectedPlayer.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedPlayer.position} • OVR {selectedPlayer.overall}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {slots.map((slot) => {
              const equipped = getEquippedItem(selectedPlayer, slot);
              const SlotIcon = SLOT_ICONS[slot] || Gem;

              return (
                <div key={slot} className="text-center">
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-2">{slot}</div>
                  {equipped ? (
                    <div className={`p-3 rounded-xl border ${RARITY_COLORS[equipped.item.rarity] || RARITY_COLORS.common} ${RARITY_BG[equipped.item.rarity] || RARITY_BG.common}`}>
                      <SlotIcon className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-xs font-bold text-white">{equipped.item.name}</div>
                      <div className="text-[10px] text-white/60 mt-1">
                        {Object.entries(equipped.item.statBoosts).map(([stat, val]) => (
                          <span key={stat} className="text-emerald-400">+{val} {stat}</span>
                        ))}
                      </div>
                      <div className="text-[10px] text-white/40 mt-1">Dur: {equipped.durability}</div>
                      <button
                        onClick={() => handleUnequip(equipped.id)}
                        disabled={loading}
                        className="mt-2 px-2 py-1 bg-red-400/10 text-red-400 rounded text-xs hover:bg-red-400/20 disabled:opacity-50"
                      >
                        <Minus className="w-3 h-3 inline" /> Remove
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-white/10 bg-white/5">
                      <SlotIcon className="w-6 h-6 mx-auto mb-2 text-white/20" />
                      <div className="text-xs text-white/30">Empty</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Inventory for this player */}
          <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Inventory</h4>
          {selectedPlayer.playerItems?.length === 0 ? (
            <p className="text-sm text-white/30">No items in inventory. Visit the Market to buy equipment.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {selectedPlayer.playerItems?.map((pi) => {
                const SlotIcon = SLOT_ICONS[pi.item.slot] || Gem;
                return (
                  <div
                    key={pi.id}
                    className={`p-3 rounded-xl border transition-all ${
                      pi.equipped
                        ? `${RARITY_COLORS[pi.item.rarity] || RARITY_COLORS.common} ${RARITY_BG[pi.item.rarity] || RARITY_BG.common}`
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <SlotIcon className="w-4 h-4 text-white/60" />
                      <span className="text-xs font-bold text-white">{pi.item.name}</span>
                    </div>
                    <div className="text-[10px] text-white/50 mb-2">
                      {Object.entries(pi.item.statBoosts).map(([stat, val]) => (
                        <span key={stat} className="text-emerald-400">+{val} {stat} </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-white/40 mb-2">Dur: {pi.durability}/{pi.item.durability}</div>
                    {!pi.equipped && (
                      <button
                        onClick={() => handleEquip(pi.id, selectedPlayer.id)}
                        disabled={loading}
                        className="w-full px-2 py-1 bg-[#E94560]/20 text-[#E94560] rounded text-xs hover:bg-[#E94560]/30 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Equip
                      </button>
                    )}
                    {pi.equipped && (
                      <div className="w-full text-center text-[10px] text-emerald-400 font-bold py-1">Equipped</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
