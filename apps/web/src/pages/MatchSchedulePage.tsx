import { useState, useEffect } from 'react';
import { useMatchSchedule, type AIOpponent, type VehicleType, type ScheduledMatch } from '../components/match/MatchScheduleSystem';
import { useTravel } from '../components/travel/TravelSystem';
import { useGamePlan } from '../components/gameplan/GamePlanSystem';
import MatchReplay from '../components/match/MatchReplay';
import { fetchApi } from '../lib/api';
import {
  Calendar, MapPin, Bus, Plane, Car, TrendingUp, Users, Trophy, Clock, X, Shield, Swords, CircleDollarSign, Activity, CheckCircle, Target, Play, ChevronLeft,
} from 'lucide-react';

const VEHICLE_INFO: Record<VehicleType, { icon: any; name: string; speed: number; color: string }> = {
  van: { icon: Car, name: 'Team Van', speed: 80, color: '#94a3b8' },
  bus: { icon: Bus, name: 'Tour Bus', speed: 90, color: '#3b82f6' },
  coach: { icon: Bus, name: 'Luxury Coach', speed: 100, color: '#a855f7' },
  jet: { icon: Plane, name: 'Private Jet', speed: 800, color: '#fbbf24' },
};

interface Team {
  id: string;
  name: string;
}

export default function MatchSchedulePage() {
  const { availableOpponents, scheduledMatches, scheduleMatch, cancelMatch, refreshOpponents, getUpcomingMatches, getMatchHistory, getActiveMatch } = useMatchSchedule();
  const { scheduleTrip } = useTravel();
  const { activeFormation } = useGamePlan();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedOpponent, setSelectedOpponent] = useState<AIOpponent | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('bus');
  const [isHome, setIsHome] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [tab, setTab] = useState<'schedule' | 'upcoming' | 'history'>('schedule');
  const [message, setMessage] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState(getActiveMatch());
  const [loading, setLoading] = useState(true);
  const [viewingReplay, setViewingReplay] = useState<ScheduledMatch | null>(null);

  useEffect(() => {
    fetchApi('/teams/mine').then((r) => {
      const teamsData = r.data || [];
      setTeams(teamsData);
      if (teamsData.length > 0) {
        setSelectedTeam(teamsData[0].id);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Load opponents when team changes
  useEffect(() => {
    if (selectedTeam) {
      refreshOpponents(selectedTeam);
    }
  }, [selectedTeam, refreshOpponents]);

  // Update active match from context
  useEffect(() => {
    const match = getActiveMatch();
    setActiveMatch(match);
  }, [scheduledMatches, getActiveMatch]);

  const handleSchedule = async () => {
    if (!selectedOpponent || !selectedTeam) return;
    setScheduling(true);
    setMessage(null);

    const match = await scheduleMatch(selectedOpponent, isHome, selectedVehicle, selectedTeam, activeFormation?.id, activeFormation?.name);
    if (match) {
      setMessage(`Match scheduled! Traveling to ${selectedOpponent.venueName} via ${VEHICLE_INFO[selectedVehicle].name}.`);
      scheduleTrip('stadium', 'stadium', selectedVehicle, match.travelDurationMs, match.id);
      setSelectedOpponent(null);
    } else {
      setMessage('Failed to schedule match');
    }
    setScheduling(false);
  };

  const upcoming = getUpcomingMatches();
  const history = getMatchHistory();
  const travelTime = selectedOpponent
    ? Math.ceil((selectedOpponent.distanceKm / VEHICLE_INFO[selectedVehicle].speed) * 60)
    : 0;
  const estimatedRevenue = selectedOpponent
    ? Math.floor((isHome ? 5000 : selectedOpponent.venueCapacity) * (isHome ? 15 : selectedOpponent.venueTicketPrice) * 0.75)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Match Office</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule matches, manage travel, and track revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-white/5 rounded-xl text-sm text-white/60">
            <Swords className="w-4 h-4 inline mr-1 text-[#E94560]" />
            {upcoming.length} upcoming
          </div>
          <div className="px-3 py-1.5 bg-white/5 rounded-xl text-sm text-white/60">
            <Trophy className="w-4 h-4 inline mr-1 text-amber-400" />
            {history.length} played
          </div>
          {activeFormation && (
            <div className="px-3 py-1.5 bg-white/5 rounded-xl text-sm text-white/60 flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span>{activeFormation.name}</span>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className={`rounded-xl p-4 text-sm ${message.includes('scheduled') ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-200' : 'bg-red-400/10 border border-red-400/20 text-red-200'}`}>
          {message}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E94560]" />
        </div>
      )}

      {/* Team Selector */}
      {!loading && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/60 font-medium">Your Team:</span>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm flex-1"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Active Match Banner */}
      {activeMatch && (
        <div className="glass-card p-5 border-amber-400/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-400/10 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <div className="font-bold text-white">Live Match</div>
                <div className="text-sm text-white/50">
                  {activeMatch.homeTeamName} vs {activeMatch.awayTeamName}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-white">
                {activeMatch.homeScore} - {activeMatch.awayScore}
              </div>
              <div className="text-xs text-amber-400">{activeMatch.phase}</div>
            </div>
          </div>
          <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#E94560] to-amber-400 transition-all duration-1000 rounded-full"
              style={{ width: `${activeMatch.progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/40">
            <span>{Math.round(activeMatch.progress)}% complete</span>
            <span>{activeMatch.crowdAttendance.toLocaleString()} in attendance</span>
            <span className="text-emerald-400">+{activeMatch.revenueGenerated.toLocaleString()} CASH</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-1">
        {[
          { id: 'schedule' as const, label: 'Schedule Match', icon: Calendar },
          { id: 'upcoming' as const, label: 'Upcoming', icon: Clock },
          { id: 'history' as const, label: 'History', icon: Trophy },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
              tab === t.id
                ? 'text-[#E94560] border-b-2 border-[#E94560]'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Schedule Tab */}
      {tab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Opponent List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Available Opponents</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">Home/Away:</span>
                <button
                  onClick={() => setIsHome(!isHome)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    isHome ? 'bg-[#E94560] text-white' : 'bg-white/10 text-white/60'
                  }`}
                >
                  {isHome ? 'HOME' : 'AWAY'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableOpponents.map((opp) => (
                <div
                  key={opp.id}
                  onClick={() => setSelectedOpponent(selectedOpponent?.id === opp.id ? null : opp)}
                  className={`glass-card p-4 cursor-pointer transition-all ${
                    selectedOpponent?.id === opp.id ? 'border-[#E94560] ring-1 ring-[#E94560]/50' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-bold text-white">{opp.name}</div>
                      <div className="text-xs text-white/40 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {opp.homeCity} • {opp.distanceKm}km away
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#E94560]">OVR {opp.teamOverall}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/50">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {opp.venueCapacity.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <CircleDollarSign className="w-3 h-3" />
                      {opp.venueTicketPrice} CASH
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {opp.record.wins}-{opp.record.losses}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Panel */}
          <div className="space-y-4">
            <div className="glass-card p-5 sticky top-4">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Match Details</h3>
              
              {selectedOpponent ? (
                <div className="space-y-4">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <div className="font-bold text-white">{selectedOpponent.name}</div>
                    <div className="text-xs text-white/40">{selectedOpponent.venueName}</div>
                  </div>

                  {/* Vehicle Selection */}
                  <div>
                    <div className="text-xs text-white/40 mb-2">Select Vehicle</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.entries(VEHICLE_INFO) as [VehicleType, any][]).map(([type, info]) => {
                        const Icon = info.icon;
                        return (
                          <button
                            key={type}
                            onClick={() => setSelectedVehicle(type)}
                            className={`p-2 rounded-lg text-xs font-medium transition-all border ${
                              selectedVehicle === type
                                ? 'border-white/30 bg-white/10 text-white'
                                : 'border-white/5 bg-white/5 text-white/40 hover:bg-white/10'
                            }`}
                          >
                            <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: info.color }} />
                            {info.name}
                            <div className="text-white/30">{info.speed} km/h</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Travel Info */}
                  <div className="p-3 bg-white/5 rounded-xl space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Travel time:</span>
                      <span className="text-white font-medium">{travelTime} min</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Venue:</span>
                      <span className="text-white font-medium">{selectedOpponent.venueName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Capacity:</span>
                      <span className="text-white font-medium">{isHome ? '5,000' : selectedOpponent.venueCapacity.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Ticket price:</span>
                      <span className="text-white font-medium">{isHome ? 15 : selectedOpponent.venueTicketPrice} CASH</span>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-400 font-bold">Est. Revenue:</span>
                        <span className="text-amber-400 font-bold">{estimatedRevenue.toLocaleString()} CASH</span>
                      </div>
                      {!isHome && (
                        <div className="text-xs text-white/30 mt-1">
                          (10% venue owner share deducted)
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleSchedule}
                    disabled={scheduling}
                    className="w-full py-3 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-bold text-sm hover:shadow-glow transition-shadow disabled:opacity-50"
                  >
                    {scheduling ? 'Scheduling...' : `Schedule ${isHome ? 'Home' : 'Away'} Match`}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-white/30 text-sm">
                  Select an opponent to schedule a match
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Tab */}
      {tab === 'upcoming' && (
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white font-medium mb-1">No upcoming matches</p>
              <p className="text-white/40 text-sm">Schedule a match to get started</p>
            </div>
          ) : (
            upcoming.map((match) => (
              <div key={match.id} className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      match.phase === 'TRAVELING' ? 'bg-blue-400 animate-pulse' :
                      match.phase === 'PREGAME' ? 'bg-amber-400 animate-pulse' :
                      match.phase === 'PLAYING' ? 'bg-emerald-400 animate-pulse' :
                      'bg-white/20'
                    }`} />
                    <div>
                      <div className="font-bold text-white">
                        {match.homeTeamName} <span className="text-white/40">vs</span> {match.awayTeamName}
                      </div>
                      <div className="text-xs text-white/40 flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> {match.venueName}
                        <span className="text-white/20">|</span>
                        <Shield className="w-3 h-3" /> {match.phase}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{match.homeScore} - {match.awayScore}</div>
                    <div className="text-xs text-white/40">{match.progress.toFixed(0)}%</div>
                  </div>
                </div>
                {match.phase === 'SCHEDULED' && (
                  <button
                    onClick={() => cancelMatch(match.id)}
                    className="mt-3 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors"
                  >
                    Cancel Match
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-3">
          {viewingReplay ? (
            <div>
              <button
                onClick={() => setViewingReplay(null)}
                className="mb-3 flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back to History
              </button>
              <MatchReplay match={viewingReplay} onClose={() => setViewingReplay(null)} />
            </div>
          ) : (
            <>
              {history.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Trophy className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <p className="text-white font-medium mb-1">No match history</p>
                  <p className="text-white/40 text-sm">Complete a match to see results here</p>
                </div>
              ) : (
                history.map((match) => (
                  <div key={match.id} className="glass-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          match.result === 'WIN' ? 'bg-emerald-400/20 text-emerald-400' :
                          match.result === 'LOSS' ? 'bg-red-400/20 text-red-400' :
                          'bg-amber-400/20 text-amber-400'
                        }`}>
                          {match.result === 'WIN' ? <CheckCircle className="w-5 h-5" /> :
                           match.result === 'LOSS' ? <X className="w-5 h-5" /> :
                           <TrendingUp className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-bold text-white">
                            {match.homeTeamName} <span className="text-white/40">{match.homeScore} - {match.awayScore}</span> {match.awayTeamName}
                          </div>
                          <div className="text-xs text-white/40">
                            {match.venueName} • {match.crowdAttendance.toLocaleString()} attendance
                            {match.formationName && <span className="ml-2 text-purple-400">• {match.formationName}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${
                          match.result === 'WIN' ? 'text-emerald-400' :
                          match.result === 'LOSS' ? 'text-red-400' :
                          'text-amber-400'
                        }`}>
                          {match.result}
                        </div>
                        <div className="text-xs text-emerald-400">+{match.revenueGenerated.toLocaleString()} CASH</div>
                        <button
                          onClick={() => setViewingReplay(match)}
                          className="mt-2 px-3 py-1 bg-white/5 text-white/60 rounded-lg text-xs font-medium hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" /> Replay
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
