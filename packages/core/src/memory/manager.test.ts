import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChoraDatabase } from '../db/client.js';
import { MemoryManager } from './manager.js';
import { findWorkspaceRoot } from '../utils/workspace.js';
import * as path from 'path';
import * as fs from 'fs';

describe('MemoryManager Unit Test', () => {
  let db: ChoraDatabase;
  let manager: MemoryManager;
  let dbPath: string;

  beforeEach(() => {
    const root = findWorkspaceRoot();
    dbPath = path.resolve(root, 'data/test_memory_manager.db');
    // Ensure any leftover file is deleted
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (e) {}
    }
    db = new ChoraDatabase(dbPath);
    manager = new MemoryManager(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (e) {}
    }
  });

  it('should calculate Euclidean distance and find similar active namings', () => {
    // Insert dummy active namings
    // Naming 1: Close to [0.5, 0.5, 0.5, 0.5]
    db.insertNaming({
      name: 'LabelA',
      description: 'Close to middle',
      pulse_pattern: JSON.stringify({ signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 }),
      prediction_error: JSON.stringify({ signal_a: 0, signal_b: 0, signal_c: 0, signal_d: 0 }),
      llm_provider: 'test',
      confidence: 0.9,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0
    });

    // Naming 2: Farther from [0.5, 0.5, 0.5, 0.5]
    db.insertNaming({
      name: 'LabelB',
      description: 'Far from middle',
      pulse_pattern: JSON.stringify({ signal_a: 0.9, signal_b: 0.9, signal_c: 0.9, signal_d: 0.9 }),
      prediction_error: JSON.stringify({ signal_a: 0, signal_b: 0, signal_c: 0, signal_d: 0 }),
      llm_provider: 'test',
      confidence: 0.8,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0
    });

    // Naming 3: Forgotten naming
    db.insertNaming({
      name: 'LabelC',
      description: 'Forgotten',
      pulse_pattern: JSON.stringify({ signal_a: 0.51, signal_b: 0.51, signal_c: 0.51, signal_d: 0.51 }),
      prediction_error: JSON.stringify({ signal_a: 0, signal_b: 0, signal_c: 0, signal_d: 0 }),
      llm_provider: 'test',
      confidence: 0.75,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 1
    });

    const currentPulse = { signal_a: 0.52, signal_b: 0.52, signal_c: 0.52, signal_d: 0.52 };
    const similar = manager.findSimilar(currentPulse, 5);

    // Should only contain active namings (LabelA and LabelB, not LabelC)
    expect(similar.length).toBe(2);
    // LabelA pattern is closer to currentPulse than LabelB
    expect(similar[0].name).toBe('LabelA');
    expect(similar[1].name).toBe('LabelB');
  });

  it('should reinforce an existing naming by boosting confidence and reference count', () => {
    db.insertNaming({
      name: 'ReinforceMe',
      description: 'Test reinforcement',
      pulse_pattern: JSON.stringify({ signal_a: 0.1, signal_b: 0.1, signal_c: 0.1, signal_d: 0.1 }),
      prediction_error: JSON.stringify({ signal_a: 0, signal_b: 0, signal_c: 0, signal_d: 0 }),
      llm_provider: 'test',
      confidence: 0.5,
      created_at: Date.now(),
      reference_count: 2,
      forgotten: 0
    });

    manager.reinforceNaming('ReinforceMe', 0.15);

    const active = db.getAllActiveNamings();
    const target = active.find(n => n.name === 'ReinforceMe');
    expect(target).toBeDefined();
    expect(target?.confidence).toBeCloseTo(0.65);
    expect(target?.reference_count).toBe(3);
  });

  it('should perform memory decay and mark forgotten if below threshold', () => {
    db.insertNaming({
      name: 'DecayingLabelA',
      description: 'High confidence',
      pulse_pattern: JSON.stringify({ signal_a: 0.1, signal_b: 0.1, signal_c: 0.1, signal_d: 0.1 }),
      prediction_error: JSON.stringify({ signal_a: 0, signal_b: 0, signal_c: 0, signal_d: 0 }),
      llm_provider: 'test',
      confidence: 0.8,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0
    });

    db.insertNaming({
      name: 'DecayingLabelB',
      description: 'Low confidence, will be forgotten',
      pulse_pattern: JSON.stringify({ signal_a: 0.1, signal_b: 0.1, signal_c: 0.1, signal_d: 0.1 }),
      prediction_error: JSON.stringify({ signal_a: 0, signal_b: 0, signal_c: 0, signal_d: 0 }),
      llm_provider: 'test',
      confidence: 0.15,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0
    });

    // Run decay step with decayFactor = 0.1, threshold = 0.1
    // DecayingLabelA confidence: 0.8 -> 0.7 (active)
    // DecayingLabelB confidence: 0.15 -> 0.05 (forgotten because < 0.1)
    const decayResult = manager.decayStep(0.1, 0.1);

    expect(decayResult.decayedCount).toBe(2);
    expect(decayResult.forgottenCount).toBe(1);

    const active = db.getAllActiveNamings();
    expect(active.length).toBe(1);
    expect(active[0].name).toBe('DecayingLabelA');
    expect(active[0].confidence).toBeCloseTo(0.7);

    // Retrieve forgotten naming from the database manually to check forgotten status
    const recent = db.getRecentNamings(5);
    const forgottenB = recent.find(n => n.name === 'DecayingLabelB');
    expect(forgottenB?.forgotten).toBe(1);
    expect(forgottenB?.confidence).toBeCloseTo(0.05);
  });
});
