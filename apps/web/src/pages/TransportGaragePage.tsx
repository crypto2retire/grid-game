import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bus,
  Loader2,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  ArrowUpCircle,
  Gauge,
  GaugeCircle,
  Zap,
  Clock,
  Store,
  Tag,
  X,
  ShoppingCart,
} from 'lucide-react';
import TransportGarage, { type VehicleAsset } from '../components/garage/TransportGarage';

const TIER_LABELS: Record<string, string> = {
  CARPOOL: 'Carpool Van',
  USED_BUS: 'Used Bus',
  TEAM_BUS: 'Team Bus',
  LUXURY_COACH: 'Luxury Coach',
  CHARTER_FLIGHT: 'Charter Flight',
  TEAM_AIRCRAFT: 'Team Aircraft',
  CUSTOM_JET: 'Custom Jet',
};

const TIER_BG_COLORS: Record<string, string> = {
  CARPOOL: '#64748b',
  USED_BUS: '#94a3b8',
  TEAM_BUS: '#3b82f6',
  LUXURY_COACH: '#fbbf24',
  CHARTER_FLIGHT: '#a78bfa',
  TEAM_AIRCRAFT: '#06b6d4',
  CUSTOM_JET: '#E94560',
};

function buildVehicleAssets(transport: any[]): VehicleAsset[] {
  return transport.map((t, i) => ({
    id: t.id || `vehicle-${i}`,
    name: t.name || `${t.tier} ${i + 1}`,
    tier: t.tier || 'CARPOOL',
    condition: t.condition || 70,
    operatingCost: t.operatingCost || 100,
    fatigueReduction: t.fatigueReduction || 1,
    prestige: t.prestige || 1,
    isLeased: false, // All transport is player-owned from day one
    capacity: t.capacity || 12,
    speed: t.speed || 1,
    upgradeCount: t.upgradeCount || 0,
    maxUpgrade: t.maxUpgrade || 5,
    yearAcquired: t.yearAcquired || 2024,
    tripsTaken: t.tripsTaken || 0,
  }));
}

export default function TransportGaragePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<VehicleAsset[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<Record<string, boolean>>({});
  const [upgradeMessages, setUpgradeMessages] = useState<Record<string, string>>({});
  const [wallet, setWallet] = useState({ cash: 0 });
  const [teamName, setTeamName] = useState('');
  const [availableTransport, setAvailableTransport] = useState<any[]>([]);
  const [marketplaceTransport, setMarketplaceTransport] = useState<any[]>([]);
  const [listingTransport, setListingTransport] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [listCurrency, setListCurrency] = useState<'CASH' | 'DYN' | 'SOL'>('CASH');
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    Promise.allSettled([
      fetch('/api/teams/mine', { headers }),
      fetch('/api/economy/wallet', { headers }),
      fetch('/api/teams/transport/available', { headers }),
      fetch('/api/teams/transport/marketplace', { headers }),
    ])
      .then(async ([teamsRes, walletRes, availRes, marketRes]) => {
        let transport: any[] = [];

        if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
          const json = await teamsRes.value.json();
          const teams = json.data || [];
          if (teams.length > 0) {
            transport = teams[0].transportationAssets || [];
            setTeamName(teams[0].name || 'My Team');
          }
        }

        if (walletRes.status === 'fulfilled' && walletRes.value.ok) {
          const json = await walletRes.value.json();
          setWallet(json.data || { cash: 0 });
        }

        if (availRes.status === 'fulfilled' && availRes.value.ok) {
          const json = await availRes.value.json();
          setAvailableTransport(json.data || []);
        }

        if (marketRes.status === 'fulfilled' && marketRes.value.ok) {
          const json = await marketRes.value.json();
          setMarketplaceTransport(json.data || []);
        }

        const vehicleAssets = buildVehicleAssets(transport);
        setVehicles(vehicleAssets);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;

    setUpgrading((prev) => ({ ...prev, [vehicleId]: true }));

    setTimeout(() => {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicleId
            ? {
                ...v,
                upgradeCount: Math.min(v.upgradeCount + 1, v.maxUpgrade),
                condition: Math.min(v.condition + 10, 100),
                fatigueReduction: Math.min(v.fatigueReduction + 1, 10),
                prestige: v.prestige + 1,
                speed: Math.min(v.speed + 0.5, 10),
                tripsTaken: v.tripsTaken + 1,
              }
            : v
        )
      );

      setUpgradeMessages((prev) => ({
        ...prev,
        [vehicleId]: `${vehicle.name} upgraded! +1 fatigue reduction, +10 condition`,
      }));
      setTimeout(() => {
        setUpgradeMessages((prev) => {
          const next = { ...prev };
          delete next[vehicleId];
          return next;
        });
      }, 3000);

      setUpgrading((prev) => ({ ...prev, [vehicleId]: false }));
    }, 1200);
  };

  async function listTransportForSale(transportId: string) {
    const price = parseInt(listPrice, 10);
    if (!price || price <= 0) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/teams/transport/${transportId}/list`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, currency: listCurrency }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        const availRes = await fetch('/api/teams/transport/available', { headers: { Authorization: `Bearer ${token}` } });
        const marketRes = await fetch('/api/teams/transport/marketplace', { headers: { Authorization: `Bearer ${token}` } });
        const availJson = await availRes.json();
        const marketJson = await marketRes.json();
        if (availJson.status === 'success') setAvailableTransport(availJson.data || []);
        if (marketJson.status === 'success') setMarketplaceTransport(marketJson.data || []);
        setListingTransport(null);
        setListPrice('');
      } else {
        alert(json.message || 'Listing failed');
      }
    } catch (e) {
      alert('Network error');
    }
  }

  async function unlistTransport(transportId: string) {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/teams/transport/${transportId}/unlist`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        const availRes = await fetch('/api/teams/transport/available', { headers: { Authorization: `Bearer ${token}` } });
        const marketRes = await fetch('/api/teams/transport/marketplace', { headers: { Authorization: `Bearer ${token}` } });
        const availJson = await availRes.json();
        const marketJson = await marketRes.json();
        if (availJson.status === 'success') setAvailableTransport(availJson.data || []);
        if (marketJson.status === 'success') setMarketplaceTransport(marketJson.data || []);
      } else {
        alert(json.message || 'Unlist failed');
      }
    } catch (e) {
      alert('Network error');
    }
  }

  async function buyTransportFromMarket(transportId: string) {
    setBuyingId(transportId);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/teams/transport/${transportId}/buy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        const marketRes = await fetch('/api/teams/transport/marketplace', { headers: { Authorization: `Bearer ${token}` } });
        const marketJson = await marketRes.json();
        if (marketJson.status === 'success') setMarketplaceTransport(marketJson.data || []);
      } else {
        alert(json.message || 'Purchase failed');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setBuyingId(null);
    }
  }

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const totalOperatingCost = vehicles.reduce((sum, v) => sum + v.operatingCost, 0);
  const avgCondition = vehicles.length > 0 ? Math.round(vehicles.reduce((sum, v) => sum + v.condition, 0) / vehicles.length) : 0;
  const totalTrips = vehicles.reduce((sum, v) => sum + v.tripsTaken, 0);
  const totalFatigueReduction = vehicles.reduce((sum, v) => sum + v.fatigueReduction, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#E94560] mx-auto" />
          <p className="text-sm text-slate-400">Loading garage data...</p>
        </div>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Bus className="h-12 w-12 text-slate-600 mx-auto" />
          <h2 className="text-xl font-bold text-white">No Vehicles Found</h2>
          <p className="text-sm text-slate-400">Create a team first to get your starter transportation.</p>
          <button
            onClick={() => navigate('/team')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E94560] px-4 py-2 font-bold text-white hover:bg-[#E94560]/90"
          >
            Create Team <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/assets')}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Assets
          </button>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Bus className="h-7 w-7 text-[#E94560]" />
            {teamName} — Transport Garage
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-slate-400">{vehicles.length} vehicles</span>
            <span className="text-slate-500">•</span>
            <span className="text-sm text-slate-400">{totalOperatingCost.toLocaleString()} CASH / trip operating cost</span>
            <span className="text-slate-500">•</span>
            <span className="text-sm text-[#FFD700]">+{totalFatigueReduction} total fatigue reduction</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Wallet</div>
            <div className="text-lg font-bold text-[#FFD700]">{wallet.cash.toLocaleString()} CASH</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* Left: Garage Visual */}
        <div className="rounded-3xl border border-white/10 bg-black/30 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Wrench className="h-4 w-4" />
              <span>Click any vehicle to view upgrade options</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Good
              <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2" /> Fair
              <span className="w-2 h-2 rounded-full bg-red-500 ml-2" /> Poor
            </div>
          </div>
          <TransportGarage
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={setSelectedVehicleId}
          />
        </div>

        {/* Right: Detail Panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedVehicle ? (
              <motion.div
                key={selectedVehicle.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <VehicleDetailPanel
                  vehicle={selectedVehicle}
                  onUpgrade={() => handleUpgrade(selectedVehicle.id)}
                  upgrading={upgrading[selectedVehicle.id] || false}
                  message={upgradeMessages[selectedVehicle.id] || ''}
                  walletCash={wallet.cash}
                />
              </motion.div>
            ) : (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <FleetOverviewPanel
                  vehicles={vehicles}
                  avgCondition={avgCondition}
                  totalOperatingCost={totalOperatingCost}
                  totalTrips={totalTrips}
                  totalFatigueReduction={totalFatigueReduction}
                  onVehicleSelect={setSelectedVehicleId}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Available Transport & Marketplace */}
      {(availableTransport.length > 0 || marketplaceTransport.length > 0) && (
        <div className="space-y-6 mt-6">
          {/* Available Transport */}
          {availableTransport.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-5 w-5 text-[#E94560]" />
                <h3 className="font-bold text-white">Available Transport</h3>
                <span className="text-xs text-slate-500 ml-2">({availableTransport.length} not in use)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableTransport.map((t: any) => (
                  <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="font-bold text-white">{t.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{TIER_LABELS[t.tier] || t.tier}</div>
                    <div className="text-xs text-slate-500 mt-1">{t.operatingCost} CASH/trip • Fatigue -{t.fatigueReduction}</div>
                    <div className="mt-3 flex gap-2">
                      {t.isForSale ? (
                        <button
                          onClick={() => unlistTransport(t.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/10"
                        >
                          <X className="h-3 w-3" /> Unlist
                        </button>
                      ) : (
                        <button
                          onClick={() => setListingTransport(t.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-[#E94560]/30 bg-[#E94560]/10 px-3 py-2 text-xs font-bold text-[#E94560] hover:bg-[#E94560]/20"
                        >
                          <Tag className="h-3 w-3" /> List for Sale
                        </button>
                      )}
                    </div>
                    {t.isForSale && (
                      <div className="mt-2 text-xs text-slate-500">
                        Listed for <span className="font-bold text-[#FFD700]">{t.salePrice?.toLocaleString()} {t.saleCurrency}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transport Listing Modal */}
          {listingTransport && (
            <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-6">
              <h3 className="font-bold text-white mb-4">List Transport for Sale</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Price</label>
                  <input
                    type="number"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    placeholder="e.g., 5000"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 focus:border-[#E94560] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Currency</label>
                  <div className="flex gap-2">
                    {(['CASH', 'DYN', 'SOL'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setListCurrency(c)}
                        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                          listCurrency === c
                            ? 'border-[#E94560] bg-[#E94560]/10 text-white'
                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => listTransportForSale(listingTransport)}
                    disabled={!listPrice || parseInt(listPrice, 10) <= 0}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#E94560] px-4 py-3 font-bold text-white hover:bg-[#E94560]/90 disabled:opacity-50"
                  >
                    <Tag className="h-4 w-4" /> List for Sale
                  </button>
                  <button
                    onClick={() => { setListingTransport(null); setListPrice(''); }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 font-bold text-white hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transport Marketplace */}
          {marketplaceTransport.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-5 w-5 text-[#E94560]" />
                <h3 className="font-bold text-white">Transport Marketplace</h3>
                <span className="text-xs text-slate-500 ml-2">({marketplaceTransport.length} for sale)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {marketplaceTransport.map((t: any) => (
                  <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="font-bold text-white">{t.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{TIER_LABELS[t.tier] || t.tier}</div>
                    <div className="text-xs text-slate-500 mt-1">{t.operatingCost} CASH/trip • Fatigue -{t.fatigueReduction}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`font-bold ${t.saleCurrency === 'DYN' ? 'text-purple-400' : t.saleCurrency === 'SOL' ? 'text-cyan-400' : 'text-[#FFD700]'}`}>
                        {t.salePrice?.toLocaleString()} {t.saleCurrency}
                      </span>
                      <button
                        onClick={() => buyTransportFromMarket(t.id)}
                        disabled={buyingId === t.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#E94560] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#E94560]/90 disabled:opacity-50"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        {buyingId === t.id ? 'Buying...' : 'Buy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VehicleDetailPanel({
  vehicle,
  onUpgrade,
  upgrading,
  message,
  walletCash,
}: {
  vehicle: VehicleAsset;
  onUpgrade: () => void;
  upgrading: boolean;
  message: string;
  walletCash: number;
}) {
  const color = TIER_BG_COLORS[vehicle.tier] || '#94a3b8';
  const isMaxed = vehicle.upgradeCount >= vehicle.maxUpgrade;
  const upgradeCost = Math.floor(vehicle.operatingCost * 2 * (vehicle.upgradeCount + 1));
  const canAfford = walletCash >= upgradeCost;
  const conditionColor = vehicle.condition > 70 ? 'bg-green-500' : vehicle.condition > 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md overflow-hidden">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}25` }}>
            <Bus className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <h3 className="font-bold text-white">{vehicle.name}</h3>
            <p className="text-xs text-slate-500">
              {TIER_LABELS[vehicle.tier] || vehicle.tier} • Lv.{vehicle.upgradeCount}/{vehicle.maxUpgrade}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Condition bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Condition</span>
            <span className={`text-sm font-bold ${vehicle.condition > 70 ? 'text-green-400' : vehicle.condition > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
              {vehicle.condition}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full ${conditionColor} rounded-full transition-all`} style={{ width: `${vehicle.condition}%` }} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center bg-white/5 rounded-xl p-3">
            <div className="text-lg font-bold text-white">{vehicle.capacity}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Capacity</div>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-3">
            <div className="text-lg font-bold text-[#FFD700]">{vehicle.operatingCost.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">CASH / trip</div>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-3">
            <div className="text-lg font-bold text-emerald-400">{vehicle.fatigueReduction}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Fatigue Reduction</div>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-3">
            <div className="text-lg font-bold text-blue-400">{vehicle.speed}x</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Travel Speed</div>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-3">
            <div className="text-lg font-bold text-cyan-400">{vehicle.prestige}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Prestige</div>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-3">
            <div className="text-lg font-bold text-purple-400">{vehicle.tripsTaken}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Trips Taken</div>
          </div>
        </div>

        {/* Upgrade Section */}
        {!isMaxed && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white">Upgrade Cost</span>
              <span className="text-lg font-bold text-[#FFD700]">{upgradeCost.toLocaleString()} CASH</span>
            </div>
            <div className="text-xs text-slate-500 mb-3">
              Upgrade improves condition, fatigue reduction, travel speed, and prestige.
            </div>
            <button
              onClick={onUpgrade}
              disabled={upgrading || !canAfford}
              className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-all ${
                canAfford
                  ? 'bg-[#E94560] text-white hover:bg-[#E94560]/90'
                  : 'bg-white/5 text-slate-500 cursor-not-allowed'
              }`}
            >
              {upgrading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Upgrading...
                </>
              ) : !canAfford ? (
                <>
                  <AlertTriangle className="h-4 w-4" /> Insufficient Funds
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-4 w-4" /> Upgrade Vehicle
                </>
              )}
            </button>
          </div>
        )}

        {isMaxed && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-emerald-400">Max Level Reached</p>
            <p className="text-xs text-slate-500 mt-1">This vehicle is fully upgraded for its tier.</p>
          </div>
        )}

        {/* Upgrade message */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400 text-center font-medium"
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FleetOverviewPanel({
  vehicles,
  avgCondition,
  totalOperatingCost,
  totalTrips,
  totalFatigueReduction,
  onVehicleSelect,
}: {
  vehicles: VehicleAsset[];
  avgCondition: number;
  totalOperatingCost: number;
  totalTrips: number;
  totalFatigueReduction: number;
  onVehicleSelect: (id: string) => void;
}) {
  const tierCounts = vehicles.reduce((acc, v) => {
    acc[v.tier] = (acc[v.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Fleet Summary Card */}
      <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="h-5 w-5 text-[#E94560]" />
          <h3 className="font-bold text-white">Fleet Overview</h3>
        </div>

        <div className="text-center mb-5">
          <div className="text-4xl font-black text-[#FFD700]">{totalOperatingCost.toLocaleString()}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">CASH total operating cost per trip</div>
        </div>

        {/* Fleet stats */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-2">
              <GaugeCircle className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-white">Average Condition</span>
            </div>
            <span className={`text-sm font-bold ${avgCondition > 70 ? 'text-green-400' : avgCondition > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
              {avgCondition}%
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-white">Total Fatigue Reduction</span>
            </div>
            <span className="text-sm font-bold text-emerald-400">+{totalFatigueReduction}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-white">Total Trips Taken</span>
            </div>
            <span className="text-sm font-bold text-blue-400">{totalTrips.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Vehicle Breakdown */}
      <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Vehicle Breakdown</h3>
        <div className="space-y-2">
          {Object.entries(tierCounts).map(([tier, count]) => {
            const color = TIER_BG_COLORS[tier] || '#94a3b8';
            const pct = Math.round((count / vehicles.length) * 100);
            return (
              <div key={tier} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm text-slate-400 flex-1">{TIER_LABELS[tier] || tier}</span>
                <span className="text-sm font-bold text-white">{count}</span>
                <span className="text-xs text-slate-600">({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Condition Summary */}
      <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Overall Fleet Condition</h3>
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${
              avgCondition > 70
                ? 'bg-green-500/10 text-green-400'
                : avgCondition > 40
                ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            {avgCondition}
          </div>
          <div className="flex-1">
            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  avgCondition > 70 ? 'bg-green-500' : avgCondition > 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${avgCondition}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {avgCondition > 70
                ? 'Fleet is in great shape. Player fatigue is well managed.'
                : avgCondition > 40
                ? 'Some vehicles need maintenance soon.'
                : 'Major repairs needed. Player fatigue is increased.'}
            </p>
          </div>
        </div>
      </div>

      {/* All Vehicles List */}
      <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">All Vehicles</h3>
        <div className="space-y-2">
          {vehicles.map((vehicle) => {
            const color = TIER_BG_COLORS[vehicle.tier] || '#94a3b8';
            const conditionText = vehicle.condition > 70 ? 'text-green-400' : vehicle.condition > 40 ? 'text-yellow-400' : 'text-red-400';
            return (
              <div
                key={vehicle.id}
                className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => onVehicleSelect(vehicle.id)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm text-white">{vehicle.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    Lv.{vehicle.upgradeCount}/{vehicle.maxUpgrade}
                  </span>
                  <span className={`text-xs font-bold ${conditionText}`}>{vehicle.condition}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
