import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bus,
  Home,
  Landmark,
  ArrowRight,
  Wrench,
  Plus,
  ArrowUp,
  MapPin,
  Store,
  Tag,
  X,
  HandCoins,
  ShoppingCart,
} from 'lucide-react';

interface Venue {
  id: string;
  name: string;
  tier: string;
  capacity: number;
  ticketPrice: number;
  condition: number;
  prestige: number;
  ownerId: string | null;
  purchasePrice: number | null;
  solPrice: number | null;
  leaseRate: number;
  isForSale?: boolean;
  salePrice?: number | null;
  saleCurrency?: string;
}

interface TransportAsset {
  id: string;
  name: string;
  tier: string;
  operatingCost: number;
  fatigueReduction: number;
  prestige: number;
  ownerId: string | null;
  purchasePrice: number | null;
  solPrice: number | null;
  isForSale?: boolean;
  salePrice?: number | null;
  saleCurrency?: string;
}

interface TeamAsset {
  id: string;
  name: string;
  venue: Venue | null;
  transportationAssets: TransportAsset[];
}

const tierLabels: Record<string, string> = {
  PARK_FIELD: 'Park Field',
  COMMUNITY_FIELD: 'Community Field',
  SMALL_STADIUM: 'Small Stadium',
  REGIONAL_STADIUM: 'Regional Stadium',
  PRO_STADIUM: 'Pro Stadium',
  CARPOOL: 'Carpool',
  USED_BUS: 'Used Bus',
  TEAM_BUS: 'Team Bus',
  LUXURY_COACH: 'Luxury Coach',
  CHARTER_FLIGHT: 'Charter Flight',
  TEAM_AIRCRAFT: 'Team Aircraft',
  CUSTOM_JET: 'Custom Jet',
};

const currencyColors: Record<string, string> = {
  CASH: 'text-[#FFD700]',
  GRID: 'text-purple-400',
  SOL: 'text-cyan-400',
};

export default function AssetsPage() {
  const [teams, setTeams] = useState<TeamAsset[]>([]);
  const [availableVenues, setAvailableVenues] = useState<Venue[]>([]);
  const [forLeaseVenues, setForLeaseVenues] = useState<Venue[]>([]);
  const [marketplaceVenues, setMarketplaceVenues] = useState<Venue[]>([]);
  const [marketplaceTransport, setMarketplaceTransport] = useState<TransportAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingDev, setCreatingDev] = useState(false);
  const [devVenueId, setDevVenueId] = useState<string | null>(null);
  const [devTeamName, setDevTeamName] = useState('');
  const [leasingVenue, setLeasingVenue] = useState<string | null>(null);
  const [listingVenue, setListingVenue] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [listCurrency, setListCurrency] = useState<'CASH' | 'GRID' | 'SOL'>('CASH');
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  async function loadData() {
    const [teamsRes, availRes, leaseRes, venueMarketRes, transMarketRes] = await Promise.all([
      fetch('/api/teams/mine', { headers }),
      fetch('/api/teams/venues/available', { headers }),
      fetch('/api/teams/venues/for-lease', { headers }),
      fetch('/api/teams/venues/marketplace', { headers }),
      fetch('/api/teams/transport/marketplace', { headers }),
    ]);
    const [teamsJson, availJson, leaseJson, venueMarketJson, transMarketJson] = await Promise.all([
      teamsRes.json(),
      availRes.json(),
      leaseRes.json(),
      venueMarketRes.json(),
      transMarketRes.json(),
    ]);
    if (teamsJson.status === 'success') setTeams(teamsJson.data || []);
    if (availJson.status === 'success') setAvailableVenues(availJson.data || []);
    if (leaseJson.status === 'success') setForLeaseVenues(leaseJson.data || []);
    if (venueMarketJson.status === 'success') setMarketplaceVenues(venueMarketJson.data || []);
    if (transMarketJson.status === 'success') setMarketplaceTransport(transMarketJson.data || []);
  }

  useEffect(() => {
    loadData()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function createDevTeam() {
    if (!devVenueId || !devTeamName.trim()) return;
    setCreatingDev(true);
    try {
      const res = await fetch('/api/teams/dev', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: devVenueId, name: devTeamName }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        await loadData();
        setDevVenueId(null);
        setDevTeamName('');
      } else {
        alert(json.message || 'Failed to create dev team');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setCreatingDev(false);
    }
  }

  async function leaseVenue(teamId: string, venueId: string) {
    setLeasingVenue(venueId);
    try {
      const res = await fetch(`/api/teams/${teamId}/venue/lease`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        await loadData();
      } else {
        alert(json.message || 'Lease failed');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setLeasingVenue(null);
    }
  }

  async function listVenueForSale(venueId: string) {
    const price = parseInt(listPrice, 10);
    if (!price || price <= 0) return;
    try {
      const res = await fetch(`/api/teams/venues/${venueId}/list`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, currency: listCurrency }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        await loadData();
        setListingVenue(null);
        setListPrice('');
      } else {
        alert(json.message || 'Listing failed');
      }
    } catch (e) {
      alert('Network error');
    }
  }

  async function unlistVenue(venueId: string) {
    try {
      const res = await fetch(`/api/teams/venues/${venueId}/unlist`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        await loadData();
      } else {
        alert(json.message || 'Unlist failed');
      }
    } catch (e) {
      alert('Network error');
    }
  }

  async function buyVenue(venueId: string) {
    setBuyingId(venueId);
    try {
      const res = await fetch(`/api/teams/venues/${venueId}/buy`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        await loadData();
      } else {
        alert(json.message || 'Purchase failed');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setBuyingId(null);
    }
  }

  async function buyTransport(transportId: string) {
    setBuyingId(transportId);
    try {
      const res = await fetch(`/api/teams/transport/${transportId}/buy`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        await loadData();
      } else {
        alert(json.message || 'Purchase failed');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setBuyingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Team Assets</h1>
        <div className="glass-card p-8 text-center">
          <Landmark className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-black text-white">No teams yet</h2>
          <p className="mt-2 text-sm text-slate-300">Create a team to get your starter stadium and transportation.</p>
          <Link to="/team" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-white hover:bg-accent/90">
            Create team <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Team Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">Stadiums, facilities, and transportation that power your game-day revenue</p>
        </div>
      </div>

      {/* Stadium Marketplace */}
      {marketplaceVenues.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Store className="h-5 w-5 text-[#E94560]" />
            <h3 className="font-bold text-white">Stadium Marketplace</h3>
            <span className="text-xs text-slate-500 ml-2">({marketplaceVenues.length} for sale)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {marketplaceVenues.map((venue) => (
              <div key={venue.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="font-bold text-white">{venue.name}</div>
                <div className="text-xs text-slate-400 mt-1">{tierLabels[venue.tier] || venue.tier}</div>
                <div className="text-xs text-slate-500 mt-1">{venue.capacity.toLocaleString()} capacity • ${venue.ticketPrice}/ticket</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`font-bold ${currencyColors[venue.saleCurrency || 'CASH']}`}>
                    {venue.salePrice?.toLocaleString()} {venue.saleCurrency}
                  </span>
                  <button
                    onClick={() => buyVenue(venue.id)}
                    disabled={buyingId === venue.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#E94560] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#E94560]/90 disabled:opacity-50"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    {buyingId === venue.id ? 'Buying...' : 'Buy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stadiums for Lease */}
      {forLeaseVenues.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <HandCoins className="h-5 w-5 text-[#E94560]" />
            <h3 className="font-bold text-white">Stadiums for Lease</h3>
            <span className="text-xs text-slate-500 ml-2">({forLeaseVenues.length} available)</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Lease a larger stadium from another player. You pay {Math.round((forLeaseVenues[0]?.leaseRate || 0.1) * 100)}% of ticket revenue to the owner.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {forLeaseVenues.map((venue) => (
              <div key={venue.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="font-bold text-white">{venue.name}</div>
                <div className="text-xs text-slate-400 mt-1">{tierLabels[venue.tier] || venue.tier}</div>
                <div className="text-xs text-slate-500 mt-1">{venue.capacity.toLocaleString()} capacity • ${venue.ticketPrice}/ticket</div>
                <div className="mt-3">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => leaseVenue(team.id, venue.id)}
                      disabled={leasingVenue === venue.id}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#E94560]/30 bg-[#E94560]/10 px-3 py-2 text-xs font-bold text-[#E94560] hover:bg-[#E94560]/20 disabled:opacity-50"
                    >
                      <HandCoins className="h-3 w-3" />
                      {leasingVenue === venue.id ? 'Leasing...' : `Lease for ${team.name}`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Venues (your unused stadiums) */}
      {availableVenues.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-[#E94560]" />
            <h3 className="font-bold text-white">Your Available Stadiums</h3>
            <span className="text-xs text-slate-500 ml-2">({availableVenues.length} unused)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableVenues.map((venue) => (
              <div key={venue.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="font-bold text-white">{venue.name}</div>
                <div className="text-xs text-slate-400 mt-1">{tierLabels[venue.tier] || venue.tier}</div>
                <div className="text-xs text-slate-500 mt-1">{venue.capacity.toLocaleString()} capacity • ${venue.ticketPrice}/ticket</div>
                <div className="mt-3 flex gap-2">
                  {venue.isForSale ? (
                    <button
                      onClick={() => unlistVenue(venue.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/10"
                    >
                      <X className="h-3 w-3" /> Unlist
                    </button>
                  ) : (
                    <button
                      onClick={() => setListingVenue(venue.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-[#E94560]/30 bg-[#E94560]/10 px-3 py-2 text-xs font-bold text-[#E94560] hover:bg-[#E94560]/20"
                    >
                      <Tag className="h-3 w-3" /> List for Sale
                    </button>
                  )}
                  {teams.length < 3 && (
                    <button
                      onClick={() => setDevVenueId(venue.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20"
                    >
                      <Plus className="h-3 w-3" /> Dev Team
                    </button>
                  )}
                </div>
                {venue.isForSale && (
                  <div className="mt-2 text-xs text-slate-500">
                    Listed for <span className={`font-bold ${currencyColors[venue.saleCurrency || 'CASH']}`}>{venue.salePrice?.toLocaleString()} {venue.saleCurrency}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listing Modal */}
      {listingVenue && (
        <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-6">
          <h3 className="font-bold text-white mb-4">List Stadium for Sale</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Price</label>
              <input
                type="number"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="e.g., 50000"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 focus:border-[#E94560] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Currency</label>
              <div className="flex gap-2">
                {(['CASH', 'GRID', 'SOL'] as const).map((c) => (
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
                onClick={() => listVenueForSale(listingVenue)}
                disabled={!listPrice || parseInt(listPrice, 10) <= 0}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#E94560] px-4 py-3 font-bold text-white hover:bg-[#E94560]/90 disabled:opacity-50"
              >
                <Tag className="h-4 w-4" /> List for Sale
              </button>
              <button
                onClick={() => { setListingVenue(null); setListPrice(''); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 font-bold text-white hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dev Team Creation Modal */}
      {devVenueId && (
        <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-6">
          <h3 className="font-bold text-white mb-4">Start a Development Team</h3>
          <p className="text-sm text-slate-400 mb-4">Create a new entry-level team in one of your available stadiums. Develop players and sell them on the marketplace.</p>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Select Stadium</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableVenues.map((venue) => (
                  <button
                    key={venue.id}
                    onClick={() => setDevVenueId(venue.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      devVenueId === venue.id
                        ? 'border-[#E94560] bg-[#E94560]/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-bold text-white text-sm">{venue.name}</div>
                    <div className="text-xs text-slate-400">{tierLabels[venue.tier] || venue.tier} • {venue.capacity.toLocaleString()} capacity</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Team Name</label>
              <input
                type="text"
                value={devTeamName}
                onChange={(e) => setDevTeamName(e.target.value)}
                placeholder="e.g., JV Development Squad"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-600 focus:border-[#E94560] focus:outline-none"
                maxLength={50}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={createDevTeam}
                disabled={creatingDev || !devTeamName.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#E94560] px-4 py-3 font-bold text-white hover:bg-[#E94560]/90 disabled:opacity-50"
              >
                {creatingDev ? 'Creating...' : 'Create Dev Team'}
              </button>
              <button
                onClick={() => { setDevVenueId(null); setDevTeamName(''); }}
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
            <Bus className="h-5 w-5 text-[#E94560]" />
            <h3 className="font-bold text-white">Transport Marketplace</h3>
            <span className="text-xs text-slate-500 ml-2">({marketplaceTransport.length} for sale)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {marketplaceTransport.map((t) => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="font-bold text-white">{t.name}</div>
                <div className="text-xs text-slate-400 mt-1">{tierLabels[t.tier] || t.tier}</div>
                <div className="text-xs text-slate-500 mt-1">{t.operatingCost} CASH/trip • Fatigue -{t.fatigueReduction}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`font-bold ${currencyColors[t.saleCurrency || 'CASH']}`}>
                    {t.salePrice?.toLocaleString()} {t.saleCurrency}
                  </span>
                  <button
                    onClick={() => buyTransport(t.id)}
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

      {/* Your Teams */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {teams.map((team) => (
          <div key={team.id} className="space-y-4">
            <h2 className="text-xl font-black text-white">{team.name}</h2>

            {/* Venue Card */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-400/10 rounded-lg flex items-center justify-center">
                  <Home className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">Stadium / Venue</div>
                  <div className="text-xs text-muted-foreground">
                    {team.venue ? tierLabels[team.venue.tier] || team.venue.tier : 'No venue'}
                  </div>
                </div>
                <span className="text-xs bg-emerald-400/20 text-emerald-300 px-2 py-1 rounded-full">Owned</span>
              </div>

              {team.venue ? (
                <div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-muted-foreground">Capacity</div>
                      <div className="text-white font-bold">{team.venue.capacity.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-muted-foreground">Ticket Price</div>
                      <div className="text-white font-bold">${team.venue.ticketPrice}</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-muted-foreground">Condition</div>
                      <div className="text-white font-bold">{team.venue.condition}%</div>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <div className="text-muted-foreground">Prestige</div>
                      <div className="text-white font-bold">{team.venue.prestige}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Link
                      to="/stadium/interior"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#E94560]/30 bg-[#E94560]/10 px-4 py-2.5 font-bold text-[#E94560] hover:bg-[#E94560]/20 transition-colors"
                    >
                      <Wrench className="h-4 w-4" />
                      View Stadium Interior
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-300">No venue assigned to this team.</p>
              )}

              <div className="mt-3 rounded-xl bg-emerald-300/10 border border-emerald-300/20 p-3 text-sm text-emerald-100">
                <ArrowUp className="inline h-4 w-4 mr-1" />
                You own this venue. You receive 100% of game-day ticket revenue plus away team entry fees.
              </div>
            </div>

            {/* Transport Card */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-400/10 rounded-lg flex items-center justify-center">
                  <Bus className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-white">Transportation</div>
                  <div className="text-xs text-muted-foreground">
                    {team.transportationAssets.length > 0
                      ? team.transportationAssets.map((t) => tierLabels[t.tier] || t.tier).join(', ')
                      : 'No transport'}
                  </div>
                </div>
                <span className="text-xs bg-emerald-400/20 text-emerald-300 px-2 py-1 rounded-full">Owned</span>
              </div>

              {team.transportationAssets.length > 0 ? (
                <div className="space-y-3">
                  {team.transportationAssets.map((t) => (
                    <div key={t.id} className="rounded-xl bg-white/5 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">{tierLabels[t.tier] || t.tier}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <span className="text-muted-foreground">Operating cost: <span className="text-white">{t.operatingCost} CASH</span></span>
                        <span className="text-muted-foreground">Fatigue reduction: <span className="text-white">{t.fatigueReduction}</span></span>
                      </div>
                    </div>
                  ))}
                  <Link
                    to="/garage"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#E94560]/30 bg-[#E94560]/10 px-4 py-2.5 font-bold text-[#E94560] hover:bg-[#E94560]/20 transition-colors"
                  >
                    <Wrench className="h-4 w-4" />
                    View Transport Garage
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-slate-300">No transportation assigned to this team.</p>
              )}

              <div className="mt-3 rounded-xl bg-emerald-300/10 border border-emerald-300/20 p-3 text-sm text-emerald-100">
                <ArrowUp className="inline h-4 w-4 mr-1" />
                You own this transportation. Operating costs are standard.
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
