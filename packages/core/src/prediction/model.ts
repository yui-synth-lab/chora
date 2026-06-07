import * as ort from 'onnxruntime-node';
import { PulseRecord } from '../db/client.js';

export interface PredictionResult {
  predicted_a: number;
  predicted_b: number;
  predicted_c: number;
  predicted_d: number;
  error_magnitude: number;
  surprise: number;
  triggered_translation: boolean;
}

export class PredictiveModel {
  private session: ort.InferenceSession | null = null;
  private modelPath: string;
  private surpriseThreshold: number;

  constructor(modelPath: string, surpriseThreshold = 0.15) {
    this.modelPath = modelPath;
    this.surpriseThreshold = surpriseThreshold;
  }

  async init(): Promise<void> {
    if (!this.session) {
      this.session = await ort.InferenceSession.create(this.modelPath);
    }
  }

  /**
   * Predict the next pulse given the last 32 pulses.
   * @param history Last 32 PulseRecord entries (oldest first).
   * @param actual The actual generated pulse at the current step (to compute prediction error).
   */
  async predict(history: PulseRecord[], actual: PulseRecord): Promise<PredictionResult> {
    if (!this.session) {
      await this.init();
    }

    if (history.length < 32) {
      throw new Error(`Insufficient history length: expected 32, got ${history.length}`);
    }

    // Ensure we only use the last 32 steps in case history is larger
    const recentHistory = history.slice(-32);

    const data = new Float32Array(1 * 32 * 4);
    for (let i = 0; i < 32; i++) {
      const idx = i * 4;
      data[idx] = recentHistory[i].signal_a;
      data[idx + 1] = recentHistory[i].signal_b;
      data[idx + 2] = recentHistory[i].signal_c;
      data[idx + 3] = recentHistory[i].signal_d;
    }

    // Run inference
    const tensor = new ort.Tensor('float32', data, [1, 32, 4]);
    const feeds = { input: tensor };
    const results = await this.session!.run(feeds);
    
    const outputTensor = results.output;
    const outputData = outputTensor.data as Float32Array;

    const predA = Math.max(0, Math.min(1, outputData[0]));
    const predB = Math.max(0, Math.min(1, outputData[1]));
    const predC = Math.max(0, Math.min(1, outputData[2]));
    const predD = Math.max(0, Math.min(1, outputData[3]));

    // Calculate RMSE (Root Mean Squared Error)
    const errA = predA - actual.signal_a;
    const errB = predB - actual.signal_b;
    const errC = predC - actual.signal_c;
    const errD = predD - actual.signal_d;

    const mse = (errA * errA + errB * errB + errC * errC + errD * errD) / 4;
    const rmse = Math.sqrt(mse);

    const surprise = rmse;
    const triggered_translation = surprise > this.surpriseThreshold;

    return {
      predicted_a: predA,
      predicted_b: predB,
      predicted_c: predC,
      predicted_d: predD,
      error_magnitude: rmse,
      surprise,
      triggered_translation
    };
  }
}
