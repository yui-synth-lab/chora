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
