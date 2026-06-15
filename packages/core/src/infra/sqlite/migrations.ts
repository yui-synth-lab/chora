import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

/**
 * A single idempotent migration step.
 * `version` is stored in PRAGMA user_version after the migration runs.
 */
export interface Migration {
  version: number;
  description: string;
  up(db: DatabaseSyncType): void;
}

/**
 * Ordered list of all schema migrations for CHORA.
 *
 * Rules:
 *   • Migrations are run in order; each is skipped when `PRAGMA user_version`
 *     is already >= its version number.
 *   • Never edit an existing entry — add a new one instead.
 *   • Every migration must be idempotent: safe on a fresh DB and on an existing
 *     one that already has all the affected objects (use IF NOT EXISTS / safe
 *     column-check helpers instead of bare ALTER TABLE).
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Initial schema: pulses, predictions, namings, translation_events, system_state",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS pulses (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          signal_a  REAL    NOT NULL,
          signal_b  REAL    NOT NULL,
          signal_c  REAL    NOT NULL,
          signal_d  REAL    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS predictions (
          id                   INTEGER PRIMARY KEY AUTOINCREMENT,
          pulse_id             INTEGER REFERENCES pulses(id),
          predicted_a          REAL    NOT NULL,
          predicted_b          REAL    NOT NULL,
          predicted_c          REAL    NOT NULL,
          predicted_d          REAL    NOT NULL,
          error_magnitude      REAL    NOT NULL,
          surprise             REAL    NOT NULL,
          triggered_translation BOOLEAN NOT NULL
        );

        CREATE TABLE IF NOT EXISTS namings (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          name             TEXT    NOT NULL,
          description      TEXT,
          pulse_pattern    TEXT,
          prediction_error TEXT,
          llm_provider     TEXT,
          confidence       REAL,
          created_at       INTEGER NOT NULL,
          reference_count  INTEGER DEFAULT 1,
          forgotten        INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_namings_name       ON namings(name);
        CREATE INDEX IF NOT EXISTS idx_namings_created_at ON namings(created_at);

        CREATE TABLE IF NOT EXISTS translation_events (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          pulse_id     INTEGER REFERENCES pulses(id),
          naming_id    INTEGER REFERENCES namings(id),
          llm_provider TEXT    NOT NULL,
          prompt       TEXT    NOT NULL,
          response     TEXT    NOT NULL,
          duration_ms  INTEGER,
          created_at   INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS system_state (
          id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          cycle_count              INTEGER DEFAULT 0,
          total_namings            INTEGER DEFAULT 0,
          unique_names             INTEGER DEFAULT 0,
          last_translation_at      INTEGER,
          last_decayed_at          INTEGER DEFAULT NULL,
          generator_step           INTEGER DEFAULT 0,
          generator_signal_b_state REAL    DEFAULT 0.5,
          generator_signal_d_state REAL    DEFAULT 0.3
        );
      `);

      // Seed the singleton system_state row if absent
      db.exec(`
        INSERT OR IGNORE INTO system_state (
          id, cycle_count, total_namings, unique_names, last_translation_at,
          last_decayed_at, generator_step, generator_signal_b_state, generator_signal_d_state
        ) VALUES (1, 0, 0, 0, NULL, NULL, 0, 0.5, 0.3)
      `);
    },
  },

  {
    version: 2,
    description: "Add forgotten column to namings (backfill for existing DBs)",
    up(db) {
      // Guard: only run ALTER if the column is absent
      const cols = db.prepare("PRAGMA table_info(namings)").all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "forgotten")) {
        db.exec("ALTER TABLE namings ADD COLUMN forgotten INTEGER DEFAULT 0");
      }
    },
  },

  {
    version: 3,
    description: "Add generator state and last_decayed_at columns to system_state (backfill for existing DBs)",
    up(db) {
      const cols = db.prepare("PRAGMA table_info(system_state)").all() as Array<{ name: string }>;
      const colNames = new Set(cols.map((c) => c.name));

      if (!colNames.has("generator_step")) {
        db.exec("ALTER TABLE system_state ADD COLUMN generator_step INTEGER DEFAULT 0");
      }
      if (!colNames.has("generator_signal_b_state")) {
        db.exec("ALTER TABLE system_state ADD COLUMN generator_signal_b_state REAL DEFAULT 0.5");
      }
      if (!colNames.has("generator_signal_d_state")) {
        db.exec("ALTER TABLE system_state ADD COLUMN generator_signal_d_state REAL DEFAULT 0.3");
      }
      if (!colNames.has("last_decayed_at")) {
        db.exec("ALTER TABLE system_state ADD COLUMN last_decayed_at INTEGER DEFAULT NULL");
      }

      // Ensure the system_state row exists after any column additions
      db.exec(`
        INSERT OR IGNORE INTO system_state (
          id, cycle_count, total_namings, unique_names, last_translation_at,
          last_decayed_at, generator_step, generator_signal_b_state, generator_signal_d_state
        ) VALUES (1, 0, 0, 0, NULL, NULL, 0, 0.5, 0.3)
      `);
    },
  },
];

/**
 * Runs all pending migrations against the given database handle.
 * Uses `PRAGMA user_version` to track the highest applied migration version.
 *
 * This is idempotent: calling it on a DB that is already at the latest version
 * is a no-op (each migration's `up()` is still guarded by IF NOT EXISTS / column
 * checks, so even a concurrent double-run would be safe).
 */
export function runMigrations(db: DatabaseSyncType): void {
  const { user_version: currentVersion } = db.prepare(
    "PRAGMA user_version",
  ).get() as { user_version: number };

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  for (const migration of pending) {
    db.exec("BEGIN TRANSACTION");
    try {
      migration.up(db);
      // Bump user_version — PRAGMA does not support bound parameters
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(
        `Migration v${migration.version} ("${migration.description}") failed: ${(err as Error).message}`,
      );
    }
  }
}
