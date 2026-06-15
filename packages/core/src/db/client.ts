import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

import { SCHEMA_QUERIES } from "./schema.js";
import * as path from "path";
import * as fs from "fs";

// Import domain types and re-export for backward compatibility
import type {
  PulseRecord,
  SystemStateRecord,
  PredictionRecord,
  NamingRecord,
  TranslationEventRecord,
} from "../domain/types.js";

export type {
  PulseRecord,
  SystemStateRecord,
  PredictionRecord,
  NamingRecord,
  TranslationEventRecord,
};

export class ChoraDatabase {
  private db: DatabaseSyncType;

  constructor(dbPath: string) {
    // Ensure parent directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    // WAL mode: allows concurrent readers while CLI writes every second
    this.db.exec("PRAGMA journal_mode=WAL");
    // Retry for up to 5 seconds before throwing SQLITE_BUSY
    this.db.exec("PRAGMA busy_timeout=5000");
    this.initializeSchema();
  }

  private initializeSchema() {
    this.db.exec("BEGIN TRANSACTION");
    try {
      for (const query of SCHEMA_QUERIES) {
        this.db.exec(query);
      }
      try {
        this.db.exec(
          "ALTER TABLE namings ADD COLUMN forgotten INTEGER DEFAULT 0",
        );
      } catch (e) {
        // Ignored if column already exists
      }
      try {
        this.db.exec(
          "ALTER TABLE system_state ADD COLUMN generator_step INTEGER DEFAULT 0",
        );
      } catch (e) {}
      try {
        this.db.exec(
          "ALTER TABLE system_state ADD COLUMN generator_signal_b_state REAL DEFAULT 0.5",
        );
      } catch (e) {}
      try {
        this.db.exec(
          "ALTER TABLE system_state ADD COLUMN generator_signal_d_state REAL DEFAULT 0.3",
        );
      } catch (e) {}
      try {
        this.db.exec(
          "ALTER TABLE system_state ADD COLUMN last_decayed_at INTEGER DEFAULT NULL",
        );
      } catch (e) {}

      // Execute the INSERT OR IGNORE for system_state now that all columns exist
      this.db.exec(`
        INSERT OR IGNORE INTO system_state (
          id, cycle_count, total_namings, unique_names, last_translation_at, last_decayed_at,
          generator_step, generator_signal_b_state, generator_signal_d_state
        ) VALUES (1, 0, 0, 0, NULL, NULL, 0, 0.5, 0.3)
      `);

      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

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
    // lastInsertRowid can be a number or bigint, cast to number
    return Number(result.lastInsertRowid);
  }

  insertPrediction(prediction: Omit<PredictionRecord, "id">): number {
    const stmt = this.db.prepare(`
      INSERT INTO predictions (
        pulse_id, predicted_a, predicted_b, predicted_c, predicted_d,
        error_magnitude, surprise, triggered_translation
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      prediction.pulse_id,
      prediction.predicted_a,
      prediction.predicted_b,
      prediction.predicted_c,
      prediction.predicted_d,
      prediction.error_magnitude,
      prediction.surprise,
      prediction.triggered_translation ? 1 : 0,
    );
    return Number(result.lastInsertRowid);
  }

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
    this.db
      .prepare(
        `
      UPDATE system_state SET unique_names = unique_names + 1, total_namings = total_namings + 1 WHERE id = 1
    `,
      )
      .run();
    return Number(result.lastInsertRowid);
  }

  insertTranslationEvent(event: Omit<TranslationEventRecord, "id">): number {
    const stmt = this.db.prepare(`
      INSERT INTO translation_events (
        pulse_id, naming_id, llm_provider, prompt, response, duration_ms, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      event.pulse_id,
      event.naming_id,
      event.llm_provider,
      event.prompt,
      event.response,
      event.duration_ms,
      event.created_at,
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
    const rows = stmt.all(limit) as unknown as NamingRecord[];
    return rows;
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
    const stmt = this.db.prepare(`
      UPDATE namings
      SET confidence = ?, reference_count = ?, forgotten = ?
      WHERE id = ?
    `);
    stmt.run(confidence, referenceCount, forgotten, id);
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
        `
      UPDATE namings
      SET confidence = MAX(0.0, confidence - ?)
      WHERE forgotten = 0
    `,
      )
      .run(decayFactor);

    const result = this.db
      .prepare(
        `
      UPDATE namings
      SET forgotten = 1
      WHERE forgotten = 0 AND confidence < ?
    `,
      )
      .run(threshold);

    return {
      decayedCount: beforeActive.length,
      forgottenCount: Number(result.changes),
    };
  }

  getRecentPulses(limit: number): PulseRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, timestamp, signal_a, signal_b, signal_c, signal_d
      FROM pulses
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as unknown as PulseRecord[];
    // Reverse so they are returned in chronological order
    return rows.reverse();
  }

  getRecentHistory(limit: number): any[] {
    const stmt = this.db.prepare(`
      SELECT p.id, p.timestamp, p.signal_a, p.signal_b, p.signal_c, p.signal_d,
             pr.predicted_a, pr.predicted_b, pr.predicted_c, pr.predicted_d,
             pr.error_magnitude, pr.surprise, pr.triggered_translation
      FROM pulses p
      LEFT JOIN predictions pr ON p.id = pr.pulse_id
      ORDER BY p.timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as unknown as any[];
    return rows.reverse().map((r: any) => ({
      ...r,
      triggered_translation: !!r.triggered_translation,
    }));
  }

  getSystemState(): SystemStateRecord {
    const stmt = this.db.prepare(`
      SELECT cycle_count, total_namings, unique_names, last_translation_at, last_decayed_at,
             generator_step, generator_signal_b_state, generator_signal_d_state
      FROM system_state
      WHERE id = 1
    `);
    return stmt.get() as unknown as SystemStateRecord;
  }

  updateSystemState(
    cycleCount: number,
    generatorStep: number,
    generatorSignalBState: number,
    generatorSignalDState: number,
    lastDecayedAt?: number,
  ): void {
    if (lastDecayedAt !== undefined) {
      this.db
        .prepare(
          `
        UPDATE system_state
        SET cycle_count = ?, generator_step = ?, generator_signal_b_state = ?,
            generator_signal_d_state = ?, last_decayed_at = ?
        WHERE id = 1
      `,
        )
        .run(
          cycleCount,
          generatorStep,
          generatorSignalBState,
          generatorSignalDState,
          lastDecayedAt,
        );
    } else {
      this.db
        .prepare(
          `
        UPDATE system_state
        SET cycle_count = ?, generator_step = ?, generator_signal_b_state = ?,
            generator_signal_d_state = ?
        WHERE id = 1
      `,
        )
        .run(
          cycleCount,
          generatorStep,
          generatorSignalBState,
          generatorSignalDState,
        );
    }
  }

  close(): void {
    // DatabaseSync doesn't have a close() method in some node:sqlite builds,
    // but newer builds support close(). Let's check or handle it safely.
    if ("close" in this.db && typeof (this.db as any).close === "function") {
      (this.db as any).close();
    }
  }
}
