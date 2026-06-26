import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudRain,
  CloudSnow,
  Sun,
  Cloud,
  Wind,
  Moon,
  ArrowRight,
  Zap,
  Trophy,
  Users,
} from 'lucide-react';

export type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'night' | 'windy';

interface MatchDayAtmosphereProps {
  homeTeamName: string;
  awayTeamName: string;
  venueName: string;
  venueTier: string;
  capacity: number;
  weather?: WeatherType;
  homeColor?: string;
  awayColor?: string;
  onKickoff: () => void;
  onSkip?: () => void;
}

const TIER_CROWD_PCT: Record<string, number> = {
  PARK_FIELD: 0.35,
  COMMUNITY_FIELD: 0.45,
  SMALL_STADIUM: 0.55,
  REGIONAL_STADIUM: 0.65,
  PRO_STADIUM: 0.8,
  ELITE: 0.92,
};

const WEATHER_CONFIG: Record<WeatherType, {
  label: string;
  icon: typeof Sun;
  color: string;
  bgOverlay: string;
  particleColor: string;
  effect: string;
}> = {
  sunny: {
    label: 'Clear Skies',
    icon: Sun,
    color: '#fbbf24',
    bgOverlay: 'bg-gradient-to-b from-sky-400/20 via-transparent to-transparent',
    particleColor: '#fbbf24',
    effect: 'none',
  },
  cloudy: {
    label: 'Overcast',
    icon: Cloud,
    color: '#94a3b8',
    bgOverlay: 'bg-gradient-to-b from-slate-500/30 via-slate-500/10 to-transparent',
    particleColor: '#cbd5e1',
    effect: 'clouds',
  },
  rain: {
    label: 'Heavy Rain',
    icon: CloudRain,
    color: '#3b82f6',
    bgOverlay: 'bg-gradient-to-b from-slate-700/50 via-slate-700/20 to-transparent',
    particleColor: '#60a5fa',
    effect: 'rain',
  },
  snow: {
    label: 'Snowfall',
    icon: CloudSnow,
    color: '#e2e8f0',
    bgOverlay: 'bg-gradient-to-b from-slate-300/20 via-slate-300/10 to-transparent',
    particleColor: '#f8fafc',
    effect: 'snow',
  },
  fog: {
    label: 'Foggy',
    icon: Wind,
    color: '#64748b',
    bgOverlay: 'bg-gradient-to-b from-slate-600/40 via-slate-600/30 to-transparent',
    particleColor: '#94a3b8',
    effect: 'fog',
  },
  night: {
    label: 'Night Game',
    icon: Moon,
    color: '#a78bfa',
    bgOverlay: 'bg-gradient-to-b from-indigo-900/60 via-indigo-900/30 to-transparent',
    particleColor: '#c4b5fd',
    effect: 'none',
  },
  windy: {
    label: 'Windy',
    icon: Wind,
    color: '#22d3ee',
    bgOverlay: 'bg-gradient-to-b from-cyan-600/20 via-transparent to-transparent',
    particleColor: '#67e8f9',
    effect: 'wind',
  },
};

function WeatherParticles({ weather }: { weather: WeatherType }) {
  const config = WEATHER_CONFIG[weather];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || config.effect === 'none') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    interface Particle {
      x: number;
      y: number;
      speed: number;
      size: number;
      opacity: number;
    }

    const particles: Particle[] = [];
    const count = config.effect === 'rain' ? 200 : config.effect === 'snow' ? 100 : 50;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: config.effect === 'rain' ? 8 + Math.random() * 6 : 0.5 + Math.random() * 1.5,
        size: config.effect === 'rain' ? 1 + Math.random() * 1.5 : 2 + Math.random() * 3,
        opacity: 0.3 + Math.random() * 0.5,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        ctx.beginPath();
        ctx.fillStyle = config.particleColor;
        ctx.globalAlpha = p.opacity;

        if (config.effect === 'rain') {
          ctx.rect(p.x, p.y, 1, p.size * 4);
        } else {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }

        ctx.fill();

        p.y += p.speed;
        if (config.effect === 'wind' || config.effect === 'fog') {
          p.x += Math.sin(Date.now() / 1000 + p.y) * 0.5;
        }
        if (config.effect === 'rain') {
          p.x += 0.5;
        }

        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      });

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animId);
  }, [weather, config.effect, config.particleColor]);

  if (config.effect === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}

// Stadium crowd visualization
function StadiumCrowd({ tier, capacity, homeColor = '#E94560', awayColor = '#3b82f6' }: {
  tier: string;
  capacity: number;
  homeColor?: string;
  awayColor?: string;
}) {
  const crowdDensity = Math.min(capacity * (TIER_CROWD_PCT[tier] || 0.5) / 50000, 1);

  // Generate crowd dots - left side home, right side away, mix in middle
  const generateDots = (section: 'home' | 'away' | 'neutral') => {
    const dots = [];
    const baseCount = section === 'neutral' ? 80 : 60;
    const count = Math.floor(baseCount * (0.5 + crowdDensity * 0.5));
    const color = section === 'home' ? homeColor : section === 'away' ? awayColor : '#fbbf24';

    for (let i = 0; i < count; i++) {
      const opacity = 0.3 + Math.random() * 0.6;
      const size = 1.5 + Math.random() * 2;
      dots.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        opacity,
        size,
        color,
      });
    }
    return dots;
  };

  const homeDots = generateDots('home');
  const awayDots = generateDots('away');
  const neutralDots = generateDots('neutral');

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
      <svg viewBox="0 0 800 500" className="w-full h-full opacity-80">
        <defs>
          <radialGradient id="crowdGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Upper deck stands */}
        <rect x="50" y="30" width="700" height="80" rx="4" fill="#1e293b" opacity="0.9" />
        <rect x="50" y="30" width="700" height="80" rx="4" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {/* Lower deck stands */}
        <rect x="80" y="110" width="640" height="80" rx="4" fill="#1e293b" opacity="0.95" />
        <rect x="80" y="110" width="640" height="80" rx="4" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {/* Side stands */}
        <rect x="30" y="110" width="40" height="200" rx="4" fill="#1e293b" opacity="0.9" />
        <rect x="730" y="110" width="40" height="200" rx="4" fill="#1e293b" opacity="0.9" />

        {/* Crowd dots - home side (left) */}
        {homeDots.map((dot, i) => (
          <circle
            key={`home-${i}`}
            cx={80 + dot.x * 3.5}
            cy={40 + dot.y * 1.2}
            r={dot.size}
            fill={dot.color}
            opacity={dot.opacity}
          >
            <animate
              attributeName="opacity"
              values={`${dot.opacity};${dot.opacity * 0.3};${dot.opacity}`}
              dur={`${1 + Math.random() * 2}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {/* Crowd dots - away side (right) */}
        {awayDots.map((dot, i) => (
          <circle
            key={`away-${i}`}
            cx={520 + dot.x * 2.5}
            cy={40 + dot.y * 1.2}
            r={dot.size}
            fill={dot.color}
            opacity={dot.opacity}
          >
            <animate
              attributeName="opacity"
              values={`${dot.opacity};${dot.opacity * 0.3};${dot.opacity}`}
              dur={`${1 + Math.random() * 2}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {/* Crowd dots - lower deck mixed */}
        {[...homeDots, ...awayDots, ...neutralDots].slice(0, 120).map((dot, i) => (
          <circle
            key={`lower-${i}`}
            cx={90 + (i % 30) * 21}
            cy={120 + Math.floor(i / 30) * 18}
            r={dot.size * 0.8}
            fill={dot.color}
            opacity={dot.opacity * 0.8}
          />
        ))}

        {/* Crowd wave effect */}
        <rect x="50" y="30" width="700" height="80" fill="url(#crowdGlow)" opacity="0.3">
          <animate
            attributeName="opacity"
            values="0.2;0.4;0.2"
            dur="3s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>
    </div>
  );
}

// Bus arrival animation
function BusArrival({ homeColor = '#E94560', onComplete }: { homeColor?: string; onComplete?: () => void }) {
  const [phase, setPhase] = useState<'arriving' | 'stopped' | 'exiting'>('arriving');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('stopped'), 2500),
      setTimeout(() => setPhase('exiting'), 5000),
      setTimeout(() => onComplete?.(), 7000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" style={{ zIndex: 15 }}>
      <AnimatePresence>
        {phase !== 'exiting' && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{
              x: phase === 'arriving' ? '30%' : phase === 'stopped' ? '35%' : '120%',
            }}
            exit={{ x: '120%' }}
            transition={{ duration: phase === 'arriving' ? 2.5 : phase === 'stopped' ? 0.5 : 1.5, ease: 'easeInOut' }}
            className="absolute bottom-4"
          >
            <svg viewBox="0 0 120 50" width="120" height="50">
              <rect x="5" y="10" width="110" height="35" rx="8" fill={homeColor} opacity="0.9" />
              <rect x="15" y="15" width="25" height="15" rx="3" fill="#1e293b" opacity="0.6" />
              <rect x="45" y="15" width="25" height="15" rx="3" fill="#1e293b" opacity="0.6" />
              <rect x="75" y="15" width="25" height="15" rx="3" fill="#1e293b" opacity="0.6" />
              <circle cx="25" cy="42" r="6" fill="#1e293b" />
              <circle cx="95" cy="42" r="6" fill="#1e293b" />
              <text x="60" y="32" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">TEAM BUS</text>
              {/* Exhaust */}
              <circle cx="5" cy="35" r="2" fill="#94a3b8" opacity="0.5">
                <animate attributeName="r" values="2;5;2" dur="0.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="0.5s" repeatCount="indefinite" />
              </circle>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Scoreboard
function Scoreboard({ homeTeam, awayTeam, venue }: { homeTeam: string; awayTeam: string; venue: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.8 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: 20 }}
    >
      <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-4">
        <div className="text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Home</div>
          <div className="text-sm font-bold text-white max-w-[100px] truncate">{homeTeam}</div>
        </div>
        <div className="text-center px-3">
          <div className="text-2xl font-black text-[#E94560]">VS</div>
          <div className="text-[10px] text-slate-500">{venue}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Away</div>
          <div className="text-sm font-bold text-white max-w-[100px] truncate">{awayTeam}</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function MatchDayAtmosphere({
  homeTeamName,
  awayTeamName,
  venueName,
  venueTier,
  capacity,
  weather = 'sunny',
  homeColor = '#E94560',
  awayColor = '#3b82f6',
  onKickoff,
  onSkip,
}: MatchDayAtmosphereProps) {
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [showKickoff, setShowKickoff] = useState(false);
  const config = WEATHER_CONFIG[weather];
  const WeatherIcon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => setShowKickoff(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-3xl overflow-hidden border border-white/10">
      {/* Sky / Background */}
      <div className={`absolute inset-0 ${config.bgOverlay}`} style={{ zIndex: 1 }} />

      {/* Night stadium lights */}
      {weather === 'night' && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
          <div className="absolute top-0 left-1/4 w-4 h-4 bg-white rounded-full opacity-80 blur-sm">
            <div className="absolute inset-0 bg-white rounded-full animate-pulse" />
          </div>
          <div className="absolute top-0 right-1/4 w-4 h-4 bg-white rounded-full opacity-80 blur-sm">
            <div className="absolute inset-0 bg-white rounded-full animate-pulse" />
          </div>
          <div className="absolute top-0 left-1/2 w-4 h-4 bg-white rounded-full opacity-80 blur-sm">
            <div className="absolute inset-0 bg-white rounded-full animate-pulse" />
          </div>
          {/* Light beams */}
          <div className="absolute top-0 left-1/4 w-32 h-96 bg-white/5 transform -rotate-12 origin-top" />
          <div className="absolute top-0 right-1/4 w-32 h-96 bg-white/5 transform rotate-12 origin-top" />
        </div>
      )}

      {/* Stadium crowd */}
      <StadiumCrowd tier={venueTier} capacity={capacity} homeColor={homeColor} awayColor={awayColor} />

      {/* Field */}
      <div className="absolute bottom-0 left-0 right-0 h-48" style={{ zIndex: 5 }}>
        <svg viewBox="0 0 800 150" className="w-full h-full">
          <rect x="0" y="0" width="800" height="150" fill="#16a34a" opacity="0.9" />
          <rect x="0" y="0" width="800" height="150" fill="url(#fieldPattern)" opacity="0.3" />
          <defs>
            <pattern id="fieldPattern" width="20" height="20" patternUnits="userSpaceOnUse">
              <line x1="0" y1="10" x2="20" y2="10" stroke="#15803d" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          {/* Yard lines */}
          {[100, 200, 300, 400, 500, 600, 700].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="150" stroke="white" strokeWidth="1" opacity="0.3" strokeDasharray="4 2" />
          ))}
          {/* Center line */}
          <line x1="400" y1="0" x2="400" y2="150" stroke="white" strokeWidth="2" opacity="0.4" />
          {/* End zones */}
          <rect x="0" y="0" width="60" height="150" fill="#E94560" opacity="0.2" />
          <rect x="740" y="0" width="60" height="150" fill="#3b82f6" opacity="0.2" />
          <text x="30" y="80" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" opacity="0.4">HOME</text>
          <text x="770" y="80" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" opacity="0.4">AWAY</text>
        </svg>
      </div>

      {/* Weather particles */}
      <WeatherParticles weather={weather} />

      {/* Scoreboard */}
      <Scoreboard homeTeam={homeTeamName} awayTeam={awayTeamName} venue={venueName} />

      {/* Weather info badge */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5"
        style={{ zIndex: 20 }}
      >
        <WeatherIcon className="w-4 h-4" style={{ color: config.color }} />
        <span className="text-xs font-bold text-white">{config.label}</span>
      </motion.div>

      {/* Crowd info */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5"
        style={{ zIndex: 20 }}
      >
        <Users className="w-4 h-4 text-[#E94560]" />
        <span className="text-xs font-bold text-white">
          {Math.floor(capacity * (TIER_CROWD_PCT[venueTier] || 0.5)).toLocaleString()} fans
        </span>
      </motion.div>

      {/* Bus arrival */}
      <BusArrival homeColor={homeColor} onComplete={() => setEntranceComplete(true)} />

      {/* Entrance complete message */}
      <AnimatePresence>
        {entranceComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-40 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{ zIndex: 20 }}
          >
            <div className="bg-black/70 backdrop-blur-md border border-[#E94560]/30 rounded-2xl px-6 py-3 text-center">
              <Trophy className="w-6 h-6 text-[#E94560] mx-auto mb-1" />
              <p className="text-sm font-bold text-white">Team has arrived</p>
              <p className="text-xs text-slate-400">Ready for kickoff</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kickoff button */}
      <AnimatePresence>
        {showKickoff && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3"
            style={{ zIndex: 30 }}
          >
            <button
              onClick={onKickoff}
              className="flex items-center gap-2 px-8 py-3 bg-[#E94560] text-white rounded-xl font-bold text-lg hover:bg-[#E94560]/90 transition-all shadow-lg shadow-[#E94560]/30 hover:shadow-[#E94560]/50"
            >
              <Zap className="w-5 h-5" />
              Kickoff!
              <ArrowRight className="w-5 h-5" />
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-4 py-3 bg-white/10 text-white/60 rounded-xl font-medium text-sm hover:bg-white/20 hover:text-white transition-all"
              >
                Skip
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
