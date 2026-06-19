import type { PulsePattern } from './sensory.js';

/** Raw naming record returned by /api/namings */
export interface Naming {
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

/** Telemetry row returned by /api/history and derived from tick events */
export interface TelemetryPoint {
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

/** A naming record with its pre-parsed pulse pattern */
export interface NamingNode extends Naming {
  _pattern: PulsePattern;
}

/** Item in the real-time naming event timeline */
export interface TimelineItem {
  pulse_id: number;
  name: string;
  description: string;
  confidence: number;
  is_new: boolean;
  pulse_pattern: PulsePattern;
  duration_ms: number;
  timestamp: number;
}

/** K-line record from /api/klines */
export interface KLine {
  id: number;
  agent_a_id: number;
  agent_b_id: number;
  strength: number;
  formed_at: number;
  last_co_activation: number;
  co_activation_count: number;
}

/** Agency record from /api/agencies */
export interface Agency {
  id: number;
  name: string | null;
  member_ids: string;
  coherence: number;
  formed_at: number;
  updated_at: number;
}

/** Per-agent activation level (from WebSocket activation events) */
export interface AgentActivationVM {
  agentId: number;
  name: string;
  totalActivation: number;
}
