import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { createRequire } from "node:module";
import * as path from "path";
import * as fs from "fs";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

export interface ConnectionOptions {
  /** When true, open in read-only mode (skips WAL/pragma setup). Default: false. */
  readOnly?: boolean;
}

/**
 * Opens a DatabaseSync handle with WAL mode and busy_timeout configured.
 * Ensures the parent directory exists before opening.
 *
 * @param dbPath  Absolute path to the SQLite database file.
 * @param options Optional connection options.
 * @returns       The raw DatabaseSync handle.
 */
export function openConnection(
  dbPath: string,
  options: ConnectionOptions = {},
): DatabaseSyncType {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const readOnly = options.readOnly ?? false;

  // node:sqlite DatabaseSync constructor accepts an options object in Node 22.5+
  // { readOnly } is a future-proof option — fall back gracefully if unsupported.
  let db: DatabaseSyncType;
  try {
    db = new DatabaseSync(dbPath, { readOnly }) as DatabaseSyncType;
  } catch {
    // Older Node builds that don't support the options object
    db = new DatabaseSync(dbPath) as DatabaseSyncType;
  }

  if (!readOnly) {
    // WAL mode: allows concurrent readers while the CLI writes every second
    db.exec("PRAGMA journal_mode=WAL");
    // Retry for up to 5 seconds before throwing SQLITE_BUSY
    db.exec("PRAGMA busy_timeout=5000");
  }

  return db;
}
