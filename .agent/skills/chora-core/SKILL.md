---
name: chora-core
description: Manages Layer 0 (Pulse Generator), Layer 1 (Predictive Model), ONNX integration, and the SQLite database.
---
# Skill: CHORA Core & Database Management

This skill handles low-level data structures, pulse generation dynamics, ONNX runtime integration, and SQLite operations.

## Capabilities
- **Pulse Generator Initialization**: Implementing time-correlated 4D signals with noise and cyclic variance.
- **ONNX Model Inference**: Executing small Transformer/GRU models using `onnxruntime-node`.
- **Database Schema Execution**: Implementing schema migration and data storage queries using `better-sqlite3`.

## Coding Guidelines

### 1. Database Operations (`better-sqlite3`)
- Always instantiate the database connection synchronously inside a dedicated database service wrapper.
- Use transactions (`db.transaction()`) for compound writes, e.g., logging a pulse and its corresponding prediction.
- Keep SQL statements uppercase (e.g., `SELECT`, `INSERT INTO`, `WHERE`) and query parameters parameterized to prevent issues.

### 2. Pulse Generator Dynamics (Layer 0)
- The generator must produce signals within `[0, 1]` ranges.
- Include parameters for cycle periods, noise thresholds, and correlation matrices.
- Keep the implementation free of external NPM packages where possible; rely on basic Math libraries for noise (e.g., Box-Muller transform for Gaussian noise).

### 3. Predictive Model Inference (Layer 1)
- Map inputs exactly to 1D flat arrays of shape `[1, 32, 4]` (128 elements) or similar depending on the exact ONNX definition.
- Cache the ONNX inference session (`InferenceSession`) to avoid reloading the file on every cycle.
