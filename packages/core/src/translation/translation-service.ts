import type { LLMProvider, NamingResponse } from "./provider.js";
import { SensoryPromptBuilder, type PromptLang } from "./prompt.js";
import type { Pulse, PulseRecord } from "../domain/types.js";

export interface TranslationInput {
  pulse: Pulse;
  history: PulseRecord[];
  deltas: { signal_a: number; signal_b: number; signal_c: number; signal_d: number };
  pastNamings: { name: string; occurrences: number; distance: number }[];
  activeAgents?: { name: string; activation: number; neighbors: string[] }[];
}

export interface TranslationResult {
  namingResponse: NamingResponse;
  promptText: string;
  durationMs: number;
}

/**
 * TranslationService — owns prompt construction (language selection) and LLM
 * invocation. Returns the raw NamingResponse for NamingService to resolve.
 */
export class TranslationService {
  constructor(
    private readonly llm: LLMProvider,
    private readonly lang: PromptLang = "en",
  ) {}

  get llmName(): string {
    return this.llm.name;
  }

  async translate(input: TranslationInput): Promise<TranslationResult> {
    const promptText = SensoryPromptBuilder.build(
      {
        history: input.history.map((h) => ({
          signal_a: h.signal_a,
          signal_b: h.signal_b,
          signal_c: h.signal_c,
          signal_d: h.signal_d,
        })),
        deltas: input.deltas,
        pastNamings: input.pastNamings,
        activeAgents: input.activeAgents,
      },
      this.lang,
    );

    const startTime = Date.now();
    const namingResponse = await this.llm.generateNaming(promptText);
    const durationMs = Date.now() - startTime;

    return { namingResponse, promptText, durationMs };
  }
}
