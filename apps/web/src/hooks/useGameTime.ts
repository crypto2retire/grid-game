import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';

export interface GameTime {
  week: number;
  day: number;
  season: number;
  year: number;
  display: string;
}

export interface TeamSlotPricing {
  catalogId: string;
  tier: string;
  name: string;
  basePrice: number;
  slotPrice: number;
  solPrice: number | null;
  teamCount: number;
  slotIndex: number;
}

export interface LeagueTierConfig {
  [tier: string]: {
    minOverall: number;
    maxOverall: number;
    nextTierUnlock: string | null;
  };
}

export function useGameTime() {
  const [gameTime, setGameTime] = useState<GameTime | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGameTime = useCallback(async () => {
    try {
      const res = await fetchApi('/api/game-time');
      if (res.data) setGameTime(res.data);
    } catch (err) {
      console.error('Failed to fetch game time:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGameTime();
    const interval = setInterval(fetchGameTime, 60 * 1000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchGameTime]);

  return { gameTime, loading, refresh: fetchGameTime };
}

export function useTeamSlotPricing() {
  const [pricing, setPricing] = useState<TeamSlotPricing[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPricing = useCallback(async () => {
    try {
      const res = await fetchApi('/api/game-time/team-slot-pricing');
      if (res.data) setPricing(res.data);
    } catch (err) {
      console.error('Failed to fetch team slot pricing:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  return { pricing, loading, refresh: fetchPricing };
}

export function useLeagueTierConfig() {
  const [config, setConfig] = useState<LeagueTierConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/api/game-time/league-tier-config')
      .then((res) => {
        if (res.data) setConfig(res.data);
      })
      .catch((err) => console.error('Failed to fetch league tier config:', err))
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}
