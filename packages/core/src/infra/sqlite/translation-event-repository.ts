import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { TranslationEventRecord } from "../../domain/types.js";

export class TranslationEventRepository {
  constructor(private readonly db: DatabaseSyncType) {}

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
}
