import { useState } from 'react';
import type { ScheduledMatch } from './MatchScheduleSystem';
import {
  Trophy, ChevronDown, ChevronUp, Target, Zap, Shield, Activity, CircleDollarSign, User, Clock, Swords,
} from 'lucide-react';

interface MatchEvent {
  timestamp: number;
  tick: number;
  type: string;
  actorName?: string;
  targetName?: string;
  metadata?: {
    drive?: number;
    possession?: string;
    points?: number;
    score?: string;
    yards?: number;
    overtime?: boolean;
    quarter?: number;
    sportId?: string;
  };
}

interface PlayerStat {
  playerId: string;
  name: string;
  goals: number;
  assists: number;
  tackles: number;
  saves: number;
  passes: number;
  shots: number;
  rating: number;
  sportStats?: {
    yards?: number;
    passingTouchdowns?: number;
    turnoversForced?: number;
    fieldGoals?: number;
  };
}

const EVENT_ICONS: Record<string, any> = {
  TOUCHDOWN: Target,
  FIELD_GOAL: Zap,
  RUSH: Activity,
  PASS_COMPLETION: Target,
  TURNOVER: Shield,
  END_QUARTER: Clock,
  FINAL: Trophy,
};

const EVENT_COLORS: Record<string, string> = {
  TOUCHDOWN: 'text-emerald-400',
  FIELD_GOAL: 'text-amber-400',
  RUSH: 'text-blue-400',
  PASS_COMPLETION: 'text-cyan-400',
  TURNOVER: 'text-red-400',
  END_QUARTER: 'text-white/40',
  FINAL: 'text-amber-400',
};

function formatEventDescription(event: MatchEvent): string {
  const { type, actorName, targetName, metadata } = event;
  const score = metadata?.score || '';
  const yards = metadata?.yards;

  switch (type) {
    case 'TOUCHDOWN':
      return `${actorName || 'Unknown'} scores a touchdown!${yards ? ` (${yards} yards)` : ''}`;
    case 'FIELD_GOAL':
      return `${actorName || 'Kicker'} makes a field goal!`;
    case 'RUSH':
      return `${actorName || 'Runner'} rushes for ${yards || 0} yards`;
    case 'PASS_COMPLETION':
      return `${actorName || 'QB'} passes to ${targetName || 'Receiver'} for ${yards || 0} yards`;
    case 'TURNOVER':
      return `${targetName || 'Defender'} forces a turnover!`;
    case 'END_QUARTER':
      return `End of Q${metadata?.quarter || 1} — Score: ${score}`;
    case 'FINAL':
      return `Final Score: ${score}`;
    default:
      return `${type}${actorName ? ` — ${actorName}` : ''}`;
  }
}

function formatTime(timestamp: number): string {
  const minutes = Math.floor(timestamp / 60);
  const seconds = Math.floor(timestamp % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

interface MatchReplayProps {
  match: ScheduledMatch;
  onClose?: () => void;
}

export default function MatchReplay({ match, onClose }: MatchReplayProps) {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showEconomics, setShowEconomics] = useState(true);

  // Map stored events to our interface
  const events: MatchEvent[] = (match.events || []).map((e: any) => ({
    timestamp: e.timestamp || 0,
    tick: e.tick || 0,
    type: e.type || 'UNKNOWN',
    actorName: e.actorName,
    targetName: e.targetName,
    metadata: e.metadata,
  }));

  const scoringEvents = events.filter(e => e.type === 'TOUCHDOWN' || e.type === 'FIELD_GOAL');
  const keyEvents = events.filter(e => ['TOUCHDOWN', 'FIELD_GOAL', 'TURNOVER', 'FINAL'].includes(e.type));
  const displayEvents = showAllEvents ? events : keyEvents;

  const playerStats = match.events?.length ? extractPlayerStats(match) : [];
  const resultColor = match.result === 'WIN' ? 'text-emerald-400' : match.result === 'LOSS' ? 'text-red-400' : 'text-amber-400';
  const resultBg = match.result === 'WIN' ? 'bg-emerald-400/10 border-emerald-400/20' : match.result === 'LOSS' ? 'bg-red-400/10 border-red-400/20' : 'bg-amber-400/10 border-amber-400/20';

  return (
    <div className="space-y-5">
      {/* Header / Scoreboard */}
      <div className={`p-5 rounded-xl border ${resultBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-black ${resultColor}`}>
              {match.result}
            </div>
            <div>
              <div className="text-3xl font-black text-white">
                {match.homeScore} - {match.awayScore}
              </div>
              <div className="text-sm text-white/40">
                {match.homeTeamName} vs {match.awayTeamName}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white/40">{match.venueName}</div>
            <div className="text-sm text-emerald-400">+{match.revenueGenerated.toLocaleString()} CASH</div>
          </div>
        </div>
      </div>

      {/* Scoring Summary */}
      {scoringEvents.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Scoring Plays
          </h3>
          <div className="space-y-2">
            {scoringEvents.map((event, i) => {
              const Icon = EVENT_ICONS[event.type] || Activity;
              const color = EVENT_COLORS[event.type] || 'text-white/40';
              return (
                <div key={i} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <div className="flex-1">
                    <div className="text-sm text-white">{formatEventDescription(event)}</div>
                    <div className="text-xs text-white/40">{formatTime(event.timestamp)}</div>
                  </div>
                  <div className="text-sm font-bold text-white/60">
                    {event.metadata?.score}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Play-by-Play Timeline */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Swords className="w-4 h-4" />
            Play-by-Play
          </h3>
          <button
            onClick={() => setShowAllEvents(!showAllEvents)}
            className="text-xs text-[#E94560] hover:text-white transition-colors"
          >
            {showAllEvents ? 'Show Key Plays Only' : 'Show All Plays'}
          </button>
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {displayEvents.map((event, i) => {
            const Icon = EVENT_ICONS[event.type] || Activity;
            const color = EVENT_COLORS[event.type] || 'text-white/40';
            const isScoring = event.type === 'TOUCHDOWN' || event.type === 'FIELD_GOAL';
            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-2 rounded-lg ${isScoring ? 'bg-white/5' : ''}`}
              >
                <div className="w-10 text-xs text-white/30 text-right font-mono">
                  {formatTime(event.timestamp)}
                </div>
                <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                <div className="flex-1 text-sm text-white/80">
                  {formatEventDescription(event)}
                </div>
                {event.metadata?.yards && event.type !== 'TOUCHDOWN' && event.type !== 'FIELD_GOAL' && (
                  <div className="text-xs text-blue-400">{event.metadata.yards}y</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Stats */}
      {playerStats.length > 0 && (
        <div className="glass-card p-4">
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              Player Stats
            </h3>
            {showStats ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          </button>
          {showStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {playerStats.map((stat) => (
                <div key={stat.playerId} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{stat.name}</span>
                    <span className="text-xs text-amber-400">Rating: {stat.rating.toFixed(1)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-white/40">
                    <div>TDs: <span className="text-emerald-400">{stat.goals}</span></div>
                    <div>Pass TDs: <span className="text-cyan-400">{stat.sportStats?.passingTouchdowns || 0}</span></div>
                    <div>Yards: <span className="text-blue-400">{stat.sportStats?.yards || 0}</span></div>
                    <div>Tackles: <span className="text-purple-400">{stat.tackles}</span></div>
                    <div>TO Forced: <span className="text-red-400">{stat.sportStats?.turnoversForced || 0}</span></div>
                    <div>FGs: <span className="text-amber-400">{stat.sportStats?.fieldGoals || 0}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Economics */}
      {(match.homeEconomics || match.awayEconomics) && (
        <div className="glass-card p-4">
          <button
            onClick={() => setShowEconomics(!showEconomics)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4" />
              Revenue Breakdown
            </h3>
            {showEconomics ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          </button>
          {showEconomics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {match.homeEconomics && (
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-sm font-bold text-white mb-2">Home Team</div>
                  <div className="space-y-1 text-xs text-white/40">
                    <div className="flex justify-between"><span>Ticket Revenue:</span> <span className="text-emerald-400">{match.homeEconomics.ticketRevenue?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Concessions:</span> <span className="text-emerald-400">{match.homeEconomics.concessionRevenue?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Merchandise:</span> <span className="text-emerald-400">{match.homeEconomics.merchandiseRevenue?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Sponsorships:</span> <span className="text-emerald-400">{match.homeEconomics.sponsorshipRevenue?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Transport:</span> <span className="text-red-400">-{match.homeEconomics.transportCost?.toLocaleString()}</span></div>
                    <div className="pt-1 border-t border-white/10 flex justify-between"><span className="font-bold">Net:</span> <span className="text-emerald-400 font-bold">{match.homeEconomics.netRevenue?.toLocaleString()}</span></div>
                  </div>
                </div>
              )}
              {match.awayEconomics && (
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-sm font-bold text-white mb-2">Away Team</div>
                  <div className="space-y-1 text-xs text-white/40">
                    <div className="flex justify-between"><span>Ticket Revenue:</span> <span className="text-emerald-400">{match.awayEconomics.ticketRevenue?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Concessions:</span> <span className="text-emerald-400">{match.awayEconomics.concessionRevenue?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Merchandise:</span> <span className="text-emerald-400">{match.awayEconomics.merchandiseRevenue?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Sponsorships:</span> <span className="text-emerald-400">{match.awayEconomics.sponsorshipRevenue?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Transport:</span> <span className="text-red-400">-{match.awayEconomics.transportCost?.toLocaleString()}</span></div>
                    <div className="pt-1 border-t border-white/10 flex justify-between"><span className="font-bold">Net:</span> <span className="text-emerald-400 font-bold">{match.awayEconomics.netRevenue?.toLocaleString()}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="w-full py-3 bg-white/5 text-white rounded-xl font-medium text-sm hover:bg-white/10 transition-colors"
        >
          Close Replay
        </button>
      )}
    </div>
  );
}

function extractPlayerStats(_match: ScheduledMatch): PlayerStat[] {
  // Events contain player stats in the simulation result
  // For now, return empty — the backend would need to return playerStats array
  return [];
}
