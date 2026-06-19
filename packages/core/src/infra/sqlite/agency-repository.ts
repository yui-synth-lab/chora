import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import type { AgencyRecord } from "../../domain/types.js";

export class AgencyRepository {
  constructor(private readonly db: DatabaseSyncType) {}

  upsertAgency(agency: Omit<AgencyRecord, "id">): number {
    const result = this.db.prepare(
      `INSERT INTO agencies (name, member_ids, coherence, formed_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      agency.name,
      agency.member_ids,
      agency.coherence,
      agency.formed_at,
      agency.updated_at,
    );
    return Number(result.lastInsertRowid);
  }

  getAllAgencies(): AgencyRecord[] {
    return this.db.prepare(
      "SELECT id, name, member_ids, coherence, formed_at, updated_at FROM agencies",
    ).all() as unknown as AgencyRecord[];
  }

  deleteAllAgencies(): void {
    this.db.prepare("DELETE FROM agencies").run();
  }
}
