import { LLMProvider, TranslationPrompt, NamingResponse } from './provider.js';
import { SensoryPromptBuilder } from './prompt.js';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private model: string;
  private endpoint: string;

  constructor(model = 'llama3', endpoint = 'http://localhost:11434/api/generate') {
    this.model = model;
    this.endpoint = endpoint;
  }

  async generateNaming(prompt: TranslationPrompt): Promise<NamingResponse> {
    const promptText = SensoryPromptBuilder.build(prompt);

    const requestBody = {
      model: this.model,
      prompt: promptText,
      stream: false,
      options: {
        temperature: 0.3
      },
      format: 'json'
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as { response: string };
    
    try {
      const parsed = JSON.parse(json.response);
      return {
        use_existing_name: parsed.use_existing_name || null,
        new_name: parsed.new_name || null,
        description: parsed.description || '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8
      };
    } catch (err) {
      throw new Error(`Failed to parse Ollama JSON response: ${json.response}. Error: ${(err as Error).message}`);
    }
  }
}
