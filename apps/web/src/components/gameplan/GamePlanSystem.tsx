import { createContext, useContext, useState, useCallback } from 'react';

export type FormationType = 'OFFENSE' | 'DEFENSE';

export interface Formation {
  id: string;
  name: string;
  type: FormationType;
  description: string;
  runWeight: number; // 0.0 - 1.0, affects rush vs pass probability
  passWeight: number;
  blitzChance: number; // 0.0 - 1.0
  aggression: number; // 0.0 - 1.0, affects turnover risk vs big play chance
  recommendedPositions: string[];
  icon: string; // SVG path or emoji character
}

export interface GamePlanState {
  activeFormation: Formation | null;
  formations: Formation[];
}

interface GamePlanContextValue extends GamePlanState {
  setFormation: (formationId: string) => void;
  getFormationModifiers: () => { runWeight: number; passWeight: number; blitzChance: number; aggression: number };
}

const FORMATIONS: Formation[] = [
  // OFFENSE
  {
    id: 'spread',
    name: 'Spread Offense',
    type: 'OFFENSE',
    description: '4-5 wide receivers, spread the field. High tempo, balanced run-pass threat.',
    runWeight: 0.42,
    passWeight: 0.58,
    blitzChance: 0.15,
    aggression: 0.65,
    recommendedPositions: ['QB', 'RB', 'WR', 'WR', 'WR', 'TE'],
    icon: 'S',
  },
  {
    id: 'air-raid',
    name: 'Air Raid',
    type: 'OFFENSE',
    description: 'Pass-first, high tempo. Lots of quick throws, screens, and vertical shots.',
    runWeight: 0.30,
    passWeight: 0.70,
    blitzChance: 0.20,
    aggression: 0.80,
    recommendedPositions: ['QB', 'WR', 'WR', 'WR', 'WR', 'TE'],
    icon: 'A',
  },
  {
    id: 'power-run',
    name: 'Power Run',
    type: 'OFFENSE',
    description: 'I-formation, heavy personnel. Pound the rock, control the clock, wear down defenses.',
    runWeight: 0.65,
    passWeight: 0.35,
    blitzChance: 0.10,
    aggression: 0.45,
    recommendedPositions: ['QB', 'RB', 'RB', 'TE', 'TE', 'OL'],
    icon: 'P',
  },
  {
    id: 'west-coast',
    name: 'West Coast',
    type: 'OFFENSE',
    description: 'Short, high-percentage passes as an extension of the run game. Precision and timing.',
    runWeight: 0.35,
    passWeight: 0.65,
    blitzChance: 0.12,
    aggression: 0.55,
    recommendedPositions: ['QB', 'RB', 'WR', 'WR', 'TE', 'TE'],
    icon: 'W',
  },
  // DEFENSE
  {
    id: '4-3',
    name: '4-3 Defense',
    type: 'DEFENSE',
    description: '4 down linemen, 3 linebackers. Balanced against run and pass. Solid and reliable.',
    runWeight: 0.50,
    passWeight: 0.50,
    blitzChance: 0.15,
    aggression: 0.50,
    recommendedPositions: ['DL', 'DL', 'DL', 'DL', 'LB', 'LB', 'LB', 'CB', 'CB', 'S', 'S'],
    icon: '4',
  },
  {
    id: '3-4',
    name: '3-4 Defense',
    type: 'DEFENSE',
    description: '3 down linemen, 4 linebackers. Versatile, strong pass rush, disguised blitzes.',
    runWeight: 0.45,
    passWeight: 0.55,
    blitzChance: 0.30,
    aggression: 0.65,
    recommendedPositions: ['DL', 'DL', 'DL', 'LB', 'LB', 'LB', 'LB', 'CB', 'CB', 'S', 'S'],
    icon: '3',
  },
  {
    id: 'nickel',
    name: 'Nickel Defense',
    type: 'DEFENSE',
    description: '5 DBs, 2 LBs. Extra coverage against spread and passing offenses.',
    runWeight: 0.35,
    passWeight: 0.65,
    blitzChance: 0.25,
    aggression: 0.60,
    recommendedPositions: ['DL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'CB', 'S', 'S', 'S'],
    icon: 'N',
  },
  {
    id: 'dime',
    name: 'Dime Defense',
    type: 'DEFENSE',
    description: '6 DBs. Extreme pass coverage. Vulnerable to the run but locks down the air.',
    runWeight: 0.25,
    passWeight: 0.75,
    blitzChance: 0.35,
    aggression: 0.70,
    recommendedPositions: ['DL', 'DL', 'LB', 'CB', 'CB', 'CB', 'CB', 'S', 'S', 'S', 'S'],
    icon: 'D',
  },
];

const GamePlanContext = createContext<GamePlanContextValue | null>(null);

export const useGamePlan = () => {
  const ctx = useContext(GamePlanContext);
  if (!ctx) throw new Error('useGamePlan must be inside GamePlanProvider');
  return ctx;
};

export function GamePlanProvider({ children }: { children: React.ReactNode }) {
  const [activeFormation, setActiveFormation] = useState<Formation | null>(FORMATIONS[0]);

  const setFormation = useCallback((formationId: string) => {
    const formation = FORMATIONS.find(f => f.id === formationId) || null;
    setActiveFormation(formation);
  }, []);

  const getFormationModifiers = useCallback(() => {
    if (!activeFormation) {
      return { runWeight: 0.50, passWeight: 0.50, blitzChance: 0.15, aggression: 0.50 };
    }
    return {
      runWeight: activeFormation.runWeight,
      passWeight: activeFormation.passWeight,
      blitzChance: activeFormation.blitzChance,
      aggression: activeFormation.aggression,
    };
  }, [activeFormation]);

  const value: GamePlanContextValue = {
    activeFormation,
    formations: FORMATIONS,
    setFormation,
    getFormationModifiers,
  };

  return (
    <GamePlanContext.Provider value={value}>
      {children}
    </GamePlanContext.Provider>
  );
}
