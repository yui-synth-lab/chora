import { useState, useCallback } from 'react';
import type { TelemetryPoint, Naming, KLine, Agency } from '../lib/view-models.js';

export interface BaselineStats {
  cycle_count: number;
  active_namings: number;
  unique_names: number;
}

export interface BaselineData {
  history: TelemetryPoint[];
  namings: Naming[];
  stats: BaselineStats;
}

/**
 * useBaselineData — fetches the initial REST snapshot from the server.
 * Returns the data plus a `reload` callback for on-demand refresh.
 */
export function useBaselineData() {
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [namings, setNamings] = useState<Naming[]>([]);
  const [klines, setKlines] = useState<KLine[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [stats, setStats] = useState<BaselineStats>({
    cycle_count: 0,
    active_namings: 0,
    unique_names: 0,
  });

  const loadBaseline = useCallback(async () => {
    try {
      const [historyRes, namingsRes, stateRes, klinesRes, agenciesRes] = await Promise.all([
        fetch('/api/history'),
        fetch('/api/namings'),
        fetch('/api/state'),
        fetch('/api/klines'),
        fetch('/api/agencies'),
      ]);

      if (historyRes.ok) {
        const data = await historyRes.json() as TelemetryPoint[];
        setHistory(data);
      }
      if (namingsRes.ok) {
        const data = await namingsRes.json() as Naming[];
        setNamings(data);
      }
      if (stateRes.ok) {
        const data = await stateRes.json() as BaselineStats;
        setStats({ cycle_count: data.cycle_count, active_namings: data.active_namings, unique_names: data.unique_names });
      }
      if (klinesRes.ok) {
        const data = await klinesRes.json() as KLine[];
        setKlines(data);
      }
      if (agenciesRes.ok) {
        const data = await agenciesRes.json() as Agency[];
        setAgencies(data);
      }
    } catch (err) {
      console.error('Failed to load baseline data:', err);
    }
  }, []);

  const reloadNamings = useCallback(async () => {
    try {
      const res = await fetch('/api/namings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Naming[];
      if (!Array.isArray(data)) return;
      setNamings(data);
      setStats(prev => ({ ...prev, active_namings: data.length }));
    } catch (err) {
      console.error('Failed to reload namings:', err);
    }
  }, []);

  const reloadKlines = useCallback(async () => {
    try {
      const res = await fetch('/api/klines');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as KLine[];
      if (Array.isArray(data)) setKlines(data);
    } catch (err) {
      console.error('Failed to reload klines:', err);
    }
  }, []);

  return {
    history, setHistory, namings, setNamings, klines, setKlines, agencies, setAgencies,
    stats, setStats, loadBaseline, reloadNamings, reloadKlines,
  };
}
