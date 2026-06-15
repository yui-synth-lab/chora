import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Activity } from 'lucide-react';
import type { TelemetryPoint } from '../lib/view-models.js';

interface Props {
  history: TelemetryPoint[];
}

function formatTime(tickTime: number): string {
  return new Date(tickTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function PulseChart({ history }: Props) {
  return (
    <section className="glass-panel signal-panel">
      <div className="panel-header">
        <h2 className="panel-title">
          <Activity size={18} />
          Sensory Pulse Stream (Layer 0 &amp; Layer 1)
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
                  fontFamily: 'Outfit',
                }}
                labelFormatter={(label) => `Time: ${new Date(label as number).toLocaleTimeString()}`}
              />
              <Line type="monotone" dataKey="signal_a" stroke="var(--color-a)" strokeWidth={2} dot={false} name="Signal A" />
              <Line type="monotone" dataKey="signal_b" stroke="var(--color-b)" strokeWidth={2} dot={false} name="Signal B" />
              <Line type="monotone" dataKey="signal_c" stroke="var(--color-c)" strokeWidth={2} dot={false} name="Signal C" />
              <Line type="monotone" dataKey="signal_d" stroke="var(--color-d)" strokeWidth={2} dot={false} name="Signal D" />
              <Line type="monotone" dataKey="predicted_a" stroke="var(--color-a)" strokeDasharray="3 3" strokeWidth={1} dot={false} name="Pred A" />
              <Line type="monotone" dataKey="predicted_b" stroke="var(--color-b)" strokeDasharray="3 3" strokeWidth={1} dot={false} name="Pred B" />
              <Line type="monotone" dataKey="predicted_c" stroke="var(--color-c)" strokeDasharray="3 3" strokeWidth={1} dot={false} name="Pred C" />
              <Line type="monotone" dataKey="predicted_d" stroke="var(--color-d)" strokeDasharray="3 3" strokeWidth={1} dot={false} name="Pred D" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

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
                  : `rgba(245, 158, 11, ${Math.min(1.0, surpriseVal * 3)})`,
              }}
              title={`Surprise: ${surpriseVal.toFixed(3)} ${isTriggered ? '(Triggered)' : ''}`}
            />
          );
        })}
      </div>
    </section>
  );
}
