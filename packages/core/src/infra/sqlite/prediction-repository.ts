import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { PredictionRecord } from "../../domain/types.js";

export class PredictionRepository {
  constructor(private readonly db: DatabaseSyncType) {}

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
}
