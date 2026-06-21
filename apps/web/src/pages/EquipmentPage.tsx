import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Wrench, Dumbbell, HeartPulse, Monitor, Coins, Zap } from 'lucide-react';

interface EquipmentType {
  id: string;
  name: string;
  category: string;
  tier: number;
  description: string;
  baseCostGrid: number;
  baseCostCash: number;
  effects: Record<string, any>;
}

interface TeamEquipment {
  id: string;
  equipmentType: EquipmentType;
  level: number;
  purchasedAt: string;
  activeEffects: Record<string, any>;
}

interface Team {
  id: string;
  name: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  TRAINING: Dumbbell,
  FACILITY: Wrench,
  MEDICAL: HeartPulse,
  ANALYSIS: Monitor,
};

const CATEGORY_LABELS: Record<string, string> = {
  TRAINING: 'Training',
  FACILITY: 'Facility',
  MEDICAL: 'Medical',
  ANALYSIS: 'Analysis',
};

export default function EquipmentPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [ownedEquipment, setOwnedEquipment] = useState<TeamEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wallet, setWallet] = useState({ cash: 0, gridTokens: 0 });

  useEffect(() => {
    Promise.all([
      fetchApi('/teams/mine').then((r) => setTeams(r.data || [])),
      fetchApi('/equipment/types').then((r) => setEquipmentTypes(r.data || [])),
      fetchApi('/economy/wallet').then((r) => setWallet(r.data || { cash: 0, gridTokens: 0 })),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    loadTeamEquipment();
  }, [selectedTeam]);

  const loadTeamEquipment = () => {
    fetchApi(`/equipment/team/${selectedTeam}`)
      .then((r) => setOwnedEquipment(r.data || []))
      .catch(console.error);
  };

  const purchaseEquipment = async (typeId: string) => {
    if (!selectedTeam) {
      setMessage('Please select a team first');
      return;
    }

    setPurchasing(true);
    setMessage(null);
    try {
      const res = await fetchApi('/equipment/purchase', {
        method: 'POST',
        body: JSON.stringify({ teamId: selectedTeam, equipmentTypeId: typeId }),
      });
      setMessage(`Purchased ${res.data?.teamEquipment?.equipmentType?.name || 'equipment'}`);
      loadTeamEquipment();
      const walletRes = await fetchApi('/economy/wallet');
      setWallet(walletRes.data || { cash: 0, gridTokens: 0 });
    } catch (err: any) {
      setMessage(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const ownedTypeIds = new Set(ownedEquipment.map((e) => e.equipmentType.id));

  const groupedByCategory = equipmentTypes.reduce((acc, eq) => {
    const cat = eq.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(eq);
    return acc;
  }, {} as Record<string, EquipmentType[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Equipment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upgrade facilities and training equipment to boost your team
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
          >
            <option value="">Select Team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl text-sm">
            <Coins className="w-4 h-4 text-[#FFD700]" />
            <span className="text-white font-medium">{wallet.cash.toLocaleString()} CASH</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl text-sm">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-white font-medium">{wallet.gridTokens.toLocaleString()} GRID</span>
          </div>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl p-4 text-sm ${message.includes('Purchased') ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-200' : 'bg-red-400/10 border border-red-400/20 text-red-200'}`}>
          {message}
        </div>
      )}

      {/* Owned Equipment */}
      {selectedTeam && ownedEquipment.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Owned Equipment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownedEquipment.map((eq) => {
              const Icon = CATEGORY_ICONS[eq.equipmentType.category] || Wrench;
              return (
                <div key={eq.id} className="rounded-xl bg-white/5 p-4 border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{eq.equipmentType.name}</div>
                      <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[eq.equipmentType.category]}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {Object.entries(eq.activeEffects).map(([key, val]) => (
                      <span key={key} className="text-xs bg-white/5 rounded-lg px-2 py-1 text-emerald-400">
                        {key}: {typeof val === 'number' && val < 1 ? `+${Math.round(val * 100)}%` : `+${val}`}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Equipment */}
      {Object.entries(groupedByCategory).map(([category, items]) => {
        const Icon = CATEGORY_ICONS[category] || Wrench;
        const available = items.filter((i) => !ownedTypeIds.has(i.id));
        if (available.length === 0) return null;

        return (
          <div key={category} className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#E94560]" />
              </div>
              <div>
                <div className="font-bold text-white">{CATEGORY_LABELS[category]}</div>
                <div className="text-xs text-muted-foreground">{available.length} available</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {available.map((eq) => {
                const canAfford = wallet.gridTokens >= eq.baseCostGrid && wallet.cash >= eq.baseCostCash;
                return (
                  <div key={eq.id} className="rounded-xl bg-white/5 p-4 border border-white/10 hover:border-white/20 transition-all">
                    <div className="font-bold text-white text-sm mb-1">{eq.name}</div>
                    <div className="text-xs text-white/40 mb-3">{eq.description}</div>

                    <div className="flex gap-2 flex-wrap mb-3">
                      {Object.entries(eq.effects).map(([key, val]) => (
                        <span key={key} className="text-xs bg-white/5 rounded-lg px-2 py-1 text-emerald-400">
                          {key}: {typeof val === 'number' && val < 1 ? `+${Math.round(val * 100)}%` : `+${val}`}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <div className="space-y-1">
                        {eq.baseCostGrid > 0 && (
                          <div className="text-xs text-purple-400 font-bold">{eq.baseCostGrid.toLocaleString()} GRID</div>
                        )}
                        {eq.baseCostCash > 0 && (
                          <div className="text-xs text-[#FFD700] font-bold">{eq.baseCostCash.toLocaleString()} CASH</div>
                        )}
                      </div>
                      <button
                        onClick={() => purchaseEquipment(eq.id)}
                        disabled={purchasing || !canAfford || !selectedTeam}
                        className="px-3 py-1.5 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-lg font-medium text-xs hover:shadow-glow transition-shadow disabled:opacity-50"
                      >
                        Purchase
                      </button>
                    </div>
                    {!canAfford && selectedTeam && (
                      <p className="text-xs text-red-300 mt-1">Not enough funds</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
