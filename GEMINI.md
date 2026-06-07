# CHORA - Project Context & Instructions

## Project Overview
**CHORA** is a research project aiming to explore the emergence of consciousness from a "pre-linguistic field" of bodily signals. Unlike traditional AI that starts with language, CHORA starts with raw, meaningless pulses and attempts to "translate" or "name" them using LLMs, hypothesizing that consciousness is the byproduct of this continuous self-organizing naming process.

- **Core Concept**: Consciousness as a "Translation Loop" from body signals to language.
- **Origin**: Derived from Plato's *Timaeus* (Chora: the formless space where form emerges).
- **Status**: **Initial Design Phase** (as of June 2026). Implementation has not yet begun.

## Architecture (Four-Layer Structure)
Refer to `docs/CHORA_SPEC.md` for full details.

1.  **Layer 0: Pulse Generator**: Generates 4-dimensional time-correlated signals (representing hormones/body state).
2.  **Layer 1: Predictive Model**: Uses an ONNX model to predict the next pulse; calculates "Surprise" (prediction error).
3.  **Layer 2: Translation Loop**: When Surprise exceeds a threshold, an LLM is prompted to "name" the sensation/pattern.
4.  **Layer 3: Self-Naming Memory**: Stores and manages the history of namings to form a persistent "self-model".

## Planned Tech Stack
- **Language**: TypeScript (Main), Python (ML training).
- **Runtime**: Node.js (Core/Server), Browser (Web UI).
- **Package Management**: `pnpm` with workspaces (Monorepo).
- **Database**: SQLite (local, single file).
- **ML**: ONNX Runtime (for inference in Node.js/TS).
- **UI**: React + Vite + D3.js (for real-time visualization).

## Development Conventions (Planned)
- **Monorepo Structure**:
  - `packages/core`: The main logic loop.
  - `packages/server`: API and WebSocket for UI.
  - `packages/web`: Visualization dashboard.
  - `packages/training`: Python scripts for model training.
- **Data Integrity**: All signals and naming events must be logged to SQLite for long-term observation.
- **LLM Usage**: LLMs are "Translation Engines", not "Thinking Agents". Prompts should emphasize the "internal sensation" aspect.

## Key Files
- `docs/CHORA_SPEC.md`: The primary specification and source of truth for design, architecture, and roadmap.

## Implementation Roadmap (Next Steps)
1.  **Phase 1 (Foundation)**: Setup pnpm monorepo, implement Layer 0 (Pulse Generator), and initialize SQLite schema.
2.  **Phase 2 (Predictive Loop)**: Train a simple time-series model in Python, export to ONNX, and implement Layer 1.
3.  **Phase 3 (Translation)**: Implement LLM abstraction and the Translation Loop logic.

---
*Note: This file serves as the foundational context for Gemini CLI when interacting with this workspace.*
