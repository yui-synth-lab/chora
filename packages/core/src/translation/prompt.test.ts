import { describe, it, expect } from 'vitest';
import { SensoryPromptBuilder } from './prompt.js';
import { TranslationPrompt } from './provider.js';

describe('SensoryPromptBuilder', () => {
  it('should build a formatted sensory translation prompt', () => {
    const promptData: TranslationPrompt = {
      history: [
        { signal_a: 0.50, signal_b: 0.40, signal_c: 0.30, signal_d: 0.20 },
        { signal_a: 0.55, signal_b: 0.42, signal_c: 0.35, signal_d: 0.22 }
      ],
      deltas: {
        signal_a: 0.05,
        signal_b: -0.15,
        signal_c: 0.35,
        signal_d: 0.01
      },
      pastNamings: [
        { name: 'ざわめき', occurrences: 5 },
        { name: '静寂', occurrences: 2 }
      ]
    };

    const promptText = SensoryPromptBuilder.build(promptData);

    // Verify sections are present
    expect(promptText).toContain('[CONTEXT]');
    expect(promptText).toContain('[CURRENT STATE]');
    expect(promptText).toContain('[PAST NAMINGS]');
    expect(promptText).toContain('[QUESTION]');
    expect(promptText).toContain('[JSON RESPONSE FORMAT]');

    // Verify history and deltas are formatted correctly
    expect(promptText).toContain('signal_a: 0.50');
    expect(promptText).toContain('signal_b: 0.42');
    expect(promptText).toContain('signal_c: +0.35 (急上昇)');
    expect(promptText).toContain('signal_b: -0.15 (下降)');

    // Verify past namings are formatted
    expect(promptText).toContain('"ざわめき" (過去の出現回数: 5)');
    expect(promptText).toContain('"静寂" (過去の出現回数: 2)');
  });
});
