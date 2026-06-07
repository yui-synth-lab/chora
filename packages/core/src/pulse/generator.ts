export interface Pulse {
  timestamp: number;
  signal_a: number;
  signal_b: number;
  signal_c: number;
  signal_d: number;
}

export class PulseGenerator {
  private step: number = 0;
  private signalBState: number = 0.5;
  private signalDState: number = 0.3;

  constructor() {}

  getState() {
    return {
      step: this.step,
      signalBState: this.signalBState,
      signalDState: this.signalDState
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
    const baseA = 0.5 + 0.2 * Math.sin(circadianRad) + 0.1 * Math.cos(ultradianRad);
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
    this.signalBState = this.signalBState + reversionSpeed * (meanB - this.signalBState) + walkB;
    let signal_b = this.signalBState;

    // --- Signal C (Stress / Arousal) ---
    // Peaks early in circadian cycle. Partial negative correlation with Signal A.
    const circadianC = 0.4 + 0.25 * Math.sin(circadianRad + Math.PI / 3);
    const noiseC = this.nextGaussian(0, 0.04);
    const bInfluence = Math.max(0, signal_b - 0.6) * 0.2;
    let signal_c = circadianC - 0.2 * (signal_a - 0.5) + bInfluence + noiseC;

    // --- Signal D (Social/Connection baseline) ---
    // Slow drifting state with positive plateaus. Decays under high stress (Signal C).
    const meanD = 0.3;
    let walkD = this.nextGaussian(0, 0.02);
    // 0.5% chance of connection event (increase state significantly)
    if (Math.random() < 0.005) {
      walkD += 0.35;
    }
    const stressDrag = signal_c > 0.6 ? -0.05 * (signal_c - 0.6) : 0;
    this.signalDState = this.signalDState + 0.02 * (meanD - this.signalDState) + walkD + stressDrag;
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
      signal_d
    };
  }

  private nextGaussian(mean = 0, stddev = 1): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z * stddev + mean;
  }
}
