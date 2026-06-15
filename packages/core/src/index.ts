export { ChoraDatabase } from "./db/client.js";
export type {
  PulseRecord,
  SystemStateRecord,
  PredictionRecord,
  NamingRecord,
  TranslationEventRecord,
  PulseHistoryRecord,
  ChoraDBOptions,
} from "./db/client.js";
export { PulseGenerator } from "./pulse/generator.js";
export type { Pulse } from "./pulse/generator.js";
export { PredictiveModel } from "./prediction/model.js";
export type { PredictionResult } from "./prediction/model.js";
export { findWorkspaceRoot } from "./utils/workspace.js";
export { OllamaProvider } from "./translation/ollama.js";
export { SensoryPromptBuilder } from "./translation/prompt.js";
export type {
  LLMProvider,
  TranslationPrompt,
  NamingResponse,
} from "./translation/provider.js";
export { MemoryManager } from "./memory/manager.js";
export type {
  TickEvent,
  NamingEvent,
  DecayEvent,
  InitStatsEvent,
} from "./domain/events.js";

// Phase 3 exports
export { NamingService } from "./memory/naming-service.js";
export type { ResolvedNaming, NamingInsertPayload } from "./memory/naming-service.js";
export { TranslationService } from "./translation/translation-service.js";
export type { TranslationInput, TranslationResult } from "./translation/translation-service.js";
export { ChoraEngine } from "./engine/chora-engine.js";
export type { TickResult, TickPhase, ChoraEngineConfig } from "./engine/chora-engine.js";
export type { EventSink } from "./engine/event-sink.js";
export { NoopEventSink } from "./engine/event-sink.js";
export type { Clock } from "./engine/clock.js";
export { SystemClock } from "./engine/clock.js";
export { HttpEventSink } from "./infra/telemetry/http-event-sink.js";
