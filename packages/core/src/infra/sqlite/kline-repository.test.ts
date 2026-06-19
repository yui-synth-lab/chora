import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { findWorkspaceRoot } from "../../utils/workspace.js";
import { openConnection } from "./connection.js";
import { runMigrations } from "./migrations.js";
import { KLineRepository } from "./kline-repository.js";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(): { db: DatabaseSyncType; repo: KLineRepository; dbPath: string } {
  const root = findWorkspaceRoot();
  const dbPath = path.resolve(root, "data/test_kline_repo.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = openConnection(dbPath);
  runMigrations(db);
  const repo = new KLineRepository(db);
  return { db, repo, dbPath };
}

/** Insert a minimal naming row and return its id. */
function insertNaming(db: DatabaseSyncType, name: string): number {
  const result = db.prepare(
    `INSERT INTO namings (name, pulse_pattern, prediction_error, confidence, created_at, forgotten)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(name, "", "", 0.8, Date.now(), 0);
  return Number(result.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KLineRepository", () => {
  let db: DatabaseSyncType;
  let repo: KLineRepository;
  let dbPath: string;

  beforeEach(() => {
    ({ db, repo, dbPath } = makeRepo());
  });

  afterEach(() => {
    if ("close" in db && typeof (db as any).close === "function") {
      (db as any).close();
    }
    if (fs.existsSync(dbPath)) {
      try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
    }
  });

  it("upsertKLine creates a new K-line and returns isNew=true", () => {
    const a = insertNaming(db, "AgentA");
    const b = insertNaming(db, "AgentB");
    const ts = Date.now();

    const { id, isNew } = repo.upsertKLine(a, b, ts);
    expect(id).toBeGreaterThan(0);
    expect(isNew).toBe(true);
  });

  it("upsertKLine strengthens existing K-line and returns isNew=false", () => {
    const a = insertNaming(db, "AgentA");
    const b = insertNaming(db, "AgentB");
    const ts = Date.now();

    const first = repo.upsertKLine(a, b, ts);
    const second = repo.upsertKLine(a, b, ts + 1000);

    expect(second.id).toBe(first.id);
    expect(second.isNew).toBe(false);

    const klines = repo.getAllActiveKLines();
    expect(klines.length).toBe(1);
    // strength starts at 1.0 and is clamped: MIN(1.0, 1.0 + 0.2) = 1.0
    expect(klines[0].strength).toBeCloseTo(1.0);
    expect(klines[0].co_activation_count).toBe(2);
  });

  it("upsertKLine enforces canonical ordering (a < b)", () => {
    const a = insertNaming(db, "AgentA");
    const b = insertNaming(db, "AgentB");
    // Insert with higher id first
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);

    const { isNew } = repo.upsertKLine(hi, lo, Date.now());
    expect(isNew).toBe(true);

    const klines = repo.getAllActiveKLines();
    expect(klines.length).toBe(1);
    expect(klines[0].agent_a_id).toBe(lo);
    expect(klines[0].agent_b_id).toBe(hi);
  });

  it("getAllActiveKLines returns only K-lines with strength > 0", () => {
    const a = insertNaming(db, "AgentA");
    const b = insertNaming(db, "AgentB");
    const c = insertNaming(db, "AgentC");
    const ts = Date.now();

    repo.upsertKLine(a, b, ts);
    repo.upsertKLine(a, c, ts);

    // Decay fully so one drops to 0
    repo.decayKLines(1.0);

    const active = repo.getAllActiveKLines();
    expect(active.length).toBe(0);
  });

  it("getKLinesForAgent returns K-lines in both directions", () => {
    const a = insertNaming(db, "AgentA");
    const b = insertNaming(db, "AgentB");
    const c = insertNaming(db, "AgentC");
    const ts = Date.now();

    repo.upsertKLine(a, b, ts);
    repo.upsertKLine(b, c, ts);
    repo.upsertKLine(a, c, ts);

    // b participates as both agent_b (with a) and agent_a (with c)
    const forB = repo.getKLinesForAgent(b);
    expect(forB.length).toBe(2);
  });

  it("decayKLines reduces all strengths", () => {
    const a = insertNaming(db, "AgentA");
    const b = insertNaming(db, "AgentB");
    const ts = Date.now();

    repo.upsertKLine(a, b, ts);

    const changed = repo.decayKLines(0.3);
    expect(changed).toBe(1);

    const klines = repo.getAllActiveKLines();
    expect(klines.length).toBe(1);
    expect(klines[0].strength).toBeCloseTo(0.7);
  });

  it("removeWeakKLines deletes K-lines below threshold", () => {
    const a = insertNaming(db, "AgentA");
    const b = insertNaming(db, "AgentB");
    const ts = Date.now();

    repo.upsertKLine(a, b, ts);
    repo.decayKLines(0.9); // strength -> 0.1

    const deleted = repo.removeWeakKLines(0.5);
    expect(deleted).toBe(1);

    const klines = repo.getAllActiveKLines();
    expect(klines.length).toBe(0);
  });

  it("removeKLinesForAgent removes all K-lines for a given agent", () => {
    const a = insertNaming(db, "AgentA");
    const b = insertNaming(db, "AgentB");
    const c = insertNaming(db, "AgentC");
    const ts = Date.now();

    repo.upsertKLine(a, b, ts);
    repo.upsertKLine(a, c, ts);
    repo.upsertKLine(b, c, ts);

    const deleted = repo.removeKLinesForAgent(a);
    expect(deleted).toBe(2);

    const remaining = repo.getAllActiveKLines();
    expect(remaining.length).toBe(1);
    expect(remaining[0].agent_a_id).toBe(b);
    expect(remaining[0].agent_b_id).toBe(c);
  });
});
