import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { PulseRecord, PulseHistoryRecord } from "../../domain/types.js";

export class PulseRepository {
  constructor(private readonly db: DatabaseSyncType) {}

  insertPulse(pulse: Omit<PulseRecord, "id">): number {
    const stmt = this.db.prepare(`
      INSERT INTO pulses (timestamp, signal_a, signal_b, signal_c, signal_d)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      pulse.timestamp,
      pulse.signal_a,
      pulse.signal_b,
      pulse.signal_c,
      pulse.signal_d,
    );
    return Number(result.lastInsertRowid);
  }

  /**
   * Returns the last `limit` pulses in **chronological** order (oldest first).
   * The query fetches DESC then reverses, matching the original behavior.
   */
  getRecentPulses(limit: number): PulseRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, timestamp, signal_a, signal_b, signal_c, signal_d
      FROM pulses
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as unknown as PulseRecord[];
    return rows.reverse();
  }

  /**
   * Returns the last `limit` pulse+prediction join rows in **chronological** order.
   * `triggered_translation` is coerced from the SQLite integer (0/1) to a boolean.
   */
  getRecentHistory(limit: number): PulseHistoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT p.id, p.timestamp, p.signal_a, p.signal_b, p.signal_c, p.signal_d,
             pr.predicted_a, pr.predicted_b, pr.predicted_c, pr.predicted_d,
             pr.error_magnitude, pr.surprise, pr.triggered_translation
      FROM pulses p
      LEFT JOIN predictions pr ON p.id = pr.pulse_id
      ORDER BY p.timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as unknown as Array<{
      id: number;
      timestamp: number;
      signal_a: number;
      signal_b: number;
      signal_c: number;
      signal_d: number;
      predicted_a: number | null;
      predicted_b: number | null;
      predicted_c: number | null;
      predicted_d: number | null;
      error_magnitude: number | null;
      surprise: number | null;
      triggered_translation: number | null;
    }>;

    return rows.reverse().map((r) => ({
      ...r,
      triggered_translation: !!r.triggered_translation,
    }));
  }
}
