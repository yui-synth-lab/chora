import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { findWorkspaceRoot } from "../../utils/workspace.js";
import { openConnection } from "./connection.js";
import { runMigrations, MIGRATIONS } from "./migrations.js";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

function tempDbPath(name: string): string {
  const root = findWorkspaceRoot();
  return path.resolve(root, `data/test_migrations_${name}.db`);
}

describe("runMigrations", () => {
  const paths: string[] = [];
  const dbs: DatabaseSyncType[] = [];

  function open(name: string): { db: DatabaseSyncType; dbPath: string } {
    const dbPath = tempDbPath(name);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const db = openConnection(dbPath);
    paths.push(dbPath);
    dbs.push(db);
    return { db, dbPath };
  }

  afterEach(() => {
    for (const db of dbs.splice(0)) {
      if ("close" in db && typeof (db as any).close === "function") {
        (db as any).close();
      }
    }
    for (const p of paths.splice(0)) {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
      }
    }
  });

  it("MIGRATIONS registry is non-empty and versions are strictly increasing", () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    for (let i = 1; i < MIGRATIONS.length; i++) {
      expect(MIGRATIONS[i].version).toBeGreaterThan(MIGRATIONS[i - 1].version);
    }
  });

  it("creates all expected tables on a fresh database", () => {
    const { db } = open("fresh");
    runMigrations(db);

    const tableNames = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>
    ).map((r) => r.name);

    expect(tableNames).toContain("pulses");
    expect(tableNames).toContain("predictions");
    expect(tableNames).toContain("namings");
    expect(tableNames).toContain("translation_events");
    expect(tableNames).toContain("system_state");
  });

  it("seeds the system_state singleton row on a fresh database", () => {
    const { db } = open("seed");
    runMigrations(db);

    const row = db
      .prepare("SELECT id, cycle_count FROM system_state WHERE id = 1")
      .get() as { id: number; cycle_count: number } | undefined;

    expect(row).toBeDefined();
    expect(row?.id).toBe(1);
    expect(row?.cycle_count).toBe(0);
  });

  it("is idempotent: running migrations twice does not throw", () => {
    const { db } = open("idempotent");
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });

  it("advances PRAGMA user_version to the latest migration version", () => {
    const { db } = open("version");
    runMigrations(db);

    const { user_version } = db
      .prepare("PRAGMA user_version")
      .get() as { user_version: number };

    const latestVersion = Math.max(...MIGRATIONS.map((m) => m.version));
    expect(user_version).toBe(latestVersion);
  });

  it("namings table has the forgotten column (from migration v2)", () => {
    const { db } = open("forgotten_col");
    runMigrations(db);

    const cols = db
      .prepare("PRAGMA table_info(namings)")
      .all() as Array<{ name: string }>;
    expect(cols.map((c) => c.name)).toContain("forgotten");
  });

  it("system_state table has generator and last_decayed_at columns (from migration v3)", () => {
    const { db } = open("sysstate_cols");
    runMigrations(db);

    const cols = db
      .prepare("PRAGMA table_info(system_state)")
      .all() as Array<{ name: string }>;
    const colNames = cols.map((c) => c.name);

    expect(colNames).toContain("generator_step");
    expect(colNames).toContain("generator_signal_b_state");
    expect(colNames).toContain("generator_signal_d_state");
    expect(colNames).toContain("last_decayed_at");
  });

  it("k_lines and agencies tables exist (from migration v4)", () => {
    const { db } = open("som_tables");
    runMigrations(db);

    const tableNames = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>
    ).map((r) => r.name);

    expect(tableNames).toContain("k_lines");
    expect(tableNames).toContain("agencies");
  });
});
