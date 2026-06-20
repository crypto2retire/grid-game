import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Swords, Trophy } from 'lucide-react';

interface MatchEvent {
  timestamp: number;
  tick: number;
  type: string;
  actorName?: string;
  targetName?: string;
  metadata?: any;
}

interface MatchData {
  id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  homeScore: number;
  awayScore: number;
  status: string;
  events: MatchEvent[];
  playerStats: any[];
  seed: string;
}

export default function MatchPage() {
  const { id } = useParams();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentEvent, setCurrentEvent] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (id) fetchMatch();
  }, [id]);

  const fetchMatch = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/matches/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMatch(data.data);
        // Simulate match if not completed
        if (data.data.status === 'SCHEDULED') {
          simulateMatch();
        }
      }
    } catch (err) {
      console.error('Failed to fetch match:', err);
    } finally {
      setLoading(false);
    }
  };

  const simulateMatch = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/matches/${id}/simulate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await res.json();
        // Refresh match data
        fetchMatch();
      }
    } catch (err) {
      console.error('Failed to simulate match:', err);
    }
  };

  useEffect(() => {
    if (playing && match && currentEvent < match.events.length) {
      const timer = setTimeout(() => {
        setCurrentEvent(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    } else if (playing && match && currentEvent >= match.events.length) {
      setPlaying(false);
    }
  }, [playing, currentEvent, match]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'goal': return <span className="text-green-400">⚽</span>;
      case 'shot': return <span className="text-yellow-400">🎯</span>;
      case 'save': return <span className="text-blue-400">🧤</span>;
      case 'tackle': return <span className="text-red-400">🦶</span>;
      case 'foul': return <span className="text-red-400">🟨</span>;
      case 'card': return <span className="text-red-400">🟥</span>;
      case 'halftime': return <span className="text-muted-foreground">⏸️</span>;
      case 'fulltime': return <span className="text-muted-foreground">🏁</span>;
      default: return <span className="text-muted-foreground">•</span>;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'goal': return 'text-green-400 bg-green-400/10';
      case 'shot': return 'text-yellow-400 bg-yellow-400/10';
      case 'save': return 'text-blue-400 bg-blue-400/10';
      case 'tackle': return 'text-red-400 bg-red-400/10';
      case 'foul': return 'text-orange-400 bg-orange-400/10';
      case 'card': return 'text-red-400 bg-red-400/10';
      case 'halftime': return 'text-muted-foreground bg-secondary';
      case 'fulltime': return 'text-accent bg-accent/10';
      default: return 'text-muted-foreground bg-secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-12">
        <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Match not found</p>
      </div>
    );
  }

  const visibleEvents = match.status === 'COMPLETED'
    ? match.events
    : match.events.slice(0, currentEvent);

  return (
    <div className="space-y-6">
      {/* Scoreboard */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{match.homeTeam.name}</div>
            <div className="text-5xl font-bold text-white mt-2">{match.homeScore}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">
              {match.status === 'SCHEDULED' ? 'VS' : match.status === 'IN_PROGRESS' ? 'LIVE' : 'FT'}
            </div>
            {match.status === 'COMPLETED' && (
              <Trophy className="w-8 h-8 text-accent mx-auto" />
            )}
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{match.awayTeam.name}</div>
            <div className="text-5xl font-bold text-white mt-2">{match.awayScore}</div>
          </div>
        </div>

        {/* Match Controls */}
        {match.status === 'COMPLETED' && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => {
                setCurrentEvent(0);
                setPlaying(true);
              }}
              className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90"
            >
              {playing ? 'Playing...' : 'Replay Match'}
            </button>
            <button
              onClick={() => setPlaying(false)}
              className="px-4 py-2 bg-secondary text-white rounded-lg font-medium hover:bg-secondary/80"
            >
              Pause
            </button>
            <button
              onClick={() => setCurrentEvent(match.events.length)}
              className="px-4 py-2 bg-secondary text-white rounded-lg font-medium hover:bg-secondary/80"
            >
              End
            </button>
          </div>
        )}

        {match.status === 'SCHEDULED' && (
          <div className="text-center mt-6">
            <button
              onClick={simulateMatch}
              className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent/90"
            >
              Simulate Match
            </button>
          </div>
        )}
      </div>

      {/* Event Timeline */}
      {(match.status === 'COMPLETED' || match.events.length > 0) && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Match Events</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {visibleEvents.map((event, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-4 p-3 rounded-lg ${getEventColor(event.type)}`}
              >
                <div className="text-sm font-mono font-medium w-12">
                  {formatTime(event.timestamp)}
                </div>
                <div className="text-lg">{getEventIcon(event.type)}</div>
                <div className="flex-1">
                  <span className="font-medium">{event.type.toUpperCase()}</span>
                  {event.actorName && (
                    <span className="text-muted-foreground"> - {event.actorName}</span>
                  )}
                  {event.metadata?.score && (
                    <span className="text-accent font-bold ml-2">{event.metadata.score}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Player Stats */}
      {match.playerStats && match.playerStats.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Player Statistics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2">Player</th>
                  <th className="text-center py-2">TD</th>
                  <th className="text-center py-2">AST</th>
                  <th className="text-center py-2">Plays</th>
                  <th className="text-center py-2">Big</th>
                  <th className="text-center py-2">Yards</th>
                  <th className="text-center py-2">Tackles</th>
                  <th className="text-center py-2">Stops</th>
                  <th className="text-center py-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {match.playerStats.map((stat: any) => (
                  <tr key={stat.id} className="border-b border-border/50">
                    <td className="py-2">
                      <div className="font-medium text-white">{stat.player?.name}</div>
                      <div className="text-xs text-muted-foreground">{stat.player?.position}</div>
                    </td>
                    <td className="text-center py-2 text-white">{stat.goals}</td>
                    <td className="text-center py-2 text-white">{stat.assists}</td>
                    <td className="text-center py-2 text-white">{stat.shots}</td>
                    <td className="text-center py-2 text-white">{stat.shotsOnTarget}</td>
                    <td className="text-center py-2 text-white">{stat.passes}</td>
                    <td className="text-center py-2 text-white">{stat.tackles}</td>
                    <td className="text-center py-2 text-white">{stat.saves}</td>
                    <td className="text-center py-2">
                      <span className={`font-bold ${stat.rating >= 7 ? 'text-green-400' : stat.rating >= 6 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {stat.rating}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
