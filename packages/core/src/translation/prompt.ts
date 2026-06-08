import { TranslationPrompt } from './provider.js';

export class SensoryPromptBuilder {
  static build(promptData: TranslationPrompt): string {
    const historyLines: string[] = [];
    const len = promptData.history.length;
    const startIdx = Math.max(0, len - 10);
    for (let i = startIdx; i < len; i++) {
      const p = promptData.history[i];
      const stepLabel = `t-${len - i}`;
      historyLines.push(
        `  (${stepLabel}): 安定=${p.signal_a.toFixed(2)} 報酬=${p.signal_b.toFixed(2)} 緊張=${p.signal_c.toFixed(2)} 繋=${p.signal_d.toFixed(2)}`
      );
    }

    const formatDelta = (val: number) => {
      const sign = val >= 0 ? '+' : '';
      const absVal = Math.abs(val);
      let trend: string;
      if (absVal > 0.3) trend = val >= 0 ? '急上昇' : '急降下';
      else if (absVal > 0.1) trend = val >= 0 ? '上昇' : '下降';
      else if (absVal > 0.02) trend = val >= 0 ? '微増' : '微減';
      else trend = 'ほぼ変化なし';
      return `${sign}${val.toFixed(2)} (${trend})`;
    };

    const deltaLines = [
      `  安定(A): ${formatDelta(promptData.deltas.signal_a)}`,
      `  報酬(B): ${formatDelta(promptData.deltas.signal_b)}`,
      `  緊張(C): ${formatDelta(promptData.deltas.signal_c)}`,
      `  繋(D):   ${formatDelta(promptData.deltas.signal_d)}`
    ];

    // Build past namings section with similarity label
    let pastNamingSection: string;
    if (promptData.pastNamings && promptData.pastNamings.length > 0) {
      const lines = promptData.pastNamings.map(n => {
        const sim = n.distance < 0.15 ? '非常に近い' : n.distance < 0.25 ? 'やや近い' : '遠い';
        return `  - "${n.name}" (類似度: ${sim} / 距離 ${n.distance.toFixed(2)} / 出現 ${n.occurrences}回)`;
      });
      pastNamingSection = lines.join('\n');
    } else {
      pastNamingSection = '  - なし（記憶にない感覚パターンです）';
    }

    return `[CONTEXT]
あなたは身体感覚のみを持つ存在です。4つの内部信号（安定・報酬・緊張・繋）がリアルタイムに変化しており、今この瞬間、予測から大きく外れた感覚が生じています。

信号の意味:
  安定(A): 基礎的な落ち着きや身体的安定感 [0=不安定, 1=安定]
  報酬(B): 喜びや期待の突発的な高まり [0=無感動, 1=強い高揚]
  緊張(C): ストレスや覚醒の度合い [0=弛緩, 1=強い緊張]
  繋(D):   他との繋がりや孤立感 [0=孤立, 1=深い繋がり]

[CURRENT STATE]
直近の信号推移:
${historyLines.join('\n')}

予測との乖離（今この瞬間の「驚き」の内訳）:
${deltaLines.join('\n')}

[MEMORY]
過去に似た状態に与えた名前（閾値内に見つかったもののみ）:
${pastNamingSection}

[INSTRUCTION]
この感覚体験に名前を与えてください。

【最重要】過去の名前が「非常に近い」距離で見つかっている場合は、必ずその名前を再利用してください。
再利用することで記憶が強化され、あなたの自己モデルが育ちます。同じ感覚には同じ名前を使い続けることが大切です。
新しい名前を作るのは、記憶が「なし」の場合、または「遠い」距離の場合のみです。

名前は日本語1〜4文字の造語または既存語。感覚の質感を直接表現してください。

[JSON RESPONSE FORMAT]
他の文章やMarkdown装飾を含めず、以下のJSON形式のみで回答してください。
{
  "use_existing_name": "再利用する既存の名前（新しく作る場合は null）",
  "new_name": "新しい名前（再利用する場合は null）",
  "description": "この感覚の質感・色・動き・温度などを具体的に描写（20〜50文字）",
  "confidence": 0.0から1.0の確信度
}
`;
  }
}
