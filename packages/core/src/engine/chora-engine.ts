import type { ChoraDatabase } from "../db/client.js";
import type { PulseGenerator } from "../pulse/generator.js";
import type { PredictiveModel } from "../prediction/model.js";
import type { NamingService } from "../memory/naming-service.js";
import type { TranslationService } from "../translation/translation-service.js";
import type { EventSink } from "./event-sink.js";
import type { Clock } from "./clock.js";
import type { PredictionResult } from "../domain/types.js";

// ── Result types returned from tick() for the CLI renderer ──────────────────

export interface TickResult {
  cycleCount: number;
  timestamp: number;
  pulse: {
    signal_a: number;
    signal_b: number;
    signal_c: number;
    signal_d: number;
  };
  /** null when fewer than 32 history pulses exist */
  prediction: PredictionResult | null;
  phase: TickPhase;
}

export type TickPhase =
  | { kind: "warming_up"; historyLen: number }
  | { kind: "predicted"; surpriseTriggered: boolean; cooldownSeconds?: number; translating?: boolean }
  | { kind: "prediction_error"; message: string };

export interface ChoraEngineConfig {
  /** Tick interval in ms — used only for metadata, not scheduled here. */
  tickMs?: number;
  /** Cooldown between translation requests in ms. */
  cooldownMs?: number;
  /** Wall-clock interval between decay runs in ms. */
  decayIntervalMs?: number;
  decayFactor?: number;
  forgottenThreshold?: number;
  surpriseThreshold?: number;
  historyWindow?: number;
  /** Name label used in translation event rows, e.g. "ollama (model-name)". */
  llmProviderLabel?: string;
}

/**
 * ChoraEngine — owns the tick orchestration (invariants 1–11 from the spec).
 *
 * Injected dependencies:
 *   db              — database facade (all persistence)
 *   generator       — pulse generator (Layer 0)
 *   model           — predictive model (Layer 1); may be uninitialised (Layer-0-only fallback)
 *   namingService   — NamingService (Layer 3 memory)
 *   translationSvc  — TranslationService (Layer 2 LLM call)
 *   eventSink       — typed telemetry sink
 *   clock           — wall-clock abstraction (testable)
 *
 * The engine does NOT own the setInterval; the CLI does. Call engine.tick()
 * from the interval callback.
 */
export class ChoraEngine {
  // Mutable state
  private isTranslating = false;
  private lastTranslationTime = 0;
  lastDecayTime: number;

  private readonly config: Required<ChoraEngineConfig>;

  constructor(
    private readonly db: ChoraDatabase,
    private readonly generator: PulseGenerator,
    private readonly model: PredictiveModel,
    private readonly namingService: NamingService,
    private readonly translationSvc: TranslationService,
    private readonly eventSink: EventSink,
    private readonly clock: Clock,
    config: ChoraEngineConfig = {},
    initialLastDecayTime = 0,
  ) {
    this.config = {
      tickMs: config.tickMs ?? 1000,
      cooldownMs: config.cooldownMs ?? 10000,
      decayIntervalMs: config.decayIntervalMs ?? 30 * 60 * 1000,
      decayFactor: config.decayFactor ?? 0.05,
      forgottenThreshold: config.forgottenThreshold ?? 0.1,
      surpriseThreshold: config.surpriseThreshold ?? 0.15,
      historyWindow: config.historyWindow ?? 32,
      llmProviderLabel: config.llmProviderLabel ?? "ollama",
    };
    this.lastDecayTime = initialLastDecayTime;
  }

  /** Close the underlying database connection. Call on shutdown. */
  close(): void {
    this.db.close();
  }

  /**
   * Executes one tick. Returns a TickResult so the CLI can render output
   * without any direct db access.
   *
   * Async translation runs fire-and-forget (non-blocking).
   */
  async tick(
    onTranslationLog?: (line: string) => void,
  ): Promise<TickResult> {
    const log = onTranslationLog ?? (() => {});

    try {
      // ── Invariant 1: timestamp = now ──────────────────────────────────────
      const timestamp = this.clock.now();

      // ── Invariant 2: read system state; compute next cycle count ──────────
      const state = this.db.getSystemState();
      const nextCycleCount = state.cycle_count + 1;

      // ── Invariant 3: generate pulse; read generator state ─────────────────
      const pulse = this.generator.generate(timestamp);
      const genState = this.generator.getState();

      // ── Invariant 4: persist system state BEFORE inserting pulse ─────────
      this.db.updateSystemState(
        nextCycleCount,
        genState.step,
        genState.signalBState,
        genState.signalDState,
      );

      // ── Invariant 5: insert pulse → pulseId ───────────────────────────────
      const pulseId = this.db.insertPulse(pulse);

      // ── Invariant 6: get recent pulse history ─────────────────────────────
      const history = this.db.getRecentPulses(this.config.historyWindow);

      let prediction: PredictionResult | null = null;
      let phase: TickPhase;

      // ── Invariant 7: predict + translation trigger ────────────────────────
      if (history.length >= this.config.historyWindow) {
        try {
          prediction = await this.model.predict(history, pulse);

          this.db.insertPrediction({
            pulse_id: pulseId,
            predicted_a: prediction.predicted_a,
            predicted_b: prediction.predicted_b,
            predicted_c: prediction.predicted_c,
            predicted_d: prediction.predicted_d,
            error_magnitude: prediction.error_magnitude,
            surprise: prediction.surprise,
            triggered_translation: prediction.triggered_translation,
          });

          if (prediction.triggered_translation) {
            const timeSinceLast = this.clock.now() - this.lastTranslationTime;

            if (!this.isTranslating && timeSinceLast > this.config.cooldownMs) {
              // Fire-and-forget translation (non-blocking)
              this.isTranslating = true;
              this._runTranslation(
                pulseId,
                pulse,
                history,
                prediction,
                log,
              );
              phase = { kind: "predicted", surpriseTriggered: true };
            } else if (this.isTranslating) {
              phase = { kind: "predicted", surpriseTriggered: true, translating: true };
            } else {
              const secondsLeft = Math.ceil(
                (this.config.cooldownMs - timeSinceLast) / 1000,
              );
              phase = { kind: "predicted", surpriseTriggered: true, cooldownSeconds: secondsLeft };
            }
          } else {
            phase = { kind: "predicted", surpriseTriggered: false };
          }
        } catch (predErr) {
          phase = {
            kind: "prediction_error",
            message: (predErr as Error).message,
          };
        }
      } else {
        phase = { kind: "warming_up", historyLen: history.length };
      }

      // ── Invariant 10: emit tick event ─────────────────────────────────────
      this.eventSink.emitTick({
        cycle_count: nextCycleCount,
        timestamp,
        pulse,
        prediction: prediction
          ? {
              predicted_a: prediction.predicted_a,
              predicted_b: prediction.predicted_b,
              predicted_c: prediction.predicted_c,
              predicted_d: prediction.predicted_d,
              error_magnitude: prediction.error_magnitude,
              surprise: prediction.surprise,
              triggered_translation: prediction.triggered_translation,
            }
          : null,
      });

      // ── Invariant 11: wall-clock based decay ──────────────────────────────
      if (timestamp - this.lastDecayTime >= this.config.decayIntervalMs) {
        this.lastDecayTime = timestamp;
        this.db.updateSystemState(
          nextCycleCount,
          genState.step,
          genState.signalBState,
          genState.signalDState,
          this.lastDecayTime,
        );
        const decayResult = this.namingService.decayStep(
          this.config.decayFactor,
          this.config.forgottenThreshold,
        );
        log(
          `           | [Memory Manager] Decay tick: ${decayResult.decayedCount} active, ` +
            `${decayResult.forgottenCount} forgotten (confidence < ${this.config.forgottenThreshold}).`,
        );
        this.eventSink.emitDecay({
          decayed_count: decayResult.decayedCount,
          forgotten_count: decayResult.forgottenCount,
        });
      }

      return { cycleCount: nextCycleCount, timestamp, pulse, prediction, phase };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Runs the full translation + naming-resolution pipeline asynchronously.
   * Releases the isTranslating lock in finally.
   *
   * Invariant 8 + 9: findSimilar → prompt → LLM → resolveNaming →
   *   insertTranslationEvent → emitNaming → set lastTranslationTime.
   */
  private _runTranslation(
    pulseId: number,
    pulse: { signal_a: number; signal_b: number; signal_c: number; signal_d: number; timestamp: number },
    history: Array<{ signal_a: number; signal_b: number; signal_c: number; signal_d: number; timestamp?: number }>,
    prediction: PredictionResult,
    log: (line: string) => void,
  ): void {
    (async () => {
      const translationStartTime = this.clock.now();
      log(`           | [LLM Translation] Requesting translation for sensory surprise...`);

      try {
        // Layer 3: find similar memories
        const similarNamings = this.namingService.findSimilar(pulse, 5);
        const pastNamings = similarNamings.map(({ naming: n, distance }) => ({
          name: n.name,
          occurrences: n.reference_count ?? 1,
          distance,
        }));

        // Compute deltas: actual - predicted
        const deltas = {
          signal_a: pulse.signal_a - prediction.predicted_a,
          signal_b: pulse.signal_b - prediction.predicted_b,
          signal_c: pulse.signal_c - prediction.predicted_c,
          signal_d: pulse.signal_d - prediction.predicted_d,
        };

        // Layer 2: build prompt + call LLM
        const { namingResponse, promptText, durationMs } =
          await this.translationSvc.translate({
            pulse,
            history: history as any,
            deltas,
            pastNamings,
          });

        // Invariant 9: resolve naming (dedup logic)
        const resolved = this.namingService.resolveNaming(
          namingResponse,
          {
            name: namingResponse.new_name ?? namingResponse.use_existing_name ?? "",
            description: namingResponse.description,
            pulse,
            deltas,
            llmProvider: this.config.llmProviderLabel,
            confidence: namingResponse.confidence,
          },
          similarNamings,
        );

        if (resolved.logNote) {
          log(`           | [LLM] ${resolved.logNote}`);
        }

        // Persist translation event
        this.db.insertTranslationEvent({
          pulse_id: pulseId,
          naming_id: resolved.namingId,
          llm_provider: this.config.llmProviderLabel,
          prompt: promptText,
          response: JSON.stringify(namingResponse),
          duration_ms: durationMs,
          created_at: this.clock.now(),
        });

        log(
          `           | [LLM Translation Result] Naming: "${resolved.chosenName}" (Confidence: ${namingResponse.confidence.toFixed(2)}) in ${durationMs}ms\n` +
            `           | [LLM] Description: "${resolved.chosenDescription}"`,
        );

        // Emit naming event
        if (resolved.chosenName) {
          this.eventSink.emitNaming({
            pulse_id: pulseId,
            name: resolved.chosenName,
            description: resolved.chosenDescription,
            confidence: namingResponse.confidence,
            is_new: resolved.isNew,
            pulse_pattern: pulse,
            duration_ms: durationMs,
          });
        }

        this.lastTranslationTime = this.clock.now();
      } catch (err) {
        log(
          `           | [LLM Translation Error] Failed to generate naming: ${(err as Error).message}`,
        );
      } finally {
        this.isTranslating = false;
      }
    })();
  }
}
