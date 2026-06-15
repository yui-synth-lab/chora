// Domain types — the single source of truth for all core data shapes.
// db/client.ts, prediction/model.ts, memory/manager.ts and all other modules
// import from here. db/client.ts re-exports these for backward compatibility.

// ── Pulse ────────────────────────────────────────────────────────────────────

export interface Pulse {
  timestamp: number;
  signal_a: number;
  signal_b: number;
  signal_c: number;
  signal_d: number;
}

// ── Database record types ─────────────────────────────────────────────────────

export interface PulseRecord {
  id?: number;
  timestamp: number;
  signal_a: number;
  signal_b: number;
  signal_c: number;
  signal_d: number;
}

export interface SystemStateRecord {
  cycle_count: number;
  total_namings: number;
  unique_names: number;
  last_translation_at: number | null;
  last_decayed_at: number | null;
  generator_step?: number;
  generator_signal_b_state?: number;
  generator_signal_d_state?: number;
}

export interface PredictionRecord {
  id?: number;
  pulse_id: number;
  predicted_a: number;
  predicted_b: number;
  predicted_c: number;
  predicted_d: number;
  error_magnitude: number;
  surprise: number;
  triggered_translation: boolean;
}

export interface NamingRecord {
  id?: number;
  name: string;
  description: string | null;
  pulse_pattern: string; // JSON string
  prediction_error: string; // JSON string
  llm_provider: string | null;
  confidence: number | null;
  created_at: number;
  reference_count?: number;
  forgotten?: number;
}

export interface TranslationEventRecord {
  id?: number;
  pulse_id: number;
  naming_id: number | null;
  llm_provider: string;
  prompt: string;
  response: string;
  duration_ms: number | null;
  created_at: number;
}

// ── Prediction ───────────────────────────────────────────────────────────────

export interface PredictionResult {
  predicted_a: number;
  predicted_b: number;
  predicted_c: number;
  predicted_d: number;
  error_magnitude: number;
  surprise: number;
  triggered_translation: boolean;
}
