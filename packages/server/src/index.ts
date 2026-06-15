import { createServer } from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { ChoraDatabase, findWorkspaceRoot } from "@chora/core";
import { createApp } from "./app.js";
import { createBroadcastHub } from "./broadcast-hub.js";

const port = Number(process.env["CHORA_SERVER_PORT"] ?? process.env["PORT"] ?? 3001);

const root = findWorkspaceRoot();
const dbPath = path.join(root, "data", "chora.db");

if (!fs.existsSync(dbPath)) {
  console.error(
    `[CHORA Server] Database not found at: ${dbPath}` +
    "\n  Start the CLI first to create and populate the database.",
  );
  process.exit(1);
}

console.log(`[CHORA Server] Connecting to database (read-only) at: ${dbPath}`);
const db = new ChoraDatabase(dbPath, { readOnly: true });

const httpServer = createServer();
const hub = createBroadcastHub(httpServer, db);
const app = createApp(db, hub);

httpServer.on("request", app);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`[CHORA Server] Server listening on 0.0.0.0:${port}`);
});
