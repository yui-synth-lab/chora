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
  }[];
}

export interface NamingResponse {
  use_existing_name: string | null;
  new_name: string | null;
  description: string;
  confidence: number;
}

export interface LLMProvider {
  name: string;
  generateNaming(prompt: TranslationPrompt): Promise<NamingResponse>;
}
