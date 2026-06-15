import { Network } from 'lucide-react';
import type { NamingNode } from '../lib/view-models.js';
import { getSensoryColor, projectTo2D, getDistance4D } from '../lib/sensory.js';

interface Edge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  id1: number;
  id2: number;
}

interface Props {
  namingNodes: NamingNode[];
  namingEdges: Edge[];
  selectedNamingId: number | null;
  onSelectNaming: (id: number | null) => void;
}

export function SelfModelMap({ namingNodes, namingEdges, selectedNamingId, onSelectNaming }: Props) {
  return (
    <section className="glass-panel self-model-panel">
      <div className="panel-header">
        <h2 className="panel-title">
          <Network size={18} />
          Self-Model Map (Layer 3 Coordinate Projection)
        </h2>
      </div>
      <div className="panel-content">
        <svg className="svg-map-canvas" viewBox="0 0 100 100">
          <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.015)" strokeWidth={0.5} />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.015)" strokeWidth={0.5} />

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

          {namingNodes.map((n) => {
            const { x, y } = projectTo2D(n._pattern);
            const color = getSensoryColor(n._pattern);
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
                  onClick={() => onSelectNaming(isSelected ? null : n.id)}
                />
                <text
                  className="map-node-label"
                  x={x}
                  y={y - (isSelected ? 4.5 : 3)}
                  textAnchor="middle"
                  style={{
                    fontSize: isSelected ? '4px' : '2.5px',
                    fill: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
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

/** Build edge list from namingNodes (extracted so App.tsx can memoize it). */
export function buildNamingEdges(namingNodes: NamingNode[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < namingNodes.length; i++) {
    const n1 = namingNodes[i];
    const { x: x1, y: y1 } = projectTo2D(n1._pattern);
    for (let j = i + 1; j < namingNodes.length; j++) {
      const n2 = namingNodes[j];
      if (getDistance4D(n1._pattern, n2._pattern) < 0.35) {
        const { x: x2, y: y2 } = projectTo2D(n2._pattern);
        edges.push({ key: `${n1.id}-${n2.id}`, x1, y1, x2, y2, id1: n1.id, id2: n2.id });
      }
    }
  }
  return edges;
}
