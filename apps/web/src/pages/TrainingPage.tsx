import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { Users, Target, Shield, Zap, PersonStanding, Coins, CheckCircle } from 'lucide-react';

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

interface Player {
  id: string;
  name: string;
  position: string;
  overall: number;
}

interface TrainingRecord {
  id: string;
  player: { name: string; position: string };
  trainingPackage: { name: string; focusType: string };
  statImprovements: Record<string, number>;
  createdAt: string;
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

export default function TrainingPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [packages, setPackages] = useState<TrainingPackage[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [history, setHistory] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wallet, setWallet] = useState({ cash: 0, gridTokens: 0 });

  useEffect(() => {
    Promise.all([
      fetchApi('/teams/mine').then((r) => setTeams(r.data || [])),
      fetchApi('/training/packages').then((r) => setPackages(r.data || [])),
      fetchApi('/training/history').then((r) => setHistory(r.data || [])),
      fetchApi('/economy/wallet').then((r) => {
        const w = r.data || { cash: 0, gridTokens: 0 };
        setWallet(w);
        useGameStore.getState().setWallet(w);
      }),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    fetchApi(`/teams/${selectedTeam}`)
      .then((r) => {
        const data = r.data || {};
        const teamPlayers = data.teamPlayers || [];
        setPlayers(teamPlayers.map((tp: any) => tp.player));
      })
      .catch(console.error);
  }, [selectedTeam]);

  const startTraining = async (pkg: TrainingPackage) => {
    if (!selectedTeam) {
      setMessage('Please select a team first');
      return;
    }
    if (pkg.focusType === 'INDIVIDUAL' && !selectedPlayer) {
      setMessage('Please select a player for individual training');
      return;
    }

    setTraining(true);
    setMessage(null);
    try {
      const res = await fetchApi('/training/start', {
        method: 'POST',
        body: JSON.stringify({
          teamId: selectedTeam,
          packageId: pkg.id,
          playerId: pkg.focusType === 'INDIVIDUAL' ? selectedPlayer : undefined,
        }),
      });
      const result = res.data || {};
      const improvements = result.improvements || [];
      const totalPlayers = improvements.length;
      const totalBoosts = improvements.reduce((sum: number, imp: any) => 
        sum + Object.values(imp.improvements).reduce((s: number, v: any) => s + (v as number), 0), 0
      );
      
      setMessage(`Training complete! ${totalPlayers} player(s) improved with ${totalBoosts} total stat points.`);
      
      // Refresh data
      const [walletRes, historyRes] = await Promise.all([
        fetchApi('/economy/wallet'),
        fetchApi('/training/history'),
      ]);
      setWallet(walletRes.data || { cash: 0, gridTokens: 0 });
      setHistory(historyRes.data || []);
      
      // Refresh player data
      if (selectedTeam) {
        const teamRes = await fetchApi(`/teams/${selectedTeam}`);
        const teamData = teamRes.data || {};
        setPlayers((teamData.teamPlayers || []).map((tp: any) => tp.player));
      }
    } catch (err: any) {
      setMessage(err.message || 'Training failed');
    } finally {
      setTraining(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading) {
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
            Improve your players with focused training programs
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

      {message && (
        <div className={`rounded-xl p-4 text-sm ${message.includes('complete') ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-200' : 'bg-red-400/10 border border-red-400/20 text-red-200'}`}>
          {message}
        </div>
      )}

      {/* Player selector for individual training */}
      {selectedTeam && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Select Player (for Individual Training)</h3>
          <div className="flex gap-2 flex-wrap">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(selectedPlayer === p.id ? '' : p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedPlayer === p.id
                    ? 'bg-[#E94560] text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
              >
                {p.name} ({p.position}) OVR {p.overall}
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
          
          return (
            <div key={pkg.id} className="glass-card p-5 border border-white/10 hover:border-white/20 transition-all">
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

              {/* Stat boosts preview */}
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
                  onClick={() => startTraining(pkg)}
                  disabled={training || !canAfford || !selectedTeam}
                  className="px-4 py-2 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-medium text-sm hover:shadow-glow transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {training ? 'Training...' : 'Start Training'}
                </button>
              </div>
              {!canAfford && selectedTeam && (
                <p className="text-xs text-red-300 mt-2">Not enough funds</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Training History */}
      {history.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Training History</h3>
          <div className="space-y-2">
            {history.slice(0, 20).map((record) => (
              <div key={record.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-white font-medium">{record.player.name}</span>
                    <span className="text-white/40"> — {record.trainingPackage.name}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {Object.entries(record.statImprovements).map(([stat, boost]) => (
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
