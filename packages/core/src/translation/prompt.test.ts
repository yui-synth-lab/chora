import { describe, it, expect } from "vitest";
import { SensoryPromptBuilder } from "./prompt.js";
import { TranslationPrompt } from "./provider.js";

describe("SensoryPromptBuilder", () => {
  it("should build a formatted sensory translation prompt (English default)", () => {
    const promptData: TranslationPrompt = {
      history: [
        { signal_a: 0.5, signal_b: 0.4, signal_c: 0.3, signal_d: 0.2 },
        { signal_a: 0.55, signal_b: 0.42, signal_c: 0.35, signal_d: 0.22 },
      ],
      deltas: {
        signal_a: 0.05,
        signal_b: -0.15,
        signal_c: 0.35,
        signal_d: 0.01,
      },
      pastNamings: [
        { name: "ざわめき", occurrences: 5, distance: 0.12 },
        { name: "静寂", occurrences: 2, distance: 0.22 },
      ],
    };

    const promptText = SensoryPromptBuilder.build(promptData);

    // Verify sections are present
    expect(promptText).toContain("[CONTEXT]");
    expect(promptText).toContain("[CURRENT STATE]");
    expect(promptText).toContain("[MEMORY]");
    expect(promptText).toContain("[INSTRUCTION]");
    expect(promptText).toContain("[JSON RESPONSE FORMAT]");

    // Verify signal labels appear in history (English format)
    expect(promptText).toContain("stab=0.50");
    expect(promptText).toContain("rew=0.42");

    // Verify deltas are formatted with normalized trends and qualitative cues
    expect(promptText).toContain("+0.35 (slight rise)");
    expect(promptText).toContain("-0.15 (falling)");

    // Verify past namings include new distance/reuse indicators
    expect(promptText).toContain('"ざわめき"');
    expect(promptText).toContain("reuse recommended");
    expect(promptText).toContain('"静寂"');
  });

  it("should build a formatted sensory translation prompt (Japanese)", () => {
    const promptData: TranslationPrompt = {
      history: [
        { signal_a: 0.5, signal_b: 0.4, signal_c: 0.3, signal_d: 0.2 },
        { signal_a: 0.55, signal_b: 0.42, signal_c: 0.35, signal_d: 0.22 },
      ],
      deltas: {
        signal_a: 0.05,
        signal_b: -0.15,
        signal_c: 0.35,
        signal_d: 0.01,
      },
      pastNamings: [
        { name: "ざわめき", occurrences: 5, distance: 0.12 },
        { name: "静寂", occurrences: 2, distance: 0.22 },
      ],
    };

    const promptText = SensoryPromptBuilder.build(promptData, "ja");

    // Verify sections are present
    expect(promptText).toContain("[CONTEXT]");
    expect(promptText).toContain("[CURRENT STATE]");
    expect(promptText).toContain("[MEMORY]");
    expect(promptText).toContain("[INSTRUCTION]");

    // Verify signal labels appear in history (Japanese format)
    expect(promptText).toContain("安定=0.50");
    expect(promptText).toContain("報酬=0.42");

    // Verify deltas are formatted with normalized trends and qualitative cues
    expect(promptText).toContain("+0.35 (微増)");
    expect(promptText).toContain("-0.15 (下降)");

    // Verify past namings include new distance/reuse indicators
    expect(promptText).toContain('"ざわめき"');
    expect(promptText).toContain("再利用推奨");
    expect(promptText).toContain('"静寂"');
  });

  it("should show empty memory message when no past namings", () => {
    const promptData: TranslationPrompt = {
      history: [{ signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 }],
      deltas: { signal_a: 0.1, signal_b: 0.1, signal_c: 0.1, signal_d: 0.1 },
      pastNamings: [],
    };

    const promptTextEn = SensoryPromptBuilder.build(promptData, "en");
    expect(promptTextEn).toContain("(none)");

    const promptTextJa = SensoryPromptBuilder.build(promptData, "ja");
    expect(promptTextJa).toContain("記録なし");
  });
});
