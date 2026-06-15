import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { findWorkspaceRoot } from "../../utils/workspace.js";
import { openConnection } from "./connection.js";
import { runMigrations } from "./migrations.js";
import { NamingRepository } from "./naming-repository.js";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(): { db: DatabaseSyncType; repo: NamingRepository; dbPath: string } {
  const root = findWorkspaceRoot();
  const dbPath = path.resolve(root, "data/test_naming_repo.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = openConnection(dbPath);
  runMigrations(db);
  const repo = new NamingRepository(db);
  return { db, repo, dbPath };
}

function sampleNaming(overrides: Partial<Parameters<NamingRepository["insertNaming"]>[0]> = {}) {
  return {
    name: "テスト名称",
    description: "test description",
    pulse_pattern: JSON.stringify({ signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 }),
    prediction_error: JSON.stringify({ signal_a: 0, signal_b: 0, signal_c: 0, signal_d: 0 }),
    llm_provider: "test",
    confidence: 0.8,
    created_at: Date.now(),
    reference_count: 1,
    forgotten: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NamingRepository", () => {
  let db: DatabaseSyncType;
  let repo: NamingRepository;
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

  it("inserts a naming and returns a positive row id", () => {
    const id = repo.insertNaming(sampleNaming());
    expect(id).toBeGreaterThan(0);
  });

  it("getAllActiveNamings returns only non-forgotten rows", () => {
    repo.insertNaming(sampleNaming({ name: "Active", forgotten: 0 }));
    repo.insertNaming(sampleNaming({ name: "AlsoActive", forgotten: 0 }));
    repo.insertNaming(sampleNaming({ name: "Forgotten", forgotten: 1 }));

    const active = repo.getAllActiveNamings();
    expect(active.length).toBe(2);
    expect(active.map((n) => n.name)).not.toContain("Forgotten");
  });

  it("getRecentNamings respects the limit and orders by created_at DESC", () => {
    const t = Date.now();
    repo.insertNaming(sampleNaming({ name: "First", created_at: t }));
    repo.insertNaming(sampleNaming({ name: "Second", created_at: t + 1 }));
    repo.insertNaming(sampleNaming({ name: "Third", created_at: t + 2 }));

    const recent = repo.getRecentNamings(2);
    expect(recent.length).toBe(2);
    // DESC order: newest first
    expect(recent[0].name).toBe("Third");
    expect(recent[1].name).toBe("Second");
  });

  it("updateNamingConfidenceAndRef updates confidence, referenceCount, and forgotten", () => {
    const id = repo.insertNaming(sampleNaming({ name: "UpdateMe", confidence: 0.5, reference_count: 1 }));
    repo.updateNamingConfidenceAndRef(id, 0.9, 5, 0);

    const rows = repo.getAllActiveNamings();
    const updated = rows.find((n) => n.name === "UpdateMe");
    expect(updated).toBeDefined();
    expect(updated?.confidence).toBeCloseTo(0.9);
    expect(updated?.reference_count).toBe(5);
    expect(updated?.forgotten).toBe(0);
  });

  it("decayAllNamings reduces confidence and marks forgotten when below threshold", () => {
    repo.insertNaming(sampleNaming({ name: "HighConf", confidence: 0.8 }));
    repo.insertNaming(sampleNaming({ name: "LowConf", confidence: 0.12 }));

    // decayFactor=0.1, threshold=0.1
    // HighConf: 0.8 → 0.7 (active)
    // LowConf:  0.12 → 0.02 (forgotten)
    const result = repo.decayAllNamings(0.1, 0.1);

    expect(result.decayedCount).toBe(2);   // 2 were active before decay
    expect(result.forgottenCount).toBe(1);

    const active = repo.getAllActiveNamings();
    expect(active.length).toBe(1);
    expect(active[0].name).toBe("HighConf");
    expect(active[0].confidence).toBeCloseTo(0.7);
  });

  it("decayAllNamings clamps confidence to 0 (never negative)", () => {
    repo.insertNaming(sampleNaming({ name: "AlreadyLow", confidence: 0.05 }));

    // decayFactor=0.1 would yield -0.05 without clamping
    repo.decayAllNamings(0.1, 0.01);

    // Row is forgotten but its confidence should be >= 0
    const recent = repo.getRecentNamings(1);
    expect(recent[0].confidence).toBeGreaterThanOrEqual(0);
  });
});
