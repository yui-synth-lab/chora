/**
 * Generate training data for the ONNX predictive model.
 *
 * Uses the built @chora/core PulseGenerator as the SINGLE SOURCE OF TRUTH
 * for signal math, so training distribution matches runtime exactly.
 *
 * Output: packages/training/data/pulses.csv
 * Format: signal_a,signal_b,signal_c,signal_d  (no header, full float precision)
 *
 * Usage (from repo root):
 *   node scripts/generate-training-data.mjs
 */

import { createWriteStream, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

// Resolve PulseGenerator from the built dist directly so this script can run
// from the repo root without needing @chora/core in root node_modules.
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const coreDistUrl = pathToFileURL(
  join(repoRoot, "packages", "core", "dist", "index.js")
).href;
const { PulseGenerator } = await import(coreDistUrl);

const outputDir = join(repoRoot, "packages", "training", "data");
const outputPath = join(outputDir, "pulses.csv");

const STEPS = 200_000;

mkdirSync(outputDir, { recursive: true });

const generator = new PulseGenerator();
// Default initial state: step 0, signalBState 0.5, signalDState 0.3
// (matches PulseGenerator constructor defaults — no explicit setState needed)

const stream = createWriteStream(outputPath, { encoding: "utf8" });

const startTime = Date.now();
const baseTs = startTime;

for (let i = 0; i < STEPS; i++) {
  // Timestamp does not affect signal math, but we pass a realistic value
  const pulse = generator.generate(baseTs + i * 1000);
  stream.write(
    `${pulse.signal_a},${pulse.signal_b},${pulse.signal_c},${pulse.signal_d}\n`
  );
}

stream.end(() => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Rows written : ${STEPS.toLocaleString()}`);
  console.log(`Output file  : ${outputPath}`);
  console.log(`Elapsed      : ${elapsed}s`);
});
