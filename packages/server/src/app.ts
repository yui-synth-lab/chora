import express from "express";
import cors from "cors";
import type { ChoraDatabase } from "@chora/core";
import type { TickEvent, NamingEvent, DecayEvent } from "@chora/core/events";
import type { BroadcastHub } from "./broadcast-hub.js";

type KnownEventType = "tick" | "naming" | "decay";
const KNOWN_TYPES = new Set<string>(["tick", "naming", "decay"]);

/**
 * createApp — configures an Express application with all REST routes.
 *
 * @param db   Read-only ChoraDatabase facade.
 * @param hub  BroadcastHub used to fan-out POST /api/events to WS clients.
 * @returns    Configured Express application (not yet listening).
 */
export function createApp(db: ChoraDatabase, hub: BroadcastHub): express.Application {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json());

  /** System state: cycle count, active namings, unique names */
  app.get("/api/state", (_req, res) => {
    try {
      const state = db.getSystemState();
      const activeNamings = db.getAllActiveNamings();
      res.json({
        cycle_count: state?.cycle_count ?? 0,
        active_namings: activeNamings.length,
        unique_names: state?.unique_names ?? 0,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /** Baseline telemetry history (last 100 cycles) */
  app.get("/api/history", (_req, res) => {
    try {
      const history = db.getRecentHistory(100);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /** All active (non-forgotten) naming entries */
  app.get("/api/namings", (_req, res) => {
    try {
      const activeNamings = db.getAllActiveNamings();
      res.json(activeNamings);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * Receive events from the CLI loop and broadcast to WS clients.
   * Typed payload is forwarded without transformation.
   */
  app.post("/api/events", (req, res) => {
    const { type, data } = req.body as { type?: string; data?: TickEvent | NamingEvent | DecayEvent };
    if (!type || !data) {
      return res.status(400).json({ error: "Missing type or data" });
    }
    if (!KNOWN_TYPES.has(type)) {
      return res.status(400).json({ error: `Unknown event type: ${type}` });
    }
    hub.broadcast(type as KnownEventType, data);
    res.status(200).json({ success: true });
  });

  return app;
}
