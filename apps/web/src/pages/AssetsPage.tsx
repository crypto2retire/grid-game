import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Home, Landmark, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

interface Venue {
  id: string;
  name: string;
  tier: string;
  capacity: number;
  ticketPrice: number;
  condition: number;
  prestige: number;
}

interface TransportAsset {
  id: string;
  name: string;
  tier: string;
  operatingCost: number;
  fatigueReduction: number;
  prestige: number;
}

interface TeamAsset {
  id: string;
  name: string;
  venue: Venue | null;
  transportationAssets: TransportAsset[];
}

export default function AssetsPage() {
  const [teams, setTeams] = useState<TeamAsset[]>([]);
  const [loading, setLoading] = useState(true);

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
                <div>
                  <div className="font-bold text-white">Stadium / Venue</div>
                  <div className="text-xs text-muted-foreground">
                    {team.venue ? tierLabels[team.venue.tier] || team.venue.tier : 'No venue'}
                  </div>
                </div>
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

              <div className="mt-4 rounded-xl bg-cyan-300/10 border border-cyan-300/20 p-3 text-sm text-cyan-100">
                <ArrowUp className="inline h-4 w-4 mr-1" />
                Home games generate ticket revenue based on capacity, ticket price, and team form.
              </div>
            </div>

            {/* Transport Card */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-400/10 rounded-lg flex items-center justify-center">
                  <Bus className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="font-bold text-white">Transportation</div>
                  <div className="text-xs text-muted-foreground">
                    {team.transportationAssets.length > 0
                      ? team.transportationAssets.map((t) => tierLabels[t.tier] || t.tier).join(', ')
                      : 'No transport'}
                  </div>
                </div>
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

              <div className="mt-4 rounded-xl bg-amber-300/10 border border-amber-300/20 p-3 text-sm text-amber-100">
                <ArrowDown className="inline h-4 w-4 mr-1" />
                Away games cost more in travel. Better transport reduces fatigue but increases operating costs.
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
