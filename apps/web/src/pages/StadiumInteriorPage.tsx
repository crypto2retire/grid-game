import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Home,
  Wrench,
  TrendingUp,
  Loader2,
  Users,
  Coins,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowUpCircle,
  Info,
  Swords,
  Target,
} from 'lucide-react';
import StadiumInterior, { type StadiumInteriorData, type StadiumSection } from '../components/stadium/StadiumInterior';
import MatchSchedulePage from './MatchSchedulePage';
import GamePlanPage from './GamePlanPage';

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

const SECTION_COLORS: Record<string, { color: string; icon: typeof Home; label: string }> = {
  lower: { color: '#3b82f6', icon: Users, label: 'Lower Stands' },
  upper: { color: '#8b5cf6', icon: Users, label: 'Upper Deck' },
  luxury: { color: '#fbbf24', icon: Sparkles, label: 'Luxury Boxes' },
  concessions: { color: '#d97706', icon: Coins, label: 'Concessions' },
  press: { color: '#64748b', icon: Info, label: 'Press & Media' },
  locker: { color: '#475569', icon: Home, label: 'Locker Room' },
  club: { color: '#ec4899', icon: Sparkles, label: 'Premium Club' },
};

// Build default section data from a venue
function buildSectionsFromVenue(venue: any): StadiumSection[] {
  const baseCondition = venue?.condition || 75;
  const baseCap = venue?.capacity || 5000;

  const sections: StadiumSection[] = [
    {
      id: 'field',
      name: 'Playing Field',
      tier: 'PARK_FIELD',
      condition: baseCondition,
      maxCapacity: 0,
      currentUpgrade: 0,
      maxUpgrade: 1,
      revenuePerGame: 0,
      upgradeCost: 0,
      description: 'The heart of the stadium. Field condition affects player fatigue and injury risk.',
    },
    {
      id: 'lower',
      name: 'Lower Stands',
      tier: 'PARK_FIELD',
      condition: baseCondition,
      maxCapacity: Math.floor(baseCap * 0.5),
      currentUpgrade: Math.floor((baseCondition / 100) * 3),
      maxUpgrade: 5,
      revenuePerGame: Math.floor(baseCap * 0.5 * (venue?.ticketPrice || 10)),
      upgradeCost: Math.floor(baseCap * 0.3),
      description: 'General seating closest to the action. High volume, lower ticket price.',
    },
    {
      id: 'upper',
      name: 'Upper Deck',
      tier: 'COMMUNITY_FIELD',
      condition: baseCondition - 10,
      maxCapacity: Math.floor(baseCap * 0.3),
      currentUpgrade: Math.max(0, Math.floor((baseCondition / 100) * 3) - 1),
      maxUpgrade: 5,
      revenuePerGame: Math.floor(baseCap * 0.3 * (venue?.ticketPrice || 10) * 0.8),
      upgradeCost: Math.floor(baseCap * 0.25),
      description: 'Elevated seating with panoramic views. Slightly cheaper tickets.',
    },
    {
      id: 'concessions',
      name: 'Concessions',
      tier: 'COMMUNITY_FIELD',
      condition: baseCondition - 5,
      maxCapacity: 0,
      currentUpgrade: 1,
      maxUpgrade: 5,
      revenuePerGame: Math.floor(baseCap * 0.15),
      upgradeCost: Math.floor(baseCap * 0.2),
      description: 'Food, drinks, and merch sales. Passive revenue per attendee.',
    },
    {
      id: 'luxury',
      name: 'Luxury Boxes',
      tier: 'SMALL_STADIUM',
      condition: baseCondition - 15,
      maxCapacity: Math.floor(baseCap * 0.05),
      currentUpgrade: 0,
      maxUpgrade: 5,
      revenuePerGame: Math.floor(baseCap * 0.05 * (venue?.ticketPrice || 10) * 5),
      upgradeCost: Math.floor(baseCap * 0.8),
      description: 'Private suites for VIPs and sponsors. High margin, low volume.',
    },
    {
      id: 'press',
      name: 'Press & Media',
      tier: 'SMALL_STADIUM',
      condition: baseCondition - 20,
      maxCapacity: 0,
      currentUpgrade: 0,
      maxUpgrade: 3,
      revenuePerGame: Math.floor(baseCap * 0.05),
      upgradeCost: Math.floor(baseCap * 0.4),
      description: 'Broadcast facilities and media lounges. Unlocks sponsorship value.',
    },
    {
      id: 'locker',
      name: 'Locker Room',
      tier: 'PARK_FIELD',
      condition: baseCondition - 8,
      maxCapacity: 0,
      currentUpgrade: 0,
      maxUpgrade: 3,
      revenuePerGame: 0,
      upgradeCost: Math.floor(baseCap * 0.15),
      description: 'Player facilities. Better condition = better stat bonuses.',
    },
    {
      id: 'club',
      name: 'Premium Club',
      tier: 'REGIONAL_STADIUM',
      condition: baseCondition - 12,
      maxCapacity: Math.floor(baseCap * 0.08),
      currentUpgrade: 0,
      maxUpgrade: 4,
      revenuePerGame: Math.floor(baseCap * 0.08 * (venue?.ticketPrice || 10) * 3),
      upgradeCost: Math.floor(baseCap * 0.6),
      description: 'Premium club level with bar and dining. Mid-tier luxury option.',
    },
  ];

  return sections;
}

export default function StadiumInteriorPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stadiumData, setStadiumData] = useState<StadiumInteriorData | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<Record<string, boolean>>({});
  const [upgradeMessages, setUpgradeMessages] = useState<Record<string, string>>({});
  const [wallet, setWallet] = useState({ cash: 0 });
  const [stadiumTab, setStadiumTab] = useState<'venue' | 'matches' | 'gameplan'>('venue');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    Promise.allSettled([
      fetch('/api/teams/mine', { headers }),
      fetch('/api/economy/wallet', { headers }),
    ])
      .then(async ([teamsRes, walletRes]) => {
        let venue: any = null;

        if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
          const json = await teamsRes.value.json();
          const teams = json.data || [];
          if (teams.length > 0) {
            venue = teams[0].venue;
          }
        }

        if (walletRes.status === 'fulfilled' && walletRes.value.ok) {
          const json = await walletRes.value.json();
          setWallet(json.data || { cash: 0 });
        }

        if (venue) {
          const sections = buildSectionsFromVenue(venue);
          const totalRevenue = sections.reduce((sum, s) => sum + s.revenuePerGame, 0);
          const avgCondition = Math.round(sections.reduce((sum, s) => sum + s.condition, 0) / sections.length);

          setStadiumData({
            name: venue.name,
            tier: venue.tier,
            capacity: venue.capacity,
            ticketPrice: venue.ticketPrice,
            prestige: venue.prestige,
            overallCondition: avgCondition,
            sections,
            totalRevenuePerGame: totalRevenue,
            lastUpgradeDate: null,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = (sectionId: string) => {
    const section = stadiumData?.sections.find((s) => s.id === sectionId);
    if (!section || !stadiumData) return;

    setUpgrading((prev) => ({ ...prev, [sectionId]: true }));

    // Simulate upgrade API call
    setTimeout(() => {
      setStadiumData((prev) => {
        if (!prev) return prev;
        const newSections = prev.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                currentUpgrade: Math.min(s.currentUpgrade + 1, s.maxUpgrade),
                condition: Math.min(s.condition + 10, 100),
                revenuePerGame: Math.floor(s.revenuePerGame * 1.15),
                maxCapacity: Math.floor(s.maxCapacity * 1.1),
              }
            : s
        );
        const newTotal = newSections.reduce((sum, s) => sum + s.revenuePerGame, 0);
        const newAvg = Math.round(newSections.reduce((sum, s) => sum + s.condition, 0) / newSections.length);
        return {
          ...prev,
          sections: newSections,
          totalRevenuePerGame: newTotal,
          overallCondition: newAvg,
          prestige: prev.prestige + 2,
          lastUpgradeDate: new Date().toISOString(),
        };
      });

      setUpgradeMessages((prev) => ({
        ...prev,
        [sectionId]: `${section.name} upgraded! +10% revenue`,
      }));
      setTimeout(() => {
        setUpgradeMessages((prev) => {
          const next = { ...prev };
          delete next[sectionId];
          return next;
        });
      }, 3000);

      setUpgrading((prev) => ({ ...prev, [sectionId]: false }));
    }, 1200);
  };

  const selectedSection = stadiumData?.sections.find((s) => s.id === selectedSectionId);

  // Revenue breakdown for game day simulation
  const revenueBreakdown = stadiumData?.sections.filter((s) => s.revenuePerGame > 0) || [];
  const concessionRev = stadiumData?.sections.find((s) => s.id === 'concessions')?.revenuePerGame || 0;
  const ticketRev = (stadiumData?.totalRevenuePerGame || 0) - concessionRev;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#E94560] mx-auto" />
          <p className="text-sm text-slate-400">Loading stadium data...</p>
        </div>
      </div>
    );
  }

  if (!stadiumData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Home className="h-12 w-12 text-slate-600 mx-auto" />
          <h2 className="text-xl font-bold text-white">No Stadium Found</h2>
          <p className="text-sm text-slate-400">Create a team first to get a starter stadium.</p>
          <button
            onClick={() => navigate('/team')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E94560] px-4 py-2 font-bold text-white hover:bg-[#E94560]/90"
          >
            Create Team <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {!embedded && (
            <button
              onClick={() => navigate('/world-map')}
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-3 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to World Map
            </button>
          )}
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Home className="h-7 w-7 text-[#E94560]" />
            {stadiumData.name}
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <span className={`text-sm font-bold ${TIER_COLORS[stadiumData.tier] || 'text-slate-400'}`}>
              {TIER_LABELS[stadiumData.tier] || stadiumData.tier}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-sm text-slate-400">{stadiumData.capacity.toLocaleString()} capacity</span>
            <span className="text-slate-500">•</span>
            <span className="text-sm text-slate-400">${stadiumData.ticketPrice}/ticket</span>
            <span className="text-slate-500">•</span>
            <span className="text-sm text-[#FFD700]">{stadiumData.prestige} prestige</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Wallet</div>
            <div className="text-lg font-bold text-[#FFD700]">{wallet.cash.toLocaleString()} CASH</div>
          </div>
        </div>
      </div>

      {/* Stadium Tab Bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-1">
        {[
          { id: 'venue' as const, label: 'Venue', icon: Home },
          { id: 'matches' as const, label: 'Match Office', icon: Swords },
          { id: 'gameplan' as const, label: 'Game Plan', icon: Target },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setStadiumTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition-colors ${
              stadiumTab === t.id
                ? 'text-[#E94560] border-b-2 border-[#E94560]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {stadiumTab === 'matches' && <MatchSchedulePage />}
      {stadiumTab === 'gameplan' && <GamePlanPage />}

      {stadiumTab === 'venue' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
          {/* Left: Stadium Cutaway */}
          <div className="rounded-3xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Wrench className="h-4 w-4" />
                <span>Click any section to view upgrade options</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-green-500" /> Good
                <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2" /> Fair
                <span className="w-2 h-2 rounded-full bg-red-500 ml-2" /> Poor
              </div>
            </div>
            <StadiumInterior
              data={stadiumData}
              onSectionClick={setSelectedSectionId}
              selectedSectionId={selectedSectionId}
            />
          </div>

          {/* Right: Detail Panel */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {selectedSection ? (
                <motion.div
                  key={selectedSection.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <SectionDetailPanel
                    section={selectedSection}
                    onUpgrade={() => handleUpgrade(selectedSection.id)}
                    upgrading={upgrading[selectedSection.id] || false}
                    message={upgradeMessages[selectedSection.id] || ''}
                    walletCash={wallet.cash}
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
                  <RevenueOverviewPanel
                    stadiumData={stadiumData}
                    revenueBreakdown={revenueBreakdown}
                    ticketRev={ticketRev}
                    concessionRev={concessionRev}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function SectionDetailPanel({
  section,
  onUpgrade,
  upgrading,
  message,
  walletCash,
}: {
  section: StadiumSection;
  onUpgrade: () => void;
  upgrading: boolean;
  message: string;
  walletCash: number;
}) {
  const meta = SECTION_COLORS[section.id] || { color: '#94a3b8', icon: Info, label: section.name };
  const Icon = meta.icon;
  const isMaxed = section.currentUpgrade >= section.maxUpgrade;
  const canAfford = walletCash >= section.upgradeCost;
  const conditionColor = section.condition > 70 ? 'bg-green-500' : section.condition > 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md overflow-hidden">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${meta.color}25` }}>
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div>
            <h3 className="font-bold text-white">{meta.label}</h3>
            <p className="text-xs text-slate-500">Level {section.currentUpgrade}/{section.maxUpgrade}</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Description */}
        <p className="text-sm text-slate-400 leading-relaxed">{section.description}</p>

        {/* Condition bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Condition</span>
            <span className={`text-sm font-bold ${section.condition > 70 ? 'text-green-400' : section.condition > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
              {section.condition}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full ${conditionColor} rounded-full transition-all`} style={{ width: `${section.condition}%` }} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {section.maxCapacity > 0 && (
            <div className="text-center bg-white/5 rounded-xl p-3">
              <div className="text-lg font-bold text-white">{section.maxCapacity.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Capacity</div>
            </div>
          )}
          <div className="text-center bg-white/5 rounded-xl p-3">
            <div className="text-lg font-bold text-[#FFD700]">{section.revenuePerGame.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">CASH / game</div>
          </div>
          {section.currentUpgrade > 0 && (
            <div className="text-center bg-white/5 rounded-xl p-3">
              <div className="text-lg font-bold text-emerald-400">+{Math.round((section.currentUpgrade / section.maxUpgrade) * 100)}%</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Bonus</div>
            </div>
          )}
        </div>

        {/* Upgrade Section */}
        {!isMaxed && section.upgradeCost > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white">Upgrade Cost</span>
              <span className="text-lg font-bold text-[#FFD700]">{section.upgradeCost.toLocaleString()} CASH</span>
            </div>
            <div className="text-xs text-slate-500 mb-3">
              Upgrade improves condition, capacity, and revenue per game.
            </div>
            <button
              onClick={onUpgrade}
              disabled={upgrading || !canAfford}
              className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-all ${
                canAfford
                  ? 'bg-[#E94560] text-white hover:bg-[#E94560]/90'
                  : 'bg-white/5 text-slate-500 cursor-not-allowed'
              }`}
            >
              {upgrading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Upgrading...
                </>
              ) : !canAfford ? (
                <>
                  <AlertTriangle className="h-4 w-4" /> Insufficient Funds
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-4 w-4" /> Upgrade Section
                </>
              )}
            </button>
          </div>
        )}

        {isMaxed && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-emerald-400">Max Level Reached</p>
            <p className="text-xs text-slate-500 mt-1">This section is fully upgraded for your stadium tier.</p>
          </div>
        )}

        {/* Upgrade message */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400 text-center font-medium"
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RevenueOverviewPanel({
  stadiumData,
  revenueBreakdown,
  ticketRev,
  concessionRev,
}: {
  stadiumData: StadiumInteriorData;
  revenueBreakdown: StadiumSection[];
  ticketRev: number;
  concessionRev: number;
}) {
  return (
    <div className="space-y-4">
      {/* Game Day Revenue Card */}
      <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-[#E94560]" />
          <h3 className="font-bold text-white">Game Day Revenue</h3>
        </div>

        <div className="text-center mb-5">
          <div className="text-4xl font-black text-[#FFD700]">{stadiumData.totalRevenuePerGame.toLocaleString()}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">CASH per home game</div>
        </div>

        {/* Revenue breakdown bars */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Ticket Sales</span>
              <span className="text-white font-bold">{ticketRev.toLocaleString()}</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${ticketRev > 0 ? (ticketRev / stadiumData.totalRevenuePerGame) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Concessions & Merch</span>
              <span className="text-white font-bold">{concessionRev.toLocaleString()}</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${concessionRev > 0 ? (concessionRev / stadiumData.totalRevenuePerGame) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Per-section breakdown */}
        <div className="mt-4 space-y-2">
          {revenueBreakdown.slice(0, 5).map((section) => {
            const meta = SECTION_COLORS[section.id] || { color: '#94a3b8', label: section.name };
            const pct = stadiumData.totalRevenuePerGame > 0
              ? Math.round((section.revenuePerGame / stadiumData.totalRevenuePerGame) * 100)
              : 0;
            return (
              <div key={section.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="text-slate-400">{meta.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{section.revenuePerGame.toLocaleString()}</span>
                  <span className="text-xs text-slate-600">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overall Condition */}
      <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Overall Condition</h3>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${
            stadiumData.overallCondition > 70
              ? 'bg-green-500/10 text-green-400'
              : stadiumData.overallCondition > 40
              ? 'bg-yellow-500/10 text-yellow-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {stadiumData.overallCondition}
          </div>
          <div className="flex-1">
            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  stadiumData.overallCondition > 70
                    ? 'bg-green-500'
                    : stadiumData.overallCondition > 40
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${stadiumData.overallCondition}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {stadiumData.overallCondition > 70
                ? 'Stadium is in great shape. Fans are happy.'
                : stadiumData.overallCondition > 40
                ? 'Some sections need attention soon.'
                : 'Major upgrades needed. Revenue is suffering.'}
            </p>
          </div>
        </div>
      </div>

      {/* Section Quick List */}
      <div className="rounded-3xl border border-white/10 bg-card/80 backdrop-blur-md p-5">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">All Sections</h3>
        <div className="space-y-2">
          {stadiumData.sections.map((section) => {
            const meta = SECTION_COLORS[section.id] || { color: '#94a3b8', label: section.name };
            const conditionColor = section.condition > 70 ? 'text-green-400' : section.condition > 40 ? 'text-yellow-400' : 'text-red-400';
            return (
              <div key={section.id} className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="text-sm text-white">{meta.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  {section.maxUpgrade > 0 && (
                    <span className="text-xs text-slate-500">
                      Lv.{section.currentUpgrade}/{section.maxUpgrade}
                    </span>
                  )}
                  <span className={`text-xs font-bold ${conditionColor}`}>{section.condition}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
