// Import domain types and re-export for backward compatibility
import type {
  PulseRecord,
  SystemStateRecord,
  PredictionRecord,
  NamingRecord,
  TranslationEventRecord,
  PulseHistoryRecord,
} from "../domain/types.js";

export type {
  PulseRecord,
  SystemStateRecord,
  PredictionRecord,
  NamingRecord,
  TranslationEventRecord,
  PulseHistoryRecord,
};

import { openConnection } from "../infra/sqlite/connection.js";
import { runMigrations } from "../infra/sqlite/migrations.js";
import { PulseRepository } from "../infra/sqlite/pulse-repository.js";
import { PredictionRepository } from "../infra/sqlite/prediction-repository.js";
import { NamingRepository } from "../infra/sqlite/naming-repository.js";
import { TranslationEventRepository } from "../infra/sqlite/translation-event-repository.js";
import { SystemStateRepository } from "../infra/sqlite/system-state-repository.js";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

export interface ChoraDBOptions {
  /** When true, open the database in read-only mode and skip running migrations. */
  readOnly?: boolean;
}

/**
 * ChoraDatabase — thin facade over the focused repository layer.
 *
 * Public API is intentionally byte-identical to the original God Object so
 * that packages/cli and packages/server require zero changes.
 */
export class ChoraDatabase {
  private db: DatabaseSyncType;
  private pulseRepo: PulseRepository;
  private predictionRepo: PredictionRepository;
  private namingRepo: NamingRepository;
  private translationEventRepo: TranslationEventRepository;
  private systemStateRepo: SystemStateRepository;

  constructor(dbPath: string, options: ChoraDBOptions = {}) {
    const readOnly = options.readOnly ?? false;
    this.db = openConnection(dbPath, { readOnly });
    if (!readOnly) {
      runMigrations(this.db);
    }

    this.pulseRepo = new PulseRepository(this.db);
    this.predictionRepo = new PredictionRepository(this.db);
    this.namingRepo = new NamingRepository(this.db);
    this.translationEventRepo = new TranslationEventRepository(this.db);
    this.systemStateRepo = new SystemStateRepository(this.db);
  }

  // ── Pulses ────────────────────────────────────────────────────────────────

  insertPulse(pulse: Omit<PulseRecord, "id">): number {
    return this.pulseRepo.insertPulse(pulse);
  }

  getRecentPulses(limit: number): PulseRecord[] {
    return this.pulseRepo.getRecentPulses(limit);
  }

  getRecentHistory(limit: number): PulseHistoryRecord[] {
    return this.pulseRepo.getRecentHistory(limit);
  }

  // ── Predictions ───────────────────────────────────────────────────────────

  insertPrediction(prediction: Omit<PredictionRecord, "id">): number {
    return this.predictionRepo.insertPrediction(prediction);
  }

  // ── Namings ───────────────────────────────────────────────────────────────

  /**
   * Inserts a new naming and bumps system_state unique_names + total_namings.
   * The counter increment is coordinated here in the facade, not in the repo,
   * so each repository remains single-responsibility.
   */
  insertNaming(naming: Omit<NamingRecord, "id">): number {
    const id = this.namingRepo.insertNaming(naming);
    this.systemStateRepo.incrementNamingCounters();
    return id;
  }

  getRecentNamings(limit: number): NamingRecord[] {
    return this.namingRepo.getRecentNamings(limit);
  }

  getAllActiveNamings(): NamingRecord[] {
    return this.namingRepo.getAllActiveNamings();
  }

  updateNamingConfidenceAndRef(
    id: number,
    confidence: number,
    referenceCount: number,
    forgotten: number,
  ): void {
    this.namingRepo.updateNamingConfidenceAndRef(id, confidence, referenceCount, forgotten);
  }

  decayAllNamings(
    decayFactor: number,
    threshold: number,
  ): { decayedCount: number; forgottenCount: number } {
    return this.namingRepo.decayAllNamings(decayFactor, threshold);
  }

  // ── Translation Events ────────────────────────────────────────────────────

  insertTranslationEvent(event: Omit<TranslationEventRecord, "id">): number {
    return this.translationEventRepo.insertTranslationEvent(event);
  }

  // ── System State ──────────────────────────────────────────────────────────

  getSystemState(): SystemStateRecord {
    return this.systemStateRepo.getSystemState();
  }

  updateSystemState(
    cycleCount: number,
    generatorStep: number,
    generatorSignalBState: number,
    generatorSignalDState: number,
    lastDecayedAt?: number,
  ): void {
    this.systemStateRepo.updateSystemState(
      cycleCount,
      generatorStep,
      generatorSignalBState,
      generatorSignalDState,
      lastDecayedAt,
    );
  }

  // ── Connection ────────────────────────────────────────────────────────────

  close(): void {
    if ("close" in this.db && typeof (this.db as any).close === "function") {
      (this.db as any).close();
    }
  }
}
