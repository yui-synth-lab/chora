import { Cpu } from 'lucide-react';
import type { NamingNode } from '../lib/view-models.js';
import { getSensoryColor } from '../lib/sensory.js';

interface Props {
  namingNodes: NamingNode[];
  selectedNamingId: number | null;
  onSelectNaming: (id: number | null) => void;
}

export function MemoryCloud({ namingNodes, selectedNamingId, onSelectNaming }: Props) {
  return (
    <section className="glass-panel memory-cloud-panel">
      <div className="panel-header">
        <h2 className="panel-title">
          <Cpu size={18} />
          Naming Memory Cloud (Layer 3 Confidence &amp; Decay)
        </h2>
      </div>
      <div className="panel-content">
        <div className="cloud-container">
          {namingNodes.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>
              No active naming records found in SQLite memory.
            </div>
          ) : (
            namingNodes.map((n) => {
              const sensoryColor = getSensoryColor(n._pattern);
              const size = 12 + Math.min(22, Math.sqrt(n.reference_count) * 6);
              const opacity = 0.3 + 0.7 * (n.confidence ?? 0);
              const isSelected = selectedNamingId === n.id;

              return (
                <span
                  key={n.id}
                  className="cloud-word"
                  style={{
                    fontSize: `${size}px`,
                    color: sensoryColor,
                    opacity,
                    borderBottom: isSelected ? `2px solid ${sensoryColor}` : 'none',
                    transform: isSelected ? 'scale(1.15)' : 'none',
                    padding: '2px 6px',
                  }}
                  title={`Confidence: ${(n.confidence ?? 0).toFixed(2)} | References: ${n.reference_count}`}
                  onClick={() => onSelectNaming(isSelected ? null : n.id)}
                >
                  {n.name}
                </span>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
