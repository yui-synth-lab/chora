import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";
import * as path from "node:path";
import { ChoraDatabase, findWorkspaceRoot } from "@chora/core";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

const root = findWorkspaceRoot();
const dbPath = path.join(root, "data", "chora.db");
console.log(`[CHORA Server] Connecting to database at: ${dbPath}`);
const db = new ChoraDatabase(dbPath);

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Set of connected UI clients
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[CHORA WebSocket] UI Client connected (total: ${clients.size})`);

  // Send initial baseline statistics to newly connected client
  try {
    const state = db.getSystemState();
    const activeNamings = db.getAllActiveNamings();
    ws.send(
      JSON.stringify({
        type: "init_stats",
        data: {
          cycle_count: state?.cycle_count ?? 0,
          active_namings: activeNamings.length,
          unique_names: state?.unique_names ?? 0,
        },
      }),
    );
  } catch (err) {
    console.error(
      "[CHORA WebSocket] Failed to send init_stats:",
      (err as Error).message,
    );
  }

  ws.on("close", () => {
    clients.delete(ws);
    console.log(
      `[CHORA WebSocket] UI Client disconnected (total: ${clients.size})`,
    );
  });

  ws.on("error", (err) => {
    console.error("[CHORA WebSocket] Connection error:", err.message);
  });
});

/**
 * Broadcast event helper
 */
function broadcast(type: string, data: any) {
  const payload = JSON.stringify({ type, data });
  for (const client of [...clients]) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

/**
 * REST Endpoint: System state (cycle count, active namings, unique names)
 */
app.get("/api/state", (req, res) => {
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

/**
 * REST Endpoint: Retrieve baseline telemetry history (last 100 cycles)
 */
app.get("/api/history", (req, res) => {
  try {
    const history = db.getRecentHistory(100);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * REST Endpoint: Retrieve all active (non-forgotten) naming entries
 */
app.get("/api/namings", (req, res) => {
  try {
    const activeNamings = db.getAllActiveNamings();
    res.json(activeNamings);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * REST Endpoint: Receive events from the CLI loop and broadcast to WS clients
 */
app.post("/api/events", (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) {
    return res.status(400).json({ error: "Missing type or data" });
  }

  // Broadcast to all active frontend clients
  broadcast(type, data);
  res.status(200).json({ success: true });
});

// Start listening (binds to 0.0.0.0 to allow external access)
server.listen(Number(port), "0.0.0.0", () => {
  console.log(`[CHORA Server] Server listening on 0.0.0.0:${port}`);
});
