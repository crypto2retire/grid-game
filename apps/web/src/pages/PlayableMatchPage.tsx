import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Target,
  Zap,
  User,
  Check,
  Star,
  TrendingUp,
  Loader2,
  BarChart3,
  ChevronLeft,
} from 'lucide-react';
import MatchDayAtmosphere, { type WeatherType } from '../components/match/MatchDayAtmosphere';

const WEATHER_OPTIONS: WeatherType[] = ['sunny', 'cloudy', 'rain', 'snow', 'fog', 'night', 'windy'];
const TIER_FALLBACK = 'PRO_STADIUM';
const CAPACITY_FALLBACK = 65000;

interface RosterPlayer {
  playerId: string;
  position: string;
  name: string;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

interface PlayResult {
  playType: string;
  direction?: string;
  result: string;
  yards: number;
  firstDown: boolean;
  turnover: boolean;
  touchdown: boolean;
  punt: boolean;
  fieldGoal: boolean;
  missedFg: boolean;
  scoreChange: number;
  description: string;
  defensivePlay: string;
  primaryPlayer: { id: string; name: string; position: string } | null;
  targetPlayer: { id: string; name: string; position: string } | null;
}

interface GameState {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: { name: string; owner: { username: string } };
  awayTeam: { name: string; owner: { username: string } };
  homeScore: number;
  awayScore: number;
  gamePhase: string;
  currentQuarter: number;
  gameClock: number;
  possessionTeamId: string;
  ballPosition: number;
  down: number;
  yardsToGo: number;
  offensiveStyle?: string;
  defensiveStyle?: string;
  lastPlayResult: PlayResult | null;
  userTeamId: string | null;
}


const RUN_PLAYS = [
  { type: 'RUN_LEFT', name: 'Run Left', icon: ArrowLeft, color: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30' },
  { type: 'RUN_MIDDLE', name: 'Run Middle', icon: ArrowUp, color: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30' },
  { type: 'RUN_RIGHT', name: 'Run Right', icon: ArrowRight, color: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30' },
  { type: 'QB_DRAW', name: 'QB Draw', icon: Zap, color: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30' },
];

const PASS_PLAYS = [
  { type: 'SHORT_PASS', name: 'Short Pass', icon: ArrowUp, color: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30' },
  { type: 'MEDIUM_PASS', name: 'Medium Pass', icon: Target, color: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30' },
  { type: 'DEEP_BALL', name: 'Deep Ball', icon: Zap, color: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30' },
  { type: 'SCREEN', name: 'Screen Pass', icon: ArrowDown, color: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30' },
];

const SPECIAL_PLAYS = [
  { type: 'PUNT', name: 'Punt', icon: ArrowDown, color: 'bg-gray-500/20 hover:bg-gray-500/30 border-gray-500/30' },
  { type: 'FIELD_GOAL', name: 'Field Goal', icon: Target, color: 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30' },
];

const OFFENSIVE_STYLES = [
  { value: 'balanced', label: 'Balanced', desc: 'Mix of run and pass' },
  { value: 'runHeavy', label: 'Run Heavy', desc: 'Power running game' },
  { value: 'passHeavy', label: 'Pass Heavy', desc: 'Air attack offense' },
];

const DEFENSIVE_STYLES = [
  { value: 'balanced', label: 'Balanced', desc: 'Standard defense' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Blitz heavy, riskier' },
  { value: 'conservative', label: 'Conservative', desc: 'Prevent big plays' },
];

function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFieldPosition(position: number, possessionId: string, homeId: string): string {
  if (position <= 50) {
    return possessionId === homeId ? `Own ${position}` : `Opp ${position}`;
  }
  const opp = 100 - position;
  return possessionId === homeId ? `Opp ${opp}` : `Own ${opp}`;
}

function getQuarterLabel(q: number): string {
  if (q === 1) return '1st';
  if (q === 2) return '2nd';
  if (q === 3) return '3rd';
  return '4th';
}

export default function PlayableMatchPage() {
  const { id } = useParams<{ id: string }>();
  const matchId = id;
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'LOADING' | 'INIT' | 'ATMOSPHERE' | 'PREGAME' | 'PLAYING' | 'RESULT' | 'POSTGAME'>('LOADING');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [homeRoster, setHomeRoster] = useState<RosterPlayer[]>([]);
  const [awayRoster, setAwayRoster] = useState<RosterPlayer[]>([]);
  const [playHistory, setPlayHistory] = useState<PlayResult[]>([]);
  const [selectedOffense, setSelectedOffense] = useState<string[]>([]);
  const [selectedDefense, setSelectedDefense] = useState<string[]>([]);
  const [offStyle, setOffStyle] = useState('balanced');
  const [defStyle, setDefStyle] = useState('balanced');
  const [lastResult, setLastResult] = useState<PlayResult | null>(null);
  const [animating, setAnimating] = useState(false);
  const [postGameData, setPostGameData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [venueData, setVenueData] = useState<{ name: string; tier: string; capacity: number } | null>(null);
  const [weather, setWeather] = useState<WeatherType>('sunny');

  const token = localStorage.getItem('token');

  const fetchState = useCallback(async () => {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/play-game/${matchId}/state`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data.data.match);
        setHomeRoster(data.data.homeRoster);
        setAwayRoster(data.data.awayRoster);
        const currentPhase = data.data.match.gamePhase;
        if (currentPhase === 'SCHEDULED') setPhase('INIT');
        else if (currentPhase === 'PREGAME') setPhase('PREGAME');
        else if (currentPhase === 'IN_PROGRESS') setPhase('PLAYING');
        else if (currentPhase === 'COMPLETED') {
          setPhase('POSTGAME');
          fetchPostGame();
        }
      }
    } catch (err) {
      console.error('Failed to fetch game state:', err);
      setError('Failed to load game state');
    }
  }, [matchId, token]);

  const fetchPostGame = async () => {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/play-game/${matchId}/state`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPostGameData(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch post-game data:', err);
    }
  };

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const initializeGame = async () => {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/play-game/${matchId}/init`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setHomeRoster(data.data.homeRoster);
        setAwayRoster(data.data.awayRoster);
        setGameState(data.data.match);
        // Set default starters (first 11)
        const userTeamId = data.data.match.userTeamId;
        const isHome = userTeamId === data.data.match.homeTeamId;
        const roster = isHome ? data.data.homeRoster : data.data.awayRoster;
        const defaultStarters = roster.slice(0, 11).map((p: RosterPlayer) => p.playerId);
        setSelectedOffense(defaultStarters);
        setSelectedDefense(defaultStarters);

        // Fetch venue data for atmosphere
        try {
          const venueRes = await fetch('/api/teams/mine', { headers: { Authorization: `Bearer ${token}` } });
          if (venueRes.ok) {
            const venueJson = await venueRes.json();
            const teams = venueJson.data || [];
            const homeTeam = teams.find((t: any) => t.id === data.data.match.homeTeamId);
            if (homeTeam?.venue) {
              setVenueData({
                name: homeTeam.venue.name,
                tier: homeTeam.venue.tier,
                capacity: homeTeam.venue.capacity,
              });
            } else {
              setVenueData({ name: 'The Gridiron', tier: TIER_FALLBACK, capacity: CAPACITY_FALLBACK });
            }
          }
        } catch {
          setVenueData({ name: 'The Gridiron', tier: TIER_FALLBACK, capacity: CAPACITY_FALLBACK });
        }

        // Random weather
        setWeather(WEATHER_OPTIONS[Math.floor(Math.random() * WEATHER_OPTIONS.length)]);
        setPhase('ATMOSPHERE');
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to initialize game');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const startGame = async () => {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/play-game/${matchId}/lineup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offensiveLineup: selectedOffense,
          defensiveLineup: selectedDefense,
          offensiveStyle: offStyle,
          defensiveStyle: defStyle,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data.data);
        setPhase('PLAYING');
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to start game');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const submitPlay = async (playType: string) => {
    if (!matchId || animating) return;
    setAnimating(true);
    try {
      const res = await fetch(`/api/play-game/${matchId}/play`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playType }),
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data.data.match);
        setLastResult(data.data.playResult);
        setPlayHistory((prev) => [...prev, data.data.playResult]);
        if (data.data.gameOver) {
          setPhase('RESULT');
          setTimeout(() => completeGame(), 2000);
        } else {
          setPhase('RESULT');
          setTimeout(() => {
            setPhase('PLAYING');
            setLastResult(null);
          }, 2500);
        }
      } else {
        const data = await res.json();
        setError(data.message || 'Play failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setTimeout(() => setAnimating(false), 500);
    }
  };

  const simRemainder = async () => {
    if (!matchId) return;
    setAnimating(true);
    try {
      const res = await fetch(`/api/play-game/${matchId}/sim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data.data.match);
        setPhase('RESULT');
        setTimeout(() => completeGame(), 1500);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setAnimating(false);
    }
  };

  const completeGame = async () => {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/play-game/${matchId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setPostGameData(data.data);
        setPhase('POSTGAME');
      }
    } catch (err) {
      setError('Network error completing game');
    }
  };

  const toggleStarter = (playerId: string, isOffense: boolean) => {
    const current = isOffense ? [...selectedOffense] : [...selectedDefense];
    const idx = current.indexOf(playerId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else if (current.length < 11) {
      current.push(playerId);
    }
    if (isOffense) setSelectedOffense(current);
    else setSelectedDefense(current);
  };

  const getPositionColor = (position: string): string => {
    const colors: Record<string, string> = {
      QB: 'text-yellow-400',
      RB: 'text-green-400',
      WR: 'text-blue-400',
      TE: 'text-purple-400',
      OL: 'text-gray-400',
      DL: 'text-red-400',
      LB: 'text-orange-400',
      CB: 'text-cyan-400',
      S: 'text-pink-400',
      K: 'text-gray-400',
    };
    return colors[position] || 'text-white';
  };

  const isUserPossession = gameState?.possessionTeamId === gameState?.userTeamId;
  const userTeam = gameState?.userTeamId === gameState?.homeTeamId ? gameState?.homeTeam : gameState?.awayTeam;

  // AI auto-play when it's the opponent's turn
  useEffect(() => {
    if (phase !== 'PLAYING' || isUserPossession || animating || !gameState) return;

    const timer = setTimeout(() => {
      const allPlays = [
        'RUN_LEFT', 'RUN_MIDDLE', 'RUN_RIGHT', 'QB_DRAW',
        'SHORT_PASS', 'MEDIUM_PASS', 'DEEP_BALL', 'SCREEN',
        'PUNT', 'FIELD_GOAL',
      ];

      const isHome = gameState.possessionTeamId === gameState.homeTeamId;
      const distanceToGoal = isHome
        ? 100 - (gameState.ballPosition || 25)
        : gameState.ballPosition || 25;

      let playType: string;
      if (gameState.down === 4) {
        if (distanceToGoal <= 40) {
          playType = 'FIELD_GOAL';
        } else {
          playType = 'PUNT';
        }
      } else {
        // Random run or pass play
        const normalPlays = allPlays.slice(0, 8);
        playType = normalPlays[Math.floor(Math.random() * normalPlays.length)];
      }

      submitPlay(playType);
    }, 1500);

    return () => clearTimeout(timer);
  }, [phase, isUserPossession, animating, gameState]);

  // ─── Error ───
  if (error) {
    return (
      <div className="p-6">
        <div className="glass-card p-6 text-center">
          <Zap className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => navigate('/matches')} className="btn-primary px-4 py-2 rounded-lg">
            Back to Matches
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading ───
  if (phase === 'LOADING') {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 animate-spin text-[#E94560]" />
      </div>
    );
  }

  // ─── INIT ───
  if (phase === 'INIT') {
    return (
      <div className="p-6 space-y-6">
        <div className="glass-card p-8 text-center">
          <Zap className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Playable Game</h1>
          <p className="text-muted-foreground mb-6">
            Take control of your team and call plays in real-time. Players develop stats based on performance.
          </p>
          <button onClick={initializeGame} className="btn-primary px-8 py-3 rounded-lg text-lg font-semibold">
            Start Game
          </button>
          <p className="text-xs text-muted-foreground mt-4">
            You&apos;ll set your lineup and playbook before kickoff.
          </p>
        </div>
      </div>
    );
  }

  // ─── ATMOSPHERE ───
  if (phase === 'ATMOSPHERE') {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <MatchDayAtmosphere
          homeTeamName={gameState?.homeTeam.name || 'Home'}
          awayTeamName={gameState?.awayTeam.name || 'Away'}
          venueName={venueData?.name || 'The Gridiron'}
          venueTier={venueData?.tier || TIER_FALLBACK}
          capacity={venueData?.capacity || CAPACITY_FALLBACK}
          weather={weather}
          onKickoff={() => setPhase('PREGAME')}
          onSkip={() => setPhase('PREGAME')}
        />
      </div>
    );
  }

  // ─── PREGAME ───
  if (phase === 'PREGAME') {
    const activeRoster = gameState?.userTeamId === gameState?.homeTeamId ? homeRoster : awayRoster;
    const positionOrder = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'];
    const sortedRoster = [...activeRoster].sort((a, b) => {
      const posA = positionOrder.indexOf(a.position);
      const posB = positionOrder.indexOf(b.position);
      if (posA !== posB) return posA - posB;
      return b.overall - a.overall;
    });
    const starters = sortedRoster.filter((p) => selectedOffense.includes(p.playerId));

    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/matches')} className="flex items-center gap-1 text-muted-foreground hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-xl font-bold text-white">Pre-Game Setup</h1>
          <div className="w-20" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team Info */}
          <div className="glass-card p-4">
            <h2 className="font-semibold text-white mb-2">{userTeam?.name}</h2>
            <p className="text-sm text-muted-foreground">Your team</p>
            <div className="mt-3 text-sm text-muted-foreground">
              Select 11 starters below
            </div>
            <div className="mt-2 text-sm text-green-400">
              {starters.length}/11 selected
            </div>
          </div>

          {/* Playbook Styles */}
          <div className="glass-card p-4 space-y-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Offensive Style</label>
              <div className="grid grid-cols-3 gap-2">
                {OFFENSIVE_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setOffStyle(style.value)}
                    className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                      offStyle === style.value
                        ? 'bg-accent border-accent text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {OFFENSIVE_STYLES.find((s) => s.value === offStyle)?.desc}
              </p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Defensive Style</label>
              <div className="grid grid-cols-3 gap-2">
                {DEFENSIVE_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setDefStyle(style.value)}
                    className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                      defStyle === style.value
                        ? 'bg-accent border-accent text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {DEFENSIVE_STYLES.find((s) => s.value === defStyle)?.desc}
              </p>
            </div>
          </div>
        </div>

        {/* Roster Selector */}
        <div className="glass-card p-4">
          <h3 className="font-semibold text-white mb-3">Select Starters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sortedRoster.map((player) => {
              const isSelected = selectedOffense.includes(player.playerId);
              return (
                <button
                  key={player.playerId}
                  onClick={() => toggleStarter(player.playerId, true)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
                  }`}>
                    {isSelected ? <Check className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-medium text-white text-sm truncate">{player.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className={getPositionColor(player.position)}>{player.position}</span> • OVR {player.overall}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="text-green-400 text-xs font-bold">
                      #{selectedOffense.indexOf(player.playerId) + 1}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={startGame}
          disabled={selectedOffense.length !== 11}
          className="w-full btn-primary py-3 rounded-lg font-semibold text-lg disabled:opacity-30"
        >
          {selectedOffense.length !== 11 ? `Select ${11 - selectedOffense.length} more starters` : 'Kickoff!'}
        </button>
      </div>
    );
  }

  // ─── PLAYING / RESULT ───
  if (phase === 'PLAYING' || phase === 'RESULT') {
    const isUserTurn = isUserPossession;
    const fieldPos = formatFieldPosition(
      gameState?.ballPosition || 25,
      gameState?.possessionTeamId || '',
      gameState?.homeTeamId || ''
    );

    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Scoreboard */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-sm text-muted-foreground">{gameState?.homeTeam.name}</div>
              <div className="text-3xl font-bold text-white">{gameState?.homeScore}</div>
            </div>
            <div className="text-center px-4">
              <div className="text-xs text-muted-foreground">
                {getQuarterLabel(gameState?.currentQuarter || 1)} QTR
              </div>
              <div className="text-xl font-bold text-white">{formatClock(gameState?.gameClock || 0)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {gameState?.down} & {gameState?.yardsToGo}
              </div>
              <div className="text-xs text-green-400 mt-0.5">{fieldPos}</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-sm text-muted-foreground">{gameState?.awayTeam.name}</div>
              <div className="text-3xl font-bold text-white">{gameState?.awayScore}</div>
            </div>
          </div>
          {/* Possession indicator */}
          <div className="text-center mt-2">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              isUserTurn ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {isUserTurn ? 'Your Possession' : 'Opponent Possession'}
            </span>
          </div>
        </div>

        {/* Field Visualization */}
        <div className="glass-card p-4">
          <div className="relative h-16 bg-green-900/50 rounded-lg overflow-hidden border border-green-500/20">
            {/* Yard lines */}
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((yard) => (
              <div
                key={yard}
                className="absolute top-0 bottom-0 w-px bg-white/10"
                style={{ left: `${yard}%` }}
              />
            ))}
            {/* 50 yard line */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-white/30" style={{ left: '50%' }} />
            {/* End zones */}
            <div className="absolute left-0 top-0 bottom-0 w-[5%] bg-red-500/20" />
            <div className="absolute right-0 top-0 bottom-0 w-[5%] bg-red-500/20" />
            {/* Ball position */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full border-2 border-yellow-400 shadow-lg z-10"
              style={{ left: `${gameState?.ballPosition || 25}%` }}
            />
            {/* First down line */}
            {gameState && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/50"
                style={{
                  left: `${Math.min(100, Math.max(0, (gameState?.possessionTeamId === gameState?.homeTeamId
                    ? gameState?.ballPosition + gameState?.yardsToGo
                    : gameState?.ballPosition - gameState?.yardsToGo
                  )))}%`,
                }}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{gameState?.homeTeam.name}</span>
            <span>50</span>
            <span>{gameState?.awayTeam.name}</span>
          </div>
        </div>

        {/* Play Result Display */}
        {phase === 'RESULT' && lastResult && (
          <div className={`glass-card p-6 text-center border-2 animate-pulse ${
            lastResult.touchdown ? 'border-yellow-400/50 bg-yellow-400/5' :
            lastResult.fieldGoal ? 'border-green-400/50 bg-green-400/5' :
            lastResult.punt ? 'border-gray-400/50 bg-gray-400/5' :
            lastResult.turnover ? 'border-red-400/50 bg-red-400/5' :
            lastResult.yards > 10 ? 'border-green-400/50 bg-green-400/5' :
            'border-blue-400/30'
          }`}>
            <div className="text-2xl font-bold text-white mb-2">
              {lastResult.touchdown ? '🏈 TOUCHDOWN!' :
               lastResult.fieldGoal ? '✅ FIELD GOAL!' :
               lastResult.missedFg ? '❌ MISSED FIELD GOAL' :
               lastResult.punt ? '🏈 PUNT' :
               lastResult.turnover ? '💥 TURNOVER!' :
               lastResult.yards > 0 ? `+${lastResult.yards} yards` :
               `${lastResult.yards} yards`}
            </div>
            <p className="text-white/80">{lastResult.description}</p>
            {lastResult.firstDown && !lastResult.touchdown && (
              <div className="text-yellow-400 font-bold mt-2">FIRST DOWN!</div>
            )}
          </div>
        )}

        {/* Play Calling (only on user's turn) */}
        {phase === 'PLAYING' && isUserTurn && !animating && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground text-center">
              Select your play
              {gameState?.down === 4 && (
                <span className="block text-xs text-orange-400 mt-1">4th Down — Special Teams Available</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-xs text-amber-400 font-medium uppercase tracking-wider text-center">Run Plays</div>
                {RUN_PLAYS.map((play) => {
                  const Icon = play.icon;
                  return (
                    <button
                      key={play.type}
                      onClick={() => submitPlay(play.type)}
                      className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-all ${play.color}`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                      <span className="font-medium text-white text-sm">{play.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <div className="text-xs text-blue-400 font-medium uppercase tracking-wider text-center">Pass Plays</div>
                {PASS_PLAYS.map((play) => {
                  const Icon = play.icon;
                  return (
                    <button
                      key={play.type}
                      onClick={() => submitPlay(play.type)}
                      className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-all ${play.color}`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                      <span className="font-medium text-white text-sm">{play.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Special Teams — only on 4th down */}
            {gameState?.down === 4 && (
              <div className="space-y-2">
                <div className="text-xs text-orange-400 font-medium uppercase tracking-wider text-center">Special Teams</div>
                <div className="grid grid-cols-2 gap-3">
                  {SPECIAL_PLAYS.map((play) => {
                    const Icon = play.icon;
                    return (
                      <button
                        key={play.type}
                        onClick={() => submitPlay(play.type)}
                        className={`w-full p-3 rounded-lg border flex items-center gap-3 transition-all ${play.color}`}
                      >
                        <Icon className="w-5 h-5 text-white" />
                        <span className="font-medium text-white text-sm">{play.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Turn / Sim Options */}
        {phase === 'PLAYING' && !isUserTurn && (
          <div className="glass-card p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#E94560] mx-auto mb-3" />
            <p className="text-white font-medium">Opponent is calling a play...</p>
            <button
              onClick={simRemainder}
              className="mt-4 text-sm text-muted-foreground hover:text-white transition-colors"
            >
              Sim to end of game
            </button>
          </div>
        )}

        {/* Play History */}
        {playHistory.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Play History</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {playHistory.slice(-5).reverse().map((play, idx) => (
                <div key={idx} className="text-sm flex items-center gap-2">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    play.touchdown ? 'bg-yellow-400/20 text-yellow-400' :
                    play.fieldGoal ? 'bg-green-400/20 text-green-400' :
                    play.missedFg ? 'bg-red-400/20 text-red-400' :
                    play.punt ? 'bg-gray-400/20 text-gray-400' :
                    play.turnover ? 'bg-red-400/20 text-red-400' :
                    play.yards > 0 ? 'bg-green-400/20 text-green-400' :
                    'bg-white/10 text-white/40'
                  }`}>
                    {play.touchdown ? 'TD' :
                     play.fieldGoal ? 'FG' :
                     play.missedFg ? 'MISS' :
                     play.punt ? 'PUNT' :
                     play.yards > 0 ? `+${play.yards}` : play.yards}
                  </span>
                  <span className="text-white/70 truncate">{play.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── POSTGAME ───
  if (phase === 'POSTGAME') {
    const match = postGameData?.match || gameState;
    const devLogs = postGameData?.developmentLogs || [];
    const playerStats = postGameData?.playerStats || {};

    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="glass-card p-6 text-center">
          <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white mb-1">Final Score</h1>
          <div className="text-4xl font-bold text-white mb-4">
            {match?.homeScore} - {match?.awayScore}
          </div>
          <div className="text-sm text-muted-foreground">
            {match?.homeTeam.name} vs {match?.awayTeam.name}
          </div>
        </div>

        {/* Player Development */}
        {devLogs.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Player Development
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {devLogs.map((log: any) => (
                <div key={log.id} className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white text-sm">Player gained +{log.amount} {log.statGained}</div>
                    <div className="text-xs text-green-400">{log.reason.replace('_', ' ')}</div>
                  </div>
                  <Star className="w-5 h-5 text-green-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player Stats */}
        {Object.keys(playerStats).length > 0 && (
          <div className="glass-card p-4">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Player Stats
            </h3>
            <div className="space-y-2">
              {Object.entries(playerStats).map(([playerId, stats]: [string, any]) => {
                const player = homeRoster.find((p) => p.playerId === playerId) || awayRoster.find((p) => p.playerId === playerId);
                if (!player) return null;
                return (
                  <div key={playerId} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${getPositionColor(player.position)}`}>{player.position}</span>
                      <span className="text-white text-sm">{player.name}</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-400">{stats.yards} yds</span>
                      <span className="text-yellow-400">{stats.td} TD</span>
                      <span className="text-white/60">{stats.plays} plays</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => navigate('/matches')} className="flex-1 btn-primary py-3 rounded-lg font-semibold">
            Back to Matches
          </button>
        </div>
      </div>
    );
  }

  // Fallback - should never reach here
  return (
    <div className="p-6">
      <div className="glass-card p-6 text-center">
        <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-4">Phase: {phase}</p>
        <button onClick={() => navigate('/matches')} className="btn-primary px-4 py-2 rounded-lg">
          Back to Matches
        </button>
      </div>
    </div>
  );
}
