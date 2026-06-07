import { ChoraDatabase, PulseGenerator, PredictiveModel, findWorkspaceRoot } from '@chora/core';
import * as path from 'path';

function createBar(val: number, length = 10): string {
  const filledCount = Math.round(val * length);
  const filled = '█'.repeat(filledCount);
  const empty = '░'.repeat(length - filledCount);
  return `[${filled}${empty}]`;
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

  // Initialize ONNX model session
  try {
    await model.init();
    console.log('Predictive Model (Layer 1) loaded successfully.');
  } catch (err) {
    console.warn('Could not initialize Predictive Model. Running in Layer 0-only fallback mode. Details:', err);
  }

  console.log('\n--- CHORA Loop (Layer 0 & 1) Started ---');
  console.log('Press Ctrl+C to terminate loop.\n');

  const intervalMs = 1000;
  
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

          const predStr = `A: ${prediction.predicted_a.toFixed(2)}, B: ${prediction.predicted_b.toFixed(2)}, C: ${prediction.predicted_c.toFixed(2)}, D: ${prediction.predicted_d.toFixed(2)}`;
          const surpriseStr = prediction.surprise.toFixed(3);
          const alert = prediction.triggered_translation 
            ? `⚡ [Surprise Triggered: Translation loop requested]`
            : `[Surprise: ${surpriseStr} (Low)]`;

          console.log(`           | Predicted: ${predStr} | ${alert}`);
        } catch (predErr) {
          console.error('           | Prediction error:', (predErr as Error).message);
        }
      } else {
        console.log(`           | Predictive model warming up... (${history.length}/32 steps)`);
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
