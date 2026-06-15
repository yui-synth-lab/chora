import { useEffect, useState, useMemo } from 'react';
import type { PulsePattern } from './lib/sensory.js';
import { useBaselineData } from './hooks/useBaselineData.js';
import { useChoraSocket, tickToTelemetryPoint, namingToTimelineItem } from './hooks/useChoraSocket.js';
import { PulseChart } from './components/PulseChart.js';
import { SelfModelMap, buildNamingEdges } from './components/SelfModelMap.js';
import { NamingTimeline } from './components/NamingTimeline.js';
import { MemoryCloud } from './components/MemoryCloud.js';
import type { TimelineItem, NamingNode } from './lib/view-models.js';
import type { TickEvent, NamingEvent, InitStatsEvent } from '@chora/core/events';

export default function App() {
  const { history, setHistory, namings, stats, setStats, loadBaseline, reloadNamings } =
    useBaselineData();
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [surpriseActive, setSurpriseActive] = useState(false);
  const [selectedNamingId, setSelectedNamingId] = useState<number | null>(null);

  useEffect(() => { void loadBaseline(); }, [loadBaseline]);

  useChoraSocket({
    onConnectionChange: setIsConnected,

    onInitStats: (data: InitStatsEvent) => {
      setStats({ cycle_count: data.cycle_count, active_namings: data.active_namings, unique_names: data.unique_names });
    },

    onTick: (data: TickEvent) => {
      setHistory(prev => {
        const updated = [...prev, tickToTelemetryPoint(data)];
        return updated.length > 100 ? updated.slice(updated.length - 100) : updated;
      });
      setStats(prev => ({ ...prev, cycle_count: data.cycle_count }));
      if (data.prediction?.triggered_translation) {
        setSurpriseActive(true);
        setTimeout(() => setSurpriseActive(false), 500);
      }
    },

    onNaming: (data: NamingEvent) => {
      setTimeline(prev => [namingToTimelineItem(data), ...prev]);
      void reloadNamings();
      setStats(prev => ({ ...prev, unique_names: data.is_new ? prev.unique_names + 1 : prev.unique_names }));
    },

    onDecay: () => { void reloadNamings(); },
  });

  const namingNodes = useMemo<NamingNode[]>(() =>
    (Array.isArray(namings) ? namings : []).map(n => {
      let pattern: PulsePattern = { signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 };
      try { pattern = JSON.parse(n.pulse_pattern) as PulsePattern; } catch { /* ignore */ }
      return { ...n, _pattern: pattern };
    }),
    [namings],
  );

  const namingEdges = useMemo(() => buildNamingEdges(namingNodes), [namingNodes]);

  return (
    <>
      <div className={`surprise-flash-overlay ${surpriseActive ? 'active' : ''}`} />
      <div className="dashboard-container">
        <header className="glass-panel header-panel">
          <div className="brand-section">
            <h1 className="brand-title">CHORA</h1>
            <span className="brand-subtitle">Emergent Consciousness Monitor</span>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Cycle Count</span>
              <span className="stat-value">{stats.cycle_count}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Active Memories</span>
              <span className="stat-value">{stats.active_namings}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Unique Names</span>
              <span className="stat-value">{stats.unique_names}</span>
            </div>
          </div>
          <div className="live-indicator">
            <span className={`pulse-dot ${isConnected ? 'active' : ''} ${surpriseActive ? 'surprise' : ''}`} />
            <span>{isConnected ? 'STREAM CONNECTED' : 'OFFLINE'}</span>
          </div>
        </header>
        <main className="main-grid">
          <PulseChart history={history} />
          <SelfModelMap
            namingNodes={namingNodes}
            namingEdges={namingEdges}
            selectedNamingId={selectedNamingId}
            onSelectNaming={setSelectedNamingId}
          />
          <NamingTimeline timeline={timeline} />
          <MemoryCloud
            namingNodes={namingNodes}
            selectedNamingId={selectedNamingId}
            onSelectNaming={setSelectedNamingId}
          />
        </main>
      </div>
    </>
  );
}
