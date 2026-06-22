import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LlamaProvider } from "./llama.js";

describe("LlamaProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with default endpoint", () => {
    const provider = new LlamaProvider();
    expect(provider.name).toBe("llama");
    // @ts-expect-error accessing private property for testing
    expect(provider.endpoint).toBe("http://localhost:8080/completion");
  });

  it("should initialize with custom endpoint", () => {
    const provider = new LlamaProvider("http://custom-host:8080/completion");
    // @ts-expect-error accessing private property for testing
    expect(provider.endpoint).toBe("http://custom-host:8080/completion");
  });

  it("should successfully generate naming and parse response", async () => {
    const mockResponse = {
      content: JSON.stringify({
        use_existing_name: null,
        new_name: "微風",
        description: "心地よい静かな風のような感覚",
        confidence: 0.9,
      }),
    };

    const mockFetch = vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const provider = new LlamaProvider();
    const result = await provider.generateNaming("test prompt");

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:8080/completion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "test prompt",
        temperature: 0.7,
        stream: false,
        response_format: { type: "json_object" },
      }),
    });

    expect(result).toEqual({
      use_existing_name: null,
      new_name: "微風",
      description: "心地よい静かな風のような感覚",
      confidence: 0.9,
    });
  });

  it("should handle invalid JSON and throw error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ content: "invalid json string" }),
    } as Response);

    const provider = new LlamaProvider();
    await expect(provider.generateNaming("test prompt")).rejects.toThrow(
      /Failed to parse Llama JSON response/
    );
  });

  it("should clamp confidence to 0.0 - 1.0", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: JSON.stringify({
          use_existing_name: "静寂",
          new_name: null,
          description: "穏やかな状態",
          confidence: 1.5,
        }),
      }),
    } as Response);

    const provider = new LlamaProvider();
    const result1 = await provider.generateNaming("test prompt");
    expect(result1.confidence).toBe(1.0);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: JSON.stringify({
          use_existing_name: "静寂",
          new_name: null,
          description: "穏やかな状態",
          confidence: -0.5,
        }),
      }),
    } as Response);

    const result2 = await provider.generateNaming("test prompt");
    expect(result2.confidence).toBe(0.0);
  });

  it("should throw error if fetch response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    const provider = new LlamaProvider();
    await expect(provider.generateNaming("test prompt")).rejects.toThrow(
      /Llama request failed with status: 500 Internal Server Error/
    );
  });
});
