import { useState, useEffect, useMemo } from 'react';
import { Shield, Plus, X, Coins, AlertCircle, Users, ChevronRight, Award, Home, Handshake, Wrench, Bus, RefreshCw, Lock, Activity, HeartPulse, Dumbbell, Zap, PersonStanding, Target, CheckCircle, Timer } from 'lucide-react';
import { getSportLabel, useGameStore } from '../store/gameStore';
import { useLeagueTierConfig } from '../hooks/useGameTime';
import PlayerCard, { type PlayerCardData } from '../components/player/PlayerCard';
import { useTraining } from '../components/training/TrainingSystem';

export type TeamPageTab = 'roster' | 'training' | 'medical' | 'equipment' | 'assets' | 'sponsorships';

const FOOTBALL_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'];
const FOOTBALL_POSITION_TARGETS: Record<string, number> = { QB: 2, RB: 4, WR: 6, TE: 3, OL: 8, DL: 6, LB: 5, CB: 5, S: 3, K: 1 };
const positionColor = (pos: string) => {
  if (['QB', 'RB', 'WR', 'TE'].includes(pos)) return 'bg-[#E94560]';
  if (['OL'].includes(pos)) return 'bg-yellow-400';
  if (['DL', 'LB'].includes(pos)) return 'bg-blue-400';
  if (['CB', 'S'].includes(pos)) return 'bg-green-400';
  return 'bg-purple-400';
};

const INJURY_SEVERITY: Record<string, { label: string; color: string }> = {
  HEALTHY: { label: 'Healthy', color: 'text-emerald-400' },
  WEEK_TO_WEEK: { label: 'Week-to-week', color: 'text-amber-400' },
  SEASON_ENDING: { label: 'Season ending', color: 'text-red-400' },
};

const OFFENSE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL'];
const DEFENSE_POSITIONS = ['DL', 'LB', 'CB', 'S', 'K'];

const FOCUS_LABELS: Record<string, string> = {
  ALL: 'All Players',
  POSITION_GROUP: 'Position Group',
  OFFENSE: 'Offense',
  DEFENSE: 'Defense',
  INDIVIDUAL: 'Individual',
};

const FOCUS_ICONS: Record<string, any> = {
  ALL: Users,
  POSITION_GROUP: Target,
  OFFENSE: Zap,
  DEFENSE: Shield,
  INDIVIDUAL: PersonStanding,
};

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

const normalizePosition = (position?: string | null): string => (position || 'UNK').toUpperCase();

const getPositionGuide = (position?: string | null) => POSITION_TRAINING_GUIDE[normalizePosition(position)] || { role: 'Player', needs: ['SPD', 'IQ', 'STR'], bestStats: ['pace', 'passing', 'physical'] };

const getPackageTargetText = (pkg: any): string => {
  if (pkg.focusType === 'POSITION_GROUP' && pkg.targetPosition) return `Targets ${pkg.targetPosition}`;
  if (pkg.focusType === 'OFFENSE') return 'Targets QB/RB/WR/TE/OL';
  if (pkg.focusType === 'DEFENSE') return 'Targets DL/LB/CB/S/K';
  if (pkg.focusType === 'INDIVIDUAL') return 'Targets selected player';
  return 'Targets full roster';
};

const getPackageFitText = (pkg: any, position?: string | null): string => {
  const normalized = normalizePosition(position);
  const guide = getPositionGuide(normalized);
  const boostStats = Object.entries(pkg.statBoosts || {})
    .filter(([, boost]) => safeNumber(boost) > 0)
    .map(([stat]) => stat);
  const matchingStats = boostStats.filter((stat) => guide.bestStats.includes(stat));
  const focusMatches = pkg.focusType === 'ALL' || pkg.focusType === 'INDIVIDUAL' || (pkg.focusType === 'POSITION_GROUP' && normalizePosition(pkg.targetPosition) === normalized) || (pkg.focusType === 'OFFENSE' && OFFENSE_POSITIONS.includes(normalized)) || (pkg.focusType === 'DEFENSE' && DEFENSE_POSITIONS.includes(normalized));
  if (!focusMatches) return `Does not target ${normalized}`;
  if (matchingStats.length === 0) return `Targets ${normalized}, but secondary fit`;
  return `Good for ${normalized}: boosts ${matchingStats.map((stat) => STAT_LABELS[stat] || stat.toUpperCase()).join(', ')}`;
};

const getTreatmentCost = (injury?: string | null): number => {
  const costs: Record<string, number> = { MINOR: 200, MODERATE: 500, MAJOR: 1500, WEEK_TO_WEEK: 200, SEASON_ENDING: 5000 };
  return costs[injury || 'MINOR'] || costs.MINOR;
};

export default function TeamPage({ initialTab }: { initialTab?: TeamPageTab } = {}) {
  const {
    teams,
    selectedTeamId,
    teamsLoading,
    wallet,
    setSelectedTeamId,
    refreshTeams,
    refreshWallet,
    activeSportId,
  } = useGameStore();

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0] || null;

  const [newTeamName, setNewTeamName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPlayerSelect, setShowPlayerSelect] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [addingPlayer, setAddingPlayer] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const [promotionData, setPromotionData] = useState<any>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TeamPageTab>(initialTab || 'roster');

  useEffect(() => {
    setActiveTab(initialTab || 'roster');
  }, [initialTab]);

  const [teamSponsorships, setTeamSponsorships] = useState<any[]>([]);
  const [sponsorOffers, setSponsorOffers] = useState<any[]>([]);
  const [sponsorLoading, setSponsorLoading] = useState(false);
  const [teamEquipment, setTeamEquipment] = useState<any[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<any[]>([]);
  const [equipLoading, setEquipLoading] = useState(false);
  const [purchasingEquipmentId, setPurchasingEquipmentId] = useState<string | null>(null);
  const [equipmentMessage, setEquipmentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { config: tierConfig } = useLeagueTierConfig();

  const [selectedTrainingPlayer, setSelectedTrainingPlayer] = useState<string>('');
  const [trainingMessage, setTrainingMessage] = useState<string | null>(null);
  const [medicalMessage, setMedicalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [treatingPlayerId, setTreatingPlayerId] = useState<string | null>(null);
  const [equipmentActionMsg, setEquipmentActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'train' | 'medical' | 'equip'>('overview');

  const {
    packages,
    activeTraining,
    isTraining,
    startTraining,
    cancelTraining,
    claimReward,
    playerFatigue,
    canTrain,
    completedSessions,
    loading: packagesLoading,
    refreshHistory: _refreshHistory,
  } = useTraining();

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const teamPlayers = useMemo(() => selectedTeam?.teamPlayers || [], [selectedTeam?.teamPlayers]);

  const injuredPlayers = useMemo(() => teamPlayers.filter((tp: any) => tp.player.injuryStatus && tp.player.injuryStatus !== 'HEALTHY'), [teamPlayers]);

  useEffect(() => {
    if (!selectedTeam) return;
    if (activeTab === 'sponsorships') loadSponsorships();
    else if (activeTab === 'equipment') loadEquipment();
  }, [activeTab, selectedTeam?.id]);

  const loadSponsorships = async () => {
    setSponsorLoading(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/sponsorships`, { headers });
      if (res.ok) {
        const data = await res.json();
        setTeamSponsorships(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load sponsorships:', err);
    } finally {
      setSponsorLoading(false);
    }
  };

  const refreshSponsorOffers = async () => {
    setSponsorLoading(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/sponsorships/refresh`, { method: 'POST', headers });
      if (res.ok) {
        const data = await res.json();
        setSponsorOffers(data.data?.offers || []);
      }
    } catch (err) {
      console.error('Failed to refresh offers:', err);
    } finally {
      setSponsorLoading(false);
    }
  };

  const acceptSponsorOffer = async (offer: any) => {
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/sponsorships`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorName: offer.sponsorName,
          tier: offer.tier,
          amountPerGame: offer.amountPerGame,
          amountPerSeason: offer.amountPerSeason,
          bonusRules: offer.bonusRules,
        }),
      });
      if (res.ok) {
        loadSponsorships();
        setSponsorOffers([]);
      }
    } catch (err) {
      console.error('Failed to accept offer:', err);
    }
  };

  const loadEquipment = async () => {
    setEquipLoading(true);
    try {
      const [equipRes, typesRes] = await Promise.all([
        fetch(`/api/equipment/team/${selectedTeam.id}`, { headers }),
        fetch('/api/equipment/types', { headers }),
      ]);
      if (equipRes.ok) {
        const data = await equipRes.json();
        setTeamEquipment(data.data || []);
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setEquipmentTypes(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load equipment:', err);
    } finally {
      setEquipLoading(false);
    }
  };

  const purchaseEquipment = async (equipmentTypeId: string) => {
    if (!selectedTeam || purchasingEquipmentId) return;
    setPurchasingEquipmentId(equipmentTypeId);
    setEquipmentMessage(null);
    try {
      const res = await fetch('/api/equipment/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ teamId: selectedTeam.id, equipmentTypeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEquipmentMessage({ type: 'error', text: data.message || `Purchase failed (${res.status})` });
        return;
      }
      setEquipmentMessage({ type: 'success', text: data.message || 'Equipment purchased' });
      if (data.data?.wallet) refreshWallet();
      await loadEquipment();
      setTimeout(() => setEquipmentMessage(null), 4000);
    } catch (err) {
      console.error('Failed to purchase equipment:', err);
      setEquipmentMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setPurchasingEquipmentId(null);
    }
  };

  const treatPlayer = async (playerId: string) => {
    if (!selectedTeam) return;
    setTreatingPlayerId(playerId);
    setMedicalMessage(null);
    try {
      const res = await fetch('/api/players/treat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMedicalMessage({ type: 'error', text: data.message || 'Treatment failed' });
        return;
      }
      setMedicalMessage({ type: 'success', text: data.data?.message || 'Player treated' });
      refreshTeams();
      refreshWallet();
      setTimeout(() => setMedicalMessage(null), 4000);
    } catch (err) {
      console.error('Failed to treat player:', err);
      setMedicalMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setTreatingPlayerId(null);
    }
  };

  const handleEquip = async (playerItemId: string, playerId: string) => {
    setEquipmentActionMsg(null);
    try {
      const res = await fetch('/api/equipment/equip', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerItemId, playerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setEquipmentActionMsg({ type: 'success', text: 'Item equipped!' });
        await refreshTeams();
        setTimeout(() => setEquipmentActionMsg(null), 3000);
      } else {
        setEquipmentActionMsg({ type: 'error', text: data.message || 'Failed to equip' });
      }
    } catch (err) {
      setEquipmentActionMsg({ type: 'error', text: 'Network error' });
    }
  };

  const handleUnequip = async (playerItemId: string) => {
    setEquipmentActionMsg(null);
    try {
      const res = await fetch('/api/equipment/unequip', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerItemId }),
      });
      const data = await res.json();
      if (res.ok) {
        setEquipmentActionMsg({ type: 'success', text: 'Item unequipped!' });
        await refreshTeams();
        setTimeout(() => setEquipmentActionMsg(null), 3000);
      } else {
        setEquipmentActionMsg({ type: 'error', text: data.message || 'Failed to unequip' });
      }
    } catch (err) {
      setEquipmentActionMsg({ type: 'error', text: 'Network error' });
    }
  };

  const handleStartTraining = async (pkg: any) => {
    if (!selectedTeam?.id) {
      setTrainingMessage('Select a team first');
      return;
    }
    if (pkg.focusType === 'INDIVIDUAL' && !selectedTrainingPlayer) {
      setTrainingMessage('Select a player for individual training');
      return;
    }
    const playerName = pkg.focusType === 'INDIVIDUAL' ? playerFatigue.find((p) => p.playerId === selectedTrainingPlayer)?.playerName : undefined;
    const check = canTrain(pkg.focusType === 'INDIVIDUAL' ? selectedTrainingPlayer : undefined);
    if (!check.ok) {
      setTrainingMessage(check.reason || 'Cannot train right now');
      return;
    }
    setTrainingMessage(null);
    const success = await startTraining({
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
      packageId: pkg.id,
      packageName: pkg.name,
      focusType: pkg.focusType,
      targetPlayerId: pkg.focusType === 'INDIVIDUAL' ? selectedTrainingPlayer : undefined,
      targetPlayerName: playerName,
      durationSeconds: 30,
      costGrid: pkg.costGrid,
      costCash: pkg.costCash,
      statBoosts: pkg.statBoosts,
    });
    if (!success) setTrainingMessage('Training could not be started');
  };

  const startIndividualTraining = async (pkg: any, playerId: string, playerName: string) => {
    if (!selectedTeam?.id) return;
    const check = canTrain(playerId);
    if (!check.ok) {
      setTrainingMessage(check.reason || 'Cannot train right now');
      return;
    }
    setTrainingMessage(null);
    const success = await startTraining({
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
      packageId: pkg.id,
      packageName: pkg.name,
      focusType: 'INDIVIDUAL',
      targetPlayerId: playerId,
      targetPlayerName: playerName,
      durationSeconds: 30,
      costGrid: pkg.costGrid,
      costCash: pkg.costCash,
      statBoosts: pkg.statBoosts,
    });
    if (!success) setTrainingMessage('Training could not be started');
  };

  const startDrawerGroupTraining = async (pkg: any, label: string) => {
    if (!selectedTeam?.id) return;
    const check = canTrain();
    if (!check.ok) {
      setTrainingMessage(check.reason || 'Cannot train right now');
      return;
    }
    setTrainingMessage(null);
    const success = await startTraining({
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
      packageId: pkg.id,
      packageName: `${pkg.name} — ${label}`,
      focusType: pkg.focusType,
      durationSeconds: 30,
      costGrid: pkg.costGrid,
      costCash: pkg.costCash,
      statBoosts: pkg.statBoosts,
    });
    if (!success) setTrainingMessage('Training could not be started');
  };

  useEffect(() => {
    if (teams.length === 0 && !teamsLoading) refreshTeams();
    if (wallet.cash === 0) refreshWallet();
  }, []);

  useEffect(() => {
    if (selectedTeam && selectedPlayer) {
      const updated = selectedTeam.teamPlayers.find(
        (tp: any) => tp.id === selectedPlayer.id || tp.player?.id === selectedPlayer.player?.id
      );
      if (updated) setSelectedPlayer(updated);
    }
  }, [selectedTeam?.teamPlayers]);

  useEffect(() => {
    if (selectedTeam) loadPromotionData();
  }, [selectedTeam?.id]);

  const loadPromotionData = async () => {
    if (!selectedTeam) return;
    setPromotionLoading(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/promotion-eligibility`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPromotionData(data.data);
      }
    } catch (err) {
      console.error('Failed to load promotion data:', err);
    } finally {
      setPromotionLoading(false);
    }
  };

  const promoteTeam = async () => {
    if (!selectedTeam) return;
    setPromotionLoading(true);
    setPromotionMessage(null);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/promote`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok && data.data?.newTier) {
        setPromotionMessage(`Promoted to ${data.data.newTier.replace(/_/g, ' ')}!`);
        refreshTeams();
        loadPromotionData();
      } else {
        setPromotionMessage(data.message || 'Promotion failed');
      }
    } catch (err) {
      console.error('Failed to promote team:', err);
      setPromotionMessage('Network error');
    } finally {
      setPromotionLoading(false);
      setTimeout(() => setPromotionMessage(null), 5000);
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreateError(null);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ name: newTeamName.trim(), sportId: activeSportId, formation: activeSportId === 'american-football' ? '11v11' : undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewTeamName('');
        setShowCreate(false);
        refreshTeams();
      } else {
        setCreateError(data.message || `Failed to create team (${res.status})`);
      }
    } catch (err) {
      console.error('Failed to create team:', err);
      setCreateError('Network error. Please try again.');
    }
  };

  const openPlayerSelect = async () => {
    setShowPlayerSelect(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await fetch(`/api/players?limit=50&sportId=${activeSportId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAvailablePlayers(data.data?.players || []);
      }
    } catch (err) {
      console.error('Failed to fetch players:', err);
    }
  };

  const addPlayerToTeam = async (playerId: string) => {
    if (!selectedTeam) return;
    setAddingPlayer(playerId);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ playerId, isStarter: false }),
      });
      const data = await res.json();
      if (res.ok) {
        const hiredName = data.data?.hired?.player?.name || 'Player';
        const replacement = data.data?.replacement;
        setAddSuccess(`${hiredName} hired! A new prospect has been added to the pool.`);
        setAvailablePlayers((prev) => {
          const filtered = prev.filter((p) => p.id !== playerId);
          if (replacement && !filtered.find((p) => p.id === replacement.id)) {
            return [...filtered, { ...replacement, currentPrice: replacement.overall * 100 }];
          }
          return filtered;
        });
        refreshTeams();
        refreshWallet();
        setTimeout(() => setAddSuccess(null), 4000);
      } else {
        setAddError(data.message || 'Failed to hire player');
      }
    } catch (err) {
      console.error('Failed to add player:', err);
      setAddError('Network error. Please try again.');
    } finally {
      setAddingPlayer(null);
    }
  };

  const topUpWallet = async () => {
    try {
      const res = await fetch('/api/economy/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ amount: 100000 }),
      });
      if (res.ok) refreshWallet();
      else {
        const data = await res.json();
        console.error('Top up failed:', data.message);
      }
    } catch (err) {
      console.error('Failed to top up wallet:', err);
    }
  };

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      COMMON: 'text-gray-400 border-gray-500/30',
      BRONZE: 'text-amber-600 border-amber-700/30',
      SILVER: 'text-slate-300 border-slate-300/30',
      GOLD: 'text-yellow-400 border-yellow-400/30',
      ELITE: 'text-purple-400 border-purple-400/30',
      LEGEND: 'text-red-400 border-red-400/30',
    };
    return colors[rarity] || colors.COMMON;
  };

  const getRarityBg = (rarity: string) => {
    const colors: Record<string, string> = {
      COMMON: 'bg-gray-500/10',
      BRONZE: 'bg-amber-700/10',
      SILVER: 'bg-slate-300/10',
      GOLD: 'bg-yellow-400/10',
      ELITE: 'bg-purple-400/10',
      LEGEND: 'bg-red-400/10',
    };
    return colors[rarity] || colors.COMMON;
  };

  const calculateTeamOVR = (team: any) => {
    if (!team.teamPlayers?.length) return 0;
    const total = team.teamPlayers.reduce((sum: number, tp: any) => sum + tp.player.overall, 0);
    return Math.round(total / team.teamPlayers.length);
  };

  const loading = teamsLoading;
  const ownedEquipmentTypeIds = new Set(teamEquipment.map((eq: any) => eq.equipmentTypeId));

  const renderPlayerWithHealth = (tp: any, className = '') => {
    const player = tp.player;
    const cardData: PlayerCardData = {
      id: player.id,
      name: player.name,
      position: player.position,
      overall: player.overall,
      age: player.age ?? 22,
      nationality: player.nationality ?? 'USA',
      rarity: player.rarity,
      pace: player.pace,
      shooting: player.shooting,
      passing: player.passing,
      dribbling: player.dribbling,
      defending: player.defending,
      physical: player.physical,
      isStarter: tp.isStarter,
    };
    const tierInfo = selectedTeam.tier && tierConfig ? tierConfig[selectedTeam.tier] : null;
    const isTooLow = tierInfo ? player.overall < tierInfo.minOverall : false;
    const isTooHigh = tierInfo ? player.overall > tierInfo.maxOverall : false;
    const isRestricted = isTooLow || isTooHigh;
    const health = safeNumber(player.health);
    const fatigue = safeNumber(player.fatigue);
    const injury = player.injuryStatus;
    const injuryWeeks = safeNumber(player.injuryWeeks);
    const injuryType = player.injuryType;
    const healthColor = health > 70 ? 'bg-emerald-400' : health > 40 ? 'bg-amber-400' : 'bg-red-400';
    const fatigueColor = fatigue < 50 ? 'bg-emerald-400' : fatigue < 80 ? 'bg-amber-400' : 'bg-red-400';
    return (
      <div key={tp.id} className={`relative ${className}`}>
        {isRestricted && (
          <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/90 text-white text-xs font-bold shadow-lg">
            <AlertCircle className="w-3 h-3" />
            {isTooHigh ? 'Too high' : 'Too low'}
          </div>
        )}
        <PlayerCard
          player={cardData}
          onClick={() => {
            setSelectedPlayer(tp);
            setDetailTab('overview');
          }}
          className={`card-lift ${isRestricted ? 'opacity-60' : ''}`}
        />
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-white/60 w-12">Health</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full ${healthColor} rounded-full`} style={{ width: `${health}%` }} />
            </div>
            <span className="text-white/80 w-8 text-right">{health}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-white/60 w-12">Fatigue</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full ${fatigueColor} rounded-full`} style={{ width: `${fatigue}%` }} />
            </div>
            <span className="text-white/80 w-8 text-right">{fatigue}%</span>
          </div>
          {injury && injury !== 'HEALTHY' && (
            <div className="flex items-center gap-2 text-xs rounded-lg bg-red-400/10 border border-red-400/20 px-2 py-1">
              <HeartPulse className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-300 font-medium">{INJURY_SEVERITY[injury]?.label || injury}{injuryType ? `: ${injuryType}` : ''}{injuryWeeks > 0 ? ` (${injuryWeeks}w)` : ''}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTrainingTab = () => {
    if (!selectedTeam) return null;
    const selectedPlayerInfo = playerFatigue.find((p) => p.playerId === selectedTrainingPlayer);

    return (
      <div className="space-y-6">
        {trainingMessage && (
          <div className={`rounded-xl p-4 text-sm ${trainingMessage.includes('complete') || trainingMessage.includes('finished') ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-200' : 'bg-red-400/10 border border-red-400/20 text-red-200'}`}>
            {trainingMessage}
          </div>
        )}

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
                    {activeTraining.focusType === 'INDIVIDUAL' ? `Training ${activeTraining.targetPlayerName}` : FOCUS_LABELS[activeTraining.focusType]}
                  </div>
                </div>
              </div>
              <button onClick={cancelTraining} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors">Cancel</button>
            </div>
            <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#E94560] to-amber-400 transition-all duration-1000 rounded-full" style={{ width: `${activeTraining.progress}%` }} />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-white/40">{Math.round(activeTraining.progress)}% complete</span>
              <span className="text-xs text-white/40">{Math.ceil(activeTraining.durationSeconds - (Date.now() - activeTraining.startedAt) / 1000)}s remaining</span>
            </div>
          </div>
        )}

        {activeTraining?.status === 'completed' && (
          <div className="glass-card p-5 border-emerald-400/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="font-bold text-white">Training Complete!</div>
                  <div className="text-sm text-emerald-400">{activeTraining.packageName} finished successfully</div>
                </div>
              </div>
              <button onClick={claimReward} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-500/30 transition-colors">Claim & Continue</button>
            </div>
          </div>
        )}

        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Dumbbell className="w-4 h-4 text-[#E94560]" />
            Select Player (Individual Training)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {playerFatigue.map((p) => {
              const position = normalizePosition(p.position);
              const guide = getPositionGuide(position);
              const disabled = p.fatigue >= 90;
              const selected = selectedTrainingPlayer === p.playerId;
              return (
                <button
                  key={p.playerId}
                  onClick={() => setSelectedTrainingPlayer(selected ? '' : p.playerId)}
                  disabled={disabled}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all ${selected ? 'border-[#E94560]/70 bg-[#E94560]/25 text-white shadow-glow' : disabled ? 'border-white/5 bg-white/5 text-white/25 cursor-not-allowed' : 'border-cyan-200/10 bg-slate-900/70 text-slate-200 hover:border-cyan-200/40 hover:bg-cyan-400/10 hover:text-white'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-bold">{p.playerName}</span>
                    <span className="rounded-md border border-cyan-200/30 bg-cyan-400/15 px-2 py-0.5 text-xs font-black text-cyan-100">{position}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300">{p.fatigue}% fatigue • best: {guide.needs.join(' / ')}</div>
                </button>
              );
            })}
          </div>
          {selectedPlayerInfo && (
            <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 inline-block">
              Selected {normalizePosition(selectedPlayerInfo.position)} • train {getPositionGuide(selectedPlayerInfo.position).needs.join(' / ')}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {packagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E94560]" />
            </div>
          ) : (
            packages.map((pkg: any) => {
              const FocusIcon = FOCUS_ICONS[pkg.focusType] || Users;
              const costGrid = safeNumber(pkg.costGrid);
              const costCash = safeNumber(pkg.costCash);
              const canAfford = (wallet.dynTokens ?? 0) >= costGrid && (wallet.cash ?? 0) >= costCash;
              const check = canTrain(pkg.focusType === 'INDIVIDUAL' ? selectedTrainingPlayer : undefined);
              const selectedFitText = selectedPlayerInfo ? getPackageFitText(pkg, selectedPlayerInfo.position) : null;
              return (
                <div key={pkg.id} className={`glass-card p-5 border transition-all ${isTraining ? 'opacity-50 border-white/5' : 'border-white/10 hover:border-white/20'}`}>
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
                    <span className="rounded-lg border border-cyan-200/20 bg-cyan-400/10 px-2 py-1 text-xs font-bold text-cyan-100">{getPackageTargetText(pkg)}</span>
                    {selectedFitText && (
                      <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${selectedFitText.startsWith('Good') ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : selectedFitText.startsWith('Does not') ? 'border-amber-300/25 bg-amber-400/10 text-amber-100' : 'border-white/10 bg-white/5 text-slate-200'}`}>
                        {selectedFitText}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {Object.entries(pkg.statBoosts || {}).map(([stat, boost]) => (boost && typeof boost === 'number' && boost > 0 ? (
                      <span key={stat} className="text-xs bg-white/5 rounded-lg px-2 py-1 text-emerald-400">+{boost} {STAT_LABELS[stat] || stat.toUpperCase()}</span>
                    ) : null))}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="space-y-1">
                      {costGrid > 0 && <div className="text-sm text-purple-400 font-bold">{formatNumber(costGrid)} DYN</div>}
                      {costCash > 0 && <div className="text-sm text-[#FFD700] font-bold">{formatNumber(costCash)} CASH</div>}
                      {costGrid === 0 && costCash === 0 && <div className="text-sm text-emerald-400 font-bold">Free</div>}
                    </div>
                    <button
                      onClick={() => handleStartTraining(pkg)}
                      disabled={isTraining || !canAfford || !selectedTeam.id || !check.ok}
                      className="px-4 py-2 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-medium text-sm hover:shadow-glow transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTraining ? 'Training...' : 'Start Training'}
                    </button>
                  </div>
                  {!canAfford && selectedTeam.id && <p className="text-xs text-red-300 mt-2">Not enough funds</p>}
                  {!check.ok && selectedTeam.id && <p className="text-xs text-amber-300 mt-2">{check.reason}</p>}
                </div>
              );
            })
          )}
        </div>

        {completedSessions.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Recent Sessions</h3>
            <div className="space-y-2">
              {completedSessions.slice(0, 10).map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-white font-medium">{session.trainingPackage?.name || 'Training'}</span>
                      <span className="text-white/40"> — {session.player?.name || 'Team'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {Object.entries(session.statImprovements || {}).map(([stat, boost]) => (boost && typeof boost === 'number' && boost > 0 ? <span key={stat} className="text-xs text-emerald-400">+{boost} {stat}</span> : null))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMedicalTab = () => {
    if (!selectedTeam) return null;

    const treatCost = getTreatmentCost;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><HeartPulse className="w-5 h-5 text-red-400" /> Medical Center</h3>
          <div className="text-sm text-white/40">{injuredPlayers.length} injured</div>
        </div>

        {medicalMessage && (
          <div className={`rounded-xl border p-3 text-sm ${medicalMessage.type === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
            {medicalMessage.text}
          </div>
        )}

        {injuredPlayers.length === 0 ? (
          <div className="glass-card p-12 text-center border-2 border-dashed border-white/10">
            <HeartPulse className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">Roster is healthy</p>
            <p className="text-white/30 text-sm">No medical treatment needed right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {injuredPlayers.map((tp: any) => {
              const player = tp.player;
              const severity = player.injuryStatus;
              const cost = treatCost(severity);
              const canAfford = (wallet.cash ?? 0) >= cost;
              const isTreating = treatingPlayerId === player.id;
              return (
                <div key={tp.id} className="glass-card p-4 border border-red-400/20">
                  {renderPlayerWithHealth(tp, 'mb-3')}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div className="text-sm text-[#FFD700] font-bold">{cost.toLocaleString()} CASH</div>
                    <button
                      onClick={() => treatPlayer(player.id)}
                      disabled={isTreating || !canAfford}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTreating ? 'Treating...' : 'Treat'}
                    </button>
                  </div>
                  {!canAfford && <p className="text-xs text-red-300 mt-2">Not enough CASH</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderEquipmentTab = () => {
    if (!selectedTeam) return null;

    const allPlayerItems = teamPlayers.flatMap((tp: any) => (tp.player.playerItems || []).map((pi: any) => ({ ...pi, player: tp.player })));
    const equippedItems = allPlayerItems.filter((pi: any) => pi.equipped);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Wrench className="w-5 h-5 text-[#FFD700]" /> Equipment</h3>
        </div>

        {equipmentMessage && (
          <div className={`rounded-xl border p-3 text-sm ${equipmentMessage.type === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
            {equipmentMessage.text}
          </div>
        )}
        {equipmentActionMsg && (
          <div className={`rounded-xl border p-3 text-sm ${equipmentActionMsg.type === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
            {equipmentActionMsg.text}
          </div>
        )}

        {equipLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E94560]" />
          </div>
        ) : (
          <>
            {equippedItems.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white/40 uppercase tracking-wider">Equipped ({equippedItems.length})</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {equippedItems.map((pi: any) => (
                    <div key={pi.id} className="glass-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center"><Wrench className="w-4 h-4 text-white/40" /></div>
                          <div>
                            <div className="font-medium text-white">{pi.item.name}</div>
                            <div className="text-xs text-white/30">{pi.player.name} • {pi.item.slot}</div>
                          </div>
                        </div>
                        <button onClick={() => handleUnequip(pi.id)} className="px-2 py-1 bg-white/5 text-white/60 rounded-lg text-xs hover:bg-white/10 transition-colors">Unequip</button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(pi.item.statBoosts || {}).map(([stat, boost]) => (boost && typeof boost === 'number' && boost > 0 ? (
                          <span key={stat} className="text-xs bg-emerald-400/10 text-emerald-400 rounded-lg px-2 py-0.5">+{boost} {STAT_LABELS[stat] || stat.toUpperCase()}</span>
                        ) : null))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white/40 uppercase tracking-wider">Team Inventory</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {teamPlayers.map((tp: any) => {
                  const player = tp.player;
                  const items = player.playerItems || [];
                  return (
                    <div key={player.id} className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-2 h-2 rounded-full ${positionColor(player.position)}`} />
                        <span className="text-sm font-bold text-white">{player.name}</span>
                        <span className="text-xs text-white/40 ml-auto">{player.position}</span>
                      </div>
                      {items.length === 0 ? (
                        <p className="text-xs text-white/30">No items owned</p>
                      ) : (
                        <div className="space-y-2">
                          {items.map((pi: any) => (
                            <div key={pi.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                              <div className="text-xs">
                                <div className="text-white font-medium">{pi.item.name}</div>
                                <div className="text-white/40">{pi.item.slot} • {pi.item.rarity}</div>
                              </div>
                              <button
                                onClick={() => pi.equipped ? handleUnequip(pi.id) : handleEquip(pi.id, player.id)}
                                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${pi.equipped ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#E94560] text-white hover:bg-[#E94560]/80'}`}
                              >
                                {pi.equipped ? 'Equipped' : 'Equip'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {equipmentTypes.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white/40 uppercase tracking-wider">Available</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {equipmentTypes.map((type: any) => {
                    const isOwned = ownedEquipmentTypeIds.has(type.id);
                    const cashCost = type.baseCostCash ?? 0;
                    const dynCost = type.baseCostGrid ?? 0;
                    const canAfford = (wallet.cash ?? 0) >= cashCost && (wallet.dynTokens ?? 0) >= dynCost;
                    const isPurchasing = purchasingEquipmentId === type.id;
                    return (
                      <div key={type.id} className={`glass-card p-4 ${isOwned ? 'border-emerald-400/20' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-white">{type.name}</div>
                          <div className="text-xs text-white/30">{type.category}</div>
                        </div>
                        <div className="text-sm text-white/40 mb-3">{type.description}</div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-[#FFD700]">
                            {cashCost.toLocaleString()} CASH{dynCost > 0 ? ` + ${dynCost.toLocaleString()} DYN` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => purchaseEquipment(type.id)}
                            disabled={isOwned || !canAfford || isPurchasing || !!purchasingEquipmentId}
                            className="px-3 py-1.5 bg-[#E94560] text-white rounded-lg text-xs font-medium hover:bg-[#E94560]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isOwned ? 'Owned' : isPurchasing ? 'Buying...' : canAfford ? 'Purchase' : 'Need Funds'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!equipLoading && teamEquipment.length === 0 && equipmentTypes.length === 0 && (
              <div className="glass-card p-12 text-center border-2 border-dashed border-white/10">
                <Wrench className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">No equipment available</p>
                <p className="text-white/30 text-sm">Equipment types will be added soon</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#E94560]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            MY <span className="text-[#E94560]">TEAM</span>
          </h1>
          <p className="text-white/40 mt-1">Active sport: {getSportLabel(activeSportId)}. Build your roster, train players, manage injuries, and equip your squad.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-black/30 border border-[#FFD700]/20 rounded-xl">
            <Coins className="w-5 h-5 text-[#FFD700]" />
            <span className="text-lg font-mono font-bold text-[#FFD700]">{wallet.cash.toLocaleString()}</span>
            <span className="text-xs text-[#FFD700]/60">CASH</span>
          </div>
          <button
            onClick={topUpWallet}
            className="px-3 py-2 bg-[#E94560]/10 border border-[#E94560]/30 text-[#E94560] rounded-xl text-sm font-medium hover:bg-[#E94560]/20 transition-colors"
          >
            +100K
          </button>
        </div>
      </div>

      {addError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {addError}
        </div>
      )}
      {addSuccess && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
          {addSuccess}
        </div>
      )}

      {teams.length === 0 && (
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#E94560]/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-[#E94560]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Create Your First Team</h2>
          <p className="text-white/40 mb-6 max-w-md mx-auto">
            Build a football roster, fill key positions, and compete in weekly games to climb the leaderboard.
          </p>
          <div className="flex items-center gap-4 justify-center mb-6">
            <div className="text-center">
              <div className="text-2xl font-black text-[#E94560]">43</div>
              <div className="text-xs text-white/30">Roster Spots</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <div className="text-2xl font-black text-[#FFD700]">∞</div>
              <div className="text-xs text-white/30">Games</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <div className="text-2xl font-black text-purple-400">#1</div>
              <div className="text-xs text-white/30">Rank</div>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-8 py-3 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-bold text-lg hover:shadow-glow-lg transition-shadow"
          >
            Create Your First Team
          </button>
        </div>
      )}

      {teams.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Your Teams</h3>
                {teams.length < 3 && (
                  <button onClick={() => setShowCreate(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <Plus className="w-4 h-4 text-[#E94560]" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {teams.map((team) => {
                  const isSelected = selectedTeam?.id === team.id;
                  const teamOVR = calculateTeamOVR(team);
                  return (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${
                        isSelected ? 'bg-[#E94560]/10 border-[#E94560]/30' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-white text-sm">{team.name}</div>
                        {isSelected && <ChevronRight className="w-4 h-4 text-[#E94560]" />}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                        <span>OVR {teamOVR || '—'}</span>
                        <span>{team.teamPlayers?.length || 0}/43</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedTeam && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Team Stats</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Overall Rating</span>
                    <span className="text-lg font-black text-[#E94560]">{calculateTeamOVR(selectedTeam) || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Record</span>
                    <span className="text-sm font-bold text-white">{selectedTeam.wins}-{selectedTeam.losses}-{selectedTeam.draws}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Points</span>
                    <span className="text-sm font-bold text-[#FFD700]">{selectedTeam.points}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Roster Size</span>
                    <span className="text-sm font-bold text-white">{selectedTeam.teamPlayers?.length || 0}/25</span>
                  </div>
                </div>
              </div>
            )}

            {selectedTeam && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">League Promotion</h3>
                {promotionLoading && !promotionData ? (
                  <div className="animate-pulse h-16 bg-white/5 rounded-lg" />
                ) : promotionData ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/40">Current Tier</span>
                      <span className="text-sm font-bold text-white">{promotionData.currentTier.replace(/_/g, ' ')}</span>
                    </div>
                    {promotionData.nextTier ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/40">Next Tier</span>
                          <span className="text-sm font-bold text-[#E94560]">{promotionData.nextTier.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2 mt-2">
                          <div className="bg-gradient-to-r from-[#E94560] to-[#FF6B6B] h-2 rounded-full transition-all" style={{ width: `${promotionData.progress}%` }} />
                        </div>
                        <div className="text-xs text-white/30 text-center">{promotionData.progress}% to promotion</div>
                        <div className="space-y-1 mt-2">
                          {Object.entries(promotionData.checks || {}).map(([key, check]: [string, any]) => (
                            <div key={key} className="flex items-center justify-between text-xs">
                              <span className={check.met ? 'text-white/40' : 'text-red-300'}>{key === 'teamOverall' ? 'Team OVR' : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                              <span className={check.met ? 'text-emerald-400' : 'text-red-400'}>{check.met ? '✓' : '✗'} {check.value}/{check.required}</span>
                            </div>
                          ))}
                        </div>
                        {promotionData.eligible ? (
                          <button onClick={promoteTeam} disabled={promotionLoading} className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white rounded-xl font-bold text-sm hover:shadow-glow transition-shadow disabled:opacity-50">
                            <Award className="w-4 h-4 inline mr-1" /> Promote Team
                          </button>
                        ) : (
                          <div className="text-xs text-white/30 mt-2 text-center">Complete all requirements to promote</div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-2">
                        <div className="text-lg font-black text-[#FFD700]">PRO</div>
                        <div className="text-xs text-white/30">Maximum tier reached</div>
                      </div>
                    )}
                    {promotionMessage && (
                      <div className={`text-xs text-center mt-2 ${promotionMessage.includes('Promoted') ? 'text-emerald-400' : 'text-red-400'}`}>{promotionMessage}</div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-6">
            {selectedTeam && (
              <>
                <div className="glass-card p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#E94560]/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#E94560] to-purple-600 rounded-2xl flex items-center justify-center shadow-glow">
                          <Shield className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white">{selectedTeam.name}</h2>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-white/40">{selectedTeam.teamPlayers?.length || 0} players</span>
                            <span className="text-sm text-white/20">•</span>
                            <span className="text-sm text-[#FFD700]">{selectedTeam.points} pts</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-black text-[#E94560]">{calculateTeamOVR(selectedTeam) || '—'}</div>
                        <div className="text-xs text-white/30 uppercase tracking-wider">Team OVR</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        <span className="text-sm text-white/40">{selectedTeam.wins} Wins</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <span className="text-sm text-white/40">{selectedTeam.draws} Ties</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <span className="text-sm text-white/40">{selectedTeam.losses} Losses</span>
                      </div>
                      {selectedTeam.tier && tierConfig && tierConfig[selectedTeam.tier] && (
                        <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span className="text-xs text-amber-100 font-medium">
                            {selectedTeam.tier.replace(/_/g, ' ')}: OVR {tierConfig[selectedTeam.tier].minOverall}-{tierConfig[selectedTeam.tier].maxOverall}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[
                    { key: 'roster', label: 'Roster', icon: Users },
                    { key: 'training', label: 'Training', icon: Dumbbell },
                    { key: 'medical', label: 'Medical', icon: HeartPulse },
                    { key: 'equipment', label: 'Equipment', icon: Wrench },
                    { key: 'assets', label: 'Assets', icon: Home },
                    { key: 'sponsorships', label: 'Sponsorships', icon: Handshake },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                          isActive ? 'bg-[#E94560]/20 text-[#E94560] border border-[#E94560]/30' : 'bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/60'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {activeTab === 'roster' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#E94560]" />
                        Roster ({selectedTeam.teamPlayers?.length || 0}/43)
                      </h3>
                      {(selectedTeam.teamPlayers?.length || 0) < 43 && (
                        <button onClick={openPlayerSelect} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-medium hover:shadow-glow transition-shadow">
                          <Plus className="w-4 h-4" />
                          {selectedTeam.teamPlayers?.length === 0 ? 'Hire Your First Player' : 'Hire Player'}
                        </button>
                      )}
                    </div>

                    {selectedTeam.teamPlayers?.length === 0 ? (
                      <div className="glass-card p-12 text-center border-2 border-dashed border-white/10">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Users className="w-8 h-8 text-white/20" />
                        </div>
                        <p className="text-white font-medium mb-1">No players yet</p>
                        <p className="text-white/30 text-sm">Click "Hire Player" to add your first roster player</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setPositionFilter('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${positionFilter === 'ALL' ? 'bg-[#E94560] text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                          >All</button>
                          {['OFFENSE', 'DEFENSE', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'].map((pos) => (
                            <button
                              key={pos}
                              onClick={() => setPositionFilter(pos === positionFilter ? 'ALL' : pos)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${positionFilter === pos ? 'bg-[#E94560] text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                            >{pos}</button>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                          {selectedTeam.teamPlayers
                            .filter((tp: any) => {
                              if (positionFilter === 'ALL') return true;
                              const p = (tp.player.position || '').toUpperCase();
                              if (positionFilter === 'OFFENSE') return OFFENSE_POSITIONS.includes(p);
                              if (positionFilter === 'DEFENSE') return DEFENSE_POSITIONS.includes(p);
                              return p === positionFilter;
                            })
                            .map((tp: any) => renderPlayerWithHealth(tp))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'training' && renderTrainingTab()}
                {activeTab === 'medical' && renderMedicalTab()}
                {activeTab === 'equipment' && renderEquipmentTab()}

                {activeTab === 'assets' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-4">Stadium</h3>
                      {selectedTeam.venue ? (
                        <div className="glass-card p-6">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#E94560]/20 to-purple-600/20 rounded-xl flex items-center justify-center">
                              <Home className="w-6 h-6 text-[#E94560]" />
                            </div>
                            <div>
                              <div className="font-bold text-white">{selectedTeam.venue.name}</div>
                              <div className="text-sm text-white/40">{selectedTeam.venue.tier?.replace(/_/g, ' ') || 'Standard'}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="text-center bg-white/5 rounded-xl p-3">
                              <div className="text-xl font-bold text-white">{selectedTeam.venue.capacity?.toLocaleString()}</div>
                              <div className="text-xs text-white/30">Capacity</div>
                            </div>
                            <div className="text-center bg-white/5 rounded-xl p-3">
                              <div className="text-xl font-bold text-[#FFD700]">${selectedTeam.venue.ticketPrice}</div>
                              <div className="text-xs text-white/30">Ticket Price</div>
                            </div>
                            <div className="text-center bg-white/5 rounded-xl p-3">
                              <div className="text-xl font-bold text-white">{selectedTeam.venue.condition}%</div>
                              <div className="text-xs text-white/30">Condition</div>
                            </div>
                            <div className="text-center bg-white/5 rounded-xl p-3">
                              <div className="text-xl font-bold text-white">{selectedTeam.venue.prestige}</div>
                              <div className="text-xs text-white/30">Prestige</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="glass-card p-8 text-center border-2 border-dashed border-white/10">
                          <Home className="w-8 h-8 text-white/20 mx-auto mb-3" />
                          <p className="text-white/40">No venue assigned</p>
                        </div>
                      )}

                      <div className="mt-4 space-y-3">
                        <h4 className="text-sm font-bold text-white/40 uppercase tracking-wider">Upgrade Stadium</h4>
                        {[
                          { tier: 'PARK_FIELD', name: 'Community Park', capacity: 5000, ticketPrice: 10, cost: 5000, prestige: 10 },
                          { tier: 'COMMUNITY', name: 'Community Stadium', capacity: 12000, ticketPrice: 15, cost: 25000, prestige: 25 },
                          { tier: 'SMALL_STADIUM', name: 'Small Stadium', capacity: 35000, ticketPrice: 25, cost: 100000, prestige: 40 },
                          { tier: 'REGIONAL', name: 'Regional Stadium', capacity: 25000, ticketPrice: 35, cost: 300000, prestige: 50 },
                          { tier: 'PRO', name: 'Pro Stadium', capacity: 65000, ticketPrice: 50, cost: 1000000, prestige: 65 },
                          { tier: 'ELITE', name: 'Elite Stadium', capacity: 100000, ticketPrice: 75, cost: 5000000, prestige: 85 },
                        ].map((venue) => (
                          <div key={venue.tier} className="glass-card p-4 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-white">{venue.name}</div>
                              <div className="text-xs text-white/40">{venue.capacity.toLocaleString()} seats • ${venue.ticketPrice}/ticket • Prestige {venue.prestige}</div>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/teams/${selectedTeam.id}/venue`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', ...headers },
                                    body: JSON.stringify({ name: venue.name, tier: venue.tier, capacity: venue.capacity, ticketPrice: venue.ticketPrice, cost: venue.cost }),
                                  });
                                  if (res.ok) { refreshTeams(); refreshWallet(); }
                                } catch (err) { console.error('Failed to buy venue:', err); }
                              }}
                              className="px-4 py-2 bg-[#E94560] text-white rounded-lg text-sm font-medium hover:bg-[#E94560]/80 transition-colors"
                            >
                              {venue.cost.toLocaleString()} CASH
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white mb-4">Transportation</h3>
                      {selectedTeam.transportationAssets && selectedTeam.transportationAssets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedTeam.transportationAssets.map((transport: any) => (
                            <div key={transport.id} className="glass-card p-4">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center"><Bus className="w-5 h-5 text-white/40" /></div>
                                <div>
                                  <div className="font-medium text-white">{transport.name}</div>
                                  <div className="text-xs text-white/30">{transport.tier}</div>
                                </div>
                              </div>
                              <div className="flex gap-4 text-xs text-white/40">
                                <span>Op. Cost: {transport.operatingCost} CASH</span>
                                <span>Fatigue: -{transport.fatigueReduction}%</span>
                                <span>Prestige: +{transport.prestige}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="glass-card p-8 text-center border-2 border-dashed border-white/10">
                          <Bus className="w-8 h-8 text-white/20 mx-auto mb-3" />
                          <p className="text-white/40">No transportation assigned</p>
                        </div>
                      )}

                      <div className="mt-4 space-y-3">
                        <h4 className="text-sm font-bold text-white/40 uppercase tracking-wider">Upgrade Transportation</h4>
                        {[
                          { tier: 'CARPOOL', name: 'Carpool / Rental Vans', operatingCost: 100, fatigueReduction: 0, prestige: 0, cost: 2000 },
                          { tier: 'BUS', name: 'Team Bus', operatingCost: 300, fatigueReduction: 10, prestige: 5, cost: 10000 },
                          { tier: 'CHARTER', name: 'Team Charter', operatingCost: 1000, fatigueReduction: 20, prestige: 20, cost: 50000 },
                          { tier: 'LUXURY', name: 'Private Jet', operatingCost: 5000, fatigueReduction: 30, prestige: 50, cost: 250000 },
                        ].map((transport) => (
                          <div key={transport.tier} className="glass-card p-4 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-white">{transport.name}</div>
                              <div className="text-xs text-white/40">Op. Cost: {transport.operatingCost} CASH • Fatigue: -{transport.fatigueReduction}% • Prestige: +{transport.prestige}</div>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/teams/${selectedTeam.id}/transportation`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', ...headers },
                                    body: JSON.stringify({ name: transport.name, tier: transport.tier, operatingCost: transport.operatingCost, fatigueReduction: transport.fatigueReduction, prestige: transport.prestige, cost: transport.cost }),
                                  });
                                  if (res.ok) { refreshTeams(); refreshWallet(); }
                                } catch (err) { console.error('Failed to buy transportation:', err); }
                              }}
                              className="px-4 py-2 bg-[#E94560] text-white rounded-lg text-sm font-medium hover:bg-[#E94560]/80 transition-colors"
                            >
                              {transport.cost.toLocaleString()} CASH
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'sponsorships' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white">Sponsorships</h3>
                      <button onClick={refreshSponsorOffers} className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-xl text-sm hover:bg-white/10 transition-colors">
                        <RefreshCw className="w-4 h-4" /> Find Offers
                      </button>
                    </div>

                    {sponsorLoading && (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E94560]" />
                      </div>
                    )}

                    {!sponsorLoading && teamSponsorships.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-white/40 uppercase tracking-wider">Active ({teamSponsorships.length}/3)</h4>
                        {teamSponsorships.map((s: any) => (
                          <div key={s.id} className="glass-card p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-bold text-white">{s.sponsorName}</div>
                                <div className="text-sm text-white/40">{s.amountPerGame.toLocaleString()} CASH/game • {s.amountPerSeason.toLocaleString()} CASH/season</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-emerald-400">Active</div>
                                {s.bonusRules?.winBonus && <div className="text-xs text-[#FFD700]">Win Bonus: {s.bonusRules.winBonus.toLocaleString()}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!sponsorLoading && sponsorOffers.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-white/40 uppercase tracking-wider">Available Offers</h4>
                        {sponsorOffers.map((offer: any, idx: number) => (
                          <div key={idx} className="glass-card p-4 border border-[#FFD700]/20">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-bold text-white">{offer.sponsorName}</div>
                                <div className="text-xs text-white/40">{offer.tier}</div>
                                <div className="text-sm text-[#FFD700]">{offer.amountPerGame.toLocaleString()} CASH/game • {offer.amountPerSeason.toLocaleString()} CASH/season</div>
                              </div>
                              <button onClick={() => acceptSponsorOffer(offer)} className="px-4 py-2 bg-[#E94560] text-white rounded-lg text-sm font-medium hover:bg-[#E94560]/80 transition-colors">Accept</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!sponsorLoading && teamSponsorships.length === 0 && sponsorOffers.length === 0 && (
                      <div className="glass-card p-12 text-center border-2 border-dashed border-white/10">
                        <Handshake className="w-8 h-8 text-white/20 mx-auto mb-3" />
                        <p className="text-white font-medium mb-1">No sponsorships yet</p>
                        <p className="text-white/30 text-sm">Click "Find Offers" to discover sponsors</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Create New Team</h3>
              <button onClick={() => { setShowCreate(false); setCreateError(null); }} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white/40" /></button>
            </div>
            {createError && <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200 mb-4">{createError}</div>}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/40 mb-1 block">Team Name</label>
                <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g., Oshkosh Gridiron" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#E94560] focus:ring-1 focus:ring-[#E94560]/30 transition-all" />
              </div>
              <button onClick={createTeam} disabled={!newTeamName.trim()} className="w-full px-4 py-3 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-xl font-bold hover:shadow-glow transition-shadow disabled:opacity-50">Create Team</button>
            </div>
          </div>
        </div>
      )}

      {showPlayerSelect && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card w-full max-w-6xl p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Hire Player</h3>
                <p className="text-sm text-white/40">Available players with their hire costs</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 border border-[#FFD700]/20 rounded-lg">
                  <Coins className="w-4 h-4 text-[#FFD700]" />
                  <span className="text-sm font-bold text-[#FFD700]">{wallet.cash.toLocaleString()}</span>
                </div>
                <button onClick={topUpWallet} className="px-3 py-1.5 bg-[#E94560]/10 border border-[#E94560]/30 text-[#E94560] rounded-lg text-xs font-medium hover:bg-[#E94560]/20 transition-colors">+100K</button>
                <button onClick={() => setShowPlayerSelect(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white/40" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <div className="glass-card p-4">
                  <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Current Roster</h4>
                  <div className="space-y-2 mb-4">
                    {FOOTBALL_POSITIONS.map((pos) => {
                      const count = selectedTeam?.teamPlayers?.filter((tp: any) => tp.player.position === pos).length || 0;
                      const maxCount = FOOTBALL_POSITION_TARGETS[pos] || 2;
                      const isNeeded = count < maxCount;
                      return (
                        <div key={pos} className={`flex items-center justify-between p-2 rounded-lg ${isNeeded ? 'bg-[#E94560]/10 border border-[#E94560]/20' : 'bg-white/5'}`}>
                          <span className="text-sm font-medium text-white">{pos}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isNeeded ? 'text-[#E94560]' : 'text-green-400'}`}>{count}/{maxCount}</span>
                            {isNeeded && <span className="text-[10px] text-[#E94560]">NEED</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1 max-h-60 overflow-auto">
                    <div className="text-xs text-white/30 mb-2">{selectedTeam?.teamPlayers?.length || 0} players</div>
                    {selectedTeam?.teamPlayers?.map((tp: any) => (
                      <div key={tp.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${positionColor(tp.player.position)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">{tp.player.name}</div>
                          <div className="text-[10px] text-white/30">{tp.player.position} • OVR {tp.player.overall}</div>
                        </div>
                      </div>
                    )) || <div className="text-center py-4 text-white/20 text-xs">No players yet</div>}
                  </div>
                </div>
                <div className="glass-card p-4">
                  <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Roster Build</h4>
                  <div className="text-center">
                    <div className="text-2xl font-black text-[#E94560] mb-1">11v11</div>
                    <div className="text-xs text-white/30">Football Lineup</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                    <div className="text-[#E94560]">Skill</div>
                    <div className="text-blue-400">Defense</div>
                    <div className="text-yellow-400">Line</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="flex items-center gap-2 mb-4">
                  {['ALL', ...FOOTBALL_POSITIONS].map((pos) => {
                    const isActive = positionFilter === pos;
                    const posCount = pos === 'ALL' ? availablePlayers.length : availablePlayers.filter((p: any) => p.position === pos).length;
                    return (
                      <button
                        key={pos}
                        onClick={() => setPositionFilter(pos)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          isActive ? 'bg-[#E94560] text-white shadow-glow' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {pos} ({posCount})
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {availablePlayers
                    .filter((player) => positionFilter === 'ALL' || player.position === positionFilter)
                    .map((player) => {
                      const posCount = selectedTeam?.teamPlayers?.filter((tp: any) => tp.player.position === player.position).length || 0;
                      const maxCount = FOOTBALL_POSITION_TARGETS[player.position] || 2;
                      const isNeeded = posCount < maxCount;
                      return (
                        <div key={player.id} className={`glass-card p-4 border ${getRarityColor(player.rarity)} ${isNeeded ? 'ring-1 ring-[#E94560]/30' : ''}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-bold text-white">{player.name}</div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white/40">{player.position}</span>
                                {isNeeded && <span className="px-1.5 py-0.5 bg-[#E94560]/20 text-[#E94560] text-[10px] font-bold rounded">NEEDED</span>}
                              </div>
                            </div>
                            <div className={`px-2 py-1 rounded-lg text-xs font-bold ${getRarityBg(player.rarity)} ${getRarityColor(player.rarity).split(' ')[0]}`}>{player.rarity}</div>
                          </div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="text-center">
                              <div className="text-2xl font-black text-white">{player.overall}</div>
                              <div className="text-xs text-white/30">OVR</div>
                            </div>
                            <div className="flex-1 grid grid-cols-3 gap-1 text-xs">
                              {[
                                { label: 'SPD', value: player.pace },
                                { label: 'ARM', value: player.shooting },
                                { label: 'IQ', value: player.passing },
                                { label: 'AGI', value: player.dribbling },
                                { label: 'TCK', value: player.defending },
                                { label: 'STR', value: player.physical },
                              ].map((stat) => (
                                <div key={stat.label} className="text-center bg-white/5 rounded-lg py-1">
                                  <div className="font-bold text-white">{stat.value}</div>
                                  <div className="text-[10px] text-white/30">{stat.label}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-white/10">
                            <div className="text-lg font-black text-[#FFD700]">{player.currentPrice.toLocaleString()} CASH</div>
                            <button
                              onClick={() => addPlayerToTeam(player.id)}
                              disabled={addingPlayer === player.id || wallet.cash < player.currentPrice}
                              className="px-4 py-2 bg-gradient-to-r from-[#E94560] to-[#FF6B6B] text-white rounded-lg font-medium hover:shadow-glow transition-shadow disabled:opacity-50 text-sm"
                            >
                              {addingPlayer === player.id ? 'Hiring...' : 'Hire'}
                            </button>
                          </div>
                          {wallet.cash < player.currentPrice && <p className="text-xs text-red-300 mt-2">Not enough CASH</p>}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedPlayer(null)}>
          <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${positionColor(selectedPlayer.player.position)}`} />
                  {selectedPlayer.player.name}
                </h3>
                <p className="text-sm text-white/40 mt-1">
                  {selectedPlayer.player.position} • OVR {selectedPlayer.player.overall} • {selectedPlayer.player.rarity} • Age {selectedPlayer.player.age}
                </p>
              </div>
              <button onClick={() => setSelectedPlayer(null)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white/40" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <PlayerCard
                  player={{
                    id: selectedPlayer.player.id,
                    name: selectedPlayer.player.name,
                    position: selectedPlayer.player.position,
                    overall: selectedPlayer.player.overall,
                    age: selectedPlayer.player.age,
                    nationality: selectedPlayer.player.nationality,
                    rarity: selectedPlayer.player.rarity,
                    pace: selectedPlayer.player.pace,
                    shooting: selectedPlayer.player.shooting,
                    passing: selectedPlayer.player.passing,
                    dribbling: selectedPlayer.player.dribbling,
                    defending: selectedPlayer.player.defending,
                    physical: selectedPlayer.player.physical,
                    isStarter: selectedPlayer.isStarter,
                  }}
                  className="max-w-xs mx-auto"
                />
                <div className="glass-card p-4 space-y-3">
                  {[
                    { label: 'SPD', value: selectedPlayer.player.pace, color: 'bg-emerald-400' },
                    { label: 'ARM', value: selectedPlayer.player.shooting, color: 'bg-blue-400' },
                    { label: 'IQ', value: selectedPlayer.player.passing, color: 'bg-purple-400' },
                    { label: 'AGI', value: selectedPlayer.player.dribbling, color: 'bg-amber-400' },
                    { label: 'TCK', value: selectedPlayer.player.defending, color: 'bg-cyan-400' },
                    { label: 'STR', value: selectedPlayer.player.physical, color: 'bg-red-400' },
                  ].map((stat) => (
                    <div key={stat.label} className="space-y-1">
                      <div className="flex justify-between text-xs text-white/60">
                        <span>{stat.label}</span>
                        <span>{stat.value}</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${stat.color} rounded-full`} style={{ width: `${Math.min(100, stat.value)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 border-b border-white/10 pb-3 sm:grid-cols-4">
                  {[
                    { key: 'overview', label: 'Overview', icon: Activity },
                    { key: 'train', label: 'Train', icon: Dumbbell },
                    { key: 'medical', label: 'Medical', icon: HeartPulse },
                    { key: 'equip', label: 'Equip', icon: Wrench },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setDetailTab(tab.key as any)}
                      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wider transition-all ${detailTab === tab.key ? 'border-[#E94560] bg-[#E94560] text-white shadow-lg shadow-[#E94560]/20' : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10'}`}
                    >
                      <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                  ))}
                </div>

                {detailTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="glass-card p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <Activity className="w-4 h-4 text-emerald-400" /> Health: {safeNumber(selectedPlayer.player.health)}%
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${selectedPlayer.player.health > 70 ? 'bg-emerald-400' : selectedPlayer.player.health > 40 ? 'bg-amber-400' : 'bg-red-400'} rounded-full`} style={{ width: `${safeNumber(selectedPlayer.player.health)}%` }} />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <Zap className="w-4 h-4 text-amber-400" /> Fatigue: {safeNumber(selectedPlayer.player.fatigue)}%
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${selectedPlayer.player.fatigue < 50 ? 'bg-emerald-400' : selectedPlayer.player.fatigue < 80 ? 'bg-amber-400' : 'bg-red-400'} rounded-full`} style={{ width: `${safeNumber(selectedPlayer.player.fatigue)}%` }} />
                      </div>
                      {selectedPlayer.player.injuryStatus && selectedPlayer.player.injuryStatus !== 'HEALTHY' && (
                        <div className="rounded-lg bg-red-400/10 border border-red-400/20 p-3 text-sm text-red-200">
                          <HeartPulse className="w-4 h-4 inline mr-2" />
                          {INJURY_SEVERITY[selectedPlayer.player.injuryStatus]?.label || selectedPlayer.player.injuryStatus}
                          {selectedPlayer.player.injuryType ? ` — ${selectedPlayer.player.injuryType}` : ''}
                          {selectedPlayer.player.injuryWeeks > 0 ? ` (${selectedPlayer.player.injuryWeeks}w)` : ''}
                        </div>
                      )}
                    </div>

                    {selectedPlayer.player.injuryStatus && selectedPlayer.player.injuryStatus !== 'HEALTHY' && (
                      <button
                        onClick={() => treatPlayer(selectedPlayer.player.id)}
                        disabled={treatingPlayerId === selectedPlayer.player.id}
                        className="w-full px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {treatingPlayerId === selectedPlayer.player.id ? 'Treating...' : 'Treat Injury'}
                      </button>
                    )}
                  </div>
                )}

                {detailTab === 'train' && (
                  <div className="space-y-3">
                    {trainingMessage && (
                      <div className={`rounded-xl border p-3 text-sm ${trainingMessage.includes('complete') || trainingMessage.includes('started') || trainingMessage.includes('finished') ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                        {trainingMessage}
                      </div>
                    )}
                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Position-group quick actions</div>
                      <p className="mt-1 text-xs text-white/55">Use the selected player as context, then train their position room, offense/defense, or full roster.</p>
                    </div>
                    {packagesLoading ? (
                      <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E94560]" /></div>
                    ) : (
                      packages.filter((p: any) => p.focusType === 'INDIVIDUAL' || p.focusType === 'POSITION_GROUP' || p.focusType === 'OFFENSE' || p.focusType === 'DEFENSE' || p.focusType === 'ALL').map((pkg: any) => {
                        const costGrid = safeNumber(pkg.costGrid);
                        const costCash = safeNumber(pkg.costCash);
                        const canAfford = (wallet.dynTokens ?? 0) >= costGrid && (wallet.cash ?? 0) >= costCash;
                        const fit = getPackageFitText(pkg, selectedPlayer.player.position);
                        const normalizedPosition = normalizePosition(selectedPlayer.player.position);
                        const groupLabel = pkg.focusType === 'POSITION_GROUP'
                          ? `Train all ${pkg.targetPosition || normalizedPosition}s`
                          : pkg.focusType === 'OFFENSE'
                            ? 'Train offense'
                            : pkg.focusType === 'DEFENSE'
                              ? 'Train defense'
                              : pkg.focusType === 'ALL'
                                ? 'Train full roster'
                                : `Train ${selectedPlayer.player.name}`;
                        const runTraining = () => pkg.focusType === 'INDIVIDUAL'
                          ? startIndividualTraining(pkg, selectedPlayer.player.id, selectedPlayer.player.name)
                          : startDrawerGroupTraining(pkg, groupLabel);
                        return (
                          <div key={pkg.id} className="glass-card p-3 border border-white/10">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="font-bold text-white text-sm">{pkg.name}</div>
                              <div className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-white/45">{FOCUS_LABELS[pkg.focusType]}</div>
                            </div>
                            <p className="text-xs text-white/50 mb-2">{fit}</p>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs text-[#FFD700]">{costGrid > 0 ? `${costGrid} DYN` : ''} {costCash > 0 ? `${costCash} CASH` : 'Free'}</div>
                              <button
                                onClick={runTraining}
                                disabled={isTraining || !canAfford}
                                className="px-3 py-1.5 bg-[#E94560] text-white rounded-lg text-xs font-black hover:bg-[#E94560]/80 disabled:opacity-50"
                              >
                                {groupLabel}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {detailTab === 'medical' && (
                  <div className="space-y-3">
                    {medicalMessage && (
                      <div className={`rounded-xl border p-3 text-sm ${medicalMessage.type === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                        {medicalMessage.text}
                      </div>
                    )}
                    <div className="glass-card p-4 space-y-3 border border-red-400/15">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-black text-white">
                          <HeartPulse className="w-4 h-4 text-red-400" /> Health & Recovery
                        </div>
                        <div className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${selectedPlayer.player.injuryStatus && selectedPlayer.player.injuryStatus !== 'HEALTHY' ? 'bg-red-400/15 text-red-300' : 'bg-emerald-400/15 text-emerald-300'}`}>
                          {selectedPlayer.player.injuryStatus && selectedPlayer.player.injuryStatus !== 'HEALTHY' ? 'Needs treatment' : 'Healthy'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl bg-white/5 p-3">
                          <div className="text-white/40">Health</div>
                          <div className="mt-1 text-xl font-black text-white">{safeNumber(selectedPlayer.player.health)}%</div>
                        </div>
                        <div className="rounded-xl bg-white/5 p-3">
                          <div className="text-white/40">Fatigue</div>
                          <div className="mt-1 text-xl font-black text-white">{safeNumber(selectedPlayer.player.fatigue)}%</div>
                        </div>
                      </div>
                      {selectedPlayer.player.injuryStatus && selectedPlayer.player.injuryStatus !== 'HEALTHY' ? (
                        <div className="rounded-xl border border-red-400/25 bg-red-400/10 p-3">
                          <div className="text-sm font-bold text-red-100">
                            {INJURY_SEVERITY[selectedPlayer.player.injuryStatus]?.label || selectedPlayer.player.injuryStatus}
                            {selectedPlayer.player.injuryType ? ` — ${selectedPlayer.player.injuryType}` : ''}
                          </div>
                          <div className="mt-1 text-xs text-red-200/70">Recovery time: {safeNumber(selectedPlayer.player.injuryWeeks)} week(s)</div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-black text-[#FFD700]">{getTreatmentCost(selectedPlayer.player.injuryStatus).toLocaleString()} CASH</div>
                            <button
                              onClick={() => treatPlayer(selectedPlayer.player.id)}
                              disabled={treatingPlayerId === selectedPlayer.player.id || (wallet.cash ?? 0) < getTreatmentCost(selectedPlayer.player.injuryStatus)}
                              className="rounded-xl bg-red-500 px-4 py-2 text-xs font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {treatingPlayerId === selectedPlayer.player.id ? 'Treating...' : 'Treat Injury'}
                            </button>
                          </div>
                          {(wallet.cash ?? 0) < getTreatmentCost(selectedPlayer.player.injuryStatus) && <div className="mt-2 text-xs text-red-200">Not enough CASH for treatment.</div>}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">
                          This player is healthy. No medical treatment needed right now.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {detailTab === 'equip' && (
                  <div className="space-y-3">
                    {equipmentActionMsg && (
                      <div className={`rounded-xl border p-3 text-sm ${equipmentActionMsg.type === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                        {equipmentActionMsg.text}
                      </div>
                    )}
                    {(selectedPlayer.player.playerItems || []).length === 0 ? (
                      <div className="glass-card p-6 text-center text-sm text-white/40">No items owned. Buy equipment from the Equipment tab.</div>
                    ) : (
                      (selectedPlayer.player.playerItems || []).map((pi: any) => (
                        <div key={pi.id} className="glass-card p-3 flex items-center justify-between border border-white/10">
                          <div>
                            <div className="font-medium text-white text-sm">{pi.item.name}</div>
                            <div className="text-xs text-white/40">{pi.item.slot} • {pi.item.rarity} • Durability {pi.durability ?? 100}%</div>
                            <div className="flex gap-1 mt-1">
                              {Object.entries(pi.item.statBoosts || {}).map(([stat, boost]) => (boost && typeof boost === 'number' && boost > 0 ? (
                                <span key={stat} className="text-[10px] bg-emerald-400/10 text-emerald-400 rounded px-1.5 py-0.5">+{boost} {STAT_LABELS[stat] || stat.toUpperCase()}</span>
                              ) : null))}
                            </div>
                          </div>
                          <button
                            onClick={() => pi.equipped ? handleUnequip(pi.id) : handleEquip(pi.id, selectedPlayer.player.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${pi.equipped ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#E94560] text-white hover:bg-[#E94560]/80'}`}
                          >
                            {pi.equipped ? 'Unequip' : 'Equip'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
