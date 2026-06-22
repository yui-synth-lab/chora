import type { LLMProvider, NamingResponse } from "./provider.js";

export class LlamaProvider implements LLMProvider {
  name = "llama";
  private endpoint: string;

  constructor(endpoint = "http://localhost:8080/completion") {
    this.endpoint = endpoint;
  }

  async generateNaming(prompt: string): Promise<NamingResponse> {
    const requestBody = {
      prompt,
      temperature: 0.7,
      stream: false,
      response_format: { type: "json_object" },
    };

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Llama request failed with status: ${response.status} ${response.statusText}`,
      );
    }

    const json = (await response.json()) as { content: string };

    try {
      const parsed = JSON.parse(json.content);
      return {
        use_existing_name: parsed.use_existing_name || null,
        new_name: parsed.new_name || null,
        description: parsed.description || "",
        confidence:
          typeof parsed.confidence === "number"
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.8,
      };
    } catch (err) {
      throw new Error(
        `Failed to parse Llama JSON response: ${json.content}. Error: ${(err as Error).message}`,
      );
    }
  }
}
