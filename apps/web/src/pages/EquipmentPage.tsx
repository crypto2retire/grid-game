import { useState } from 'react';
import { useTraining, type EquipmentItem } from '../components/training/TrainingSystem';
import {
  Shirt, Shield, Hand, Footprints, Gem, Star, Minus, Plus,
} from 'lucide-react';

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

export default function EquipmentPage() {
  const { equipment, equippedSlots, equipItem, unequipItem, playerFatigue } = useTraining();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('player-0');
  const [filterSlot, setFilterSlot] = useState<string>('all');

  const slots = ['helmet', 'pads', 'gloves', 'shoes', 'accessory'];
  
  const playerEquipped = equippedSlots.filter(s => s.playerId === selectedPlayer);
  const playerFatigueData = playerFatigue.find(p => p.playerId === selectedPlayer);

  const filteredEquipment = filterSlot === 'all' 
    ? equipment 
    : equipment.filter(e => e.slot === filterSlot);

  const isEquipped = (itemId: string) => {
    return equippedSlots.some(s => s.playerId === selectedPlayer && s.item.id === itemId);
  };

  const getEquippedItem = (slot: string): EquipmentItem | null => {
    const equipped = playerEquipped.find(s => s.slot === slot);
    return equipped?.item || null;
  };

  const totalBoosts = playerEquipped.reduce((sum, s) => {
    return sum + Object.values(s.item.statBoosts).reduce((a, b) => a + b, 0);
  }, 0);

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

      {/* Player Selector */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Select Player</h3>
        <div className="flex gap-2 flex-wrap">
          {playerFatigue.map((p) => (
            <button
              key={p.playerId}
              onClick={() => setSelectedPlayer(p.playerId)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedPlayer === p.playerId
                  ? 'bg-[#E94560] text-white'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
              }`}
            >
              {p.playerName} ({p.fatigue}% fatigue)
            </button>
          ))}
        </div>
      </div>

      {/* Equipped Gear Display */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
          Equipped on {playerFatigueData?.playerName}
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {slots.map((slot) => {
            const equippedItem = getEquippedItem(slot);
            const SlotIcon = SLOT_ICONS[slot];
            return (
              <div
                key={slot}
                onClick={() => setSelectedSlot(selectedSlot === slot ? null : slot)}
                className={`relative p-4 rounded-xl border border-white/10 cursor-pointer transition-all hover:border-white/20 ${
                  equippedItem ? RARITY_BG[equippedItem.rarity] : 'bg-white/5'
                } ${selectedSlot === slot ? 'ring-2 ring-[#E94560]' : ''}`}
              >
                <div className="flex flex-col items-center gap-2">
                  <SlotIcon className={`w-6 h-6 ${equippedItem ? RARITY_COLORS[equippedItem.rarity].split(' ')[0] : 'text-white/30'}`} />
                  <span className="text-xs font-bold text-white/60 uppercase">{slot}</span>
                  {equippedItem ? (
                    <div className="text-center">
                      <div className={`text-xs font-bold ${RARITY_COLORS[equippedItem.rarity].split(' ')[0]}`}>
                        {equippedItem.name}
                      </div>
                      <div className="text-xs text-white/40 mt-1">
                        {Object.entries(equippedItem.statBoosts).map(([stat, val]) => (
                          <span key={stat} className="text-emerald-400">+{val} {stat}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-white/30">Empty</span>
                  )}
                </div>
                {equippedItem && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      unequipItem(selectedPlayer, slot);
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-500"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Inventory</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterSlot('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filterSlot === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              All
            </button>
            {slots.map((slot) => (
              <button
                key={slot}
                onClick={() => setFilterSlot(slot)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  filterSlot === slot ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredEquipment.map((item) => {
            const SlotIcon = SLOT_ICONS[item.slot];
            const equipped = isEquipped(item.id);
            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  RARITY_COLORS[item.rarity]
                } ${RARITY_BG[item.rarity]} ${equipped ? 'opacity-50' : 'hover:border-white/30'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                      <SlotIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{item.name}</div>
                      <div className="text-xs text-white/40 capitalize">{item.slot} • {item.rarity}</div>
                    </div>
                  </div>
                  <div className="text-xs text-white/40">
                    {item.durability}%
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap mt-3">
                  {Object.entries(item.statBoosts).map(([stat, val]) => (
                    <span key={stat} className="text-xs bg-white/10 rounded-lg px-2 py-1 text-emerald-400 font-medium">
                      +{val} {stat}
                    </span>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-white/10">
                  <button
                    onClick={() => {
                      if (!equipped) equipItem(selectedPlayer, item.id);
                    }}
                    disabled={equipped}
                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      equipped
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-[#E94560]/20 text-[#E94560] hover:bg-[#E94560]/30'
                    }`}
                  >
                    {equipped ? (
                      <>Equipped</>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Equip
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
