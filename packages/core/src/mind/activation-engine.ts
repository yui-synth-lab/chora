import type { NamingRecord, KLineRecord, AgentActivation } from "../domain/types.js";

interface AgentCacheEntry {
  id: number;
  name: string;
  pattern: { signal_a: number; signal_b: number; signal_c: number; signal_d: number };
}

export class AgentActivationEngine {
  private agentCache: AgentCacheEntry[] = [];
  private klineMap: Map<number, Array<{ neighborId: number; strength: number; klineId: number }>> = new Map();

  constructor(
    private readonly activationThreshold: number = 0.1,
    private readonly spreadWeight: number = 0.3,
    private readonly maxReportedAgents: number = 10,
  ) {}

  hasAgents(): boolean {
    return this.agentCache.length > 0;
  }

  /**
   * Refreshes the in-memory caches from the current DB state.
   * Call at startup and after any naming/k-line mutation.
   */
  refreshCache(activeNamings: NamingRecord[], allKLines: KLineRecord[]): void {
    this.agentCache = activeNamings
      .filter((n) => n.id !== undefined && n.pulse_pattern)
      .map((n) => {
        try {
          const pattern = JSON.parse(n.pulse_pattern) as {
            signal_a: number; signal_b: number; signal_c: number; signal_d: number;
          };
          return { id: n.id!, name: n.name, pattern };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is AgentCacheEntry => entry !== null);

    // Build adjacency map for K-line spread
    this.klineMap.clear();
    for (const kl of allKLines) {
      if (!this.klineMap.has(kl.agent_a_id)) this.klineMap.set(kl.agent_a_id, []);
      if (!this.klineMap.has(kl.agent_b_id)) this.klineMap.set(kl.agent_b_id, []);
      this.klineMap.get(kl.agent_a_id)!.push({ neighborId: kl.agent_b_id, strength: kl.strength, klineId: kl.id! });
      this.klineMap.get(kl.agent_b_id)!.push({ neighborId: kl.agent_a_id, strength: kl.strength, klineId: kl.id! });
    }
  }

  /**
   * Computes activation for all cached agents given the current pulse.
   *
   * Algorithm:
   * 1. For each agent: directActivation = max(0, 1 - normalizedDistance(pulse, pattern))
   *    Using scale { A: 0.1, B: 0.06, C: 0.3, D: 0.04 } from MemoryManager.
   * 2. For agents with directActivation > threshold: spread along K-lines
   *    neighbor.spreadActivation += directActivation * kline.strength * spreadWeight
   * 3. totalActivation = clamp(directActivation + spreadActivation, 0, 1)
   * 4. Return sorted by totalActivation desc, filtered > threshold, capped at maxReported.
   */
  computeActivation(
    pulse: { signal_a: number; signal_b: number; signal_c: number; signal_d: number },
  ): { activations: AgentActivation[]; activeKLineIds: number[] } {
    const SCALE = { A: 0.1, B: 0.06, C: 0.3, D: 0.04 };

    // Step 1: compute direct activation for all agents
    const directMap = new Map<number, number>();
    for (const agent of this.agentCache) {
      const dA = (pulse.signal_a - agent.pattern.signal_a) / SCALE.A;
      const dB = (pulse.signal_b - agent.pattern.signal_b) / SCALE.B;
      const dC = (pulse.signal_c - agent.pattern.signal_c) / SCALE.C;
      const dD = (pulse.signal_d - agent.pattern.signal_d) / SCALE.D;
      const distance = Math.sqrt((dA * dA + dB * dB + dC * dC + dD * dD) / 4);
      const activation = Math.max(0, 1 - distance);
      directMap.set(agent.id, activation);
    }

    // Step 2: spread activation through K-lines
    const spreadMap = new Map<number, number>();
    const activeKLineIds = new Set<number>();

    for (const [agentId, direct] of directMap) {
      if (direct <= this.activationThreshold) continue;
      const neighbors = this.klineMap.get(agentId);
      if (!neighbors) continue;

      for (const { neighborId, strength, klineId } of neighbors) {
        const contribution = direct * strength * this.spreadWeight;
        spreadMap.set(neighborId, (spreadMap.get(neighborId) ?? 0) + contribution);
        activeKLineIds.add(klineId);
      }
    }

    // Step 3: combine and filter
    const results: AgentActivation[] = [];
    for (const agent of this.agentCache) {
      const direct = directMap.get(agent.id) ?? 0;
      const spread = spreadMap.get(agent.id) ?? 0;
      const total = Math.min(1, direct + spread);

      if (total > this.activationThreshold) {
        results.push({
          agentId: agent.id,
          name: agent.name,
          directActivation: direct,
          spreadActivation: spread,
          totalActivation: total,
        });
      }
    }

    // Step 4: sort and cap
    results.sort((a, b) => b.totalActivation - a.totalActivation);

    return {
      activations: results.slice(0, this.maxReportedAgents),
      activeKLineIds: [...activeKLineIds],
    };
  }
}
