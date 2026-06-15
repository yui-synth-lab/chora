import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { SystemStateRecord } from "../../domain/types.js";

export class SystemStateRepository {
  constructor(private readonly db: DatabaseSyncType) {}

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
          `UPDATE system_state
           SET cycle_count = ?, generator_step = ?, generator_signal_b_state = ?,
               generator_signal_d_state = ?, last_decayed_at = ?
           WHERE id = 1`,
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
          `UPDATE system_state
           SET cycle_count = ?, generator_step = ?, generator_signal_b_state = ?,
               generator_signal_d_state = ?
           WHERE id = 1`,
        )
        .run(cycleCount, generatorStep, generatorSignalBState, generatorSignalDState);
    }
  }

  /**
   * Increments both unique_names and total_namings counters atomically.
   * Called by the facade immediately after a new naming is inserted.
   */
  incrementNamingCounters(): void {
    this.db
      .prepare(
        `UPDATE system_state
         SET unique_names = unique_names + 1, total_namings = total_namings + 1
         WHERE id = 1`,
      )
      .run();
  }
}
