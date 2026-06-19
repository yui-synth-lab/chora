import { describe, it, expect } from "vitest";
import { AgentActivationEngine } from "./activation-engine.js";
import type { NamingRecord, KLineRecord } from "../domain/types.js";

function makeNaming(
  id: number,
  name: string,
  pattern: { signal_a: number; signal_b: number; signal_c: number; signal_d: number },
): NamingRecord {
  return {
    id,
    name,
    description: null,
    pulse_pattern: JSON.stringify(pattern),
    prediction_error: "{}",
    llm_provider: "test",
    confidence: 0.8,
    created_at: Date.now(),
    reference_count: 1,
    forgotten: 0,
  };
}

function makeKLine(
  id: number,
  agentAId: number,
  agentBId: number,
  strength: number = 1.0,
): KLineRecord {
  return {
    id,
    agent_a_id: Math.min(agentAId, agentBId),
    agent_b_id: Math.max(agentAId, agentBId),
    strength,
    formed_at: Date.now(),
    last_co_activation: Date.now(),
    co_activation_count: 1,
  };
}

describe("AgentActivationEngine", () => {
  it("agent with matching pulse pattern gets high direct activation", () => {
    const engine = new AgentActivationEngine();
    const naming = makeNaming(1, "resonant", {
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });
    engine.refreshCache([naming], []);

    const { activations } = engine.computeActivation({
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });

    expect(activations).toHaveLength(1);
    expect(activations[0].directActivation).toBeCloseTo(1.0, 5);
    expect(activations[0].totalActivation).toBeCloseTo(1.0, 5);
    expect(activations[0].name).toBe("resonant");
  });

  it("agent with dissimilar pulse pattern gets low or zero activation", () => {
    const engine = new AgentActivationEngine();
    const naming = makeNaming(1, "distant", {
      signal_a: 0.0,
      signal_b: 0.0,
      signal_c: 0.0,
      signal_d: 0.0,
    });
    engine.refreshCache([naming], []);

    const { activations } = engine.computeActivation({
      signal_a: 1.0,
      signal_b: 1.0,
      signal_c: 1.0,
      signal_d: 1.0,
    });

    // Normalized distance is ~15.9, activation = max(0, 1-15.9) = 0 → below threshold
    expect(activations).toHaveLength(0);
  });

  it("spread activation flows through K-lines", () => {
    const engine = new AgentActivationEngine();

    // Agent A: pattern matches pulse exactly → direct ≈ 1.0
    const agentA = makeNaming(1, "agent-a", {
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });
    // Agent B: pattern far from pulse → direct ≈ 0, but connected to A via K-line
    const agentB = makeNaming(2, "agent-b", {
      signal_a: 0.0,
      signal_b: 0.0,
      signal_c: 0.0,
      signal_d: 0.0,
    });

    const kline = makeKLine(10, 1, 2, 1.0);
    engine.refreshCache([agentA, agentB], [kline]);

    const { activations, activeKLineIds } = engine.computeActivation({
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });

    const bActivation = activations.find((a) => a.name === "agent-b");
    expect(bActivation).toBeDefined();
    // B's directActivation is 0 (distance ~7.96, activation clamped to 0)
    expect(bActivation!.directActivation).toBe(0);
    // spreadActivation = directA * strength * spreadWeight = ~1 * 1 * 0.3 = ~0.3
    expect(bActivation!.spreadActivation).toBeGreaterThan(0);
    expect(bActivation!.totalActivation).toBeGreaterThan(0.1);

    // K-line should appear in activeKLineIds
    expect(activeKLineIds).toContain(10);
  });

  it("totalActivation is clamped to 1.0", () => {
    const engine = new AgentActivationEngine();

    // Both agents have patterns matching the pulse → both get direct ≈ 1.0
    // They share a K-line, so each receives spread on top of the already-max direct
    const agentA = makeNaming(1, "agent-a", {
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });
    const agentB = makeNaming(2, "agent-b", {
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });

    const kline = makeKLine(10, 1, 2, 1.0);
    engine.refreshCache([agentA, agentB], [kline]);

    const { activations } = engine.computeActivation({
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });

    for (const a of activations) {
      expect(a.totalActivation).toBeLessThanOrEqual(1.0);
    }
  });

  it("results are sorted by totalActivation descending and capped at maxReportedAgents", () => {
    const engine = new AgentActivationEngine(0.1, 0.3, 10);

    // Create 15 agents with varying proximity to the query pulse (0.5, 0.5, 0.5, 0.5)
    // Agents closer to the pulse get higher activation
    const namings: NamingRecord[] = [];
    for (let i = 1; i <= 15; i++) {
      // Vary signal_a by small increments so all are above threshold but at different distances
      const offset = (i - 1) * 0.005; // small enough to stay activated
      namings.push(
        makeNaming(i, `agent-${i}`, {
          signal_a: 0.5 + offset,
          signal_b: 0.5,
          signal_c: 0.5,
          signal_d: 0.5,
        }),
      );
    }

    engine.refreshCache(namings, []);

    const { activations } = engine.computeActivation({
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });

    // Must not exceed the cap
    expect(activations.length).toBeLessThanOrEqual(10);

    // Must be sorted descending
    for (let i = 0; i < activations.length - 1; i++) {
      expect(activations[i].totalActivation).toBeGreaterThanOrEqual(
        activations[i + 1].totalActivation,
      );
    }
  });

  it("hasAgents returns false when cache is empty, true after refresh", () => {
    const engine = new AgentActivationEngine();

    expect(engine.hasAgents()).toBe(false);

    const naming = makeNaming(1, "test", {
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });
    engine.refreshCache([naming], []);

    expect(engine.hasAgents()).toBe(true);
  });

  it("refreshCache handles malformed pulse_pattern JSON gracefully", () => {
    const engine = new AgentActivationEngine();

    const badNaming: NamingRecord = {
      id: 1,
      name: "malformed",
      description: null,
      pulse_pattern: "invalid json",
      prediction_error: "{}",
      llm_provider: "test",
      confidence: 0.8,
      created_at: Date.now(),
      reference_count: 1,
      forgotten: 0,
    };

    // Should not throw; the malformed entry should be silently skipped
    expect(() => engine.refreshCache([badNaming], [])).not.toThrow();

    // hasAgents should return false since the only entry was skipped
    expect(engine.hasAgents()).toBe(false);

    // computeActivation on empty cache should return empty results
    const { activations, activeKLineIds } = engine.computeActivation({
      signal_a: 0.5,
      signal_b: 0.5,
      signal_c: 0.5,
      signal_d: 0.5,
    });
    expect(activations).toHaveLength(0);
    expect(activeKLineIds).toHaveLength(0);
  });
});
