import { Waypoints, Maximize2, Minimize2 } from 'lucide-react';
import type { NamingNode, KLine, Agency, AgentActivationVM } from '../lib/view-models.js';
import { getSensoryColor, projectTo2D } from '../lib/sensory.js';

interface Props {
  namingNodes: NamingNode[];
  klines: KLine[];
  agencies: Agency[];
  activations: Map<number, AgentActivationVM>;
  isMaximized: boolean;
  onToggleMaximize: () => void;
}

export function AgentNetwork({ namingNodes, klines, agencies, activations, isMaximized, onToggleMaximize }: Props) {
  const nodeMap = new Map(namingNodes.map(n => [n.id, n]));

  const agencyMembers = new Set<number>();
  for (const agency of agencies) {
    try {
      const ids = JSON.parse(agency.member_ids) as number[];
      for (const id of ids) agencyMembers.add(id);
    } catch { /* ignore */ }
  }

  return (
    <section className="glass-panel agent-network-panel">
      <div className="panel-header">
        <div className="panel-header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h2 className="panel-title">
            <Waypoints size={18} />
            Society of Mind — Agent Network
          </h2>
          <div className="agent-network-stats">
            <span className="an-stat">{klines.length} K-lines</span>
            <span className="an-stat">{agencies.length} agencies</span>
          </div>
        </div>
        <button
          onClick={onToggleMaximize}
          className="panel-action-btn"
          title={isMaximized ? "Minimize" : "Maximize"}
          aria-label={isMaximized ? "Minimize panel" : "Maximize panel"}
        >
          {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      <div className="panel-content">
        <svg className="svg-map-canvas" viewBox="0 0 100 100">
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.015)" strokeWidth={0.5} />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.015)" strokeWidth={0.5} />

          {klines.map(kl => {
            const nA = nodeMap.get(kl.agent_a_id);
            const nB = nodeMap.get(kl.agent_b_id);
            if (!nA || !nB) return null;
            const posA = projectTo2D(nA._pattern);
            const posB = projectTo2D(nB._pattern);
            const opacity = 0.1 + kl.strength * 0.5;
            const width = 0.3 + kl.strength * 1.2;
            return (
              <line
                key={`kl-${kl.id}`}
                x1={posA.x} y1={posA.y}
                x2={posB.x} y2={posB.y}
                stroke={`rgba(245, 158, 11, ${opacity})`}
                strokeWidth={width}
              />
            );
          })}

          {namingNodes.map(n => {
            const { x, y } = projectTo2D(n._pattern);
            const color = getSensoryColor(n._pattern);
            const act = activations.get(n.id);
            const activation = act?.totalActivation ?? 0;
            const baseR = 1.2;
            const r = baseR + activation * 3;
            const glowOpacity = activation * 0.6;
            const isInAgency = agencyMembers.has(n.id);

            return (
              <g key={n.id}>
                {activation > 0.1 && (
                  <circle
                    cx={x} cy={y} r={r + 2}
                    fill="none"
                    stroke={color}
                    strokeWidth={0.3}
                    opacity={glowOpacity}
                  />
                )}
                {isInAgency && (
                  <circle
                    cx={x} cy={y} r={r + 1}
                    fill="none"
                    stroke="rgba(245, 158, 11, 0.3)"
                    strokeWidth={0.4}
                    strokeDasharray="1 1"
                  />
                )}
                <circle
                  cx={x} cy={y} r={r}
                  fill={color}
                  opacity={0.4 + activation * 0.6}
                  stroke="#FFFFFF"
                  strokeWidth={0.3}
                />
                <text
                  x={x} y={y - r - 1.5}
                  textAnchor="middle"
                  style={{
                    fontSize: '2.2px',
                    fill: activation > 0.3 ? '#FFFFFF' : 'var(--text-secondary)',
                    opacity: 0.5 + activation * 0.5,
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
  );
}
