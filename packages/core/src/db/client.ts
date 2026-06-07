import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

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

export interface NamingRecord {
  id?: number;
  name: string;
  description: string | null;
  pulse_pattern: string; // JSON string
  prediction_error: string; // JSON string
  llm_provider: string | null;
  confidence: number | null;
  created_at: number;
  reference_count?: number;
  forgotten?: number;
}

export interface TranslationEventRecord {
  id?: number;
  pulse_id: number;
  naming_id: number | null;
  llm_provider: string;
  prompt: string;
  response: string;
  duration_ms: number | null;
  created_at: number;
}

export class ChoraDatabase {
  private db: DatabaseSyncType;

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
      try {
        this.db.exec('ALTER TABLE namings ADD COLUMN forgotten INTEGER DEFAULT 0');
      } catch (e) {
        // Ignored if column already exists
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

  insertNaming(naming: Omit<NamingRecord, 'id'>): number {
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
      naming.forgotten ?? 0
    );
    return Number(result.lastInsertRowid);
  }

  insertTranslationEvent(event: Omit<TranslationEventRecord, 'id'>): number {
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
      event.created_at
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

  updateNamingConfidenceAndRef(id: number, confidence: number, referenceCount: number, forgotten: number): void {
    const stmt = this.db.prepare(`
      UPDATE namings
      SET confidence = ?, reference_count = ?, forgotten = ?
      WHERE id = ?
    `);
    stmt.run(confidence, referenceCount, forgotten, id);
  }

  decayAllNamings(decayFactor: number, threshold: number): { decayedCount: number; forgottenCount: number } {
    const beforeActive = this.db.prepare('SELECT id FROM namings WHERE forgotten = 0').all();
    
    this.db.prepare(`
      UPDATE namings
      SET confidence = MAX(0.0, confidence - ?)
      WHERE forgotten = 0
    `).run(decayFactor);

    const result = this.db.prepare(`
      UPDATE namings
      SET forgotten = 1
      WHERE forgotten = 0 AND confidence < ?
    `).run(threshold);

    return {
      decayedCount: beforeActive.length,
      forgottenCount: Number(result.changes)
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
