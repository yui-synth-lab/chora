import {
  ChoraDatabase,
  PulseGenerator,
  PredictiveModel,
  OllamaProvider,
  NamingService,
  TranslationService,
  ChoraEngine,
  SystemClock,
  HttpEventSink,
  findWorkspaceRoot,
} from "@chora/core";
import * as path from "path";

// ── ConsoleRenderer ──────────────────────────────────────────────────────────

function createBar(val: number, length = 10): string {
  const filledCount = Math.round(val * length);
  return `[${"█".repeat(filledCount)}${"░".repeat(length - filledCount)}]`;
}

function renderTick(result: Awaited<ReturnType<ChoraEngine["tick"]>>): void {
  const { cycleCount, pulse, prediction, phase } = result;
  const fmt = (v: number) => v.toFixed(2);
  console.log(
    `Cycle #${cycleCount.toString().padEnd(4)} | ` +
      `A: ${fmt(pulse.signal_a)} ${createBar(pulse.signal_a)} | ` +
      `B: ${fmt(pulse.signal_b)} ${createBar(pulse.signal_b)} | ` +
      `C: ${fmt(pulse.signal_c)} ${createBar(pulse.signal_c)} | ` +
      `D: ${fmt(pulse.signal_d)} ${createBar(pulse.signal_d)}`,
  );

  if (phase.kind === "warming_up") {
    console.log(`           | Predictive model warming up... (${phase.historyLen}/32 steps)`);
  } else if (phase.kind === "prediction_error") {
    console.error(`           | Prediction error: ${phase.message}`);
  } else if (phase.kind === "predicted" && prediction) {
    const p = prediction;
    const predStr = `A: ${fmt(p.predicted_a)}, B: ${fmt(p.predicted_b)}, C: ${fmt(p.predicted_c)}, D: ${fmt(p.predicted_d)}`;
    const alert = p.triggered_translation
      ? `⚡ [Surprise Triggered: Translation loop requested]`
      : `[Surprise: ${p.surprise.toFixed(3)} (Low)]`;
    console.log(`           | Predicted: ${predStr} | ${alert}`);

    if (p.triggered_translation) {
      if (phase.translating) {
        console.log(`           | [LLM Translation] Cooldown active (translation currently in progress)`);
      } else if (phase.cooldownSeconds !== undefined) {
        console.log(`           | [LLM Translation] Cooldown active (wait ${phase.cooldownSeconds}s)`);
      }
    }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const root = findWorkspaceRoot();
  const dbPath = path.join(root, "data", "chora.db");
  const modelPath = path.join(root, "models", "predictive_model.onnx");

  console.log(`Initializing CHORA Database at: ${dbPath}`);
  console.log(`Loading Predictive Model from: ${modelPath}`);

  const db = new ChoraDatabase(dbPath);
  const generator = new PulseGenerator();

  // CHORA_SURPRISE_THRESHOLD: dial CHORA's verbosity at runtime.
  // After retraining (Phase 5), the new model's mean RMSE is ~0.036 with
  // genuine spikes reaching ~0.18–0.23. 0.15 (default) names only the rare
  // genuine surprises; 0.08 names also moderate excursions; 0.06 starts
  // catching noise. Tune to taste.
  const surpriseThreshold = Number(process.env.CHORA_SURPRISE_THRESHOLD ?? 0.15);
  const model = new PredictiveModel(modelPath, surpriseThreshold);
  console.log(`Surprise threshold: ${surpriseThreshold}`);

  // Restore generator state from DB and capture last_decayed_at for engine
  const savedState = db.getSystemState();
  let initialLastDecayTime = 0;
  if (savedState && typeof savedState.generator_step === "number") {
    generator.setState(
      savedState.generator_step,
      savedState.generator_signal_b_state ?? 0.5,
      savedState.generator_signal_d_state ?? 0.3,
    );
    initialLastDecayTime = savedState.last_decayed_at ?? 0;
    console.log(
      `Restored PulseGenerator state: step=${savedState.generator_step}, B=${savedState.generator_signal_b_state?.toFixed(3)}, D=${savedState.generator_signal_d_state?.toFixed(3)}`,
    );
  }

  const ollamaModelName =
    process.env.OLLAMA_MODEL ||
    "hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M";
  const promptLang = (process.env.PROMPT_LANG === "ja" ? "ja" : "en") as "en" | "ja";
  console.log(`LLM: ${ollamaModelName} | prompt lang: ${promptLang}`);

  // Initialize ONNX model — graceful degrade on failure
  try {
    await model.init();
    console.log("Predictive Model (Layer 1) loaded successfully.");
  } catch (err) {
    console.warn(
      "Could not initialize Predictive Model. Running in Layer 0-only fallback mode. Details:",
      err,
    );
  }

  // Assemble engine with all injected dependencies
  const engine = new ChoraEngine(
    db,
    generator,
    model,
    new NamingService(db),
    new TranslationService(new OllamaProvider(ollamaModelName), promptLang),
    new HttpEventSink(),
    new SystemClock(),
    { llmProviderLabel: `ollama (${ollamaModelName})` },
    initialLastDecayTime,
  );

  console.log("\n--- CHORA Loop (Layer 0 & 1 & 2 & 3) Started ---");
  console.log("Press Ctrl+C to terminate loop.\n");

  const tick = async () => {
    try {
      const result = await engine.tick((line) => console.log(line));
      renderTick(result);
    } catch (err) {
      console.error("Error during cycle tick:", err);
    }
  };

  await tick();
  const timer = setInterval(tick, 1000);

  process.on("SIGINT", () => {
    clearInterval(timer);
    engine.close();
    console.log("\nDatabase closed. CHORA terminated safely.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal initialization error:", err);
  process.exit(1);
});
