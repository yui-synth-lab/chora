import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { findWorkspaceRoot } from "../utils/workspace.js";
import { ChoraDatabase } from "../db/client.js";
import { AgencyService } from "./agency-service.js";
import type { KLineRecord, NamingRecord } from "../domain/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(): { db: ChoraDatabase; service: AgencyService; dbPath: string } {
  const root = findWorkspaceRoot();
  const dbPath = path.resolve(root, "data/test_agency_service.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new ChoraDatabase(dbPath);
  const service = new AgencyService(db, 3, 0.2);
  return { db, service, dbPath };
}

function makeNaming(id: number, name: string): NamingRecord {
  return {
    id,
    name,
    description: null,
    pulse_pattern: "{}",
    prediction_error: "{}",
    llm_provider: "test",
    confidence: 0.8,
    created_at: Date.now(),
    reference_count: 1,
    forgotten: 0,
  };
}

function makeKLine(
  aId: number,
  bId: number,
  strength: number,
  timestamp: number = Date.now(),
): KLineRecord {
  const a = Math.min(aId, bId);
  const b = Math.max(aId, bId);
  return {
    agent_a_id: a,
    agent_b_id: b,
    strength,
    formed_at: timestamp,
    last_co_activation: timestamp,
    co_activation_count: 1,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgencyService", () => {
  let db: ChoraDatabase;
  let service: AgencyService;
  let dbPath: string;

  beforeEach(() => {
    ({ db, service, dbPath } = makeEnv());
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
    }
  });

  it("recomputeAgencies finds connected components", () => {
    const ts = Date.now();

    // 5 naming records: ids 1-5
    const namings = [1, 2, 3, 4, 5].map((i) => makeNaming(i, `agent-${i}`));

    // A(1)↔B(2)↔C(3) forms one component of 3
    // D(4)↔E(5) forms a pair — too small (< minMembers=3)
    const klines: KLineRecord[] = [
      makeKLine(1, 2, 0.8, ts),
      makeKLine(2, 3, 0.7, ts),
      makeKLine(4, 5, 0.9, ts),
    ];

    const result = service.recomputeAgencies(klines, namings, ts);

    expect(result.agencies).toHaveLength(1);
    expect(result.agencies[0].memberNames).toEqual(
      expect.arrayContaining(["agent-1", "agent-2", "agent-3"]),
    );
    expect(result.agencies[0].memberNames).toHaveLength(3);

    // Persisted to DB
    const persisted = db.getAllAgencies();
    expect(persisted).toHaveLength(1);
  });

  it("recomputeAgencies ignores weak K-lines", () => {
    const ts = Date.now();

    // 3 agents: A(1)↔B(2)↔C(3) but A-B link is below threshold (0.1 < 0.2)
    // This splits the graph: A alone (no edges above threshold), B-C pair (size 2 < 3)
    const namings = [1, 2, 3].map((i) => makeNaming(i, `agent-${i}`));

    const klines: KLineRecord[] = [
      makeKLine(1, 2, 0.1, ts), // weak — ignored
      makeKLine(2, 3, 0.8, ts), // strong
    ];

    const result = service.recomputeAgencies(klines, namings, ts);

    // Only B-C survives filter, but it's a pair of 2 — below minMembers=3
    expect(result.agencies).toHaveLength(0);
    expect(db.getAllAgencies()).toHaveLength(0);
  });

  it("recomputeAgencies computes coherence as mean edge strength", () => {
    const ts = Date.now();
    const namings = [1, 2, 3].map((i) => makeNaming(i, `agent-${i}`));

    // Triangle: A-B=0.8, B-C=0.6, A-C=0.4 → mean = (0.8+0.6+0.4)/3 = 0.6
    const klines: KLineRecord[] = [
      makeKLine(1, 2, 0.8, ts),
      makeKLine(2, 3, 0.6, ts),
      makeKLine(1, 3, 0.4, ts),
    ];

    const result = service.recomputeAgencies(klines, namings, ts);

    expect(result.agencies).toHaveLength(1);
    expect(result.agencies[0].coherence).toBeCloseTo(0.6, 5);
  });

  it("recomputeAgencies replaces old agencies on recompute", () => {
    const ts = Date.now();
    const namings = [1, 2, 3].map((i) => makeNaming(i, `agent-${i}`));

    const klines: KLineRecord[] = [
      makeKLine(1, 2, 0.8, ts),
      makeKLine(2, 3, 0.7, ts),
      makeKLine(1, 3, 0.6, ts),
    ];

    // First recompute
    service.recomputeAgencies(klines, namings, ts);
    expect(db.getAllAgencies()).toHaveLength(1);

    // Second recompute with no qualifying components (all pairs, too small)
    const onlyPair: KLineRecord[] = [makeKLine(1, 2, 0.9, ts + 1)];
    const namings2 = [1, 2].map((i) => makeNaming(i, `agent-${i}`));
    service.recomputeAgencies(onlyPair, namings2, ts + 1);

    // Old agencies should be replaced — none qualify now
    expect(db.getAllAgencies()).toHaveLength(0);
  });
});
