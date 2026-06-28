import { useState } from 'react';
import { useGamePlan } from '../components/gameplan/GamePlanSystem';
import {
  Shield, Swords, Zap, Target, ChevronRight, Check, TrendingUp, Activity,
} from 'lucide-react';

const OFFENSE_POSITIONS: Record<string, { x: number; y: number; label: string }[]> = {
  'spread': [
    { x: 50, y: 85, label: 'QB' },
    { x: 50, y: 65, label: 'RB' },
    { x: 20, y: 45, label: 'WR' },
    { x: 40, y: 45, label: 'WR' },
    { x: 60, y: 45, label: 'WR' },
    { x: 80, y: 45, label: 'WR' },
  ],
  'air-raid': [
    { x: 50, y: 85, label: 'QB' },
    { x: 50, y: 65, label: 'RB' },
    { x: 15, y: 40, label: 'WR' },
    { x: 35, y: 40, label: 'WR' },
    { x: 65, y: 40, label: 'WR' },
    { x: 85, y: 40, label: 'WR' },
  ],
  'power-run': [
    { x: 50, y: 85, label: 'QB' },
    { x: 45, y: 65, label: 'RB' },
    { x: 55, y: 65, label: 'FB' },
    { x: 25, y: 50, label: 'TE' },
    { x: 75, y: 50, label: 'TE' },
    { x: 50, y: 30, label: 'WR' },
  ],
  'west-coast': [
    { x: 50, y: 85, label: 'QB' },
    { x: 50, y: 65, label: 'RB' },
    { x: 20, y: 45, label: 'WR' },
    { x: 80, y: 45, label: 'WR' },
    { x: 35, y: 40, label: 'TE' },
    { x: 65, y: 40, label: 'TE' },
  ],
};

const DEFENSE_POSITIONS: Record<string, { x: number; y: number; label: string }[]> = {
  '4-3': [
    { x: 30, y: 30, label: 'DL' },
    { x: 43, y: 30, label: 'DL' },
    { x: 57, y: 30, label: 'DL' },
    { x: 70, y: 30, label: 'DL' },
    { x: 35, y: 50, label: 'LB' },
    { x: 50, y: 50, label: 'LB' },
    { x: 65, y: 50, label: 'LB' },
    { x: 20, y: 70, label: 'CB' },
    { x: 80, y: 70, label: 'CB' },
    { x: 40, y: 75, label: 'S' },
    { x: 60, y: 75, label: 'S' },
  ],
  '3-4': [
    { x: 40, y: 30, label: 'DL' },
    { x: 50, y: 30, label: 'DL' },
    { x: 60, y: 30, label: 'DL' },
    { x: 25, y: 50, label: 'LB' },
    { x: 40, y: 50, label: 'LB' },
    { x: 60, y: 50, label: 'LB' },
    { x: 75, y: 50, label: 'LB' },
    { x: 20, y: 70, label: 'CB' },
    { x: 80, y: 70, label: 'CB' },
    { x: 40, y: 75, label: 'S' },
    { x: 60, y: 75, label: 'S' },
  ],
  'nickel': [
    { x: 35, y: 30, label: 'DL' },
    { x: 50, y: 30, label: 'DL' },
    { x: 65, y: 30, label: 'DL' },
    { x: 40, y: 50, label: 'LB' },
    { x: 60, y: 50, label: 'LB' },
    { x: 15, y: 65, label: 'CB' },
    { x: 35, y: 65, label: 'CB' },
    { x: 65, y: 65, label: 'CB' },
    { x: 85, y: 65, label: 'CB' },
    { x: 40, y: 75, label: 'S' },
    { x: 60, y: 75, label: 'S' },
  ],
  'dime': [
    { x: 40, y: 30, label: 'DL' },
    { x: 60, y: 30, label: 'DL' },
    { x: 50, y: 50, label: 'LB' },
    { x: 15, y: 60, label: 'CB' },
    { x: 30, y: 60, label: 'CB' },
    { x: 50, y: 60, label: 'CB' },
    { x: 70, y: 60, label: 'CB' },
    { x: 85, y: 60, label: 'CB' },
    { x: 35, y: 75, label: 'S' },
    { x: 50, y: 75, label: 'S' },
    { x: 65, y: 75, label: 'S' },
  ],
};

function FormationDiagram({ formationId, type }: { formationId: string; type: 'OFFENSE' | 'DEFENSE' }) {
  const positions = type === 'OFFENSE' ? OFFENSE_POSITIONS[formationId] : DEFENSE_POSITIONS[formationId];
  if (!positions) return null;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-32">
      {/* Field */}
      <rect x="0" y="0" width="100" height="100" fill="#0f172a" rx="4" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="#1e293b" strokeWidth="0.5" />
      <line x1="50" y1="0" x2="50" y2="100" stroke="#1e293b" strokeWidth="0.5" />
      {/* LOS */}
      <line x1="0" y1={type === 'OFFENSE' ? '70' : '30'} x2="100" y2={type === 'OFFENSE' ? '70' : '30'} stroke="#334155" strokeWidth="1" strokeDasharray="4" />
      {/* Players */}
      {positions.map((pos, i) => (
        <g key={i}>
          <circle cx={pos.x} cy={pos.y} r="5" fill={type === 'OFFENSE' ? '#E94560' : '#3b82f6'} opacity="0.8" />
          <text x={pos.x} y={pos.y + 1.5} textAnchor="middle" fill="#fff" fontSize="4" fontWeight="700">{pos.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function GamePlanPage() {
  const { activeFormation, formations, setFormation, getFormationModifiers } = useGamePlan();
  const [selectedTab, setSelectedTab] = useState<'OFFENSE' | 'DEFENSE'>('OFFENSE');
  const mods = getFormationModifiers();

  const filteredFormations = formations.filter(f => f.type === selectedTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Game Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose formations that shape your team's identity and match simulation
          </p>
        </div>
        {activeFormation && (
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
            <div className="text-xs text-white/40">Active Formation</div>
            <div className="font-bold text-white flex items-center gap-2">
              {activeFormation.type === 'OFFENSE' ? <Swords className="w-4 h-4 text-[#E94560]" /> : <Shield className="w-4 h-4 text-blue-400" />}
              {activeFormation.name}
            </div>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-1">
        <button
          onClick={() => setSelectedTab('OFFENSE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
            selectedTab === 'OFFENSE'
              ? 'text-[#E94560] border-b-2 border-[#E94560]'
              : 'text-white/40 hover:text-white'
          }`}
        >
          <Swords className="w-4 h-4" />
          Offense
        </button>
        <button
          onClick={() => setSelectedTab('DEFENSE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
            selectedTab === 'DEFENSE'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-white/40 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          Defense
        </button>
      </div>

      {/* Formation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredFormations.map((formation) => {
          const isActive = activeFormation?.id === formation.id;
          return (
            <div
              key={formation.id}
              onClick={() => setFormation(formation.id)}
              className={`glass-card p-4 cursor-pointer transition-all border ${
                isActive
                  ? 'border-[#E94560] ring-1 ring-[#E94560]/30'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                    selectedTab === 'OFFENSE' ? 'bg-[#E94560]/20 text-[#E94560]' : 'bg-blue-400/20 text-blue-400'
                  }`}>
                    {formation.icon}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{formation.name}</div>
                    <div className="text-xs text-white/40">{formation.type}</div>
                  </div>
                </div>
                {isActive && (
                  <div className="w-5 h-5 rounded-full bg-emerald-400/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                )}
              </div>

              <FormationDiagram formationId={formation.id} type={formation.type} />

              <p className="text-xs text-white/40 mt-3 leading-relaxed">{formation.description}</p>

              {/* Stat Bars */}
              <div className="space-y-2 mt-3">
                <div>
                  <div className="flex justify-between text-[10px] text-white/40 mb-1">
                    <span>Run/Pass Split</span>
                    <span>{Math.round(formation.runWeight * 100)}% / {Math.round(formation.passWeight * 100)}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${formation.runWeight * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-white/40 mb-1">
                    <span>Blitz Chance</span>
                    <span>{Math.round(formation.blitzChance * 100)}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${formation.blitzChance * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-white/40 mb-1">
                    <span>Aggression</span>
                    <span>{Math.round(formation.aggression * 100)}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${formation.aggression * 100}%` }} />
                  </div>
                </div>
              </div>

              {isActive && (
                <div className="mt-3 px-3 py-1.5 bg-emerald-400/10 border border-emerald-400/20 rounded-lg text-xs text-emerald-400 font-medium text-center">
                  ACTIVE
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Formation Impact */}
      {activeFormation && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Simulation Impact</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-white/5 rounded-xl text-center">
              <div className="text-2xl font-black text-emerald-400">{Math.round(mods.runWeight * 100)}%</div>
              <div className="text-xs text-white/40 mt-1">Run Plays</div>
              <TrendingUp className="w-4 h-4 text-emerald-400/50 mx-auto mt-2" />
            </div>
            <div className="p-3 bg-white/5 rounded-xl text-center">
              <div className="text-2xl font-black text-blue-400">{Math.round(mods.passWeight * 100)}%</div>
              <div className="text-xs text-white/40 mt-1">Pass Plays</div>
              <Activity className="w-4 h-4 text-blue-400/50 mx-auto mt-2" />
            </div>
            <div className="p-3 bg-white/5 rounded-xl text-center">
              <div className="text-2xl font-black text-amber-400">{Math.round(mods.blitzChance * 100)}%</div>
              <div className="text-xs text-white/40 mt-1">Blitz Rate</div>
              <Zap className="w-4 h-4 text-amber-400/50 mx-auto mt-2" />
            </div>
            <div className="p-3 bg-white/5 rounded-xl text-center">
              <div className="text-2xl font-black text-red-400">{Math.round(mods.aggression * 100)}%</div>
              <div className="text-xs text-white/40 mt-1">Aggression</div>
              <Target className="w-4 h-4 text-red-400/50 mx-auto mt-2" />
            </div>
          </div>
          <div className="mt-4 p-3 bg-white/5 rounded-xl text-sm text-white/60">
            <ChevronRight className="w-4 h-4 inline mr-1 text-[#E94560]" />
            Your {activeFormation.name} formation will be used for all match simulations. Offense formation determines play-calling balance. Defense formation determines blitz frequency and coverage schemes.
          </div>
        </div>
      )}
    </div>
  );
}
