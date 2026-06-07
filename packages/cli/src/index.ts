import { ChoraDatabase, PulseGenerator, PredictiveModel, findWorkspaceRoot, OllamaProvider, SensoryPromptBuilder, MemoryManager } from '@chora/core';
import * as path from 'path';

function createBar(val: number, length = 10): string {
  const filledCount = Math.round(val * length);
  const filled = '█'.repeat(filledCount);
  const empty = '░'.repeat(length - filledCount);
  return `[${filled}${empty}]`;
}

function streamEvent(type: string, data: any): void {
  fetch('http://localhost:3001/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data })
  }).catch(() => {
    // Ignore server offline errors
  });
}

async function main() {
  const root = findWorkspaceRoot();
  const dbPath = path.join(root, 'data', 'chora.db');
  const modelPath = path.join(root, 'models', 'predictive_model.onnx');
  
  console.log(`Initializing CHORA Database at: ${dbPath}`);
  console.log(`Loading Predictive Model from: ${modelPath}`);

  const db = new ChoraDatabase(dbPath);
  const generator = new PulseGenerator();
  const model = new PredictiveModel(modelPath);
  const memory = new MemoryManager(db);
  
  // Initialize Ollama provider (defaulting to llama3, change via OLLAMA_MODEL env var if needed)
  const ollamaModelName = process.env.OLLAMA_MODEL || 'llama3';
  const llm = new OllamaProvider(ollamaModelName);

  // Initialize ONNX model session
  try {
    await model.init();
    console.log('Predictive Model (Layer 1) loaded successfully.');
  } catch (err) {
    console.warn('Could not initialize Predictive Model. Running in Layer 0-only fallback mode. Details:', err);
  }

  console.log('\n--- CHORA Loop (Layer 0 & 1 & 2 & 3) Started ---');
  console.log('Press Ctrl+C to terminate loop.\n');

  const intervalMs = 1000;
  
  // Lock state for translation
  let isTranslating = false;
  let lastTranslationTime = 0;
  const cooldownMs = 10000; // 10 second cooldown between translations

  const tick = async () => {
    try {
      const timestamp = Date.now();
      db.incrementCycleCount();
      
      const state = db.getSystemState();
      
      // 1. Generate current step actual pulse
      const pulse = generator.generate(timestamp);
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
        `Cycle #${state.cycle_count.toString().padEnd(4)} | ` +
        `A: ${formattedA} ${barA} | ` +
        `B: ${formattedB} ${barB} | ` +
        `C: ${formattedC} ${barC} | ` +
        `D: ${formattedD} ${barD}`
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
            triggered_translation: prediction.triggered_translation
          });

          predictionData = {
            predicted_a: prediction.predicted_a,
            predicted_b: prediction.predicted_b,
            predicted_c: prediction.predicted_c,
            predicted_d: prediction.predicted_d,
            error_magnitude: prediction.error_magnitude,
            surprise: prediction.surprise,
            triggered_translation: prediction.triggered_translation
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
                console.log(`           | 🧠 [LLM Translation] Requesting translation for sensory surprise...`);
                
                try {
                  // Layer 3 memory: Find similar sensory memories using Euclidean distance
                  const similarNamings = memory.findSimilar(pulse, 5);
                  const pastNamings = similarNamings.map(n => ({
                    name: n.name,
                    occurrences: n.reference_count ?? 1
                  }));

                  // Compute deltas: actual - predicted
                  const deltas = {
                    signal_a: pulse.signal_a - prediction.predicted_a,
                    signal_b: pulse.signal_b - prediction.predicted_b,
                    signal_c: pulse.signal_c - prediction.predicted_c,
                    signal_d: pulse.signal_d - prediction.predicted_d
                  };

                  const promptInput = {
                    history: history.map(h => ({
                      signal_a: h.signal_a,
                      signal_b: h.signal_b,
                      signal_c: h.signal_c,
                      signal_d: h.signal_d
                    })),
                    deltas,
                    pastNamings
                  };

                  const rawPromptText = SensoryPromptBuilder.build(promptInput);

                  // Call the LLM
                  const namingResult = await llm.generateNaming(promptInput);
                  const durationMs = Date.now() - translationStartTime;

                  // Resolve naming ID
                  let chosenName = '';
                  let chosenDescription = '';
                  let namingId: number | null = null;

                  if (namingResult.use_existing_name) {
                    chosenName = namingResult.use_existing_name;
                    const existing = similarNamings.find(n => n.name === chosenName);
                    chosenDescription = existing?.description || namingResult.description;
                    
                    // Reinforce count and confidence
                    memory.reinforceNaming(chosenName, 0.1);
                    
                    // Retrieve reinforced record to capture updated naming ID
                    const reinforced = db.getAllActiveNamings().find(n => n.name === chosenName);
                    namingId = reinforced?.id || null;
                  } else if (namingResult.new_name) {
                    chosenName = namingResult.new_name;
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
                      forgotten: 0
                    });
                  }

                  // Log translation event trace
                  db.insertTranslationEvent({
                    pulse_id: pulseId,
                    naming_id: namingId,
                    llm_provider: `${llm.name} (${ollamaModelName})`,
                    prompt: rawPromptText,
                    response: JSON.stringify(namingResult),
                    duration_ms: durationMs,
                    created_at: Date.now()
                  });

                  console.log(
                    `           | 🧠 [LLM Translation Result] Naming: "${chosenName}" (Confidence: ${(namingResult.confidence).toFixed(2)}) in ${durationMs}ms\n` +
                    `           | 🧠 Description: "${chosenDescription}"`
                  );

                  streamEvent('naming', {
                    pulse_id: pulseId,
                    name: chosenName,
                    description: chosenDescription,
                    confidence: namingResult.confidence,
                    is_new: !namingResult.use_existing_name,
                    pulse_pattern: pulse,
                    duration_ms: durationMs
                  });

                  lastTranslationTime = Date.now();
                } catch (err) {
                  console.error(`           | 🧠 [LLM Translation Error] Failed to generate naming:`, (err as Error).message);
                } finally {
                  isTranslating = false;
                }
              })();
            } else if (isTranslating) {
              console.log(`           | [LLM Translation] Cooldown active (translation currently in progress)`);
            } else {
              const secondsLeft = Math.ceil((cooldownMs - timeSinceLast) / 1000);
              console.log(`           | [LLM Translation] Cooldown active (wait ${secondsLeft}s)`);
            }
          }
        } catch (predErr) {
          console.error('           | Prediction error:', (predErr as Error).message);
        }
      } else {
        console.log(`           | Predictive model warming up... (${history.length}/32 steps)`);
      }

      // Stream cycle tick telemetry
      streamEvent('tick', {
        cycle_count: state.cycle_count,
        timestamp,
        pulse,
        prediction: predictionData
      });

      // 4. Memory Decay Loop (runs every 50 cycles to trigger forgetting)
      if (state.cycle_count % 50 === 0) {
        const decayResult = memory.decayStep(0.02, 0.1);
        if (decayResult.decayedCount > 0) {
          console.log(
            `           | 🧠 [Memory Manager] Decayed ${decayResult.decayedCount} active labels. ` +
            `Forgotten (confidence < 0.1): ${decayResult.forgottenCount}.`
          );
          streamEvent('decay', {
            decayed_count: decayResult.decayedCount,
            forgotten_count: decayResult.forgottenCount
          });
        }
      }
    } catch (err) {
      console.error('Error during cycle tick:', err);
    }
  };

  // Run first tick, then interval
  await tick();
  const timer = setInterval(tick, intervalMs);

  process.on('SIGINT', () => {
    clearInterval(timer);
    db.close();
    console.log('\nDatabase closed. CHORA terminated safely.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
