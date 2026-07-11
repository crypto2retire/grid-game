import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bot,
  CalendarDays,
  ChevronRight,
  Loader2,
  Play,
  Shield,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { getSportLabel, useGameStore } from '../store/gameStore';

type Team = { id: string; name: string; tier: string };
type Match = {
  id: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore: number;
  awayScore: number;
  status: string;
  scheduledAt: string;
};
type Opponent = {
  id: string;
  name: string;
  tier: string;
  overall: number;
  wins: number;
  losses: number;
  owner?: { username: string; displayName: string | null };
  aiDifficulty?: string;
  aiStrategy?: string;
};
type Matchmaking = { liveOpponents: Opponent[]; aiOpponents: Opponent[] };
type RosterPlayer = { playerId: string; name: string; position: string };

type GameView = {
  matchId: string;
  quarter: number;
  clock: string;
  down: number;
  distance: number;
  yardLine: number;
  possession: 'home' | 'away';
  homeScore: number;
  awayScore: number;
  homeTeamName: string;
  awayTeamName: string;
  gameOver: boolean;
  lastPlay?: string;
};

type PostgameSummary = {
  match: any;
  playerStats: Record<string, { yards: number; td: number; bigPlays: number; plays: number }>;
  developmentLogs: Array<{ playerId: string; statGained: string; amount: number; reason: string }>;
  gameRevenue: null | {
    attendance: number;
    ticketRevenue: number;
    homeTeamRevenue: number;
    entryFeePaid: number;
    totalVenueRevenue: number;
  };
  plays: Array<any>;
};

const PLAY_CALLS = [
  ['RUN_LEFT', 'Run left'],
  ['RUN_MIDDLE', 'Run middle'],
  ['RUN_RIGHT', 'Run right'],
  ['QB_DRAW', 'QB draw'],
  ['SHORT_PASS', 'Short pass'],
  ['MEDIUM_PASS', 'Medium pass'],
  ['DEEP_BALL', 'Deep ball'],
  ['SCREEN', 'Screen'],
  ['PUNT', 'Punt'],
  ['FIELD_GOAL', 'Field goal'],
] as const;

function authHeaders(json = false) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

function formatClock(seconds: number | null | undefined) {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function normalizeGame(payload: any): GameView {
  const match = payload?.match || payload;
  if (!match?.id) throw new Error('The game server returned an invalid game state');
  return {
    matchId: match.id,
    quarter: Number(match.currentQuarter || 1),
    clock: formatClock(match.gameClock),
    down: Number(match.down || 1),
    distance: Number(match.yardsToGo || 10),
    yardLine: Number(match.ballPosition || 25),
    possession: match.possessionTeamId === match.awayTeamId ? 'away' : 'home',
    homeScore: Number(match.homeScore || 0),
    awayScore: Number(match.awayScore || 0),
    homeTeamName: match.homeTeam?.name || 'Home',
    awayTeamName: match.awayTeam?.name || 'Away',
    gameOver: Boolean(payload?.gameOver || match.gamePhase === 'COMPLETED' || match.status === 'COMPLETED'),
    lastPlay: payload?.playResult?.description || match.lastPlayResult?.description,
  };
}

export default function GameCenterPage() {
  const { activeSportId, selectedTeamId } = useGameStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState(selectedTeamId || '');
  const [matchmaking, setMatchmaking] = useState<Matchmaking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [game, setGame] = useState<GameView | null>(null);
  const [selectedPlay, setSelectedPlay] = useState('');
  const [playLog, setPlayLog] = useState<string[]>([]);
  const [roster, setRoster] = useState<Record<string, RosterPlayer>>({});
  const [summary, setSummary] = useState<PostgameSummary | null>(null);

  const loadMatches = async () => {
    const response = await fetch('/api/matches?limit=50', { headers: authHeaders() });
    if (!response.ok) throw new Error('Unable to load games');
    const data = await response.json();
    setMatches((data.data?.matches || []).filter((match: any) => (match.sportId || 'american-football') === activeSportId));
  };

  const loadTeams = async () => {
    const response = await fetch('/api/teams/mine', { headers: authHeaders() });
    if (!response.ok) throw new Error('Unable to load teams');
    const data = await response.json();
    const nextTeams = (data.data || []).filter((team: any) => (team.sportId || 'american-football') === activeSportId);
    setTeams(nextTeams);
    setSelectedTeam((current) => current || nextTeams[0]?.id || '');
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([loadMatches(), loadTeams()])
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load game center'))
      .finally(() => setLoading(false));
  }, [activeSportId]);

  const findOpponents = async () => {
    if (!selectedTeam) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai-teams/matchmaking/${selectedTeam}`, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to find opponents');
      setMatchmaking(data.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to find opponents');
    } finally {
      setBusy(false);
    }
  };

  const scheduleOpponent = async (opponent: Opponent, ai: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(ai ? '/api/ai-teams/schedule/ai' : '/api/ai-teams/schedule/live', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(ai
          ? { userTeamId: selectedTeam, aiTeamId: opponent.id }
          : { homeTeamId: selectedTeam, awayTeamId: opponent.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to schedule game');
      setMatchmaking(null);
      await loadMatches();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to schedule game');
    } finally {
      setBusy(false);
    }
  };

  const startGame = async (matchId: string) => {
    setActiveMatchId(matchId);
    setBusy(true);
    setError(null);
    setSummary(null);
    setPlayLog([]);
    setSelectedPlay('');
    try {
      const initResponse = await fetch(`/api/play-game/${matchId}/init`, { method: 'POST', headers: authHeaders() });
      const initData = await initResponse.json();
      if (!initResponse.ok) throw new Error(initData.message || 'Unable to initialize game');

      const rosterEntries: RosterPlayer[] = [...(initData.data?.homeRoster || []), ...(initData.data?.awayRoster || [])];
      setRoster(Object.fromEntries(rosterEntries.map((player) => [player.playerId, player])));

      const lineupResponse = await fetch(`/api/play-game/${matchId}/lineup`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          offensiveLineup: [],
          defensiveLineup: [],
          offensiveStyle: 'balanced',
          defensiveStyle: 'balanced',
        }),
      });
      const lineupData = await lineupResponse.json();
      if (!lineupResponse.ok) throw new Error(lineupData.message || 'Unable to start game');

      const stateResponse = await fetch(`/api/play-game/${matchId}/state`, { headers: authHeaders() });
      const stateData = await stateResponse.json();
      if (!stateResponse.ok) throw new Error(stateData.message || 'Unable to load game state');
      setGame(normalizeGame(stateData.data));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to start game');
    } finally {
      setBusy(false);
    }
  };

  const finalizeGame = async (matchId: string, simulatedPlays: any[] = []) => {
    const response = await fetch(`/api/play-game/${matchId}/complete`, { method: 'POST', headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to finalize game');
    const result = data.data || {};
    setSummary({
      match: result.match,
      playerStats: result.playerStats || {},
      developmentLogs: result.developmentLogs || [],
      gameRevenue: result.gameRevenue || null,
      plays: simulatedPlays,
    });
    setGame(normalizeGame({ match: result.match, gameOver: true }));
    await loadMatches();
  };

  const runPlay = async () => {
    if (!activeMatchId || !selectedPlay) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/play-game/${activeMatchId}/play`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ playType: selectedPlay }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Play call failed');
      const next = normalizeGame(data.data);
      setGame(next);
      if (data.data?.playResult?.description) setPlayLog((current) => [data.data.playResult.description, ...current].slice(0, 12));
      setSelectedPlay('');
      if (next.gameOver) await finalizeGame(activeMatchId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Play call failed');
    } finally {
      setBusy(false);
    }
  };

  const simulateGame = async () => {
    if (!activeMatchId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/play-game/${activeMatchId}/sim`, { method: 'POST', headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Simulation failed');
      setGame(normalizeGame(data.data));
      const descriptions = (data.data?.plays || []).map((play: any) => play.description).filter(Boolean);
      setPlayLog(descriptions.slice(-12).reverse());
      await finalizeGame(activeMatchId, data.data?.plays || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Simulation failed');
    } finally {
      setBusy(false);
    }
  };

  const aggregate = useMemo(() => {
    const plays = summary?.plays || [];
    return {
      plays: plays.length,
      yards: plays.reduce((total, play) => total + Math.max(0, Number(play.yards || 0)), 0),
      touchdowns: plays.filter((play) => play.touchdown || play.result === 'TOUCHDOWN').length,
      turnovers: plays.filter((play) => play.turnover).length,
      bigPlays: plays.filter((play) => play.result === 'BIG_PLAY').length,
    };
  }, [summary]);

  if (loading) return <div className="fcc-loading"><div className="fcc-loading-ring" /><strong>Loading game center…</strong></div>;

  return (
    <div className="fcc-subpage space-y-5">
      <div className="fcc-page-heading"><span>Competition operations</span><h1>Game Center</h1><p>Schedule opponents, call plays, simulate games, and review complete results.</p></div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200"><AlertCircle className="h-4 w-4" />{error}</div>}

      <section className="glass-card p-5">
        <div className="mb-4 flex items-center gap-2"><Swords className="h-5 w-5 text-cyan-300" /><h2 className="font-semibold text-white">Schedule a game</h2></div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white">
            <option value="">Select team…</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <button onClick={findOpponents} disabled={busy || !selectedTeam} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">Find opponents</button>
        </div>
        {matchmaking && <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {[...matchmaking.liveOpponents.map((opponent) => ({ opponent, ai: false })), ...matchmaking.aiOpponents.map((opponent) => ({ opponent, ai: true }))].map(({ opponent, ai }) => (
            <button key={`${ai ? 'ai' : 'live'}-${opponent.id}`} onClick={() => scheduleOpponent(opponent, ai)} disabled={busy} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] p-4 text-left hover:bg-white/[0.07]">
              <div className="flex items-center gap-3">{ai ? <Bot className="h-7 w-7 text-violet-300" /> : <Users className="h-7 w-7 text-emerald-300" />}<div><strong className="block text-white">{opponent.name}</strong><span className="text-xs text-slate-400">OVR {opponent.overall} · {opponent.wins}-{opponent.losses} · {ai ? opponent.aiDifficulty || 'AI' : opponent.owner?.displayName || opponent.owner?.username || 'Live'}</span></div></div>
              <ChevronRight className="h-5 w-5 text-slate-500" />
            </button>
          ))}
        </div>}
      </section>

      <section className="glass-card p-5">
        <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-cyan-300" /><h2 className="font-semibold text-white">Games</h2></div>
        <div className="space-y-2">
          {matches.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">No games scheduled.</div>}
          {matches.map((match) => <div key={match.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="min-w-0 flex-1"><strong className="text-white">{match.homeTeam.name}</strong><span className="mx-3 text-slate-500">vs</span><strong className="text-white">{match.awayTeam.name}</strong><div className="mt-1 text-xs text-slate-500">{new Date(match.scheduledAt).toLocaleString()}</div></div>
            <div className="flex items-center gap-3">
              {match.status === 'COMPLETED' ? <div className="rounded-lg bg-emerald-400/10 px-3 py-2 text-sm font-black text-emerald-300">{match.homeScore}–{match.awayScore}</div> : <button onClick={() => startGame(match.id)} disabled={busy} className="flex items-center gap-2 rounded-lg bg-emerald-400/15 px-4 py-2 text-sm font-bold text-emerald-300"><Play className="h-4 w-4" />Play</button>}
            </div>
          </div>)}
        </div>
      </section>

      {activeMatchId && game && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
        <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#08131f] p-6 shadow-2xl">
          <div className="flex items-center justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Live game operations</span><h2 className="mt-1 text-2xl font-black text-white">{game.homeTeamName} vs {game.awayTeamName}</h2></div><button onClick={() => setActiveMatchId(null)} className="rounded-xl border border-white/10 p-2 text-slate-400 hover:text-white"><X /></button></div>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center">
            <div><strong className="block text-sm text-slate-300">{game.homeTeamName}</strong><span className="text-4xl font-black text-white">{game.homeScore}</span></div>
            <div className="px-6"><span className="block text-xs font-black text-cyan-300">Q{game.quarter}</span><strong className="text-xl text-white">{game.clock}</strong><span className="block text-xs text-slate-500">{game.down} & {game.distance} · ball on {game.yardLine}</span></div>
            <div><strong className="block text-sm text-slate-300">{game.awayTeamName}</strong><span className="text-4xl font-black text-white">{game.awayScore}</span></div>
          </div>

          {!game.gameOver && <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
            <div><h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-300">Call the next play</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{PLAY_CALLS.map(([value, label]) => <button key={value} onClick={() => setSelectedPlay(value)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${selectedPlay === value ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.07]'}`}>{label}</button>)}</div><div className="mt-3 flex gap-3"><button onClick={runPlay} disabled={busy || !selectedPlay} className="flex-1 rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950 disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Run play'}</button><button onClick={simulateGame} disabled={busy} className="flex-1 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 font-black text-cyan-200 disabled:opacity-50">Simulate remainder</button></div></div>
            <div><h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-300">Play log</h3><div className="max-h-72 space-y-2 overflow-y-auto">{playLog.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-500">Call a play to begin.</div> : playLog.map((entry, index) => <div key={`${entry}-${index}`} className="rounded-xl bg-white/[0.035] p-3 text-xs leading-relaxed text-slate-300">{entry}</div>)}</div></div>
          </div>}

          {game.gameOver && summary && <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-center"><Trophy className="mx-auto h-8 w-8 text-emerald-300" /><h3 className="mt-2 text-2xl font-black text-white">Final: {summary.match.homeScore}–{summary.match.awayScore}</h3><p className="mt-1 text-sm text-emerald-200">Game completed and results saved.</p></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Object.entries(aggregate).map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span><strong className="mt-1 block text-xl text-white">{value}</strong></div>)}</div>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="mb-3 font-bold text-white">Player statistics</h3><div className="space-y-2">{Object.entries(summary.playerStats).length === 0 ? <div className="text-sm text-slate-500">No individual statistics recorded.</div> : Object.entries(summary.playerStats).sort(([, a], [, b]) => b.yards - a.yards).map(([playerId, stats]) => <div key={playerId} className="flex items-center justify-between rounded-xl bg-slate-950/50 p-3 text-sm"><div><strong className="block text-white">{roster[playerId]?.name || 'Player'}</strong><span className="text-xs text-slate-500">{roster[playerId]?.position || playerId.slice(0, 8)}</span></div><div className="text-right text-xs text-slate-300">{stats.yards} yds · {stats.td} TD<br />{stats.plays} plays · {stats.bigPlays} big</div></div>)}</div></section>
              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="mb-3 font-bold text-white">Game-day impact</h3>{summary.gameRevenue ? <div className="grid grid-cols-2 gap-3 text-sm">{[['Attendance', summary.gameRevenue.attendance], ['Ticket revenue', summary.gameRevenue.ticketRevenue], ['Home revenue', summary.gameRevenue.homeTeamRevenue], ['Entry fee paid', summary.gameRevenue.entryFeePaid]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-950/50 p-3"><span className="block text-xs text-slate-500">{label}</span><strong className="text-white">{Number(value).toLocaleString()}</strong></div>)}</div> : <div className="text-sm text-slate-500">No venue revenue was recorded.</div>}<h3 className="mb-2 mt-5 font-bold text-white">Development gains</h3>{summary.developmentLogs.length === 0 ? <div className="text-sm text-slate-500">No player gained a stat this game.</div> : summary.developmentLogs.map((log, index) => <div key={`${log.playerId}-${index}`} className="mb-2 rounded-xl bg-slate-950/50 p-3 text-sm text-slate-300"><strong className="text-white">{roster[log.playerId]?.name || 'Player'}</strong> gained +{log.amount} {log.statGained}</div>)}</section>
            </div>
            <button onClick={() => setActiveMatchId(null)} className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">Return to game center</button>
          </div>}
        </div>
      </div>}
    </div>
  );
}
