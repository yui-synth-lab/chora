import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { ChoraDatabase } from "../db/client.js";
import { NamingService } from "./naming-service.js";
import { findWorkspaceRoot } from "../utils/workspace.js";
import type { Pulse } from "../domain/types.js";

const PULSE: Pulse = { timestamp: 1000, signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 };
const DELTAS = { signal_a: 0.1, signal_b: -0.1, signal_c: 0.2, signal_d: 0.0 };

describe("NamingService", () => {
  let db: ChoraDatabase;
  let service: NamingService;
  let dbPath: string;

  beforeEach(() => {
    const root = findWorkspaceRoot();
    dbPath = path.resolve(root, `data/test_naming_svc_${Date.now()}.db`);
    if (fs.existsSync(dbPath)) {
      try { fs.unlinkSync(dbPath); } catch {}
    }
    db = new ChoraDatabase(dbPath);
    service = new NamingService(db);
  });

  afterEach(() => {
    if (db) db.close();
    if (fs.existsSync(dbPath)) {
      try { fs.unlinkSync(dbPath); } catch {}
    }
  });

  // ── resolveNaming: use_existing_name path (found) ─────────────────────────

  it("reinforces an existing naming when use_existing_name is found", () => {
    db.insertNaming({
      name: "Serenity",
      description: "calm",
      pulse_pattern: JSON.stringify(PULSE),
      prediction_error: JSON.stringify(DELTAS),
      llm_provider: "test",
      confidence: 0.6,
      created_at: Date.now(),
      reference_count: 2,
      forgotten: 0,
    });

    const before = db.getAllActiveNamings().find((n) => n.name === "Serenity")!;
    expect(before.reference_count).toBe(2);

    const result = service.resolveNaming(
      { use_existing_name: "Serenity", new_name: null, description: "calm", confidence: 0.9 },
      { name: "Serenity", description: "calm", pulse: PULSE, deltas: DELTAS, llmProvider: "test", confidence: 0.9 },
      [],
    );

    expect(result.chosenName).toBe("Serenity");
    expect(result.isNew).toBe(false);
    expect(result.logNote).toBeNull();

    const after = db.getAllActiveNamings().find((n) => n.name === "Serenity")!;
    expect(after.confidence).toBeGreaterThan(0.6);
    expect(after.reference_count).toBe(3);
  });

  // ── resolveNaming: use_existing_name path (hallucination fallback) ────────

  it("inserts as new when use_existing_name is not found in DB (hallucination)", () => {
    const result = service.resolveNaming(
      { use_existing_name: "Ghost", new_name: null, description: "phantom feeling", confidence: 0.7 },
      { name: "Ghost", description: "phantom feeling", pulse: PULSE, deltas: DELTAS, llmProvider: "test", confidence: 0.7 },
      [],
    );

    expect(result.chosenName).toBe("Ghost");
    expect(result.isNew).toBe(true);
    expect(result.logNote).toContain("not found in DB");

    const active = db.getAllActiveNamings();
    expect(active.some((n) => n.name === "Ghost")).toBe(true);
  });

  // ── resolveNaming: new_name path (dedup — already exists) ────────────────

  it("reinforces instead of inserting when new_name already exists in DB (Phase-1 dedup)", () => {
    db.insertNaming({
      name: "Clarity",
      description: "sharp",
      pulse_pattern: JSON.stringify(PULSE),
      prediction_error: JSON.stringify(DELTAS),
      llm_provider: "test",
      confidence: 0.5,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0,
    });

    const result = service.resolveNaming(
      { use_existing_name: null, new_name: "Clarity", description: "sharp new", confidence: 0.85 },
      { name: "Clarity", description: "sharp new", pulse: PULSE, deltas: DELTAS, llmProvider: "test", confidence: 0.85 },
      [],
    );

    expect(result.chosenName).toBe("Clarity");
    expect(result.isNew).toBe(false);
    expect(result.logNote).toContain("already exists in DB");

    // Only one naming in the DB — no duplicate
    const active = db.getAllActiveNamings().filter((n) => n.name === "Clarity");
    expect(active.length).toBe(1);
    // Confidence boosted
    expect(active[0].confidence).toBeGreaterThan(0.5);
  });

  // ── resolveNaming: new_name path (genuinely new) ──────────────────────────

  it("inserts a new naming when new_name is not in DB", () => {
    const result = service.resolveNaming(
      { use_existing_name: null, new_name: "Vertigo", description: "spinning darkness", confidence: 0.75 },
      { name: "Vertigo", description: "spinning darkness", pulse: PULSE, deltas: DELTAS, llmProvider: "test", confidence: 0.75 },
      [],
    );

    expect(result.chosenName).toBe("Vertigo");
    expect(result.isNew).toBe(true);
    expect(result.namingId).not.toBeNull();
    expect(result.logNote).toBeNull();

    const active = db.getAllActiveNamings();
    expect(active.some((n) => n.name === "Vertigo")).toBe(true);
  });

  // ── decayStep delegates correctly ─────────────────────────────────────────

  it("decays all active namings and marks forgotten ones", () => {
    db.insertNaming({
      name: "HiConf",
      description: "high",
      pulse_pattern: JSON.stringify(PULSE),
      prediction_error: JSON.stringify(DELTAS),
      llm_provider: "test",
      confidence: 0.8,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0,
    });
    db.insertNaming({
      name: "LoConf",
      description: "low",
      pulse_pattern: JSON.stringify(PULSE),
      prediction_error: JSON.stringify(DELTAS),
      llm_provider: "test",
      confidence: 0.12,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0,
    });

    const result = service.decayStep(0.1, 0.1);
    expect(result.decayedCount).toBe(2);
    expect(result.forgottenCount).toBe(1);

    const active = db.getAllActiveNamings();
    expect(active.length).toBe(1);
    expect(active[0].name).toBe("HiConf");
  });
});
