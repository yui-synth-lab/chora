import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_QUERIES } from './schema.js';
import * as path from 'path';
import * as fs from 'fs';

export interface PulseRecord {
  id?: number;
  timestamp: number;
  signal_a: number;
  signal_b: number;
  signal_c: number;
  signal_d: number;
}

export interface SystemStateRecord {
  cycle_count: number;
  total_namings: number;
  unique_names: number;
  last_translation_at: number | null;
}

export interface PredictionRecord {
  id?: number;
  pulse_id: number;
  predicted_a: number;
  predicted_b: number;
  predicted_c: number;
  predicted_d: number;
  error_magnitude: number;
  surprise: number;
  triggered_translation: boolean;
}

export class ChoraDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    // Ensure parent directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    this.db.exec('BEGIN TRANSACTION');
    try {
      for (const query of SCHEMA_QUERIES) {
        this.db.exec(query);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  insertPulse(pulse: Omit<PulseRecord, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO pulses (timestamp, signal_a, signal_b, signal_c, signal_d)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      pulse.timestamp,
      pulse.signal_a,
      pulse.signal_b,
      pulse.signal_c,
      pulse.signal_d
    );
    // lastInsertRowid can be a number or bigint, cast to number
    return Number(result.lastInsertRowid);
  }

  insertPrediction(prediction: Omit<PredictionRecord, 'id'>): number {
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
      prediction.triggered_translation ? 1 : 0
    );
    return Number(result.lastInsertRowid);
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

  getSystemState(): SystemStateRecord {
    const stmt = this.db.prepare(`
      SELECT cycle_count, total_namings, unique_names, last_translation_at
      FROM system_state
      WHERE id = 1
    `);
    return stmt.get() as unknown as SystemStateRecord;
  }

  incrementCycleCount(): void {
    const stmt = this.db.prepare(`
      UPDATE system_state
      SET cycle_count = cycle_count + 1
      WHERE id = 1
    `);
    stmt.run();
  }

  close(): void {
    // DatabaseSync doesn't have a close() method in some node:sqlite builds,
    // but newer builds support close(). Let's check or handle it safely.
    if ('close' in this.db && typeof (this.db as any).close === 'function') {
      (this.db as any).close();
    }
  }
}
