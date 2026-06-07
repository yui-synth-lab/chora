---
name: chora-translation
description: Handles Layer 2 Translation Loop prompts, LLM abstraction providers (Gemini, Claude, Ollama), and Layer 3 Memory retention/forgetting logic.
---
# Skill: CHORA Translation Loop & Memory

This skill governs the interaction with LLMs as translation engines and the self-organizing memory retrieval systems.

## Capabilities
- **LLM Client Abstraction**: Interfacing with Google Gemini, Anthropic Claude, and local Ollama or llama.cpp APIs.
- **Prompt Engineering for Sensory Grounding**: Constructing prompts that present raw vector streams to the model without human bias.
- **Memory Consolidation & Natural Selection**: Implementing search-based recall and decay functions for stored naming concepts in SQLite.

## Guidelines

### 1. Translation Prompts
- Force the model's response format to a structured JSON object.
- The prompt must position the AI as a silent observer of its internal state, trying to describe raw signals.
- Limit the historical naming references passed into the prompt to the Top 5 most similar states or Top 5 most frequent states to control context size.

### 2. LLM Provider Management
- Implement standard retry logic with exponential backoff for network-based API providers.
- Allow swapping providers dynamically at runtime based on CLI parameters or configuration files.

### 3. Memory Decay & Forget Mechanics (Layer 3)
- Retain a `reference_count` and `confidence` value for each label.
- Implement a decay cycle: every $M$ cycles, reduce confidence of labels that have not been referred to.
- Do not delete labels from database. Flag them as `forgotten = 1` so they can still be analyzed in logs.
