import type { ChoraDatabase } from "../db/client.js";
import type { KLineRecord, NamingRecord } from "../domain/types.js";
import type { AgencyEvent } from "../domain/events.js";

export class AgencyService {
  constructor(
    private readonly db: ChoraDatabase,
    private readonly minMembers: number = 3,
    private readonly strengthThreshold: number = 0.2,
  ) {}

  /**
   * Recomputes agencies from the K-line graph using connected-component clustering.
   *
   * Algorithm:
   * 1. Filter K-lines to those with strength >= strengthThreshold.
   * 2. Build adjacency graph.
   * 3. Find connected components via BFS.
   * 4. Components with >= minMembers agents become agencies.
   * 5. Coherence = mean K-line strength within the component.
   * 6. Replace all agencies in DB (full recompute).
   */
  recomputeAgencies(
    allKLines: KLineRecord[],
    activeNamings: NamingRecord[],
    timestamp: number,
  ): AgencyEvent {
    const namingMap = new Map<number, NamingRecord>();
    for (const n of activeNamings) {
      if (n.id !== undefined) namingMap.set(n.id, n);
    }

    // Step 1: filter K-lines by strength threshold
    const strongKLines = allKLines.filter((k) => k.strength >= this.strengthThreshold);

    // Step 2: build adjacency graph
    const adjacency = new Map<number, Set<number>>();
    const edgeStrengths = new Map<string, number>();

    for (const kl of strongKLines) {
      if (!adjacency.has(kl.agent_a_id)) adjacency.set(kl.agent_a_id, new Set());
      if (!adjacency.has(kl.agent_b_id)) adjacency.set(kl.agent_b_id, new Set());
      adjacency.get(kl.agent_a_id)!.add(kl.agent_b_id);
      adjacency.get(kl.agent_b_id)!.add(kl.agent_a_id);

      const key = `${Math.min(kl.agent_a_id, kl.agent_b_id)}-${Math.max(kl.agent_a_id, kl.agent_b_id)}`;
      edgeStrengths.set(key, kl.strength);
    }

    // Step 3: BFS connected components
    const visited = new Set<number>();
    const components: number[][] = [];

    for (const nodeId of adjacency.keys()) {
      if (visited.has(nodeId)) continue;
      const component: number[] = [];
      const queue = [nodeId];
      visited.add(nodeId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);
        const neighbors = adjacency.get(current);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }
      components.push(component);
    }

    // Step 4-5: filter by minMembers, compute coherence, persist
    this.db.deleteAllAgencies();

    const agencies: AgencyEvent["agencies"] = [];

    for (const members of components) {
      if (members.length < this.minMembers) continue;

      // Coherence: mean edge strength for edges that exist within the component
      let totalStrength = 0;
      let edgeCount = 0;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = `${Math.min(members[i], members[j])}-${Math.max(members[i], members[j])}`;
          const strength = edgeStrengths.get(key);
          if (strength !== undefined) {
            totalStrength += strength;
            edgeCount++;
          }
        }
      }
      const coherence = edgeCount > 0 ? totalStrength / edgeCount : 0;

      const memberNames = members
        .map((id) => namingMap.get(id)?.name ?? `agent-${id}`)
        .sort();

      const agencyId = this.db.upsertAgency({
        name: null, // auto-naming via LLM is a future enhancement
        member_ids: JSON.stringify(members),
        coherence,
        formed_at: timestamp,
        updated_at: timestamp,
      });

      agencies.push({
        id: agencyId,
        name: null,
        memberNames,
        coherence,
      });
    }

    return { agencies };
  }
}
