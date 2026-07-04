import { useState, useEffect } from 'react';
import { useTraining } from '../components/training/TrainingSystem';
import { useGameStore } from '../store/gameStore';
import {
  Users, Target, Shield, Zap, PersonStanding, Coins, CheckCircle, Timer, AlertTriangle, Activity, TrendingUp,
} from 'lucide-react';

interface TrainingPackage {
  id: string;
  name: string;
  description: string;
  focusType: string;
  targetPosition: string | null;
  durationDays: number;
  costGrid: number;
  costCash: number;
  statBoosts: Record<string, number>;
  maxUsesPerPlayer: number;
}

const FOCUS_ICONS: Record<string, any> = {
  ALL: Users,
  POSITION_GROUP: Target,
  OFFENSE: Zap,
  DEFENSE: Shield,
  INDIVIDUAL: PersonStanding,
};

const FOCUS_LABELS: Record<string, string> = {
  ALL: 'All Players',
  POSITION_GROUP: 'Position Group',
  OFFENSE: 'Offense',
  DEFENSE: 'Defense',
  INDIVIDUAL: 'Individual',
};

const TRAINING_DURATION_SECONDS = 30; // Real-time seconds per training

const OFFENSE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL'];
const DEFENSE_POSITIONS = ['DL', 'LB', 'CB', 'S', 'K'];

const STAT_LABELS: Record<string, string> = {
  pace: 'SPD',
  shooting: 'ARM',
  passing: 'IQ',
  dribbling: 'AGI',
  defending: 'TCK',
  physical: 'STR',
};

const POSITION_TRAINING_GUIDE: Record<string, { role: string; needs: string[]; bestStats: string[] }> = {
  QB: { role: 'Quarterback', needs: ['ARM', 'IQ', 'AGI'], bestStats: ['shooting', 'passing', 'dribbling'] },
  RB: { role: 'Running Back', needs: ['SPD', 'AGI', 'STR'], bestStats: ['pace', 'dribbling', 'physical'] },
  WR: { role: 'Wide Receiver', needs: ['SPD', 'AGI', 'IQ'], bestStats: ['pace', 'dribbling', 'passing'] },
  TE: { role: 'Tight End', needs: ['STR', 'IQ', 'AGI'], bestStats: ['physical', 'passing', 'dribbling'] },
  OL: { role: 'O-Line', needs: ['STR', 'IQ'], bestStats: ['physical', 'passing'] },
  DL: { role: 'D-Line', needs: ['STR', 'TCK'], bestStats: ['physical', 'defending'] },
  LB: { role: 'Linebacker', needs: ['TCK', 'SPD', 'IQ'], bestStats: ['defending', 'pace', 'passing'] },
  CB: { role: 'Cornerback', needs: ['SPD', 'AGI', 'TCK'], bestStats: ['pace', 'dribbling', 'defending'] },
  S: { role: 'Safety', needs: ['TCK', 'IQ', 'SPD'], bestStats: ['defending', 'passing', 'pace'] },
  K: { role: 'Kicker', needs: ['ARM', 'IQ'], bestStats: ['shooting', 'passing'] },
};

const safeNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: unknown): string => safeNumber(value).toLocaleString();

function normalizePosition(position?: string | null): string {
  return (position || 'UNK').toUpperCase();
}

function getPositionGuide(position?: string | null) {
  return POSITION_TRAINING_GUIDE[normalizePosition(position)] || {
    role: 'Player',
    needs: ['SPD', 'IQ', 'STR'],
    bestStats: ['pace', 'passing', 'physical'],
  };
}

function getPositionSide(position?: string | null): 'Offense' | 'Defense' | 'Special' {
  const normalized = normalizePosition(position);
  if (normalized === 'K') return 'Special';
  if (OFFENSE_POSITIONS.includes(normalized)) return 'Offense';
  return 'Defense';
}

function getPackageTargetText(pkg: TrainingPackage): string {
  if (pkg.focusType === 'POSITION_GROUP' && pkg.targetPosition) return `Targets ${pkg.targetPosition}`;
  if (pkg.focusType === 'OFFENSE') return 'Targets QB/RB/WR/TE/OL';
  if (pkg.focusType === 'DEFENSE') return 'Targets DL/LB/CB/S/K';
  if (pkg.focusType === 'INDIVIDUAL') return 'Targets selected player';
  return 'Targets full roster';
}

function getPackageFitText(pkg: TrainingPackage, position?: string | null): string {
  const normalized = normalizePosition(position);
  const guide = getPositionGuide(normalized);
  const boostStats = Object.entries(pkg.statBoosts)
    .filter(([, boost]) => safeNumber(boost) > 0)
    .map(([stat]) => stat);
  const matchingStats = boostStats.filter((stat) => guide.bestStats.includes(stat));

  const focusMatches =
    pkg.focusType === 'ALL' ||
    pkg.focusType === 'INDIVIDUAL' ||
    (pkg.focusType === 'POSITION_GROUP' && normalizePosition(pkg.targetPosition) === normalized) ||
    (pkg.focusType === 'OFFENSE' && OFFENSE_POSITIONS.includes(normalized)) ||
    (pkg.focusType === 'DEFENSE' && DEFENSE_POSITIONS.includes(normalized));

  if (!focusMatches) return `Does not target ${normalized}`;
  if (matchingStats.length === 0) return `Targets ${normalized}, but secondary fit`;
  return `Good for ${normalized}: boosts ${matchingStats.map((stat) => STAT_LABELS[stat] || stat.toUpperCase()).join(', ')}`;
}

export default function TrainingPage() {
  const { packages, activeTraining, isTraining, startTraining, cancelTraining, claimReward, playerFatigue, canTrain, completedSessions, loading: packagesLoading } = useTraining();
  const { teams, selectedTeamId, setSelectedTeamId, wallet, refreshTeams, refreshWallet } = useGameStore();
  const walletCash = safeNumber(wallet?.cash);
  const walletDyn = safeNumber(wallet?.dynTokens);
  
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load teams on mount if not already loaded
  useEffect(() => {
    refreshWallet();
    if (teams.length === 0) {
      refreshTeams().then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [teams.length, refreshTeams, refreshWallet]);

  // Reset player selection when team changes
  useEffect(() => {
    setSelectedPlayer('');
  }, [selectedTeamId]);

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId || null);
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const selectedPlayerInfo = playerFatigue.find((p) => p.playerId === selectedPlayer);

  const handleStartTraining = async (pkg: TrainingPackage) => {
    if (!selectedTeamId) {
      setMessage('Please select a team first');
      return;
    }
    if (pkg.focusType === 'INDIVIDUAL' && !selectedPlayer) {
      setMessage('Please select a player for individual training');
      return;
    }

    const teamName = selectedTeam?.name || 'Team';
    const playerName = pkg.focusType === 'INDIVIDUAL' 
      ? playerFatigue.find(p => p.playerId === selectedPlayer)?.playerName 
      : undefined;

    const check = canTrain(pkg.focusType === 'INDIVIDUAL' ? selectedPlayer : undefined);
    if (!check.ok) {
      setMessage(check.reason || 'Cannot train right now');
      return;
    }

    setStarting(true);
    setMessage(null);

    const success = await startTraining({
      teamId: selectedTeamId,
      teamName,
      packageId: pkg.id,
      packageName: pkg.name,
      focusType: pkg.focusType,
      targetPlayerId: pkg.focusType === 'INDIVIDUAL' ? selectedPlayer : undefined,
      targetPlayerName: playerName,
      durationSeconds: TRAINING_DURATION_SECONDS,
      costGrid: pkg.costGrid,
      costCash: pkg.costCash,
      statBoosts: pkg.statBoosts,
    });

    if (!success) {
      setMessage('Training could not be started');
    }
    setStarting(false);
  };

  // Show completion message
  useEffect(() => {
    if (activeTraining?.status === 'completed') {
      const totalBoosts = Object.values(activeTraining.statBoosts).reduce((a, b) => a + b, 0);
      setMessage(`Training complete! ${activeTraining.packageName} finished. +${totalBoosts} total stat points.`);
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [activeTraining?.status]);

  if (loading || packagesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Training Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time training programs with player fatigue management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTeamId || ''}
            onChange={(e) => handleTeamChange(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
          >
            <option value="">Select Team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl text-sm">
            <Coins className="w-4 h-4 text-[#FFD700]" />
            <span className="text-white font-medium">{formatNumber(walletCash)} CASH</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl text-sm">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-white font-medium">{formatNumber(walletDyn)} DYN</span>
          </div>
        </div>
      </div>

      {/* Active Training Progress */}
      {isTraining && activeTraining && (
        <div className="glass-card p-5 border-amber-400/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-400/10 rounded-lg flex items-center justify-center">
                <Timer className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <div className="font-bold text-white">{activeTraining.packageName} in Progress</div>
                <div className="text-sm text-white/50">
                  {activeTraining.focusType === 'INDIVIDUAL' 
                    ? `Training ${activeTraining.targetPlayerName}` 
                    : FOCUS_LABELS[activeTraining.focusType]}
                </div>
              </div>
            </div>
            <button
              onClick={cancelTraining}
              className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#E94560] to-amber-400 transition-all duration-1000 rounded-full"
              style={{ width: `${activeTraining.progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-white/40">{Math.round(activeTraining.progress)}% complete</span>
            <span className="text-xs text-white/40">
              {Math.ceil((activeTraining.durationSeconds - (Date.now() - activeTraining.startedAt) / 1000))}s remaining
            </span>
          </div>
        </div>
      )}

      {/* Completed Training */}
      {activeTraining?.status === 'completed' && (
        <div className="glass-card p-5 border-emerald-400/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
              <div>
                <div className="font-bold text-white">Training Complete!</div>
                <div className="text-sm text-emerald-400">
                  {activeTraining.packageName} finished successfully
                </div>
              </div>
            </div>
            <button
              onClick={claimReward}
              className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-500/30 transition-colors"
            >
              Claim & Continue
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`rounded-xl p-4 text-sm ${message.includes('complete') || message.includes('finished') ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-200' : 'bg-red-400/10 border border-red-400/20 text-red-200'}`}>
          {message}
        </div>
      )}

      {/* Player Fatigue Overview */}
      <div className="glass-card p-5">
        <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-300" />
              Player Fatigue + Position Fit
            </h3>
            <p className="mt-1 text-xs text-slate-300">
              Position badges show who benefits most from each drill: QB/RB/WR/TE/OL are offense, DL/LB/CB/S/K are defense.
            </p>
          </div>
          <span className="text-xs text-slate-300">Recovers 1% per minute</span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {playerFatigue.map((p) => {
            const isHigh = p.fatigue >= 80;
            const isCritical = p.fatigue >= 90;
            const position = normalizePosition(p.position);
            const guide = getPositionGuide(position);
            const side = getPositionSide(position);
            return (
              <div key={p.playerId} className={`p-3 rounded-xl border ${isCritical ? 'border-red-500/40 bg-red-500/10' : 'border-cyan-200/10 bg-slate-900/70'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">{p.playerName}</span>
                      <span className="rounded-md border border-cyan-200/30 bg-cyan-400/15 px-2 py-0.5 text-xs font-black text-cyan-100">
                        {position}
                      </span>
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        {side}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-300">{guide.role} • train {guide.needs.join(' / ')}</div>
                  </div>
                  {isHigh && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />}
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      isCritical ? 'bg-red-500' : isHigh ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${p.fatigue}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-slate-300">{p.fatigue}% fatigue</span>
                  {p.trainingStreak > 0 && (
                    <span className="text-xs text-amber-300">{p.trainingStreak}x streak</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player selector for individual training */}
      {selectedTeamId && (
        <div className="glass-card p-4">
          <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Select Player (for Individual Training)</h3>
              <p className="mt-1 text-xs text-slate-300">Each chip shows position + best attributes, so you can match the player to the right drill.</p>
            </div>
            {selectedPlayerInfo && (
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                Selected {normalizePosition(selectedPlayerInfo.position)} • train {getPositionGuide(selectedPlayerInfo.position).needs.join(' / ')}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {playerFatigue.map((p) => {
              const position = normalizePosition(p.position);
              const guide = getPositionGuide(position);
              const disabled = p.fatigue >= 90;
              const selected = selectedPlayer === p.playerId;
              return (
                <button
                  key={p.playerId}
                  onClick={() => setSelectedPlayer(selected ? '' : p.playerId)}
                  disabled={disabled}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all ${
                    selected
                      ? 'border-[#E94560]/70 bg-[#E94560]/25 text-white shadow-glow'
                      : disabled
                      ? 'border-white/5 bg-white/5 text-white/25 cursor-not-allowed'
                      : 'border-cyan-200/10 bg-slate-900/70 text-slate-200 hover:border-cyan-200/40 hover:bg-cyan-400/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-bold">{p.playerName}</span>
                    <span className="rounded-md border border-cyan-200/30 bg-cyan-400/15 px-2 py-0.5 text-xs font-black text-cyan-100">
                      {position}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300">{p.fatigue}% fatigue • best: {guide.needs.join(' / ')}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Training Packages */}
      <div className="grid grid-cols-1 gap-4">
        {packages.map((pkg) => {
          const FocusIcon = FOCUS_ICONS[pkg.focusType] || Users;
          const costGrid = safeNumber(pkg.costGrid);
          const costCash = safeNumber(pkg.costCash);
          const canAfford = walletDyn >= costGrid && walletCash >= costCash;
          const check = canTrain(pkg.focusType === 'INDIVIDUAL' ? selectedPlayer : undefined);
          const selectedFitText = selectedPlayerInfo ? getPackageFitText(pkg, selectedPlayerInfo.position) : null;
          
          return (
            <div key={pkg.id} className={`glass-card p-5 border transition-all ${
              isTraining ? 'opacity-50 border-white/5' : 'border-white/10 hover:border-white/20'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[#E94560]/10 rounded-lg flex items-center justify-center">
                  <FocusIcon className="w-5 h-5 text-[#E94560]" />
                </div>
                <div>
                  <div className="font-bold text-white">{pkg.name}</div>
                  <div className="text-xs text-muted-foreground">{FOCUS_LABELS[pkg.focusType]}</div>
                </div>
              </div>

              <p className="text-sm text-white/50 mb-4">{pkg.description}</p>

              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-lg border border-cyan-200/20 bg-cyan-400/10 px-2 py-1 text-xs font-bold text-cyan-100">
                  {getPackageTargetText(pkg)}
                </span>
                {selectedFitText && (
                  <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${selectedFitText.startsWith('Good') ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : selectedFitText.startsWith('Does not') ? 'border-amber-300/25 bg-amber-400/10 text-amber-100' : 'border-white/10 bg-white/5 text-slate-200'}`}>
                    {selectedFitText}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400">{TRAINING_DURATION_SECONDS}s real-time</span>
              </div>

              <div className="flex gap-2 flex-wrap mb-4">
                {Object.entries(pkg.statBoosts).map(([stat, boost]) => (
                  boost && typeof boost === 'number' && boost > 0 ? (
                    <span key={stat} className="text-xs bg-white/5 rounded-lg px-2 py-1 text-emerald-400">
                      +{boost} {STAT_LABELS[stat] || stat.toUpperCase()}
                    </span>
                  ) : null
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="space-y-1">
                  {costGrid > 0 && (
                    <div className="text-sm text-purple-400 font-bold">{formatNumber(costGrid)} DYN</div>
                  )}
                  {costCash > 0 && (
                    <div className="text-sm text-[#FFD700] font-bold">{formatNumber(costCash)} CASH</div>
                  )}
                  {costGrid === 0 && costCash === 0 && (
                    <div className="text-sm text-emerald-400 font-bold">Free</div>
                  )}
                </div>
                <button
                  onClick={() => handleStartTraining(pkg)}
                  disabled={isTraining || starting || !canAfford || !selectedTeamId || !check.ok}
                  className="px-4 py-2 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-medium text-sm hover:shadow-glow transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTraining ? 'Training...' : starting ? 'Starting...' : 'Start Training'}
                </button>
              </div>
              {!canAfford && selectedTeamId && (
                <p className="text-xs text-red-300 mt-2">Not enough funds</p>
              )}
              {!check.ok && selectedTeamId && (
                <p className="text-xs text-amber-300 mt-2">{check.reason}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Sessions */}
      {completedSessions.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Recent Training Sessions
          </h3>
          <div className="space-y-2">
            {completedSessions.slice(0, 10).map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-white font-medium">{session.trainingPackage?.name || 'Training'}</span>
                    <span className="text-white/40"> — {session.player?.name || 'Team'}</span>
                    {session.player?.name && session.trainingPackage?.focusType === 'INDIVIDUAL' && (
                      <span className="text-white/40"> ({session.player.name})</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {Object.entries(session.statImprovements || {}).map(([stat, boost]) => (
                    boost && typeof boost === 'number' && boost > 0 ? (
                      <span key={stat} className="text-xs text-emerald-400">+{boost} {stat}</span>
                    ) : null
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
