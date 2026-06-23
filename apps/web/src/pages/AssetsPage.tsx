import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Home, Landmark, ArrowUp, ArrowRight, ArrowDown, ShoppingCart } from 'lucide-react';

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
}

interface TeamAsset {
  id: string;
  name: string;
  venue: Venue | null;
  transportationAssets: TransportAsset[];
}

const AI_OWNER_ID = 'ai-system-owner-001';

export default function AssetsPage() {
  const [teams, setTeams] = useState<TeamAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/teams/mine', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.status === 'success') {
          setTeams(json.data || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function buyVenue(teamId: string, currency: 'CASH' | 'SOL') {
    const token = localStorage.getItem('token');
    setBuying((prev) => ({ ...prev, [`venue-${teamId}-${currency}`]: true }));
    try {
      const res = await fetch(`/api/teams/${teamId}/venue/buy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        const teamsRes = await fetch('/api/teams/mine', { headers: { Authorization: `Bearer ${token}` } });
        const teamsJson = await teamsRes.json();
        if (teamsJson.status === 'success') setTeams(teamsJson.data || []);
      } else {
        alert(json.message || 'Purchase failed');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setBuying((prev) => ({ ...prev, [`venue-${teamId}-${currency}`]: false }));
    }
  }

  async function buyTransport(teamId: string, currency: 'CASH' | 'SOL') {
    const token = localStorage.getItem('token');
    setBuying((prev) => ({ ...prev, [`transport-${teamId}-${currency}`]: true }));
    try {
      const res = await fetch(`/api/teams/${teamId}/transportation/buy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        const teamsRes = await fetch('/api/teams/mine', { headers: { Authorization: `Bearer ${token}` } });
        const teamsJson = await teamsRes.json();
        if (teamsJson.status === 'success') setTeams(teamsJson.data || []);
      } else {
        alert(json.message || 'Purchase failed');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setBuying((prev) => ({ ...prev, [`transport-${teamId}-${currency}`]: false }));
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
          <p className="mt-2 text-sm text-slate-300">
            Create a team to get your starter stadium and transportation.
          </p>
          <Link to="/team" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-white hover:bg-accent/90">
            Create team <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Team Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stadiums, facilities, and transportation that power your game-day revenue
          </p>
        </div>
      </div>

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
                {team.venue && team.venue.ownerId !== AI_OWNER_ID && (
                  <span className="text-xs bg-emerald-400/20 text-emerald-300 px-2 py-1 rounded-full">Owned</span>
                )}
                {team.venue && team.venue.ownerId === AI_OWNER_ID && (
                  <span className="text-xs bg-amber-400/20 text-amber-300 px-2 py-1 rounded-full">Leased</span>
                )}
              </div>

              {team.venue ? (
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
              ) : (
                <p className="text-sm text-slate-300">No venue assigned to this team.</p>
              )}

              {team.venue && team.venue.ownerId === AI_OWNER_ID && team.venue.purchasePrice && (
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => buyVenue(team.id, 'CASH')}
                    disabled={buying[`venue-${team.id}-CASH`]}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {buying[`venue-${team.id}-CASH`] ? 'Processing...' : `Buy for ${team.venue.purchasePrice.toLocaleString()} CASH`}
                  </button>
                  {team.venue.solPrice && (
                    <button
                      onClick={() => buyVenue(team.id, 'SOL')}
                      disabled={buying[`venue-${team.id}-SOL`]}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500/80 px-4 py-2.5 font-bold text-white hover:bg-purple-600 disabled:opacity-50"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {buying[`venue-${team.id}-SOL`] ? 'Processing...' : `Buy for ${team.venue.solPrice} SOL (Save ${Math.round((1 - (team.venue.solPrice * 10000 / team.venue.purchasePrice)) * 100)}%)`}
                    </button>
                  )}
                </div>
              )}

              {team.venue && team.venue.ownerId === AI_OWNER_ID && (
                <div className="mt-3 rounded-xl bg-amber-300/10 border border-amber-300/20 p-3 text-sm text-amber-100">
                  <ArrowUp className="inline h-4 w-4 mr-1" />
                  Leased: {Math.round(team.venue.leaseRate * 100)}% of ticket revenue goes to the venue owner on game days.
                </div>
              )}

              {team.venue && team.venue.ownerId !== AI_OWNER_ID && (
                <div className="mt-3 rounded-xl bg-emerald-300/10 border border-emerald-300/20 p-3 text-sm text-emerald-100">
                  <ArrowUp className="inline h-4 w-4 mr-1" />
                  You own this venue. You receive 100% of game-day revenue.
                </div>
              )}
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
                {team.transportationAssets[0] && team.transportationAssets[0].ownerId !== AI_OWNER_ID && (
                  <span className="text-xs bg-emerald-400/20 text-emerald-300 px-2 py-1 rounded-full">Owned</span>
                )}
                {team.transportationAssets[0] && team.transportationAssets[0].ownerId === AI_OWNER_ID && (
                  <span className="text-xs bg-amber-400/20 text-amber-300 px-2 py-1 rounded-full">Leased</span>
                )}
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
                </div>
              ) : (
                <p className="text-sm text-slate-300">No transportation assigned to this team.</p>
              )}

              {team.transportationAssets[0] && team.transportationAssets[0].ownerId === AI_OWNER_ID && team.transportationAssets[0].purchasePrice && (
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => buyTransport(team.id, 'CASH')}
                    disabled={buying[`transport-${team.id}-CASH`]}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {buying[`transport-${team.id}-CASH`] ? 'Processing...' : `Buy for ${team.transportationAssets[0].purchasePrice.toLocaleString()} CASH`}
                  </button>
                  {team.transportationAssets[0].solPrice && (
                    <button
                      onClick={() => buyTransport(team.id, 'SOL')}
                      disabled={buying[`transport-${team.id}-SOL`]}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500/80 px-4 py-2.5 font-bold text-white hover:bg-purple-600 disabled:opacity-50"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {buying[`transport-${team.id}-SOL`] ? 'Processing...' : `Buy for ${team.transportationAssets[0].solPrice} SOL (Save ${Math.round((1 - (team.transportationAssets[0].solPrice * 10000 / team.transportationAssets[0].purchasePrice)) * 100)}%)`}
                    </button>
                  )}
                </div>
              )}

              {team.transportationAssets[0] && team.transportationAssets[0].ownerId === AI_OWNER_ID && (
                <div className="mt-3 rounded-xl bg-amber-300/10 border border-amber-300/20 p-3 text-sm text-amber-100">
                  <ArrowDown className="inline h-4 w-4 mr-1" />
                  Leased: operating costs go to the owner. Buy to reduce costs by 50%.
                </div>
              )}

              {team.transportationAssets[0] && team.transportationAssets[0].ownerId !== AI_OWNER_ID && (
                <div className="mt-3 rounded-xl bg-emerald-300/10 border border-emerald-300/20 p-3 text-sm text-emerald-100">
                  <ArrowDown className="inline h-4 w-4 mr-1" />
                  You own this transportation. Operating costs reduced by 50%.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
