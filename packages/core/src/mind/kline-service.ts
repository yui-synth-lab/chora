import type { ChoraDatabase } from "../db/client.js";
import type { AgentActivation } from "../domain/types.js";
import type { KLineEvent } from "../domain/events.js";

export class KLineService {
  constructor(private readonly db: ChoraDatabase) {}

  /**
   * Forms or strengthens K-lines between co-active agents during a surprise event.
   * Only agents above coActivationThreshold participate.
   * Returns a KLineEvent["formed"] array describing what changed.
   */
  formKLines(
    coActiveAgents: AgentActivation[],
    timestamp: number,
    coActivationThreshold: number = 0.3,
  ): KLineEvent["formed"] {
    const eligible = coActiveAgents.filter(
      (a) => a.totalActivation >= coActivationThreshold,
    );

    if (eligible.length < 2) return [];

    const formed: KLineEvent["formed"] = [];

    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const a = eligible[i];
        const b = eligible[j];
        const result = this.db.upsertKLine(a.agentId, b.agentId, timestamp);

        // Read back the K-line to get current strength
        const klines = this.db.getKLinesForAgent(a.agentId);
        const kline = klines.find(
          (k) =>
            k.agent_a_id === Math.min(a.agentId, b.agentId) &&
            k.agent_b_id === Math.max(a.agentId, b.agentId),
        );

        formed.push({
          agent_a_id: a.agentId,
          agent_b_id: b.agentId,
          agent_a_name: a.name,
          agent_b_name: b.name,
          strength: kline?.strength ?? 1.0,
          isNew: result.isNew,
        });
      }
    }

    return formed;
  }

  /**
   * Decays K-line strengths and removes weak ones.
   * Called during the 30-min decay cycle.
   */
  decayKLines(
    decayFactor: number,
    weakThreshold: number = 0.05,
  ): { decayedCount: number; removedCount: number } {
    const decayedCount = this.db.decayKLines(decayFactor);
    const removedCount = this.db.removeWeakKLines(weakThreshold);
    return { decayedCount, removedCount };
  }

  /**
   * Removes K-lines connected to forgotten agents.
   */
  removeKLinesForForgottenAgents(forgottenIds: number[]): number {
    let total = 0;
    for (const id of forgottenIds) {
      total += this.db.removeKLinesForAgent(id);
    }
    return total;
  }
}
