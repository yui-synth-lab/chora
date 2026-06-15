/** Local sensory math utilities — kept in web to avoid pulling node deps from core. */

export interface PulsePattern {
  signal_a: number;
  signal_b: number;
  signal_c: number;
  signal_d: number;
}

/**
 * Determine a color tone based on which signal dominates the pulse pattern.
 */
export function getSensoryColor(pattern: PulsePattern): string {
  const { signal_a, signal_b, signal_c, signal_d } = pattern;
  const maxVal = Math.max(signal_a, signal_b, signal_c, signal_d);
  if (maxVal === signal_a) return '#10B981'; // Emerald (A)
  if (maxVal === signal_b) return '#3B82F6'; // Blue (B)
  if (maxVal === signal_c) return '#EF4444'; // Red (C)
  return '#EC4899'; // Pink (D)
}

/**
 * Euclidean distance in 4D pulse space.
 */
export function getDistance4D(p1: PulsePattern, p2: PulsePattern): number {
  const dA = p1.signal_a - p2.signal_a;
  const dB = p1.signal_b - p2.signal_b;
  const dC = p1.signal_c - p2.signal_c;
  const dD = p1.signal_d - p2.signal_d;
  return Math.sqrt(dA * dA + dB * dB + dC * dC + dD * dD);
}

/**
 * Project a 4D pulse pattern to 2D SVG coordinates (range 0–100).
 */
export function projectTo2D(pattern: PulsePattern): { x: number; y: number } {
  return {
    x: 50 + (pattern.signal_a - pattern.signal_c) * 40,
    y: 50 + (pattern.signal_b - pattern.signal_d) * 40,
  };
}
