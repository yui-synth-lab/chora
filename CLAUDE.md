# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (from repo root)
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run tests for a specific package
cd packages/core && pnpm test

# Run a single test file (from packages/core)
pnpm vitest run src/pulse/generator.test.ts

# Format TypeScript source
pnpm format

# Start the CLI (after building)
cd packages/cli && pnpm start

# Train the ONNX model (requires Python + PyTorch)
cd packages/training
python -m venv .venv && .venv\Scripts\Activate.ps1
pip install torch numpy onnx
python train.py
# Outputs model to: models/predictive_model.onnx (repo root)
```

## Architecture

CHORA is a **pre-linguistic consciousness simulation** structured as a layered processing loop:

```
Layer 0 — Pulse Generation     packages/core/src/pulse/generator.ts
Layer 1 — Predictive Model     packages/core/src/prediction/model.ts
Layer 2 — Translation Loop     packages/core/src/translation/
Layer 3 — Memory Management    packages/core/src/memory/manager.ts
```

**The main loop** (`packages/cli/src/index.ts`) runs a 1-second tick that:
1. Generates a 4D sensory `Pulse` (signals A–D, each clamped to [0,1])
2. Feeds the last 32 pulses into a GRU ONNX model to predict the next pulse
3. Computes RMSE as a **surprise** score; if surprise > 0.15, triggers the Translation Loop
4. Calls `OllamaProvider` (local LLM) to generate or reuse a Japanese-language "naming" for the sensory state
5. Runs memory decay on a 30-minute wall-clock interval (decayFactor 0.05), forgetting namings whose confidence drops below 0.1

**The four signals** model emotional/neurological analogs:
- `signal_a`: Baseline stability (slow circadian wave)
- `signal_b`: Reward/anticipation (random walk with mean reversion + rare spikes)
- `signal_c`: Stress/arousal (negative correlation with A, influenced by B)
- `signal_d`: Social connection (slow drift, decays under high stress)

**Database** (`packages/core/src/db/`) uses Node's built-in `node:sqlite` (`DatabaseSync`) — no external SQLite dependency. Schema has five tables: `pulses`, `predictions`, `namings`, `translation_events`, `system_state`. The DB file is created at `data/chora.db` relative to workspace root.

**ONNX model** (`packages/training/train.py`) is a GRU (hidden=16, 1 layer) trained on 50k synthetic pulses with a sliding window of 32. Must be trained and placed at `models/predictive_model.onnx` before running. The CLI gracefully degrades to Layer 0-only if the model file is missing.

**LLM integration** uses `OllamaProvider` talking to `http://localhost:11434/api/generate`. Model defaults to `hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M`; override via `OLLAMA_MODEL` env var. Prompt language defaults to `en`; override via `PROMPT_LANG=ja`. The LLM returns JSON with `use_existing_name | new_name`, `description`, and `confidence`.

**`LLMProvider` interface** (`packages/core/src/translation/provider.ts`) is the extension point for adding non-Ollama providers.

## Package structure

- `packages/core` — all domain logic, exported as `@chora/core`; uses Vitest for tests
- `packages/cli` — thin entry point; imports from `@chora/core`; no tests
- `packages/training` — standalone Python script; not part of the pnpm workspace build

## Key runtime requirements

- Node.js 22+ (uses `node:sqlite` built-in, available from Node 22.5+)
- Ollama running locally on port 11434 for Layer 2 translation
- `models/predictive_model.onnx` must exist for Layer 1 prediction (train with `train.py`)
