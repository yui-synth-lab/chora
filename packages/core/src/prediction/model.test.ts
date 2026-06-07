import { describe, it, expect } from 'vitest';
import { PredictiveModel } from './model.js';
import { PulseRecord } from '../db/client.js';
import * as path from 'path';

import { findWorkspaceRoot } from '../utils/workspace.js';

describe('PredictiveModel Integration Test', () => {
  it('should load the ONNX model and make predictions', async () => {
    // Resolve absolute path to ONNX model from workspace root
    const root = findWorkspaceRoot();
    const modelPath = path.resolve(root, 'models/predictive_model.onnx');
    const model = new PredictiveModel(modelPath, 0.15);

    await model.init();

    // Create a mock history of 32 pulses
    const history: PulseRecord[] = [];
    for (let i = 0; i < 32; i++) {
      history.push({
        timestamp: Date.now() + i * 1000,
        signal_a: 0.5,
        signal_b: 0.4,
        signal_c: 0.3,
        signal_d: 0.2
      });
    }

    const actual: PulseRecord = {
      timestamp: Date.now() + 32 * 1000,
      signal_a: 0.5,
      signal_b: 0.4,
      signal_c: 0.3,
      signal_d: 0.2
    };

    const result = await model.predict(history, actual);

    // Assert predictions are within clamped range [0, 1]
    expect(result.predicted_a).toBeGreaterThanOrEqual(0);
    expect(result.predicted_a).toBeLessThanOrEqual(1);
    expect(result.predicted_b).toBeGreaterThanOrEqual(0);
    expect(result.predicted_b).toBeLessThanOrEqual(1);
    expect(result.predicted_c).toBeGreaterThanOrEqual(0);
    expect(result.predicted_c).toBeLessThanOrEqual(1);
    expect(result.predicted_d).toBeGreaterThanOrEqual(0);
    expect(result.predicted_d).toBeLessThanOrEqual(1);

    // Verify error and surprise calculations
    expect(result.error_magnitude).toBeGreaterThanOrEqual(0);
    expect(result.surprise).toBe(result.error_magnitude);
    expect(typeof result.triggered_translation).toBe('boolean');
  });
});
