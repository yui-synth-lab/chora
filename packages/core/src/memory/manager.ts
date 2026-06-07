import { ChoraDatabase, NamingRecord } from '../db/client.js';

export class MemoryManager {
  private db: ChoraDatabase;

  constructor(db: ChoraDatabase) {
    this.db = db;
  }

  /**
   * Finds active namings with pulse patterns closest to the current pulse in Euclidean distance.
   * @param currentPulse The 4D pulse vector of the current step.
   * @param topK Number of closest naming records to retrieve.
   * @param maxDistance Maximum 4D Euclidean distance threshold (default: 0.5).
   */
  findSimilar(
    currentPulse: { signal_a: number; signal_b: number; signal_c: number; signal_d: number },
    topK = 5,
    maxDistance = 0.5
  ): NamingRecord[] {
    const active = this.db.getAllActiveNamings();
    if (active.length === 0) {
      return [];
    }

    const scored = active.map(n => {
      try {
        const pattern = JSON.parse(n.pulse_pattern) as {
          signal_a: number;
          signal_b: number;
          signal_c: number;
          signal_d: number;
        };
        
        // Calculate 4D Euclidean distance
        const dA = currentPulse.signal_a - pattern.signal_a;
        const dB = currentPulse.signal_b - pattern.signal_b;
        const dC = currentPulse.signal_c - pattern.signal_c;
        const dD = currentPulse.signal_d - pattern.signal_d;
        const distance = Math.sqrt(dA * dA + dB * dB + dC * dC + dD * dD);

        return { naming: n, distance };
      } catch (err) {
        return { naming: n, distance: Infinity };
      }
    });

    // Sort by distance ascending (closest first)
    scored.sort((a, b) => a.distance - b.distance);

    return scored
      .filter(s => s.distance <= maxDistance)
      .slice(0, topK)
      .map(s => s.naming);
  }

  /**
   * Reinforces an existing naming by increasing its confidence and incrementing its reference count.
   * @param name Name of the label to reinforce.
   * @param boost Confidence boost score (default 0.1).
   */
  reinforceNaming(name: string, boost = 0.1): void {
    const active = this.db.getAllActiveNamings();
    const existing = active.find(n => n.name === name);

    if (existing && existing.id !== undefined) {
      const newConfidence = Math.min(1.0, (existing.confidence ?? 0.8) + boost);
      const newRefCount = (existing.reference_count ?? 1) + 1;
      this.db.updateNamingConfidenceAndRef(existing.id, newConfidence, newRefCount, 0);
    }
  }

  /**
   * Decrements confidence of all active namings and flags those that fall below threshold as forgotten.
   * @param decayFactor Amount to reduce confidence by on each decay step (default 0.01).
   * @param threshold Confidence threshold below which a memory is forgotten (default 0.1).
   */
  decayStep(decayFactor = 0.01, threshold = 0.1): { decayedCount: number; forgottenCount: number } {
    return this.db.decayAllNamings(decayFactor, threshold);
  }
}
