import { useRef } from 'react';
import { Bookmark, Maximize2, Minimize2 } from 'lucide-react';
import type { TimelineItem } from '../lib/view-models.js';
import { getSensoryColor } from '../lib/sensory.js';

interface Props {
  timeline: TimelineItem[];
  isMaximized: boolean;
  onToggleMaximize: () => void;
}

export function NamingTimeline({ timeline, isMaximized, onToggleMaximize }: Props) {
  const timelineEndRef = useRef<HTMLDivElement>(null);

  return (
    <section className="glass-panel timeline-panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <h2 className="panel-title">
            <Bookmark size={18} />
            Naming Event Timeline (Layer 2 Naming)
          </h2>
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
  );
}
