import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { ChoraDatabase } from "@chora/core";
import type { TickEvent, NamingEvent, DecayEvent, InitStatsEvent, ActivationEvent, KLineEvent, AgencyEvent } from "@chora/core/events";

type BroadcastPayload = TickEvent | NamingEvent | DecayEvent | InitStatsEvent | ActivationEvent | KLineEvent | AgencyEvent;

export interface BroadcastHub {
  broadcast(type: string, data: BroadcastPayload): void;
}

/**
 * createBroadcastHub — attaches a WebSocketServer to an HTTP server, manages
 * the connected-client set, and sends an `init_stats` payload to each new client.
 *
 * @param server  The Node.js HTTP server to attach the WSS to.
 * @param db      Read-only ChoraDatabase, used only for the init_stats query.
 * @returns       A BroadcastHub with a typed `broadcast` method.
 */
export function createBroadcastHub(server: Server, db: ChoraDatabase): BroadcastHub {
  const clients = new Set<WebSocket>();
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`[CHORA WebSocket] UI Client connected (total: ${clients.size})`);

    // Send initial baseline statistics to the newly connected client
    try {
      const state = db.getSystemState();
      const activeNamings = db.getAllActiveNamings();
      const initStats: InitStatsEvent = {
        cycle_count: state?.cycle_count ?? 0,
        active_namings: activeNamings.length,
        unique_names: state?.unique_names ?? 0,
      };
      ws.send(JSON.stringify({ type: "init_stats", data: initStats }));
    } catch (err) {
      console.error(
        "[CHORA WebSocket] Failed to send init_stats:",
        (err as Error).message,
      );
    }

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[CHORA WebSocket] UI Client disconnected (total: ${clients.size})`);
    });

    ws.on("error", (err) => {
      console.error("[CHORA WebSocket] Connection error:", err.message);
    });
  });

  return {
    broadcast(type: string, data: BroadcastPayload): void {
      const payload = JSON.stringify({ type, data });
      for (const client of [...clients]) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    },
  };
}
