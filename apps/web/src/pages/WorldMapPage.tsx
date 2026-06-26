import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Map as MapIcon,
  Home,
  Bus,
  Clock,
  CalendarDays,
  Swords,
  Loader2,
  Info,
  ChevronRight,
} from 'lucide-react';
import GameMap, { type CityNode, type TravelRoute, type BusTravelState } from '../components/map/GameMap';

// The GRID League world — 6 cities in a fictional sports universe
const LEAGUE_CITIES: CityNode[] = [
  { id: 'grid-city', name: 'Grid City', x: 400, y: 240, region: 'Central', stadium: { name: 'The Gridiron', tier: 'PRO_STADIUM', capacity: 65000, prestige: 65, isLeased: false } },
  { id: 'iron-harbor', name: 'Iron Harbor', x: 200, y: 140, region: 'North', stadium: { name: 'Steel Yard', tier: 'REGIONAL_STADIUM', capacity: 35000, prestige: 50, isLeased: true } },
  { id: 'red-rock', name: 'Red Rock', x: 600, y: 160, region: 'East', stadium: { name: 'Canyon Arena', tier: 'SMALL_STADIUM', capacity: 25000, prestige: 40, isLeased: true } },
  { id: 'bay-port', name: 'Bay Port', x: 150, y: 380, region: 'South', stadium: { name: 'Harbor Field', tier: 'COMMUNITY_FIELD', capacity: 8000, prestige: 25, isLeased: true } },
  { id: 'gold-valley', name: 'Gold Valley', x: 650, y: 370, region: 'West', stadium: { name: 'Millionaire Park', tier: 'ELITE', capacity: 100000, prestige: 85, isLeased: true } },
  { id: 'pine-ridge', name: 'Pine Ridge', x: 400, y: 80, region: 'North', stadium: { name: 'Timber Bowl', tier: 'PARK_FIELD', capacity: 5000, prestige: 10, isLeased: true } },
];

const TRAVEL_ROUTES: TravelRoute[] = [
  { from: 'grid-city', to: 'iron-harbor', distance: 3 },
  { from: 'grid-city', to: 'red-rock', distance: 2 },
  { from: 'grid-city', to: 'bay-port', distance: 4 },
  { from: 'grid-city', to: 'gold-valley', distance: 5 },
  { from: 'grid-city', to: 'pine-ridge', distance: 2 },
  { from: 'iron-harbor', to: 'pine-ridge', distance: 2 },
  { from: 'iron-harbor', to: 'bay-port', distance: 5 },
  { from: 'red-rock', to: 'gold-valley', distance: 3 },
  { from: 'red-rock', to: 'pine-ridge', distance: 4 },
  { from: 'bay-port', to: 'gold-valley', distance: 6 },
];

const TIER_LABELS: Record<string, string> = {
  PARK_FIELD: 'Park Field',
  COMMUNITY_FIELD: 'Community Field',
  SMALL_STADIUM: 'Small Stadium',
  REGIONAL_STADIUM: 'Regional Stadium',
  PRO_STADIUM: 'Pro Stadium',
  ELITE: 'Elite Stadium',
};

const TIER_COLORS: Record<string, string> = {
  PARK_FIELD: 'text-gray-400',
  COMMUNITY_FIELD: 'text-emerald-400',
  SMALL_STADIUM: 'text-blue-400',
  REGIONAL_STADIUM: 'text-purple-400',
  PRO_STADIUM: 'text-rose-400',
  ELITE: 'text-yellow-400',
};

interface TeamData {
  id: string;
  name: string;
  venue: {
    id: string;
    name: string;
    tier: string;
    capacity: number;
    ticketPrice: number;
    condition: number;
    prestige: number;
  } | null;
  transportationAssets: { id: string; tier: string; name: string }[];
  wins: number;
  losses: number;
  draws: number;
  points: number;
  teamPlayers: { player: { name: string; position: string; overall: number } }[];
}

interface UpcomingMatch {
  id: string;
  homeTeam: { name: string; id: string };
  awayTeam: { name: string; id: string };
  scheduledAt: string;
  isHome: boolean;
}

export default function WorldMapPage() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [busTravel, setBusTravel] = useState<BusTravelState | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

  const homeCityId = 'grid-city'; // Default home city — could be dynamic per team

  // Build cities with actual team data overlaid
  const cities = useMemo(() => {
    return LEAGUE_CITIES.map((city) => {
      const teamWithVenue = teams.find((t) => t.venue && city.id === homeCityId);
      if (teamWithVenue && teamWithVenue.venue) {
        return {
          ...city,
          stadium: {
            name: teamWithVenue.venue.name,
            tier: teamWithVenue.venue.tier,
            capacity: teamWithVenue.venue.capacity,
            ownerName: teamWithVenue.name,
            isLeased: false,
          },
        };
      }
      return city;
    });
  }, [teams]);

  // Load data
  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    Promise.allSettled([
      fetch('/api/teams/mine', { headers }),
      fetch('/api/matches?status=SCHEDULED&limit=3', { headers }),
    ])
      .then(async ([teamsRes, matchesRes]) => {
        let teamsData: TeamData[] = [];
        let matchesData: UpcomingMatch[] = [];

        if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
          const json = await teamsRes.value.json();
          teamsData = json.data || [];
          setTeams(teamsData);
          if (teamsData.length > 0) {
            setActiveTeamId(teamsData[0].id);
          }
        }

        if (matchesRes.status === 'fulfilled' && matchesRes.value.ok) {
          const json = await matchesRes.value.json();
          const matches = (json.data?.matches || []) as any[];
          matchesData = matches.map((m) => ({
            id: m.id,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            scheduledAt: m.scheduledAt,
            isHome: m.homeTeam?.id === teamsData[0]?.id,
          }));
          setUpcomingMatches(matchesData);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Simulate bus travel for upcoming away games
  useEffect(() => {
    const awayMatch = upcomingMatches.find((m) => !m.isHome);
    if (!awayMatch) {
      setBusTravel(null);
      return;
    }

    // Pick a random destination city for demo (other than home)
    const destCities = LEAGUE_CITIES.filter((c) => c.id !== homeCityId);
    const destCity = destCities[Math.floor(Math.random() * destCities.length)];
    const transport = teams[0]?.transportationAssets[0]?.tier || 'TEAM_BUS';

    setBusTravel({
      fromCityId: homeCityId,
      toCityId: destCity.id,
      progress: 0,
      transportTier: transport,
    });

    const interval = setInterval(() => {
      setBusTravel((prev) => {
        if (!prev) return null;
        const next = prev.progress + 0.008;
        if (next >= 1) {
          return { ...prev, progress: 1 };
        }
        return { ...prev, progress: next };
      });
    }, 50);

    return () => clearInterval(interval);
  }, [upcomingMatches, teams]);

  const selectedCity = cities.find((c) => c.id === selectedCityId);
  const activeTeam = teams.find((t) => t.id === activeTeamId);

  const stats = useMemo(() => {
    if (!activeTeam) return null;
    return {
      teamOvr: activeTeam.teamPlayers?.length
        ? Math.round(activeTeam.teamPlayers.reduce((s, p) => s + p.player.overall, 0) / activeTeam.teamPlayers.length)
        : 0,
      record: `${activeTeam.wins}-${activeTeam.losses}-${activeTeam.draws}`,
      players: activeTeam.teamPlayers?.length || 0,
      points: activeTeam.points,
    };
  }, [activeTeam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#E94560] mx-auto" />
          <p className="text-sm text-slate-400">Loading the GRID world...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100 mb-3">
            <MapIcon className="h-3.5 w-3.5" /> GRID World
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">League Map</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-xl">
            Explore the GRID League. Your stadium is your home base. Travel to away games, scout opponent venues, and upgrade your facilities to dominate the league.
          </p>
        </div>
        {activeTeam && (
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Team</div>
              <div className="text-lg font-bold text-white">{activeTeam.name}</div>
            </div>
            {stats && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-500 uppercase tracking-wider">OVR</div>
                <div className="text-lg font-bold text-[#E94560]">{stats.teamOvr}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* Map */}
        <div className="rounded-3xl border border-white/10 bg-black/30 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Info className="h-4 w-4" />
              <span>Click any stadium to view details</span>
            </div>
            {busTravel && busTravel.progress < 1 && (
              <div className="flex items-center gap-2 text-xs text-orange-300">
                <Bus className="h-3.5 w-3.5 animate-bounce" />
                Team bus en route to {LEAGUE_CITIES.find((c) => c.id === busTravel.toCityId)?.name}
              </div>
            )}
          </div>
          <GameMap
            cities={cities}
            routes={TRAVEL_ROUTES}
            homeCityId={homeCityId}
            busTravel={busTravel}
            selectedCityId={selectedCityId}
            onCityClick={setSelectedCityId}
          />
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedCity ? (
              <motion.div
                key={selectedCity.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <CityDetailPanel
                  city={selectedCity}
                  isHome={selectedCity.id === homeCityId}
                  activeTeam={activeTeam}
                  onClose={() => setSelectedCityId(null)}
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
                <OverviewPanel
                  upcomingMatches={upcomingMatches}
                  stats={stats}
                  onCityClick={setSelectedCityId}
                  homeCityId={homeCityId}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function CityDetailPanel({
  city,
  isHome,
  activeTeam,
  onClose,
}: {
  city: CityNode;
  isHome: boolean;
  activeTeam?: TeamData | null;
  onClose: () => void;
}) {
  const stadium = city.stadium;
  const isOwned = isHome && activeTeam?.venue;

  return (
    <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md overflow-hidden">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{city.region}</div>
            <h3 className="text-xl font-black text-white">{city.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Stadium Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-[#E94560]/20 to-purple-600/20 rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5 text-[#E94560]" />
            </div>
            <div>
              <div className="font-bold text-white">{stadium?.name || 'No Stadium'}</div>
              <div className={`text-xs font-medium ${TIER_COLORS[stadium?.tier || ''] || 'text-slate-400'}`}>
                {TIER_LABELS[stadium?.tier || ''] || 'Unknown'}
              </div>
            </div>
          </div>

          {stadium && (
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center bg-black/20 rounded-xl p-3">
                <div className="text-lg font-bold text-white">{stadium.capacity.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Capacity</div>
              </div>
              <div className="text-center bg-black/20 rounded-xl p-3">
                <div className="text-lg font-bold text-[#FFD700]">
                  {isOwned ? 'Owned' : stadium.isLeased ? 'Leased' : 'Available'}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Status</div>
              </div>
              <div className="text-center bg-black/20 rounded-xl p-3">
                <div className="text-lg font-bold text-white">{stadium.prestige || '—'}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Prestige</div>
              </div>
              <div className="text-center bg-black/20 rounded-xl p-3">
                <div className="text-lg font-bold text-white">
                  {isOwned ? '100%' : stadium.isLeased ? '85%' : '—'}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Revenue Keep</div>
              </div>
            </div>
          )}

          {!stadium && (
            <div className="text-center py-4">
              <p className="text-sm text-slate-400">No stadium in this city yet.</p>
            </div>
          )}
        </div>

        {/* Travel Info */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bus className="h-4 w-4 text-orange-400" />
            <h4 className="font-bold text-white text-sm">Travel from Grid City</h4>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Distance</span>
            <span className="text-white font-medium">
              {TRAVEL_ROUTES.find((r) => (r.from === 'grid-city' && r.to === city.id) || (r.from === city.id && r.to === 'grid-city'))?.distance || '—'}h
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-400">Fatigue impact</span>
            <span className="text-orange-300 font-medium">
              {isHome ? 'None (home game)' : 'Moderate'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {isHome && activeTeam?.venue && (
            <Link
              to="/stadium/interior"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#E94560] px-4 py-3 font-bold text-white hover:bg-[#E94560]/90 transition-colors"
            >
              <Home className="h-4 w-4" />
              Manage Stadium
            </Link>
          )}
          {!isHome && (
            <Link
              to="/matches"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white hover:bg-white/10 transition-colors"
            >
              <Swords className="h-4 w-4" />
              Schedule Away Game
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewPanel({
  upcomingMatches,
  stats,
  onCityClick,
  homeCityId,
}: {
  upcomingMatches: UpcomingMatch[];
  stats: { teamOvr: number; record: string; players: number; points: number } | null;
  onCityClick: (id: string) => void;
  homeCityId: string;
}) {
  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      {stats && (
        <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Team Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-black text-[#E94560]">{stats.teamOvr}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">OVR</div>
            </div>
            <div className="text-center bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-black text-white">{stats.record}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Record</div>
            </div>
            <div className="text-center bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-black text-[#FFD700]">{stats.points}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Points</div>
            </div>
            <div className="text-center bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-black text-white">{stats.players}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Players</div>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Matches */}
      <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Upcoming Games
        </h3>
        {upcomingMatches.length === 0 ? (
          <div className="text-center py-6">
            <Swords className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No upcoming games</p>
            <Link to="/matches" className="text-sm text-[#E94560] hover:underline mt-1 inline-block">
              Schedule a match
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingMatches.map((match) => (
              <div
                key={match.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {match.isHome ? 'vs ' : '@ '}
                    {match.isHome ? match.awayTeam.name : match.homeTeam.name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(match.scheduledAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    match.isHome
                      ? 'bg-emerald-400/10 text-emerald-400'
                      : 'bg-orange-400/10 text-orange-400'
                  }`}
                >
                  {match.isHome ? 'Home' : 'Away'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* League Cities Quick List */}
      <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <MapIcon className="h-4 w-4" />
          League Cities
        </h3>
        <div className="space-y-2">
          {LEAGUE_CITIES.map((city) => (
            <button
              key={city.id}
              onClick={() => onCityClick(city.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left"
            >
              <div className={`w-2 h-2 rounded-full ${city.id === homeCityId ? 'bg-[#E94560]' : 'bg-slate-600'}`} />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{city.name}</div>
                <div className="text-xs text-slate-500">{TIER_LABELS[city.stadium?.tier || ''] || 'No stadium'}</div>
              </div>
              {city.id === homeCityId && (
                <span className="text-[10px] bg-[#E94560]/20 text-[#E94560] px-2 py-0.5 rounded-full font-bold">
                  HOME
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
