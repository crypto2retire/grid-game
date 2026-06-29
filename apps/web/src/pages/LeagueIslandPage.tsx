import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  Swords, Users, Shield, Lock, Star, Globe,
  Loader2, AlertCircle, Building2
} from 'lucide-react';

interface IslandData {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  size: number;
  color: string;
  theme: string;
  teamCount: number;
  maxTeams: number;
  prestige: number;
  league: {
    id: string;
    name: string;
    tier: string;
    visibility: string;
    minOverall: number;
    maxOverall: number;
    maxTeams: number;
    entryFee: number;
    minTeamRating: number;
    isDefault: boolean;
    creator: { id: string; username: string; displayName: string | null };
    memberships: {
      team: {
        id: string;
        name: string;
        owner: { username: string; displayName: string | null };
        venue: { id: string; name: string; capacity: number; tier: string; condition: number; prestige: number } | null;
        teamPlayers: { player: { overall: number } }[];
      };
    }[];
  };
}

const TIER_LABELS: Record<string, string> = {
  STATE_COLLEGE: 'State College',
  MID_COLLEGE: 'Mid College',
  TOP_COLLEGE: 'Top College',
  REGIONAL_PRO: 'Regional Pro',
  PRO_ENTRY: 'Pro Entry',
  PRO_ELITE: 'Pro Elite',
};

export default function LeagueIslandPage({ islandId }: { islandId: string; leagueId?: string }) {
  const { user } = useAuthStore();
  const [island, setIsland] = useState<IslandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'stadiums'>('overview');

  useEffect(() => {
    fetchIsland();
  }, [islandId]);

  const fetchIsland = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/islands/${islandId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setIsland(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch island:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!island?.league) return;
    setJoining(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leagues/${island.league.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Joined ${island.league.name}!` });
        fetchIsland();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to join' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#E94560]" />
      </div>
    );
  }

  if (!island) {
    return <div className="text-center text-white/50 py-12">Island not found</div>;
  }

  const league = island.league;
  const isFull = island.teamCount >= island.maxTeams;
  const isOwner = league.creator?.id === user?.id;
  const VisibilityIcon = league.visibility === 'PRIVATE' ? Lock : league.visibility === 'RATING_BASED' ? Star : Globe;

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-2">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden" style={{ backgroundColor: island.color + '20' }}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full" style={{ backgroundColor: island.color + '30', color: island.color }}>
                  {TIER_LABELS[league.tier] || league.tier}
                </span>
                <span className="flex items-center gap-1 text-xs text-white/50">
                  <VisibilityIcon className="w-3 h-3" />
                  {league.visibility}
                </span>
              </div>
              <h1 className="text-2xl font-black text-white">{island.name}</h1>
              <p className="text-sm text-white/50 mt-1">
                {island.teamCount} / {island.maxTeams} teams • OVR {league.minOverall}-{league.maxOverall}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black" style={{ color: island.color }}>{island.prestige}</div>
              <div className="text-xs text-white/40">Prestige</div>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 mt-4">
            {!isOwner && !isFull && league.visibility === 'PUBLIC' && (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E94560] text-white font-bold text-sm hover:bg-[#E94560]/90 transition-colors disabled:opacity-50"
              >
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                Join League
              </button>
            )}
            {league.visibility === 'PRIVATE' && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/50 text-sm">
                <Lock className="w-4 h-4" /> Invite-only
              </div>
            )}
            {league.visibility === 'RATING_BASED' && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/50 text-sm">
                <Star className="w-4 h-4" /> Min OVR {league.minTeamRating}
              </div>
            )}
            {isFull && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" /> League Full
              </div>
            )}
            {league.entryFee > 0 && (
              <div className="text-xs text-amber-400">
                Entry fee: {league.entryFee.toLocaleString()} GRID
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {[
          { key: 'overview', label: 'Overview', icon: Shield },
          { key: 'teams', label: 'Teams', icon: Users },
          { key: 'stadiums', label: 'Stadiums', icon: Building2 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-4 rounded-xl">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3">League Stats</div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Tier</span>
                <span className="text-white font-medium">{TIER_LABELS[league.tier] || league.tier}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Teams</span>
                <span className="text-white font-medium">{island.teamCount} / {island.maxTeams}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">OVR Range</span>
                <span className="text-white font-medium">{league.minOverall} - {league.maxOverall}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Entry</span>
                <span className="text-white font-medium">{league.visibility}</span>
              </div>
              {league.entryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Entry Fee</span>
                  <span className="text-amber-400 font-medium">{league.entryFee.toLocaleString()} GRID</span>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3">Founder</div>
            {league.creator ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E94560] to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {(league.creator.displayName || league.creator.username)[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-white font-medium text-sm">
                    {league.creator.displayName || league.creator.username}
                  </div>
                  <div className="text-xs text-white/40">League Creator</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/40">Official Game League</div>
            )}
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="space-y-3">
          {league.memberships.length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm">No teams have joined yet</div>
          )}
          {league.memberships.map((membership) => {
            const team = membership.team;
            const avgOvr = team.teamPlayers.length > 0
              ? Math.round(team.teamPlayers.reduce((s, tp) => s + tp.player.overall, 0) / team.teamPlayers.length)
              : 0;
            return (
              <div key={team.id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-[#E94560]" />
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{team.name}</div>
                    <div className="text-xs text-white/40">
                      {team.owner.displayName || team.owner.username} • {team.teamPlayers.length} players
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-white">{avgOvr}</div>
                  <div className="text-[10px] text-white/30">AVG OVR</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stadiums Tab */}
      {activeTab === 'stadiums' && (
        <div className="space-y-3">
          {league.memberships.length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm">No stadiums built yet</div>
          )}
          {league.memberships
            .filter((m) => m.team.venue)
            .map((membership) => {
              const venue = membership.team.venue!;
              return (
                <div key={venue.id} className="glass-card p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium text-sm">{venue.name}</div>
                      <div className="text-xs text-white/40">{membership.team.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white font-medium">{venue.capacity.toLocaleString()}</div>
                      <div className="text-[10px] text-white/30">Capacity</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
                    <span>Tier: {venue.tier}</span>
                    <span>Condition: {venue.condition}%</span>
                    <span>Prestige: {venue.prestige}</span>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
