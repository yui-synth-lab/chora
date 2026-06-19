import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { findWorkspaceRoot } from "../../utils/workspace.js";
import { openConnection } from "./connection.js";
import { runMigrations } from "./migrations.js";
import { AgencyRepository } from "./agency-repository.js";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(): { db: DatabaseSyncType; repo: AgencyRepository; dbPath: string } {
  const root = findWorkspaceRoot();
  const dbPath = path.resolve(root, "data/test_agency_repo.db");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = openConnection(dbPath);
  runMigrations(db);
  const repo = new AgencyRepository(db);
  return { db, repo, dbPath };
}

function sampleAgency(overrides: Partial<{ name: string | null; member_ids: string; coherence: number; formed_at: number; updated_at: number }> = {}) {
  const ts = Date.now();
  return {
    name: "TestAgency",
    member_ids: JSON.stringify([1, 2, 3]),
    coherence: 0.75,
    formed_at: ts,
    updated_at: ts,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgencyRepository", () => {
  let db: DatabaseSyncType;
  let repo: AgencyRepository;
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

  it("upsertAgency inserts an agency and returns a positive id", () => {
    const id = repo.upsertAgency(sampleAgency());
    expect(id).toBeGreaterThan(0);
  });

  it("getAllAgencies returns all agencies", () => {
    repo.upsertAgency(sampleAgency({ name: "AgencyOne" }));
    repo.upsertAgency(sampleAgency({ name: "AgencyTwo" }));
    repo.upsertAgency(sampleAgency({ name: null }));

    const agencies = repo.getAllAgencies();
    expect(agencies.length).toBe(3);
    expect(agencies.map((a) => a.name)).toContain("AgencyOne");
    expect(agencies.map((a) => a.name)).toContain("AgencyTwo");
    expect(agencies.map((a) => a.name)).toContain(null);
  });

  it("deleteAllAgencies removes all agencies", () => {
    repo.upsertAgency(sampleAgency({ name: "A" }));
    repo.upsertAgency(sampleAgency({ name: "B" }));

    repo.deleteAllAgencies();

    const agencies = repo.getAllAgencies();
    expect(agencies.length).toBe(0);
  });
});
