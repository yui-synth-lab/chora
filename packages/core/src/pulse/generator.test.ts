import { describe, it, expect } from "vitest";
import { PulseGenerator } from "./generator.js";

describe("PulseGenerator", () => {
  it("should generate valid pulses with 4D signals bounded between 0 and 1", () => {
    const generator = new PulseGenerator();
    const timestamp = Date.now();

    const pulse = generator.generate(timestamp);

    expect(pulse.timestamp).toBe(timestamp);
    expect(pulse.signal_a).toBeGreaterThanOrEqual(0);
    expect(pulse.signal_a).toBeLessThanOrEqual(1);

    expect(pulse.signal_b).toBeGreaterThanOrEqual(0);
    expect(pulse.signal_b).toBeLessThanOrEqual(1);

    expect(pulse.signal_c).toBeGreaterThanOrEqual(0);
    expect(pulse.signal_c).toBeLessThanOrEqual(1);

    expect(pulse.signal_d).toBeGreaterThanOrEqual(0);
    expect(pulse.signal_d).toBeLessThanOrEqual(1);
  });

  it("should vary signals over consecutive generations", () => {
    const generator = new PulseGenerator();
    const startTimestamp = Date.now();

    const pulse1 = generator.generate(startTimestamp);
    const pulse2 = generator.generate(startTimestamp + 1000);

    // Signals should change due to math, cycles, or noise
    const isDifferent =
      pulse1.signal_a !== pulse2.signal_a ||
      pulse1.signal_b !== pulse2.signal_b ||
      pulse1.signal_c !== pulse2.signal_c ||
      pulse1.signal_d !== pulse2.signal_d;

    expect(isDifferent).toBe(true);
  });
});
