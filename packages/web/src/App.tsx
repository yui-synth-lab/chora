import { useEffect, useState, useRef, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  Activity,
  Network,
  Cpu,
  Bookmark
} from 'lucide-react';

interface PulsePattern {
  signal_a: number;
  signal_b: number;
  signal_c: number;
  signal_d: number;
}

interface Naming {
  id: number;
  name: string;
  description: string;
  pulse_pattern: string; // JSON string
  prediction_error: string; // JSON string
  llm_provider: string;
  confidence: number;
  created_at: number;
  reference_count: number;
  forgotten: number;
}

interface TelemetryPoint {
  id: number;
  timestamp: number;
  signal_a: number;
  signal_b: number;
  signal_c: number;
  signal_d: number;
  predicted_a?: number;
  predicted_b?: number;
  predicted_c?: number;
  predicted_d?: number;
  error_magnitude?: number;
  surprise?: number;
  triggered_translation?: boolean;
}

interface TimelineItem {
  pulse_id: number;
  name: string;
  description: string;
  confidence: number;
  is_new: boolean;
  pulse_pattern: PulsePattern;
  duration_ms: number;
  timestamp: number;
}

export default function App() {
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [namings, setNamings] = useState<Naming[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [stats, setStats] = useState({
    cycle_count: 0,
    active_namings: 0,
    unique_names: 0
  });
  const [isConnected, setIsConnected] = useState(false);
  const [surpriseActive, setSurpriseActive] = useState(false);
  const [selectedNamingId, setSelectedNamingId] = useState<number | null>(null);

  const timelineEndRef = useRef<HTMLDivElement>(null);
  const isIntentionalClose = useRef(false);

  // Fetch initial REST baselines
  const loadBaselineData = async () => {
    try {
      const [historyRes, namingsRes, stateRes] = await Promise.all([
        fetch('/api/history'),
        fetch('/api/namings'),
        fetch('/api/state')
      ]);

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }

      if (namingsRes.ok) {
        const namingsData = await namingsRes.json();
        setNamings(namingsData);
      }

      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setStats({
          cycle_count: stateData.cycle_count,
          active_namings: stateData.active_namings,
          unique_names: stateData.unique_names
        });
      }
    } catch (err) {
      console.error('Failed to load baseline data:', err);
    }
  };

  useEffect(() => {
    loadBaselineData();

    // Establish WebSocket Connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Proxy points /api, but websockets are separate. Express runs on 3001
    const wsPort = 3001; 
    const wsUrl = `${wsProtocol}//${window.location.hostname}:${wsPort}`;
    console.log(`[CHORA WebSocket] Connecting to ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[CHORA WebSocket] Connected to event stream');
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (!isIntentionalClose.current) {
        console.log('[CHORA WebSocket] Disconnected from event stream. Retrying in 5s...');
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
    };

    ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);

        switch (type) {
          case 'init_stats':
            setStats({
              cycle_count: data.cycle_count,
              active_namings: data.active_namings,
              unique_names: data.unique_names
            });
            break;

          case 'tick':
            // Append new telemetry point
            setHistory(prev => {
              const updated = [...prev, {
                id: data.cycle_count,
                timestamp: data.timestamp,
                ...data.pulse,
                ...data.prediction
              }];
              // Keep rolling window of 100 elements
              if (updated.length > 100) {
                return updated.slice(updated.length - 100);
              }
              return updated;
            });

            // Update cycles
            setStats(prev => ({
              ...prev,
              cycle_count: data.cycle_count
            }));

            // Flash screen border on surprise triggers
            if (data.prediction?.triggered_translation) {
              setSurpriseActive(true);
              setTimeout(() => setSurpriseActive(false), 500);
            }
            break;

          case 'naming':
            // Prepend naming event to timeline
            setTimeline(prev => [
              {
                pulse_id: data.pulse_id,
                name: data.name,
                description: data.description,
                confidence: data.confidence,
                is_new: data.is_new,
                pulse_pattern: data.pulse_pattern,
                duration_ms: data.duration_ms,
                timestamp: Date.now()
              },
              ...prev
            ]);

            // Reload active namings list to update word cloud and 2D map
            fetch('/api/namings')
              .then(res => res.json())
              .then(data => {
                setNamings(data);
                setStats(prev => ({
                  ...prev,
                  active_namings: data.length
                }));
              })
              .catch(err => console.error('Failed to reload namings:', err));

            // Update stats
            setStats(prev => ({
              ...prev,
              unique_names: data.is_new ? prev.unique_names + 1 : prev.unique_names
            }));
            break;

          case 'decay':
            // Reload active namings to display decayed confidences and forgotten values
            fetch('/api/namings')
              .then(res => res.json())
              .then(data => {
                setNamings(data);
                setStats(prev => ({
                  ...prev,
                  active_namings: data.length
                }));
              })
              .catch(err => console.error('Failed to reload namings after decay:', err));
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    return () => {
      isIntentionalClose.current = true;
      ws.close();
    };
  }, []);

  // Format Recharts data timestamp
  const formatTime = (tickTime: number) => {
    return new Date(tickTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  /**
   * Determine sensory color tone depending on which signal is dominant
   */
  const getSensoryColor = (pattern: PulsePattern) => {
    const { signal_a, signal_b, signal_c, signal_d } = pattern;
    const maxVal = Math.max(signal_a, signal_b, signal_c, signal_d);
    if (maxVal === signal_a) return '#10B981'; // Emerald (A)
    if (maxVal === signal_b) return '#3B82F6'; // Blue (B)
    if (maxVal === signal_c) return '#EF4444'; // Red (C)
    return '#EC4899'; // Pink (D)
  };

  // 4D distance helper for SVG map links
  const getDistance4D = (p1: PulsePattern, p2: PulsePattern) => {
    const dA = p1.signal_a - p2.signal_a;
    const dB = p1.signal_b - p2.signal_b;
    const dC = p1.signal_c - p2.signal_c;
    const dD = p1.signal_d - p2.signal_d;
    return Math.sqrt(dA * dA + dB * dB + dC * dC + dD * dD);
  };

  // Pre-parse pulse_pattern JSON and compute SVG coordinates once per namings change
  const namingNodes = useMemo(() =>
    namings.map(n => {
      let pattern: PulsePattern = { signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 };
      try { pattern = JSON.parse(n.pulse_pattern) as PulsePattern; } catch {}
      return { ...n, _pattern: pattern };
    }),
    [namings]
  );

  const namingEdges = useMemo(() => {
    const edges: Array<{ key: string; x1: number; y1: number; x2: number; y2: number; id1: number; id2: number }> = [];
    for (let i = 0; i < namingNodes.length; i++) {
      const n1 = namingNodes[i];
      const p1 = n1._pattern;
      const x1 = 50 + (p1.signal_a - p1.signal_c) * 40;
      const y1 = 50 + (p1.signal_b - p1.signal_d) * 40;
      for (let j = i + 1; j < namingNodes.length; j++) {
        const n2 = namingNodes[j];
        const p2 = n2._pattern;
        if (getDistance4D(p1, p2) < 0.35) {
          edges.push({
            key: `${n1.id}-${n2.id}`,
            x1, y1,
            x2: 50 + (p2.signal_a - p2.signal_c) * 40,
            y2: 50 + (p2.signal_b - p2.signal_d) * 40,
            id1: n1.id,
            id2: n2.id
          });
        }
      }
    }
    return edges;
  }, [namingNodes]);

  return (
    <>
      {/* Surprise trigger flash border */}
      <div className={`surprise-flash-overlay ${surpriseActive ? 'active' : ''}`} />

      <div className="dashboard-container">
        {/* Header Section */}
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

        {/* Dashboard Grid */}
        <main className="main-grid">
          
          {/* 1. Pulse Stream View */}
          <section className="glass-panel signal-panel">
            <div className="panel-header">
              <h2 className="panel-title">
                <Activity size={18} />
                Sensory Pulse Stream (Layer 0 & Layer 1)
              </h2>
            </div>
            <div className="panel-content">
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTime}
                      stroke="var(--text-muted)"
                      style={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      stroke="var(--text-muted)"
                      style={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(13,17,28,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontFamily: 'Outfit'
                      }}
                      labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                    />
                    {/* Actual Signals */}
                    <Line type="monotone" dataKey="signal_a" stroke="var(--color-a)" strokeWidth={2} dot={false} name="Signal A" />
                    <Line type="monotone" dataKey="signal_b" stroke="var(--color-b)" strokeWidth={2} dot={false} name="Signal B" />
                    <Line type="monotone" dataKey="signal_c" stroke="var(--color-c)" strokeWidth={2} dot={false} name="Signal C" />
                    <Line type="monotone" dataKey="signal_d" stroke="var(--color-d)" strokeWidth={2} dot={false} name="Signal D" />
                    
                    {/* Predicted Signals (Dashed) */}
                    <Line type="monotone" dataKey="predicted_a" stroke="var(--color-a)" strokeDasharray="3 3" strokeWidth={1} dot={false} name="Pred A" />
                    <Line type="monotone" dataKey="predicted_b" stroke="var(--color-b)" strokeDasharray="3 3" strokeWidth={1} dot={false} name="Pred B" />
                    <Line type="monotone" dataKey="predicted_c" stroke="var(--color-c)" strokeDasharray="3 3" strokeWidth={1} dot={false} name="Pred C" />
                    <Line type="monotone" dataKey="predicted_d" stroke="var(--color-d)" strokeDasharray="3 3" strokeWidth={1} dot={false} name="Pred D" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Rolling surprise heatmap */}
            <div className="surprise-track">
              {history.map((pt, idx) => {
                const surpriseVal = pt.surprise ?? 0;
                const heightPercent = Math.min(100, surpriseVal * 400);
                const isTriggered = pt.triggered_translation;
                return (
                  <div
                    key={idx}
                    className="surprise-bar"
                    style={{
                      height: `${Math.max(20, heightPercent)}%`,
                      backgroundColor: isTriggered 
                        ? 'var(--color-surprise)' 
                        : `rgba(245, 158, 11, ${Math.min(1.0, surpriseVal * 3)})`
                    }}
                    title={`Surprise: ${surpriseVal.toFixed(3)} ${isTriggered ? '(Triggered)' : ''}`}
                  />
                );
              })}
            </div>
          </section>

          {/* 2. Self-Model 2D SVG Map */}
          <section className="glass-panel self-model-panel">
            <div className="panel-header">
              <h2 className="panel-title">
                <Network size={18} />
                Self-Model Map (Layer 3 Coordinate Projection)
              </h2>
            </div>
            <div className="panel-content">
              <svg className="svg-map-canvas" viewBox="0 0 100 100">
                {/* Grid guidelines */}
                <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.015)" strokeWidth={0.5} />
                <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.015)" strokeWidth={0.5} />

                {/* Render Links between close 4D memories (memoized) */}
                {namingEdges.map(edge => {
                  const isHighlighted = selectedNamingId === edge.id1 || selectedNamingId === edge.id2;
                  return (
                    <line
                      key={edge.key}
                      className={`map-edge ${isHighlighted ? 'active' : ''}`}
                      x1={edge.x1}
                      y1={edge.y1}
                      x2={edge.x2}
                      y2={edge.y2}
                    />
                  );
                })}

                {/* Render Nodes (memoized) */}
                {namingNodes.map((n) => {
                  const pattern = n._pattern;
                  const x = 50 + (pattern.signal_a - pattern.signal_c) * 40;
                  const y = 50 + (pattern.signal_b - pattern.signal_d) * 40;
                  const color = getSensoryColor(pattern);
                  const isSelected = selectedNamingId === n.id;

                  return (
                    <g key={n.id}>
                      <circle
                        className={`map-node ${isSelected ? 'selected' : ''}`}
                        cx={x}
                        cy={y}
                        r={isSelected ? 3 : 1.8}
                        fill={color}
                        stroke="#FFFFFF"
                        strokeWidth={isSelected ? 0.8 : 0.3}
                        onClick={() => setSelectedNamingId(isSelected ? null : n.id)}
                      />
                      <text
                        className="map-node-label"
                        x={x}
                        y={y - (isSelected ? 4.5 : 3)}
                        textAnchor="middle"
                        style={{
                          fontSize: isSelected ? '4px' : '2.5px',
                          fill: isSelected ? '#FFFFFF' : 'var(--text-secondary)'
                        }}
                      >
                        {n.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </section>

          {/* 3. Naming Timeline Log */}
          <section className="glass-panel timeline-panel">
            <div className="panel-header">
              <h2 className="panel-title">
                <Bookmark size={18} />
                Naming Event Timeline (Layer 2 Naming)
              </h2>
            </div>
            <div className="panel-content">
              <div className="timeline-scroll">
                {timeline.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>
                    Waiting for surprise triggers to generate naming translation events...
                  </div>
                ) : (
                  timeline.map((item, idx) => {
                    const sensoryColor = getSensoryColor(item.pulse_pattern);
                    return (
                      <div key={idx} className="timeline-item">
                        <div className="timeline-dot-col">
                          <span className={`timeline-dot ${item.is_new ? 'new' : 'existing'}`} style={{ backgroundColor: sensoryColor }} />
                          {idx !== timeline.length - 1 && <span className="timeline-line" />}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-meta">
                            <span>CYCLE #{item.pulse_id}</span>
                            <span>{item.duration_ms}ms</span>
                          </div>
                          <div className="timeline-name-row">
                            <span className="timeline-name" style={{ color: sensoryColor }}>"{item.name}"</span>
                            <span className={`timeline-badge ${item.is_new ? 'new' : 'existing'}`}>
                              {item.is_new ? 'new name' : 'reinforced'}
                            </span>
                          </div>
                          <p className="timeline-desc">{item.description}</p>
                          <div className="timeline-vector">
                            <span className="vector-chip">A: {item.pulse_pattern.signal_a.toFixed(2)}</span>
                            <span className="vector-chip">B: {item.pulse_pattern.signal_b.toFixed(2)}</span>
                            <span className="vector-chip">C: {item.pulse_pattern.signal_c.toFixed(2)}</span>
                            <span className="vector-chip">D: {item.pulse_pattern.signal_d.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={timelineEndRef} />
              </div>
            </div>
          </section>

          {/* 4. Word Cloud Panel */}
          <section className="glass-panel memory-cloud-panel">
            <div className="panel-header">
              <h2 className="panel-title">
                <Cpu size={18} />
                Naming Memory Cloud (Layer 3 Confidence & Decay)
              </h2>
            </div>
            <div className="panel-content">
              <div className="cloud-container">
                {namings.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>
                    No active naming records found in SQLite memory.
                  </div>
                ) : (
                  namingNodes.map((n) => {
                    const pattern = n._pattern;
                    const sensoryColor = getSensoryColor(pattern);
                    // Sizing based on reference count
                    const size = 12 + Math.min(22, Math.sqrt(n.reference_count) * 6);
                    // Fade out word based on confidence decay level
                    const opacity = 0.3 + 0.7 * (n.confidence ?? 0);
                    const isSelected = selectedNamingId === n.id;

                    return (
                      <span
                        key={n.id}
                        className="cloud-word"
                        style={{
                          fontSize: `${size}px`,
                          color: sensoryColor,
                          opacity: opacity,
                          borderBottom: isSelected ? `2px solid ${sensoryColor}` : 'none',
                          transform: isSelected ? 'scale(1.15)' : 'none',
                          padding: '2px 6px'
                        }}
                        title={`Confidence: ${(n.confidence ?? 0).toFixed(2)} | References: ${n.reference_count}`}
                        onClick={() => setSelectedNamingId(isSelected ? null : n.id)}
                      >
                        {n.name}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
