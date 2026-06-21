import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Handshake, Trash2, RefreshCw, CheckCircle, TrendingUp } from 'lucide-react';

interface Sponsorship {
  id: string;
  sponsorName: string;
  amountPerGame: number;
  amountPerSeason: number;
  active: boolean;
  createdAt: string;
  bonusRules: Record<string, any>;
}

interface SponsorshipOffer {
  sponsorName: string;
  tier: string;
  amountPerGame: number;
  amountPerSeason: number;
  bonusRules: Record<string, any>;
  expiresAt: string;
}

interface Team {
  id: string;
  name: string;
}

export default function SponsorshipsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [offers, setOffers] = useState<SponsorshipOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchApi('/teams/mine')
      .then((res) => {
        const data = res.data || [];
        setTeams(data);
        if (data.length > 0) {
          setSelectedTeam(data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    loadSponsorships();
  }, [selectedTeam]);

  const loadSponsorships = () => {
    setLoading(true);
    fetchApi(`/teams/${selectedTeam}/sponsorships`)
      .then((res) => {
        setSponsorships(res.data || []);
        setOffers([]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const refreshOffers = () => {
    if (!selectedTeam) return;
    setRefreshing(true);
    fetchApi(`/teams/${selectedTeam}/sponsorships/refresh`, { method: 'POST' })
      .then((res) => {
        const data = res.data || {};
        setOffers(data.offers || []);
      })
      .catch(console.error)
      .finally(() => setRefreshing(false));
  };

  const acceptOffer = (offer: SponsorshipOffer) => {
    if (!selectedTeam) return;
    fetchApi(`/teams/${selectedTeam}/sponsorships`, {
      method: 'POST',
      body: JSON.stringify(offer),
    })
      .then(() => {
        loadSponsorships();
      })
      .catch(console.error);
  };

  const cancelSponsorship = (id: string) => {
    if (!selectedTeam) return;
    fetchApi(`/teams/${selectedTeam}/sponsorships/${id}`, {
      method: 'DELETE',
    })
      .then(() => {
        loadSponsorships();
      })
      .catch(console.error);
  };

  const tierColors: Record<string, string> = {
    LOCAL_BUSINESS: 'text-emerald-400',
    REGIONAL_BRAND: 'text-cyan-400',
    NATIONAL_BRAND: 'text-amber-400',
    GLOBAL_CORP: 'text-rose-400',
  };

  const tierLabels: Record<string, string> = {
    LOCAL_BUSINESS: 'Local Business',
    REGIONAL_BRAND: 'Regional Brand',
    NATIONAL_BRAND: 'National Brand',
    GLOBAL_CORP: 'Global Corporation',
  };

  if (loading && teams.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Sponsorships</h1>
        <div className="glass-card p-8 text-center">
          <Handshake className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-black text-white">No teams yet</h2>
          <p className="mt-2 text-sm text-slate-300">
            Create a team to attract sponsors and generate revenue.
          </p>
        </div>
      </div>
    );
  }

  const activeSponsors = sponsorships.filter((s) => s.active);
  const slots = 3 - activeSponsors.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Sponsorships</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Attract sponsors to boost your game-day and season revenue
          </p>
        </div>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Active Sponsors */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-400/10 rounded-lg flex items-center justify-center">
              <Handshake className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-bold text-white">Active Sponsors</div>
              <div className="text-xs text-muted-foreground">
                {activeSponsors.length} / 3 slots filled
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refreshOffers}
              disabled={refreshing || slots <= 0}
              className="flex items-center gap-2 rounded-xl bg-accent/10 border border-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Find Offers
            </button>
          </div>
        </div>

        {activeSponsors.length === 0 ? (
          <p className="text-sm text-slate-300 py-4">
            No active sponsors. Click "Find Offers" to discover potential sponsors.
          </p>
        ) : (
          <div className="space-y-3">
            {activeSponsors.map((s) => (
              <div key={s.id} className="rounded-xl bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{s.sponsorName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.amountPerGame.toLocaleString()} CASH/game +{' '}
                      {s.amountPerSeason.toLocaleString()} CASH/season
                    </div>
                  </div>
                  <button
                    onClick={() => cancelSponsorship(s.id)}
                    className="p-2 rounded-lg hover:bg-white/10 text-red-400"
                    title="Cancel sponsorship"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {s.bonusRules && Object.keys(s.bonusRules).length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {Object.entries(s.bonusRules).map(([key, val]) => (
                      <span
                        key={key}
                        className="text-xs bg-white/5 rounded-lg px-2 py-1 text-muted-foreground"
                      >
                        {key}: +{Number(val).toLocaleString()} CASH
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Offers */}
      {offers.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-400/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-white">New Offers</div>
              <div className="text-xs text-muted-foreground">
                {offers.length} offer{offers.length !== 1 ? 's' : ''} available
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {offers.map((offer, idx) => (
              <div key={idx} className="rounded-xl bg-white/5 p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{offer.sponsorName}</div>
                    <div className={`text-xs font-medium ${tierColors[offer.tier] || 'text-white'}`}>
                      {tierLabels[offer.tier] || offer.tier}
                    </div>
                  </div>
                  <button
                    onClick={() => acceptOffer(offer)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Accept
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-white/5 p-2">
                    <div className="text-xs text-muted-foreground">Per Game</div>
                    <div className="text-white font-bold">{offer.amountPerGame.toLocaleString()} CASH</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <div className="text-xs text-muted-foreground">Per Season</div>
                    <div className="text-white font-bold">{offer.amountPerSeason.toLocaleString()} CASH</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <div className="text-xs text-muted-foreground">Expires</div>
                    <div className="text-white font-bold">
                      {new Date(offer.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {offer.bonusRules && Object.keys(offer.bonusRules).length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {Object.entries(offer.bonusRules).map(([key, val]) => (
                      <span
                        key={key}
                        className="text-xs bg-white/5 rounded-lg px-2 py-1 text-muted-foreground"
                      >
                        {key}: +{Number(val).toLocaleString()} CASH
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
