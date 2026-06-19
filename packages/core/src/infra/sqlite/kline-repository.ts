import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { KLineRecord } from "../../domain/types.js";

export class KLineRepository {
  constructor(private readonly db: DatabaseSyncType) {}

  upsertKLine(agentAId: number, agentBId: number, timestamp: number): { id: number; isNew: boolean } {
    const lo = Math.min(agentAId, agentBId);
    const hi = Math.max(agentAId, agentBId);

    const existing = this.db.prepare(
      "SELECT id, strength, co_activation_count FROM k_lines WHERE agent_a_id = ? AND agent_b_id = ?",
    ).get(lo, hi) as { id: number; strength: number; co_activation_count: number } | undefined;

    if (existing) {
      this.db.prepare(
        `UPDATE k_lines
         SET strength = MIN(1.0, strength + 0.2),
             co_activation_count = co_activation_count + 1,
             last_co_activation = ?
         WHERE id = ?`,
      ).run(timestamp, existing.id);
      return { id: existing.id, isNew: false };
    }

    const result = this.db.prepare(
      `INSERT INTO k_lines (agent_a_id, agent_b_id, strength, formed_at, last_co_activation, co_activation_count)
       VALUES (?, ?, 1.0, ?, ?, 1)`,
    ).run(lo, hi, timestamp, timestamp);
    return { id: Number(result.lastInsertRowid), isNew: true };
  }

  getAllActiveKLines(): KLineRecord[] {
    return this.db.prepare(
      "SELECT id, agent_a_id, agent_b_id, strength, formed_at, last_co_activation, co_activation_count FROM k_lines WHERE strength > 0.0",
    ).all() as unknown as KLineRecord[];
  }

  getKLinesForAgent(agentId: number): KLineRecord[] {
    return this.db.prepare(
      "SELECT id, agent_a_id, agent_b_id, strength, formed_at, last_co_activation, co_activation_count FROM k_lines WHERE agent_a_id = ? OR agent_b_id = ?",
    ).all(agentId, agentId) as unknown as KLineRecord[];
  }

  decayKLines(decayFactor: number): number {
    const result = this.db.prepare(
      "UPDATE k_lines SET strength = MAX(0.0, strength - ?)",
    ).run(decayFactor);
    return Number(result.changes);
  }

  removeWeakKLines(threshold: number): number {
    const result = this.db.prepare(
      "DELETE FROM k_lines WHERE strength < ?",
    ).run(threshold);
    return Number(result.changes);
  }

  removeKLinesForAgent(agentId: number): number {
    const result = this.db.prepare(
      "DELETE FROM k_lines WHERE agent_a_id = ? OR agent_b_id = ?",
    ).run(agentId, agentId);
    return Number(result.changes);
  }
}
