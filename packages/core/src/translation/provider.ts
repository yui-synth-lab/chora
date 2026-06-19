export interface TranslationPrompt {
  history: {
    signal_a: number;
    signal_b: number;
    signal_c: number;
    signal_d: number;
  }[];
  deltas: {
    signal_a: number;
    signal_b: number;
    signal_c: number;
    signal_d: number;
  };
  pastNamings: {
    name: string;
    occurrences: number;
    distance: number;
  }[];
  activeAgents?: {
    name: string;
    activation: number;
    neighbors: string[];
  }[];
}

export interface NamingResponse {
  use_existing_name: string | null;
  new_name: string | null;
  description: string;
  confidence: number;
}

/** LLMProvider port. Accepts a pre-built prompt string; prompt construction
 *  is the responsibility of TranslationService. */
export interface LLMProvider {
  name: string;
  generateNaming(prompt: string): Promise<NamingResponse>;
}
