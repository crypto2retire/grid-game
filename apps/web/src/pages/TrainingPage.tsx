import { useState, useEffect } from 'react';
import { useTraining } from '../components/training/TrainingSystem';
import { fetchApi } from '../lib/api';
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

interface Team {
  id: string;
  name: string;
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

export default function TrainingPage() {
  const { packages, activeTraining, isTraining, startTraining, cancelTraining, claimReward, playerFatigue, canTrain, completedSessions, loading: packagesLoading, refreshPlayers } = useTraining();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wallet, setWallet] = useState({ cash: 0, gridTokens: 0 });

  useEffect(() => {
    Promise.all([
      fetchApi('/teams/mine').then((r) => setTeams(r.data || [])),
      fetchApi('/economy/wallet').then((r) => {
        const w = r.data || { cash: 0, gridTokens: 0 };
        setWallet(w);
      }),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load players when team changes
  useEffect(() => {
    if (selectedTeam) {
      refreshPlayers(selectedTeam);
      setSelectedPlayer(''); // Reset player selection when team changes
    }
  }, [selectedTeam, refreshPlayers]);

  const handleStartTraining = async (pkg: TrainingPackage) => {
    if (!selectedTeam) {
      setMessage('Please select a team first');
      return;
    }
    if (pkg.focusType === 'INDIVIDUAL' && !selectedPlayer) {
      setMessage('Please select a player for individual training');
      return;
    }

    const teamName = teams.find(t => t.id === selectedTeam)?.name || 'Team';
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
      teamId: selectedTeam,
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
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm"
          >
            <option value="">Select Team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl text-sm">
            <Coins className="w-4 h-4 text-[#FFD700]" />
            <span className="text-white font-medium">{wallet.cash.toLocaleString()} CASH</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl text-sm">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-white font-medium">{wallet.gridTokens.toLocaleString()} GRID</span>
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Player Fatigue
          </h3>
          <span className="text-xs text-white/40">Recovers 1% per minute</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {playerFatigue.map((p) => {
            const isHigh = p.fatigue >= 80;
            const isCritical = p.fatigue >= 90;
            return (
              <div key={p.playerId} className={`p-3 rounded-xl border ${isCritical ? 'border-red-500/30 bg-red-500/5' : 'border-white/5 bg-white/5'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{p.playerName}</span>
                  {isHigh && <AlertTriangle className="w-4 h-4 text-amber-400" />}
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
                  <span className="text-xs text-white/40">{p.fatigue}% fatigue</span>
                  {p.trainingStreak > 0 && (
                    <span className="text-xs text-amber-400">{p.trainingStreak}x streak</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player selector for individual training */}
      {selectedTeam && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Select Player (for Individual Training)</h3>
          <div className="flex gap-2 flex-wrap">
            {playerFatigue.map((p) => (
              <button
                key={p.playerId}
                onClick={() => setSelectedPlayer(selectedPlayer === p.playerId ? '' : p.playerId)}
                disabled={p.fatigue >= 90}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedPlayer === p.playerId
                    ? 'bg-[#E94560] text-white'
                    : p.fatigue >= 90
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
              >
                {p.playerName} ({p.fatigue}%)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Training Packages */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg) => {
          const FocusIcon = FOCUS_ICONS[pkg.focusType] || Users;
          const canAfford = wallet.gridTokens >= pkg.costGrid && wallet.cash >= pkg.costCash;
          const check = canTrain(pkg.focusType === 'INDIVIDUAL' ? selectedPlayer : undefined);
          
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

              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400">{TRAINING_DURATION_SECONDS}s real-time</span>
              </div>

              <div className="flex gap-2 flex-wrap mb-4">
                {Object.entries(pkg.statBoosts).map(([stat, boost]) => (
                  boost && typeof boost === 'number' && boost > 0 ? (
                    <span key={stat} className="text-xs bg-white/5 rounded-lg px-2 py-1 text-emerald-400">
                      +{boost} {stat}
                    </span>
                  ) : null
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="space-y-1">
                  {pkg.costGrid > 0 && (
                    <div className="text-sm text-purple-400 font-bold">{pkg.costGrid.toLocaleString()} GRID</div>
                  )}
                  {pkg.costCash > 0 && (
                    <div className="text-sm text-[#FFD700] font-bold">{pkg.costCash.toLocaleString()} CASH</div>
                  )}
                  {pkg.costGrid === 0 && pkg.costCash === 0 && (
                    <div className="text-sm text-emerald-400 font-bold">Free</div>
                  )}
                </div>
                <button
                  onClick={() => handleStartTraining(pkg)}
                  disabled={isTraining || starting || !canAfford || !selectedTeam || !check.ok}
                  className="px-4 py-2 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-medium text-sm hover:shadow-glow transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTraining ? 'Training...' : starting ? 'Starting...' : 'Start Training'}
                </button>
              </div>
              {!canAfford && selectedTeam && (
                <p className="text-xs text-red-300 mt-2">Not enough funds</p>
              )}
              {!check.ok && selectedTeam && (
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
