import {
  ChoraDatabase,
  PulseGenerator,
  PredictiveModel,
  findWorkspaceRoot,
  OllamaProvider,
  SensoryPromptBuilder,
  MemoryManager,
} from "@chora/core";
import * as path from "path";

function createBar(val: number, length = 10): string {
  const filledCount = Math.round(val * length);
  const filled = "█".repeat(filledCount);
  const empty = "░".repeat(length - filledCount);
  return `[${filled}${empty}]`;
}

function streamEvent(type: string, data: any): void {
  fetch("http://localhost:3001/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, data }),
  }).catch(() => {
    // Ignore server offline errors
  });
}

async function main() {
  const root = findWorkspaceRoot();
  const dbPath = path.join(root, "data", "chora.db");
  const modelPath = path.join(root, "models", "predictive_model.onnx");

  console.log(`Initializing CHORA Database at: ${dbPath}`);
  console.log(`Loading Predictive Model from: ${modelPath}`);

  const db = new ChoraDatabase(dbPath);
  const generator = new PulseGenerator();
  const model = new PredictiveModel(modelPath);
  const memory = new MemoryManager(db);

  // Restore generator state from DB if available
  const initialState = db.getSystemState();
  if (initialState && typeof initialState.generator_step === "number") {
    generator.setState(
      initialState.generator_step,
      initialState.generator_signal_b_state ?? 0.5,
      initialState.generator_signal_d_state ?? 0.3,
    );
    console.log(
      `Restored PulseGenerator state: step=${initialState.generator_step}, B=${initialState.generator_signal_b_state?.toFixed(3)}, D=${initialState.generator_signal_d_state?.toFixed(3)}`,
    );
  }

  // Initialize Ollama provider
  // OLLAMA_MODEL: model name (default: LFM2-8B-A1B)
  // PROMPT_LANG:  prompt/naming language "en" | "ja" (default: "en")
  //               Provider-agnostic — works with Ollama, Gemini, or any future LLMProvider.
  const ollamaModelName =
    process.env.OLLAMA_MODEL ||
    "hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M";
  const promptLang = (process.env.PROMPT_LANG === "ja" ? "ja" : "en") as
    | "en"
    | "ja";
  const llm = new OllamaProvider(ollamaModelName);
  console.log(`LLM: ${ollamaModelName} | prompt lang: ${promptLang}`);

  // Initialize ONNX model session
  try {
    await model.init();
    console.log("Predictive Model (Layer 1) loaded successfully.");
  } catch (err) {
    console.warn(
      "Could not initialize Predictive Model. Running in Layer 0-only fallback mode. Details:",
      err,
    );
  }

  console.log("\n--- CHORA Loop (Layer 0 & 1 & 2 & 3) Started ---");
  console.log("Press Ctrl+C to terminate loop.\n");

  const intervalMs = 1000;

  // Lock state for translation
  let isTranslating = false;
  let lastTranslationTime = 0;
  const cooldownMs = 10000; // 10 second cooldown between translations

  // Timestamp-based decay: run every 30 minutes, restoring last time from DB
  const decayIntervalMs = 30 * 60 * 1000; // 30 minutes
  const decayFactor = 0.05; // -0.05 confidence per 30-min interval → ~7 hours to forget
  const forgottenThreshold = 0.1;
  // Use 0 as fallback (epoch) so the first decay runs after exactly one decayIntervalMs from start,
  // rather than resetting the 30-min window on every restart.
  let lastDecayTime: number = db.getSystemState()?.last_decayed_at ?? 0;

  const tick = async () => {
    try {
      const timestamp = Date.now();
      const state = db.getSystemState();
      const nextCycleCount = state.cycle_count + 1;

      // 1. Generate current step actual pulse
      const pulse = generator.generate(timestamp);
      const genState = generator.getState();

      // Persist state and cycle count in DB
      db.updateSystemState(
        nextCycleCount,
        genState.step,
        genState.signalBState,
        genState.signalDState,
      );

      const pulseId = db.insertPulse(pulse);

      const formattedA = pulse.signal_a.toFixed(2);
      const formattedB = pulse.signal_b.toFixed(2);
      const formattedC = pulse.signal_c.toFixed(2);
      const formattedD = pulse.signal_d.toFixed(2);

      const barA = createBar(pulse.signal_a);
      const barB = createBar(pulse.signal_b);
      const barC = createBar(pulse.signal_c);
      const barD = createBar(pulse.signal_d);

      console.log(
        `Cycle #${nextCycleCount.toString().padEnd(4)} | ` +
          `A: ${formattedA} ${barA} | ` +
          `B: ${formattedB} ${barB} | ` +
          `C: ${formattedC} ${barC} | ` +
          `D: ${formattedD} ${barD}`,
      );

      let predictionData: any = null;

      // 2. Query history to make prediction for the NEXT step
      const history = db.getRecentPulses(32);

      if (history.length >= 32) {
        try {
          // Predict next values based on history, matching them against current pulse
          const prediction = await model.predict(history, pulse);

          db.insertPrediction({
            pulse_id: pulseId,
            predicted_a: prediction.predicted_a,
            predicted_b: prediction.predicted_b,
            predicted_c: prediction.predicted_c,
            predicted_d: prediction.predicted_d,
            error_magnitude: prediction.error_magnitude,
            surprise: prediction.surprise,
            triggered_translation: prediction.triggered_translation,
          });

          predictionData = {
            predicted_a: prediction.predicted_a,
            predicted_b: prediction.predicted_b,
            predicted_c: prediction.predicted_c,
            predicted_d: prediction.predicted_d,
            error_magnitude: prediction.error_magnitude,
            surprise: prediction.surprise,
            triggered_translation: prediction.triggered_translation,
          };

          const predStr = `A: ${prediction.predicted_a.toFixed(2)}, B: ${prediction.predicted_b.toFixed(2)}, C: ${prediction.predicted_c.toFixed(2)}, D: ${prediction.predicted_d.toFixed(2)}`;
          const surpriseStr = prediction.surprise.toFixed(3);
          const alert = prediction.triggered_translation
            ? `⚡ [Surprise Triggered: Translation loop requested]`
            : `[Surprise: ${surpriseStr} (Low)]`;

          console.log(`           | Predicted: ${predStr} | ${alert}`);

          // 3. Trigger Layer 2 Translation Loop if surprise is high and cooldown is clear
          if (prediction.triggered_translation) {
            const timeSinceLast = Date.now() - lastTranslationTime;
            if (!isTranslating && timeSinceLast > cooldownMs) {
              isTranslating = true;

              // Run the translation asynchronously to not block the main loop
              (async () => {
                const translationStartTime = Date.now();
                console.log(
                  `           | 🧠 [LLM Translation] Requesting translation for sensory surprise...`,
                );

                try {
                  // Layer 3 memory: Find similar sensory memories using Euclidean distance
                  const similarNamings = memory.findSimilar(pulse, 5);
                  const pastNamings = similarNamings.map(
                    ({ naming: n, distance }) => ({
                      name: n.name,
                      occurrences: n.reference_count ?? 1,
                      distance,
                    }),
                  );

                  // Compute deltas: actual - predicted
                  const deltas = {
                    signal_a: pulse.signal_a - prediction.predicted_a,
                    signal_b: pulse.signal_b - prediction.predicted_b,
                    signal_c: pulse.signal_c - prediction.predicted_c,
                    signal_d: pulse.signal_d - prediction.predicted_d,
                  };

                  const promptInput = {
                    history: history.map((h) => ({
                      signal_a: h.signal_a,
                      signal_b: h.signal_b,
                      signal_c: h.signal_c,
                      signal_d: h.signal_d,
                    })),
                    deltas,
                    pastNamings,
                  };

                  const rawPromptText = SensoryPromptBuilder.build(
                    promptInput,
                    promptLang,
                  );

                  // Call the LLM with the pre-built prompt string
                  const namingResult = await llm.generateNaming(rawPromptText);
                  const durationMs = Date.now() - translationStartTime;

                  // Resolve naming ID
                  let chosenName = "";
                  let chosenDescription = "";
                  let namingId: number | null = null;

                  if (namingResult.use_existing_name) {
                    chosenName = namingResult.use_existing_name;
                    const reinforced = db
                      .getAllActiveNamings()
                      .find((n) => n.name === chosenName);
                    if (reinforced) {
                      // Name exists in DB — reinforce it
                      const existing = similarNamings.find(
                        ({ naming: n }) => n.name === chosenName,
                      );
                      chosenDescription =
                        existing?.naming.description ||
                        reinforced.description ||
                        namingResult.description;
                      memory.reinforceNaming(chosenName, 0.1);
                      namingId = reinforced.id ?? null;
                    } else {
                      // LLM hallucinated a name not in DB — treat as new
                      console.log(
                        `           | 🧠 [LLM] use_existing_name "${chosenName}" not found in DB, inserting as new`,
                      );
                      chosenDescription = namingResult.description;
                      namingId = db.insertNaming({
                        name: chosenName,
                        description: chosenDescription,
                        pulse_pattern: JSON.stringify(pulse),
                        prediction_error: JSON.stringify(deltas),
                        llm_provider: llm.name,
                        confidence: namingResult.confidence,
                        created_at: Date.now(),
                        reference_count: 1,
                        forgotten: 0,
                      });
                    }
                  } else if (namingResult.new_name) {
                    chosenName = namingResult.new_name;
                    const existingNew = db
                      .getAllActiveNamings()
                      .find((n) => n.name === chosenName);
                    if (existingNew) {
                      // LLM proposed a "new" name that already exists — reinforce instead
                      console.log(
                        `           | 🧠 [LLM] new_name "${chosenName}" already exists in DB, reinforcing instead of inserting`,
                      );
                      chosenDescription =
                        existingNew.description || namingResult.description;
                      memory.reinforceNaming(chosenName, 0.1);
                      namingId = existingNew.id ?? null;
                    } else {
                      chosenDescription = namingResult.description;
                      namingId = db.insertNaming({
                        name: chosenName,
                        description: chosenDescription,
                        pulse_pattern: JSON.stringify(pulse),
                        prediction_error: JSON.stringify(deltas),
                        llm_provider: llm.name,
                        confidence: namingResult.confidence,
                        created_at: Date.now(),
                        reference_count: 1,
                        forgotten: 0,
                      });
                    }
                  }

                  // Log translation event trace
                  db.insertTranslationEvent({
                    pulse_id: pulseId,
                    naming_id: namingId,
                    llm_provider: `${llm.name} (${ollamaModelName})`,
                    prompt: rawPromptText,
                    response: JSON.stringify(namingResult),
                    duration_ms: durationMs,
                    created_at: Date.now(),
                  });

                  console.log(
                    `           | 🧠 [LLM Translation Result] Naming: "${chosenName}" (Confidence: ${namingResult.confidence.toFixed(2)}) in ${durationMs}ms\n` +
                      `           | 🧠 Description: "${chosenDescription}"`,
                  );

                  if (chosenName) {
                    streamEvent("naming", {
                      pulse_id: pulseId,
                      name: chosenName,
                      description: chosenDescription,
                      confidence: namingResult.confidence,
                      is_new: !namingResult.use_existing_name,
                      pulse_pattern: pulse,
                      duration_ms: durationMs,
                    });
                  }

                  lastTranslationTime = Date.now();
                } catch (err) {
                  console.error(
                    `           | 🧠 [LLM Translation Error] Failed to generate naming:`,
                    (err as Error).message,
                  );
                } finally {
                  isTranslating = false;
                }
              })();
            } else if (isTranslating) {
              console.log(
                `           | [LLM Translation] Cooldown active (translation currently in progress)`,
              );
            } else {
              const secondsLeft = Math.ceil(
                (cooldownMs - timeSinceLast) / 1000,
              );
              console.log(
                `           | [LLM Translation] Cooldown active (wait ${secondsLeft}s)`,
              );
            }
          }
        } catch (predErr) {
          console.error(
            "           | Prediction error:",
            (predErr as Error).message,
          );
        }
      } else {
        console.log(
          `           | Predictive model warming up... (${history.length}/32 steps)`,
        );
      }

      // Stream cycle tick telemetry
      streamEvent("tick", {
        cycle_count: nextCycleCount,
        timestamp,
        pulse,
        prediction: predictionData,
      });

      // 4. Memory Decay Loop (wall-clock based: every 30 minutes)
      if (timestamp - lastDecayTime >= decayIntervalMs) {
        lastDecayTime = timestamp;
        db.updateSystemState(
          nextCycleCount,
          genState.step,
          genState.signalBState,
          genState.signalDState,
          lastDecayTime,
        );
        const decayResult = memory.decayStep(decayFactor, forgottenThreshold);
        console.log(
          `           | 🧠 [Memory Manager] Decay tick: ${decayResult.decayedCount} active, ` +
            `${decayResult.forgottenCount} forgotten (confidence < ${forgottenThreshold}).`,
        );
        streamEvent("decay", {
          decayed_count: decayResult.decayedCount,
          forgotten_count: decayResult.forgottenCount,
        });
      }
    } catch (err) {
      console.error("Error during cycle tick:", err);
    }
  };

  // Run first tick, then interval
  await tick();
  const timer = setInterval(tick, intervalMs);

  process.on("SIGINT", () => {
    clearInterval(timer);
    db.close();
    console.log("\nDatabase closed. CHORA terminated safely.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal initialization error:", err);
  process.exit(1);
});
