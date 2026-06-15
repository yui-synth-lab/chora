// Telemetry event payload types shared between CLI (producer), server (relay),
// and web (consumer).  These are definitions only — wiring is done in Phase 4.

import type { Pulse, PredictionRecord } from "./types.js";

/**
 * Emitted every tick (1 s) by the CLI loop.
 * Consumed by web to update the rolling signal chart and stats counter.
 */
export interface TickEvent {
  cycle_count: number;
  timestamp: number;
  pulse: Pulse;
  /** null when fewer than 32 history pulses exist (warm-up phase) */
  prediction: Omit<PredictionRecord, "id" | "pulse_id"> | null;
}

/**
 * Emitted by the CLI whenever the LLM translation loop resolves a naming.
 * Consumed by web to update the naming timeline and word cloud.
 */
export interface NamingEvent {
  pulse_id: number;
  name: string;
  description: string;
  confidence: number;
  /** true when the LLM created a brand-new name; false when it reused an existing one */
  is_new: boolean;
  pulse_pattern: Pulse;
  duration_ms: number;
}

/**
 * Emitted by the CLI whenever the 30-minute memory decay step runs.
 * Consumed by web to surface decay activity.
 */
export interface DecayEvent {
  decayed_count: number;
  forgotten_count: number;
}

/**
 * Sent by the server to a freshly-connected WebSocket client as a one-shot
 * initialisation payload with the current system statistics.
 */
export interface InitStatsEvent {
  cycle_count: number;
  active_namings: number;
  unique_names: number;
}
