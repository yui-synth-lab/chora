import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { ChoraDatabase } from "../db/client.js";
import { PulseGenerator } from "../pulse/generator.js";
import { PredictiveModel } from "../prediction/model.js";
import { NamingService } from "../memory/naming-service.js";
import { TranslationService } from "../translation/translation-service.js";
import { ChoraEngine } from "./chora-engine.js";
import { NoopEventSink, type EventSink } from "./event-sink.js";
import type { Clock } from "./clock.js";
import type { LLMProvider, NamingResponse } from "../translation/provider.js";
import { findWorkspaceRoot } from "../utils/workspace.js";
import type { NamingEvent, DecayEvent } from "../domain/events.js";

// ── Fake implementations ─────────────────────────────────────────────────────

class FakeClock implements Clock {
  private _now: number;
  constructor(startMs = 1_000_000) {
    this._now = startMs;
  }
  now(): number {
    return this._now;
  }
  advance(ms: number): void {
    this._now += ms;
  }
}

class FakeLLMProvider implements LLMProvider {
  name = "fake-llm";
  response: NamingResponse = {
    use_existing_name: null,
    new_name: "TestName",
    description: "A test sensory state",
    confidence: 0.8,
  };
  callCount = 0;

  async generateNaming(_prompt: string): Promise<NamingResponse> {
    this.callCount++;
    return { ...this.response };
  }
}

class SpyEventSink implements EventSink {
  namingEvents: NamingEvent[] = [];
  decayEvents: DecayEvent[] = [];
  tickCount = 0;

  emitTick(_e: Parameters<EventSink["emitTick"]>[0]): void {
    this.tickCount++;
  }
  emitNaming(e: NamingEvent): void {
    this.namingEvents.push(e);
  }
  emitDecay(e: DecayEvent): void {
    this.decayEvents.push(e);
  }
}

/**
 * A PredictiveModel stub that always returns a prediction with configurable
 * surprise value, bypassing any ONNX file requirement.
 */
class FakePredictiveModel extends PredictiveModel {
  private _surprise: number;
  private _initialized = true;

  constructor(surprise = 0.0) {
    super("/nonexistent/model.onnx");
    this._surprise = surprise;
  }

  // Override init so it never tries to load the file
  async init(): Promise<void> {}

  async predict(
    history: Parameters<PredictiveModel["predict"]>[0],
    actual: Parameters<PredictiveModel["predict"]>[1],
  ): ReturnType<PredictiveModel["predict"]> {
    const triggered = this._surprise > 0.15;
    return {
      predicted_a: actual.signal_a,
      predicted_b: actual.signal_b,
      predicted_c: actual.signal_c,
      predicted_d: actual.signal_d,
      error_magnitude: this._surprise,
      surprise: this._surprise,
      triggered_translation: triggered,
    };
  }

  setSurprise(s: number): void {
    this._surprise = s;
  }
}

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeEngine(opts: {
  db: ChoraDatabase;
  model: FakePredictiveModel;
  llm: FakeLLMProvider;
  clock: FakeClock;
  sink: SpyEventSink;
  cooldownMs?: number;
  decayIntervalMs?: number;
  initialLastDecayTime?: number;
}) {
  const generator = new PulseGenerator();
  const namingService = new NamingService(opts.db);
  const translationSvc = new TranslationService(opts.llm);

  return new ChoraEngine(
    opts.db,
    generator,
    opts.model,
    namingService,
    translationSvc,
    opts.sink,
    opts.clock,
    {
      cooldownMs: opts.cooldownMs ?? 10_000,
      decayIntervalMs: opts.decayIntervalMs ?? 30 * 60 * 1000,
      llmProviderLabel: "fake-llm",
    },
    opts.initialLastDecayTime ?? 0,
  );
}

/** Runs engine.tick() enough times to fill the 32-step history window. */
async function warmUp(engine: ChoraEngine, clock: FakeClock, count = 32): Promise<void> {
  for (let i = 0; i < count; i++) {
    clock.advance(1000);
    await engine.tick();
  }
}

/** Waits for async fire-and-forget tasks to settle. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("ChoraEngine", () => {
  let db: ChoraDatabase;
  let dbPath: string;
  let clock: FakeClock;
  let model: FakePredictiveModel;
  let llm: FakeLLMProvider;
  let sink: SpyEventSink;

  beforeEach(() => {
    const root = findWorkspaceRoot();
    dbPath = path.resolve(root, `data/test_engine_${Date.now()}.db`);
    db = new ChoraDatabase(dbPath);
    clock = new FakeClock(1_000_000);
    model = new FakePredictiveModel(0.0); // low surprise by default
    llm = new FakeLLMProvider();
    sink = new SpyEventSink();
  });

  afterEach(() => {
    if (db) db.close();
    if (fs.existsSync(dbPath)) {
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });

  // ── (a) Surprise above threshold triggers a translation ───────────────────

  it("triggers a translation when surprise exceeds threshold", async () => {
    model.setSurprise(0.5); // well above 0.15
    const engine = makeEngine({ db, model, llm, clock, sink });

    // Warm up to fill history (with low surprise so no translation fires)
    model.setSurprise(0.0);
    await warmUp(engine, clock, 32);

    // Now set high surprise and tick once
    model.setSurprise(0.5);
    clock.advance(1000);
    const result = await engine.tick();
    await flushAsync();

    expect(result.prediction?.triggered_translation).toBe(true);
    expect(llm.callCount).toBeGreaterThan(0);
    expect(sink.namingEvents.length).toBeGreaterThan(0);
    expect(sink.namingEvents[0].name).toBe("TestName");
  });

  // ── (b) Cooldown blocks a second translation within the window ────────────

  it("blocks a second translation during cooldown", async () => {
    const engine = makeEngine({ db, model, llm, clock, sink, cooldownMs: 10_000 });

    model.setSurprise(0.0);
    await warmUp(engine, clock, 32);

    // First translation tick
    model.setSurprise(0.5);
    clock.advance(1000);
    await engine.tick();
    await flushAsync();

    const callsAfterFirst = llm.callCount;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // Second tick immediately — should be blocked by cooldown
    clock.advance(100); // only 100ms later, well within 10s cooldown
    model.setSurprise(0.5);
    const result2 = await engine.tick();
    await flushAsync();

    expect(llm.callCount).toBe(callsAfterFirst); // no new LLM call
    // phase should indicate cooldown active
    expect(result2.phase.kind).toBe("predicted");
  });

  // ── (c) Decay fires only after the wall-clock interval ───────────────────

  it("does not decay before the interval, but does decay after", async () => {
    const decayIntervalMs = 5000; // 5 seconds for the test
    const engine = makeEngine({
      db,
      model,
      llm,
      clock,
      sink,
      decayIntervalMs,
      initialLastDecayTime: 0, // epoch → should decay after 5s
    });

    // Insert a naming to decay
    db.insertNaming({
      name: "Fadeable",
      description: "will decay",
      pulse_pattern: JSON.stringify({ signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 }),
      prediction_error: JSON.stringify({ signal_a: 0, signal_b: 0, signal_c: 0, signal_d: 0 }),
      llm_provider: "test",
      confidence: 0.8,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0,
    });

    // With FakeClock starting at 1_000_000ms: first tick is at 1_001_000ms
    // Difference from epoch = 1_001_000ms >> 5_000ms → decay fires on first tick!
    // We need to set initialLastDecayTime so that decay doesn't fire immediately.
    // Re-create engine with lastDecayTime = clock.now()
    const engine2 = makeEngine({
      db,
      model,
      llm,
      clock,
      sink,
      decayIntervalMs,
      initialLastDecayTime: clock.now(), // set to current time → decay won't fire yet
    });

    model.setSurprise(0.0);
    clock.advance(1000); // 1 second forward — not enough
    await engine2.tick();
    expect(sink.decayEvents.length).toBe(0); // no decay yet

    // Advance past the interval
    clock.advance(decayIntervalMs + 100);
    await engine2.tick();
    expect(sink.decayEvents.length).toBe(1);
    expect(sink.decayEvents[0].decayed_count).toBeGreaterThan(0);
  });

  // ── (d) new_name dedup path reinforces existing active naming ─────────────

  it("reinforces an existing active naming when LLM proposes it as new_name", async () => {
    // Pre-insert a naming with name "TestName" (same as what fake LLM returns)
    db.insertNaming({
      name: "TestName",
      description: "pre-existing",
      pulse_pattern: JSON.stringify({ signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 }),
      prediction_error: JSON.stringify({ signal_a: 0, signal_b: 0, signal_c: 0, signal_d: 0 }),
      llm_provider: "test",
      confidence: 0.6,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0,
    });

    const engine = makeEngine({ db, model, llm, clock, sink });

    model.setSurprise(0.0);
    await warmUp(engine, clock, 32);

    // High surprise → translation runs, LLM returns new_name: "TestName"
    // which already exists → should reinforce, not insert duplicate
    model.setSurprise(0.5);
    clock.advance(1000);
    await engine.tick();
    await flushAsync();

    const activeNamings = db.getAllActiveNamings();
    const testNameEntries = activeNamings.filter((n) => n.name === "TestName");

    // Should still be exactly 1 row (no duplicate inserted)
    expect(testNameEntries.length).toBe(1);
    // Confidence should have increased (reinforced)
    expect(testNameEntries[0].confidence).toBeGreaterThan(0.6);
    // Reference count should have increased
    expect(testNameEntries[0].reference_count).toBeGreaterThan(1);
  });
});
