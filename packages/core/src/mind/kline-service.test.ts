import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { findWorkspaceRoot } from "../utils/workspace.js";
import { openConnection } from "../infra/sqlite/connection.js";
import { runMigrations } from "../infra/sqlite/migrations.js";
import { ChoraDatabase } from "../db/client.js";
import { KLineService } from "./kline-service.js";
import type { AgentActivation } from "../domain/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(): { db: ChoraDatabase; service: KLineService; dbPath: string } {
  const root = findWorkspaceRoot();
  const dbPath = path.resolve(root, "data/test_kline_service.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  // Open raw connection, run migrations, then wrap in ChoraDatabase facade
  const rawDb = openConnection(dbPath);
  runMigrations(rawDb);
  rawDb.close?.();

  const db = new ChoraDatabase(dbPath);
  const service = new KLineService(db);
  return { db, service, dbPath };
}

function insertTestNaming(db: ChoraDatabase, name: string): number {
  return db.insertNaming({
    name,
    description: null,
    pulse_pattern: JSON.stringify({ signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 }),
    prediction_error: "{}",
    llm_provider: "test",
    confidence: 0.8,
    created_at: Date.now(),
    reference_count: 1,
    forgotten: 0,
  });
}

function makeActivation(agentId: number, name: string, totalActivation: number): AgentActivation {
  return {
    agentId,
    name,
    directActivation: totalActivation,
    spreadActivation: 0,
    totalActivation,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KLineService", () => {
  let db: ChoraDatabase;
  let service: KLineService;
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

  it("formKLines creates K-lines between co-active agents", () => {
    const idA = insertTestNaming(db, "agent-alpha");
    const idB = insertTestNaming(db, "agent-beta");
    const idC = insertTestNaming(db, "agent-gamma");

    const agents = [
      makeActivation(idA, "agent-alpha", 0.8),
      makeActivation(idB, "agent-beta", 0.7),
      makeActivation(idC, "agent-gamma", 0.5),
    ];

    const formed = service.formKLines(agents, Date.now());

    // 3 agents → 3 pairs: A-B, A-C, B-C
    expect(formed).toHaveLength(3);
    expect(formed.every((f) => f.isNew)).toBe(true);
    expect(formed.every((f) => f.strength > 0)).toBe(true);

    const klines = db.getAllActiveKLines();
    expect(klines).toHaveLength(3);
  });

  it("formKLines strengthens existing K-lines on repeated co-activation", () => {
    const idA = insertTestNaming(db, "agent-alpha");
    const idB = insertTestNaming(db, "agent-beta");

    const agents = [
      makeActivation(idA, "agent-alpha", 0.9),
      makeActivation(idB, "agent-beta", 0.9),
    ];

    const ts = Date.now();

    // First formation
    const first = service.formKLines(agents, ts);
    expect(first).toHaveLength(1);
    expect(first[0].isNew).toBe(true);
    const strengthAfterFirst = first[0].strength;

    // Decay so strength drops below 1.0, then re-form to verify strengthening
    db.decayKLines(0.5); // 1.0 → 0.5

    const second = service.formKLines(agents, ts + 1000);
    expect(second).toHaveLength(1);
    expect(second[0].isNew).toBe(false);
    // 0.5 + 0.2 = 0.7, which is greater than the decayed 0.5
    expect(second[0].strength).toBeGreaterThan(0.5);

    // DB should still have only 1 k-line
    const klines = db.getAllActiveKLines();
    expect(klines).toHaveLength(1);
    expect(klines[0].co_activation_count).toBe(2);
  });

  it("formKLines ignores agents below coActivationThreshold", () => {
    const idA = insertTestNaming(db, "agent-above");
    const idB = insertTestNaming(db, "agent-below");

    const agents = [
      makeActivation(idA, "agent-above", 0.8),   // above default 0.3
      makeActivation(idB, "agent-below", 0.1),   // below default 0.3
    ];

    const formed = service.formKLines(agents, Date.now());

    // Only 1 eligible agent → no pairs → no K-lines
    expect(formed).toHaveLength(0);
    expect(db.getAllActiveKLines()).toHaveLength(0);
  });

  it("formKLines does nothing with fewer than 2 eligible agents", () => {
    const idA = insertTestNaming(db, "solo-agent");

    const agents = [makeActivation(idA, "solo-agent", 0.9)];
    const formed = service.formKLines(agents, Date.now());

    expect(formed).toHaveLength(0);
    expect(db.getAllActiveKLines()).toHaveLength(0);
  });

  it("decayKLines reduces strengths and removes weak ones", () => {
    const idA = insertTestNaming(db, "agent-alpha");
    const idB = insertTestNaming(db, "agent-beta");
    const idC = insertTestNaming(db, "agent-gamma");

    const ts = Date.now();

    // Form A-B (strong) and A-C (will be formed then decay to almost nothing)
    service.formKLines(
      [makeActivation(idA, "a", 0.9), makeActivation(idB, "b", 0.9)],
      ts,
    );
    service.formKLines(
      [makeActivation(idA, "a", 0.9), makeActivation(idC, "c", 0.9)],
      ts,
    );

    expect(db.getAllActiveKLines()).toHaveLength(2);

    // Decay by 0.95 — both start at 1.0, both drop to 0.05
    // weakThreshold = 0.06 → both get removed
    const result = service.decayKLines(0.95, 0.06);

    expect(result.decayedCount).toBe(2);
    expect(result.removedCount).toBe(2);
    expect(db.getAllActiveKLines()).toHaveLength(0);
  });

  it("removeKLinesForForgottenAgents removes associated K-lines", () => {
    const idA = insertTestNaming(db, "agent-alpha");
    const idB = insertTestNaming(db, "agent-beta");
    const idC = insertTestNaming(db, "agent-gamma");

    const ts = Date.now();
    service.formKLines(
      [makeActivation(idA, "a", 0.9), makeActivation(idB, "b", 0.9), makeActivation(idC, "c", 0.9)],
      ts,
    );

    // 3 agents → 3 K-lines
    expect(db.getAllActiveKLines()).toHaveLength(3);

    // Forget agent B — removes A-B and B-C (2 k-lines)
    const removed = service.removeKLinesForForgottenAgents([idB]);
    expect(removed).toBe(2);
    expect(db.getAllActiveKLines()).toHaveLength(1);

    // The surviving k-line should be A-C
    const remaining = db.getAllActiveKLines();
    expect(remaining[0].agent_a_id).toBe(Math.min(idA, idC));
    expect(remaining[0].agent_b_id).toBe(Math.max(idA, idC));
  });
});
