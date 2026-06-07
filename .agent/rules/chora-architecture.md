# Rules: CHORA Architecture Constraints

Always-on architectural principles and constraints for the CHORA project.

## Core Principles
1. **Four-Layer Unidirectional Dependency**:
   - **Layer 0 (Pulse Generator)**: Pure state generation. Must have zero dependencies on other layers.
   - **Layer 1 (Predictive Model)**: Predicts next state, calculates prediction error/surprise. Can import from Layer 0.
   - **Layer 2 (Translation Loop)**: Requests names for high-surprise states. Can import from Layers 0 and 1.
   - **Layer 3 (Self-Naming Memory)**: Stores and manages labels. Can import from Layers 0, 1, and 2.
   - *Strict Rule*: Absolutely no upward dependencies or circular imports allowed (e.g., Layer 0 importing Layer 1 is a hard failure).

2. **The "Nameless" Rule (No Grounding Leakage)**:
   - Do not use the labels `serotonin`, `dopamine`, `cortisol`, or `oxytocin` in any prompts, parameters, or internal core logs.
   - The signals must remain purely abstract identifiers: `signal_a`, `signal_b`, `signal_c`, and `signal_d`.
   - The AI translator (Layer 2) must determine its own names based solely on signal variations and predictive error patterns.

3. **Data Logging Integrity**:
   - Every pulse, prediction, and translation event must be logged to the SQLite database.
   - Schema definitions must be respected exactly.
