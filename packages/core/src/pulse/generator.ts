import type { Pulse } from "../domain/types.js";

export type { Pulse };

export class PulseGenerator {
  private step: number = 0;
  private signalBState: number = 0.5;
  private signalDState: number = 0.3;

  constructor() {}

  getState() {
    return {
      step: this.step,
      signalBState: this.signalBState,
      signalDState: this.signalDState,
    };
  }

  setState(step: number, signalBState: number, signalDState: number) {
    this.step = step;
    this.signalBState = signalBState;
    this.signalDState = signalDState;
  }

  /**
   * Generates the next pulse based on step/time.
   * @param timestamp Unix epoch timestamp in milliseconds.
   */
  generate(timestamp: number): Pulse {
    this.step += 1;

    // Circadian cycle (period: 86400 steps, representing 24h if 1s intervals)
    const circadianRad = (this.step * 2 * Math.PI) / 86400;
    // Ultradian cycle (period: 5400 steps, representing 90 min if 1s intervals)
    const ultradianRad = (this.step * 2 * Math.PI) / 5400;

    // --- Signal A (Baseline stability) ---
    // Smooth slow wave, minimal noise
    const baseA =
      0.5 + 0.2 * Math.sin(circadianRad) + 0.1 * Math.cos(ultradianRad);
    const noiseA = this.nextGaussian(0, 0.02);
    let signal_a = baseA + noiseA;

    // --- Signal B (Spiky reward/anticipation) ---
    // Random walk with mean reversion and positive spikes
    const reversionSpeed = 0.05;
    const meanB = 0.4;
    let walkB = this.nextGaussian(0, 0.03);
    // 1% chance of sudden spike
    if (Math.random() < 0.01) {
      walkB += 0.4;
    }
    this.signalBState =
      this.signalBState + reversionSpeed * (meanB - this.signalBState) + walkB;
    let signal_b = this.signalBState;

    // --- Signal C (Stress / Arousal) ---
    // Peaks early in circadian cycle. Partial negative correlation with Signal A.
    // Ultradian (90-min) component added so stress oscillates visibly within short runs.
    // bInfluence is bidirectional: high B raises arousal, low B lowers it.
    const circadianC = 0.2 * Math.sin(circadianRad + Math.PI / 3); // ±0.2 over 24h
    const ultradianC = 0.2 * Math.sin(ultradianRad); // ±0.2 over 90min
    const noiseC = this.nextGaussian(0, 0.05);
    const bInfluence = (signal_b - 0.5) * 0.2; // bidirectional
    let signal_c =
      0.5 +
      circadianC +
      ultradianC -
      0.3 * (signal_a - 0.5) +
      bInfluence +
      noiseC;

    // --- Signal D (Social/Connection baseline) ---
    // Slow drifting state with positive plateaus. Decays under high stress (Signal C).
    // Fix: raise meanD (0.3→0.4), make stressDrag bidirectional around 0.5
    const meanD = 0.4;
    let walkD = this.nextGaussian(0, 0.02);
    // 0.5% chance of connection event (increase state significantly)
    if (Math.random() < 0.005) {
      walkD += 0.35;
    }
    // High stress (>0.6) drags D down; low stress (<0.6) allows D to recover
    // Coefficient halved (0.06→0.03) so mean reversion can compete even at peak stress
    const stressDrag = (signal_c - 0.6) * -0.03;
    this.signalDState =
      this.signalDState +
      0.02 * (meanD - this.signalDState) +
      walkD +
      stressDrag;
    let signal_d = this.signalDState;

    // Clamp all signals strictly to [0, 1]
    signal_a = Math.max(0, Math.min(1, signal_a));
    signal_b = Math.max(0, Math.min(1, signal_b));
    signal_c = Math.max(0, Math.min(1, signal_c));
    signal_d = Math.max(0, Math.min(1, signal_d));

    return {
      timestamp,
      signal_a,
      signal_b,
      signal_c,
      signal_d,
    };
  }

  private nextGaussian(mean = 0, stddev = 1): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z * stddev + mean;
  }
}
