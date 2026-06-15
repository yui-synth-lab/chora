import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { findWorkspaceRoot } from "../../utils/workspace.js";
import { openConnection } from "./connection.js";
import { runMigrations } from "./migrations.js";
import { SystemStateRepository } from "./system-state-repository.js";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

function makeRepo(): { db: DatabaseSyncType; repo: SystemStateRepository; dbPath: string } {
  const root = findWorkspaceRoot();
  const dbPath = path.resolve(root, "data/test_sysstate_repo.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = openConnection(dbPath);
  runMigrations(db);
  const repo = new SystemStateRepository(db);
  return { db, repo, dbPath };
}

describe("SystemStateRepository", () => {
  let db: DatabaseSyncType;
  let repo: SystemStateRepository;
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

  it("getSystemState returns the seeded singleton row with default values", () => {
    const state = repo.getSystemState();
    expect(state).toBeDefined();
    expect(state.cycle_count).toBe(0);
    expect(state.total_namings).toBe(0);
    expect(state.unique_names).toBe(0);
    expect(state.last_translation_at).toBeNull();
    expect(state.generator_step).toBe(0);
    expect(state.generator_signal_b_state).toBeCloseTo(0.5);
    expect(state.generator_signal_d_state).toBeCloseTo(0.3);
  });

  it("updateSystemState persists cycle_count and generator state", () => {
    repo.updateSystemState(42, 100, 0.6, 0.4);

    const state = repo.getSystemState();
    expect(state.cycle_count).toBe(42);
    expect(state.generator_step).toBe(100);
    expect(state.generator_signal_b_state).toBeCloseTo(0.6);
    expect(state.generator_signal_d_state).toBeCloseTo(0.4);
    // last_decayed_at not passed, so should remain NULL
    expect(state.last_decayed_at).toBeNull();
  });

  it("updateSystemState with lastDecayedAt persists the timestamp", () => {
    const ts = Date.now();
    repo.updateSystemState(10, 5, 0.5, 0.3, ts);

    const state = repo.getSystemState();
    expect(state.last_decayed_at).toBe(ts);
  });

  it("incrementNamingCounters bumps unique_names and total_namings", () => {
    repo.incrementNamingCounters();
    repo.incrementNamingCounters();

    const state = repo.getSystemState();
    expect(state.unique_names).toBe(2);
    expect(state.total_namings).toBe(2);
  });

  it("incrementNamingCounters is independent of updateSystemState", () => {
    repo.incrementNamingCounters();
    // updateSystemState must NOT reset the counters
    repo.updateSystemState(5, 0, 0.5, 0.3);
    repo.incrementNamingCounters();

    const state = repo.getSystemState();
    expect(state.unique_names).toBe(2);
    expect(state.total_namings).toBe(2);
    expect(state.cycle_count).toBe(5);
  });
});
