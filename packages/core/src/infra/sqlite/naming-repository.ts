import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { NamingRecord } from "../../domain/types.js";

export class NamingRepository {
  constructor(private readonly db: DatabaseSyncType) {}

  /**
   * Inserts a new naming row and returns its row id.
   * Does NOT update system_state counters — the facade coordinates that.
   */
  insertNaming(naming: Omit<NamingRecord, "id">): number {
    const stmt = this.db.prepare(`
      INSERT INTO namings (
        name, description, pulse_pattern, prediction_error,
        llm_provider, confidence, created_at, reference_count, forgotten
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      naming.name,
      naming.description,
      naming.pulse_pattern,
      naming.prediction_error,
      naming.llm_provider,
      naming.confidence,
      naming.created_at,
      naming.reference_count ?? 1,
      naming.forgotten ?? 0,
    );
    return Number(result.lastInsertRowid);
  }

  getRecentNamings(limit: number): NamingRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, name, description, pulse_pattern, prediction_error,
             llm_provider, confidence, created_at, reference_count, forgotten
      FROM namings
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as unknown as NamingRecord[];
  }

  getAllActiveNamings(): NamingRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, name, description, pulse_pattern, prediction_error,
             llm_provider, confidence, created_at, reference_count, forgotten
      FROM namings
      WHERE forgotten = 0
    `);
    return stmt.all() as unknown as NamingRecord[];
  }

  updateNamingConfidenceAndRef(
    id: number,
    confidence: number,
    referenceCount: number,
    forgotten: number,
  ): void {
    this.db
      .prepare(
        `UPDATE namings
         SET confidence = ?, reference_count = ?, forgotten = ?
         WHERE id = ?`,
      )
      .run(confidence, referenceCount, forgotten, id);
  }

  decayAllNamings(
    decayFactor: number,
    threshold: number,
  ): { decayedCount: number; forgottenCount: number } {
    const beforeActive = this.db
      .prepare("SELECT id FROM namings WHERE forgotten = 0")
      .all();

    this.db
      .prepare(
        `UPDATE namings
         SET confidence = MAX(0.0, confidence - ?)
         WHERE forgotten = 0`,
      )
      .run(decayFactor);

    const result = this.db
      .prepare(
        `UPDATE namings
         SET forgotten = 1
         WHERE forgotten = 0 AND confidence < ?`,
      )
      .run(threshold);

    return {
      decayedCount: beforeActive.length,
      forgottenCount: Number(result.changes),
    };
  }
}
