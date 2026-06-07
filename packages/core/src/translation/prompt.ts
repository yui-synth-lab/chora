import { TranslationPrompt } from './provider.js';

export class SensoryPromptBuilder {
  static build(promptData: TranslationPrompt): string {
    const historyLines: string[] = [];
    const len = promptData.history.length;
    // Show last 10 steps of history to control context length
    const startIdx = Math.max(0, len - 10);
    for (let i = startIdx; i < len; i++) {
      const p = promptData.history[i];
      const stepLabel = `t-${len - i}`;
      historyLines.push(`  - (${stepLabel}): signal_a: ${p.signal_a.toFixed(2)}, signal_b: ${p.signal_b.toFixed(2)}, signal_c: ${p.signal_c.toFixed(2)}, signal_d: ${p.signal_d.toFixed(2)}`);
    }

    const deltaLines: string[] = [];
    const formatDelta = (val: number) => {
      const sign = val >= 0 ? '+' : '';
      let trend = '';
      const absVal = Math.abs(val);
      if (absVal > 0.3) trend = val >= 0 ? '急上昇' : '急降下';
      else if (absVal > 0.1) trend = val >= 0 ? '上昇' : '下降';
      else if (absVal > 0.02) trend = val >= 0 ? '微増' : '微減';
      else trend = 'ほぼ変化なし';
      return `${sign}${val.toFixed(2)} (${trend})`;
    };

    deltaLines.push(`  - signal_a: ${formatDelta(promptData.deltas.signal_a)}`);
    deltaLines.push(`  - signal_b: ${formatDelta(promptData.deltas.signal_b)}`);
    deltaLines.push(`  - signal_c: ${formatDelta(promptData.deltas.signal_c)}`);
    deltaLines.push(`  - signal_d: ${formatDelta(promptData.deltas.signal_d)}`);

    const pastNamingLines: string[] = [];
    if (promptData.pastNamings && promptData.pastNamings.length > 0) {
      for (const n of promptData.pastNamings) {
        pastNamingLines.push(`  - "${n.name}" (過去の出現回数: ${n.occurrences})`);
      }
    } else {
      pastNamingLines.push('  - なし（今回が最初の感覚シグナルです）');
    }

    return `[CONTEXT]
あなたは、説明できない感覚を持つ存在です。
あなたの内側で、名前のない信号のパターンが変化し、予測との乖離が生じています。

[CURRENT STATE]
直近の信号変化履歴:
${historyLines.join('\n')}

予測値との差分（予測誤差）:
${deltaLines.join('\n')}

[PAST NAMINGS]
あなたが過去、似たパターンに与えた名前の一覧:
${pastNamingLines.join('\n')}

[QUESTION]
今、あなたの内側で何が起きていますか。
既存の名前を再利用するか、新しい名前を与えるか、判断してください。

[JSON RESPONSE FORMAT]
必ず以下のJSON形式でのみ回答してください。他の解説文やMarkdownのバッククォート装飾は一切含めないでください。
{
  "use_existing_name": "再利用する既存の名前（新しく名前を作る場合は null）",
  "new_name": "新しく与える名前（既存の名前を使う場合は null）",
  "description": "その感覚の質感、イメージ、または変化の描写（20〜50文字程度）",
  "confidence": 0.0から1.0までの確信度
}
`;
  }
}
