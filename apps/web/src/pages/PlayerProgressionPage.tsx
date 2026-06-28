import { useState } from 'react';
import { usePlayerProgression } from '../components/player/PlayerProgressionSystem';
import {
  Trophy, Star, TrendingUp, Activity, ChevronDown, ChevronUp,
} from 'lucide-react';

const POSITION_COLORS: Record<string, string> = {
  QB: '#E94560', RB: '#22c55e', WR: '#3b82f6', TE: '#a855f7', OL: '#eab308',
  DL: '#ef4444', LB: '#f97316', CB: '#06b6d4', S: '#ec4899', K: '#64748b',
};

const STAT_LABELS: Record<string, string> = {
  gamesPlayed: 'Games Played',
  gamesStarted: 'Games Started',
  wins: 'Wins',
  losses: 'Losses',
  ties: 'Ties',
  rushingYards: 'Rushing Yards',
  passingYards: 'Passing Yards',
  receivingYards: 'Receiving Yards',
  touchdowns: 'Touchdowns',
  passingTouchdowns: 'Passing TDs',
  tackles: 'Tackles',
  sacks: 'Sacks',
  interceptions: 'Interceptions',
  fieldGoals: 'Field Goals',
  fumbles: 'Fumbles',
  fumblesRecovered: 'Fumbles Recovered',
  seasonBest: 'Best Game Rating',
};

export default function PlayerProgressionPage() {
  const { players, xpHistory, getOverallBonus } = usePlayerProgression();
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [showXpHistory, setShowXpHistory] = useState(false);

  const selectedPlayerData = players.find(p => p.playerId === selectedPlayer);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Player Progression</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track XP, levels, and career stats for your players
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl text-sm">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-white font-medium">{players.length} Players</span>
        </div>
      </div>

      {/* Player Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {players.map((player) => {
          const overallBonus = getOverallBonus(player.playerId);
          const xpPercent = player.xpToNextLevel > 0 ? (player.xp / player.xpToNextLevel) * 100 : 100;
          const isSelected = selectedPlayer === player.playerId;
          
          return (
            <div
              key={player.playerId}
              onClick={() => setSelectedPlayer(isSelected ? null : player.playerId)}
              className={`glass-card p-4 cursor-pointer transition-all border ${
                isSelected ? 'border-[#E94560] ring-1 ring-[#E94560]/30' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm"
                    style={{ backgroundColor: POSITION_COLORS[player.position] + '33', color: POSITION_COLORS[player.position] }}
                  >
                    {player.position}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{player.playerName}</div>
                    <div className="text-xs text-white/40">Level {player.level}</div>
                  </div>
                </div>
                {overallBonus > 0 && (
                  <div className="text-xs text-emerald-400 font-bold">+{overallBonus} OVR</div>
                )}
              </div>

              {/* XP Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">XP</span>
                  <span className="text-white/60">{player.xp} / {player.xpToNextLevel}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#E94560] to-amber-400 rounded-full transition-all"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </div>

              {/* Badges */}
              {player.badges.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-3">
                  {player.badges.slice(0, 3).map((badge, i) => (
                    <span key={i} className="text-[10px] bg-white/5 rounded px-2 py-0.5 text-amber-400 border border-white/10">
                      <Star className="w-2 h-2 inline mr-0.5" />
                      {badge}
                    </span>
                  ))}
                  {player.badges.length > 3 && (
                    <span className="text-[10px] text-white/30">+{player.badges.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Player Detail */}
      {selectedPlayerData && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg"
                style={{ backgroundColor: POSITION_COLORS[selectedPlayerData.position] + '33', color: POSITION_COLORS[selectedPlayerData.position] }}
              >
                {selectedPlayerData.position}
              </div>
              <div>
                <div className="font-bold text-white text-lg">{selectedPlayerData.playerName}</div>
                <div className="text-sm text-white/40">
                  Level {selectedPlayerData.level} • {selectedPlayerData.totalXpEarned.toLocaleString()} total XP
                  {getOverallBonus(selectedPlayerData.playerId) > 0 && (
                    <span className="text-emerald-400 ml-2">+{getOverallBonus(selectedPlayerData.playerId)} OVR bonus</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-amber-400">{selectedPlayerData.level}</div>
              <div className="text-xs text-white/40">Current Level</div>
            </div>
          </div>

          {/* XP Progress */}
          <div className="p-4 bg-white/5 rounded-xl mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/60">Progress to Level {selectedPlayerData.level + 1}</span>
              <span className="text-sm text-white/60">{selectedPlayerData.xp} / {selectedPlayerData.xpToNextLevel} XP</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#E94560] to-amber-400 rounded-full transition-all"
                style={{ width: `${selectedPlayerData.xpToNextLevel > 0 ? (selectedPlayerData.xp / selectedPlayerData.xpToNextLevel) * 100 : 100}%` }}
              />
            </div>
          </div>

          {/* Career Stats */}
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Career Stats
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {Object.entries(selectedPlayerData.careerStats).map(([stat, value]) => (
              <div key={stat} className="p-3 bg-white/5 rounded-xl text-center">
                <div className="text-lg font-black text-white">{value.toLocaleString()}</div>
                <div className="text-[10px] text-white/40 uppercase">{STAT_LABELS[stat] || stat}</div>
              </div>
            ))}
          </div>

          {/* All Badges */}
          {selectedPlayerData.badges.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Badges ({selectedPlayerData.badges.length})
              </h3>
              <div className="flex gap-2 flex-wrap">
                {selectedPlayerData.badges.map((badge, i) => (
                  <span key={i} className="text-xs bg-amber-400/10 rounded-lg px-3 py-1.5 text-amber-400 border border-amber-400/20 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* XP History */}
      {xpHistory.length > 0 && (
        <div className="glass-card p-4">
          <button
            onClick={() => setShowXpHistory(!showXpHistory)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Recent XP Gains
            </h3>
            {showXpHistory ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          </button>
          {showXpHistory && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {xpHistory.slice(0, 20).map((event, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      event.source === 'TRAINING' ? 'bg-blue-400/20 text-blue-400' :
                      event.source === 'MATCH' ? 'bg-emerald-400/20 text-emerald-400' :
                      'bg-amber-400/20 text-amber-400'
                    }`}>
                      {event.source}
                    </span>
                    <span className="text-white/60">{event.description}</span>
                  </div>
                  <span className="text-emerald-400 font-bold">+{event.amount} XP</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
