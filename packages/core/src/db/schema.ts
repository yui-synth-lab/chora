export const SCHEMA_QUERIES = [
  `CREATE TABLE IF NOT EXISTS pulses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    signal_a REAL NOT NULL,
    signal_b REAL NOT NULL,
    signal_c REAL NOT NULL,
    signal_d REAL NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pulse_id INTEGER REFERENCES pulses(id),
    predicted_a REAL NOT NULL,
    predicted_b REAL NOT NULL,
    predicted_c REAL NOT NULL,
    predicted_d REAL NOT NULL,
    error_magnitude REAL NOT NULL,
    surprise REAL NOT NULL,
    triggered_translation BOOLEAN NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS namings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    pulse_pattern TEXT,        -- JSON string of signal history
    prediction_error TEXT,     -- JSON string of prediction error
    llm_provider TEXT,
    confidence REAL,
    created_at INTEGER NOT NULL,
    reference_count INTEGER DEFAULT 1,
    forgotten INTEGER DEFAULT 0
  );`,

  `CREATE INDEX IF NOT EXISTS idx_namings_name ON namings(name);`,
  `CREATE INDEX IF NOT EXISTS idx_namings_created_at ON namings(created_at);`,

  `CREATE TABLE IF NOT EXISTS translation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pulse_id INTEGER REFERENCES pulses(id),
    naming_id INTEGER REFERENCES namings(id),
    llm_provider TEXT NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS system_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    cycle_count INTEGER DEFAULT 0,
    total_namings INTEGER DEFAULT 0,
    unique_names INTEGER DEFAULT 0,
    last_translation_at INTEGER,
    generator_step INTEGER DEFAULT 0,
    generator_signal_b_state REAL DEFAULT 0.5,
    generator_signal_d_state REAL DEFAULT 0.3
  );`,
];
