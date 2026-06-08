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
        { name: 'ざわめき', occurrences: 5, distance: 0.12 },
        { name: '静寂', occurrences: 2, distance: 0.22 }
      ]
    };

    const promptText = SensoryPromptBuilder.build(promptData);

    // Verify sections are present
    expect(promptText).toContain('[CONTEXT]');
    expect(promptText).toContain('[CURRENT STATE]');
    expect(promptText).toContain('[MEMORY]');
    expect(promptText).toContain('[INSTRUCTION]');
    expect(promptText).toContain('[JSON RESPONSE FORMAT]');

    // Verify signal labels appear in history
    expect(promptText).toContain('安定=0.50');
    expect(promptText).toContain('報酬=0.42');

    // Verify deltas are formatted
    expect(promptText).toContain('+0.35 (急上昇)');
    expect(promptText).toContain('-0.15 (下降)');

    // Verify past namings include distance
    expect(promptText).toContain('"ざわめき"');
    expect(promptText).toContain('非常に近い');
    expect(promptText).toContain('"静寂"');
    expect(promptText).toContain('やや近い');
  });

  it('should show empty memory message when no past namings', () => {
    const promptData: TranslationPrompt = {
      history: [{ signal_a: 0.5, signal_b: 0.5, signal_c: 0.5, signal_d: 0.5 }],
      deltas: { signal_a: 0.1, signal_b: 0.1, signal_c: 0.1, signal_d: 0.1 },
      pastNamings: []
    };

    const promptText = SensoryPromptBuilder.build(promptData);
    expect(promptText).toContain('記憶にない感覚パターンです');
  });
});
