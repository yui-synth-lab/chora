import { MemoryManager } from "./manager.js";
import type { ChoraDatabase } from "../db/client.js";
import type { Pulse, NamingRecord } from "../domain/types.js";
import type { NamingResponse } from "../translation/provider.js";

export interface ResolvedNaming {
  namingId: number | null;
  chosenName: string;
  chosenDescription: string;
  /** true when the LLM created a brand-new name; false when it reinforced existing */
  isNew: boolean;
  /** non-null log message when a special path was taken (hallucination, dedup) */
  logNote: string | null;
}

export interface NamingInsertPayload {
  name: string;
  description: string;
  pulse: Pulse;
  deltas: { signal_a: number; signal_b: number; signal_c: number; signal_d: number };
  llmProvider: string;
  confidence: number;
}

/**
 * NamingService — encapsulates memory-related operations:
 *   - findSimilar  (delegates to MemoryManager)
 *   - resolveNaming (the full Phase-1 dedup logic)
 *   - reinforce    (delegates to MemoryManager)
 *   - decayStep    (delegates to MemoryManager)
 *
 * MemoryManager's public API is preserved unchanged.
 */
export class NamingService {
  private readonly memory: MemoryManager;
  private readonly db: ChoraDatabase;

  constructor(db: ChoraDatabase) {
    this.db = db;
    this.memory = new MemoryManager(db);
  }

  findSimilar(
    pulse: Pulse,
    topK = 5,
    maxDistance = 0.5,
  ): { naming: NamingRecord; distance: number }[] {
    return this.memory.findSimilar(pulse, topK, maxDistance);
  }

  /**
   * Resolves the LLM NamingResponse into a concrete naming, applying the
   * Phase-1 dedup invariants:
   *
   * use_existing_name path:
   *   - If found in active namings → reinforce (+boost) and reuse.
   *   - If NOT found (hallucinated) → insert as new with a log note.
   *
   * new_name path:
   *   - If an active naming with that exact name already exists → reinforce
   *     instead of inserting a duplicate (Phase-1 dedup fix).
   *   - Otherwise → insert as new.
   */
  resolveNaming(
    response: NamingResponse,
    payload: NamingInsertPayload,
    similarNamings: { naming: NamingRecord; distance: number }[],
    boost = 0.1,
  ): ResolvedNaming {
    const activeNamings = this.db.getAllActiveNamings();

    if (response.use_existing_name) {
      const chosenName = response.use_existing_name;
      const reinforced = activeNamings.find((n) => n.name === chosenName);

      if (reinforced) {
        // Name exists in DB — reinforce it
        const existing = similarNamings.find(
          ({ naming: n }) => n.name === chosenName,
        );
        const chosenDescription =
          existing?.naming.description ||
          reinforced.description ||
          response.description;
        this.memory.reinforceNaming(chosenName, boost);
        return {
          namingId: reinforced.id ?? null,
          chosenName,
          chosenDescription: chosenDescription ?? "",
          isNew: false,
          logNote: null,
        };
      } else {
        // LLM hallucinated a name not in DB — treat as new
        const chosenDescription = response.description;
        const namingId = this.db.insertNaming({
          name: chosenName,
          description: chosenDescription,
          pulse_pattern: JSON.stringify(payload.pulse),
          prediction_error: JSON.stringify(payload.deltas),
          llm_provider: payload.llmProvider,
          confidence: payload.confidence,
          created_at: Date.now(),
          reference_count: 1,
          forgotten: 0,
        });
        return {
          namingId,
          chosenName,
          chosenDescription,
          isNew: true,
          logNote: `use_existing_name "${chosenName}" not found in DB, inserting as new`,
        };
      }
    } else if (response.new_name) {
      const chosenName = response.new_name;
      const existingNew = activeNamings.find((n) => n.name === chosenName);

      if (existingNew) {
        // LLM proposed a "new" name that already exists — reinforce instead of inserting
        const chosenDescription =
          existingNew.description || response.description;
        this.memory.reinforceNaming(chosenName, boost);
        return {
          namingId: existingNew.id ?? null,
          chosenName,
          chosenDescription: chosenDescription ?? "",
          isNew: false,
          logNote: `new_name "${chosenName}" already exists in DB, reinforcing instead of inserting`,
        };
      } else {
        const chosenDescription = response.description;
        const namingId = this.db.insertNaming({
          name: chosenName,
          description: chosenDescription,
          pulse_pattern: JSON.stringify(payload.pulse),
          prediction_error: JSON.stringify(payload.deltas),
          llm_provider: payload.llmProvider,
          confidence: payload.confidence,
          created_at: Date.now(),
          reference_count: 1,
          forgotten: 0,
        });
        return {
          namingId,
          chosenName,
          chosenDescription,
          isNew: true,
          logNote: null,
        };
      }
    }

    // LLM returned neither field — nothing to resolve
    return {
      namingId: null,
      chosenName: "",
      chosenDescription: "",
      isNew: false,
      logNote: null,
    };
  }

  reinforceNaming(name: string, boost = 0.1): void {
    this.memory.reinforceNaming(name, boost);
  }

  decayStep(
    decayFactor = 0.05,
    threshold = 0.1,
  ): { decayedCount: number; forgottenCount: number } {
    return this.memory.decayStep(decayFactor, threshold);
  }
}
