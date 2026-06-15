import { createServer } from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { ChoraDatabase, findWorkspaceRoot } from "@chora/core";
import { createApp } from "./app.js";
import { createBroadcastHub } from "./broadcast-hub.js";

const port = Number(process.env["CHORA_SERVER_PORT"] ?? process.env["PORT"] ?? 3001);

const root = findWorkspaceRoot();
const dbPath = path.join(root, "data", "chora.db");

// How long the server waits for the CLI to create the database before giving up.
const DB_WAIT_TIMEOUT_MS = Number(process.env["CHORA_DB_WAIT_MS"] ?? 30000);

/**
 * The CLI owns database creation (read/write + migrations); the server is a
 * read-only viewer. On a fresh start — e.g. `pnpm dev` launches server and CLI
 * concurrently — the file may not exist yet. Wait for the CLI to create it
 * rather than exiting immediately, so startup order doesn't matter.
 */
async function waitForDatabase(): Promise<void> {
  const start = Date.now();
  let warned = false;
  while (!fs.existsSync(dbPath)) {
    if (Date.now() - start > DB_WAIT_TIMEOUT_MS) {
      console.error(
        `[CHORA Server] Database still not found at: ${dbPath} after ${DB_WAIT_TIMEOUT_MS / 1000}s.` +
          "\n  Start the CLI to create and populate the database.",
      );
      process.exit(1);
    }
    if (!warned) {
      console.log(
        `[CHORA Server] Waiting for the CLI to create the database at: ${dbPath} ...`,
      );
      warned = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function main(): Promise<void> {
  await waitForDatabase();

  console.log(`[CHORA Server] Connecting to database (read-only) at: ${dbPath}`);
  const db = new ChoraDatabase(dbPath, { readOnly: true });

  const httpServer = createServer();
  const hub = createBroadcastHub(httpServer, db);
  const app = createApp(db, hub);

  httpServer.on("request", app);

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[CHORA Server] Server listening on 0.0.0.0:${port}`);
  });
}

main().catch((err) => {
  console.error("[CHORA Server] Fatal startup error:", err);
  process.exit(1);
});
