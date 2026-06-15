import { TranslationPrompt } from "./provider.js";

export type PromptLang = "en" | "ja";

export class SensoryPromptBuilder {
  static build(promptData: TranslationPrompt, lang: PromptLang = "en"): string {
    return lang === "ja"
      ? SensoryPromptBuilder.buildJa(promptData)
      : SensoryPromptBuilder.buildEn(promptData);
  }

  // ── Japanese ────────────────────────────────────────────────────────────────

  private static buildJa(promptData: TranslationPrompt): string {
    const historyLines = SensoryPromptBuilder.historyLinesJa(promptData);
    const deltaLines = SensoryPromptBuilder.deltaLinesJa(promptData);
    const pastNamingSection =
      SensoryPromptBuilder.pastNamingSectionJa(promptData);
    const rareEvents = SensoryPromptBuilder.rareEventNotesJa(promptData);

    return `[CONTEXT]
あなたは身体感覚のみを持つ存在です。4つの内部信号（安定・報酬・緊張・繋）がリアルタイムに変化しており、今この瞬間、予測から大きく外れた感覚が生じています。

信号の意味:
  安定(A): 基礎的な落ち着きや身体的安定感 [0=不安定, 1=安定]
  報酬(B): 喜びや期待の突発的な高まり [0=無感動, 1=強い高揚]
  緊張(C): ストレスや覚醒の度合い [0=弛緩, 1=強い緊張]
  繋(D):   他との繋がりや孤立感 [0=孤立, 1=深い繋がり]

[CURRENT STATE]
直近の信号推移:
${historyLines.join("\n")}

予測との乖離 — 各チャネルで「何が驚きか」:
${deltaLines.join("\n")}
${rareEvents}
[MEMORY]
過去に似た状態に与えた名前（閾値内に見つかったもののみ）:
${pastNamingSection}

[INSTRUCTION]
この感覚体験に名前を与えてください。
名前は4つの信号すべてを反映すべきです。緊張だけでなく、安定・報酬・繋がりの感覚にも注目してください。

【最重要】「再利用推奨」の名前がある場合は、必ずその名前をそのまま再利用してください。
再利用することで記憶が強化され、あなたの自己モデルが育ちます。
新しい名前を作るのは、記録が「(記録なし)」の場合、または「参考」のみで再利用に値しないと判断した場合のみです。

名前は日本語1〜4文字の造語または既存語。感覚の質感を直接表現してください。
※名前には距離数値・参照回数・記号などのメタ情報を含めないこと。

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

  // ── English ─────────────────────────────────────────────────────────────────

  private static buildEn(promptData: TranslationPrompt): string {
    const historyLines = SensoryPromptBuilder.historyLinesEn(promptData);
    const deltaLines = SensoryPromptBuilder.deltaLinesEn(promptData);
    const pastNamingSection =
      SensoryPromptBuilder.pastNamingSectionEn(promptData);
    const rareEvents = SensoryPromptBuilder.rareEventNotesEn(promptData);

    return `[CONTEXT]
You are an entity that experiences only raw bodily signals. Four internal signals change in real time, and right now a large prediction error has occurred — something unexpected is being felt.

Signal meanings:
  stability(A): baseline bodily calm [0=unstable, 1=stable]
  reward(B):    sudden surge of pleasure or anticipation [0=flat, 1=intense high]
  stress(C):    arousal / tension level [0=relaxed, 1=intense stress]
  connect(D):   sense of connection vs isolation [0=isolated, 1=deeply connected]

[CURRENT STATE]
Recent signal history:
${historyLines.join("\n")}

Prediction error — what feels unexpected in each channel right now:
${deltaLines.join("\n")}
${rareEvents}
[MEMORY]
Names given to similar states in the past (within distance threshold only):
${pastNamingSection}

[INSTRUCTION]
Give a name to this sensory experience.
The name should reflect ALL four signals, not just stress. Pay attention to stability, reward, and connection too.

IMPORTANT: If a past name is marked "reuse recommended", you MUST reuse it exactly as-is.
Reusing strengthens memory and builds your self-model. Use the same name for the same feeling.
Only create a new name when memory is "(none)" or all past names are "reference only".

The name should be 1–3 words in English. Express the raw texture of the sensation directly.
Do NOT include numbers, distances, counts, or any metadata in the name.

[JSON RESPONSE FORMAT]
Reply with ONLY the following JSON — no prose, no markdown.
{
  "use_existing_name": "the exact existing name to reuse (null if creating new)",
  "new_name": "a new name (null if reusing existing)",
  "description": "vivid description of the sensation's texture, color, motion, temperature (20–60 chars)",
  "confidence": a float from 0.0 to 1.0
}
`;
  }

  // ── Shared helpers ───────────────────────────────────────────────────────────

  private static historyLinesJa(promptData: TranslationPrompt): string[] {
    const lines: string[] = [];
    const len = promptData.history.length;
    const startIdx = Math.max(0, len - 10);
    for (let i = startIdx; i < len; i++) {
      const p = promptData.history[i];
      lines.push(
        `  (t-${len - i}): 安定=${p.signal_a.toFixed(2)} 報酬=${p.signal_b.toFixed(2)} 緊張=${p.signal_c.toFixed(2)} 繋=${p.signal_d.toFixed(2)}`,
      );
    }
    return lines;
  }

  private static historyLinesEn(promptData: TranslationPrompt): string[] {
    const lines: string[] = [];
    const len = promptData.history.length;
    const startIdx = Math.max(0, len - 10);
    for (let i = startIdx; i < len; i++) {
      const p = promptData.history[i];
      lines.push(
        `  (t-${len - i}): stab=${p.signal_a.toFixed(2)} rew=${p.signal_b.toFixed(2)} str=${p.signal_c.toFixed(2)} con=${p.signal_d.toFixed(2)}`,
      );
    }
    return lines;
  }

  // Typical prediction error magnitudes per channel (empirically observed).
  // Used to normalize trend labels so the LLM perceives all channels with equal salience.
  private static readonly TYPICAL_ERROR = { A: 0.1, B: 0.05, C: 0.3, D: 0.04 };

  private static deltaLinesJa(promptData: TranslationPrompt): string[] {
    const te = SensoryPromptBuilder.TYPICAL_ERROR;
    const fmt = (val: number, typical: number) => {
      const sign = val >= 0 ? "+" : "";
      const normalized = Math.abs(val) / typical;
      const trend =
        normalized > 3.0
          ? val >= 0
            ? "急上昇"
            : "急降下"
          : normalized > 1.5
            ? val >= 0
              ? "上昇"
              : "下降"
            : normalized > 0.5
              ? val >= 0
                ? "微増"
                : "微減"
              : "ほぼ変化なし";
      return `${sign}${val.toFixed(2)} (${trend})`;
    };

    const qualA =
      promptData.deltas.signal_a >= 0
        ? "身体が重く落ち着いていく感覚"
        : "足場が揺らぐ、安定が崩れる感覚";
    const qualB =
      promptData.deltas.signal_b >= 0
        ? "内側から温かさが込み上げる、期待の高まり"
        : "温もりが引いていく、期待が薄れる感覚";
    const qualC =
      promptData.deltas.signal_c >= 0
        ? "筋肉が強張り、電気的な振動が高まる"
        : "筋肉がほぐれ、緊張が溶けていく感覚";
    const qualD =
      promptData.deltas.signal_d >= 0
        ? "外へ手を伸ばす感覚、繋がりの芽生え"
        : "糸が切れていく、孤立が深まる感覚";

    return [
      `  安定(A): ${fmt(promptData.deltas.signal_a, te.A)} — ${qualA}`,
      `  報酬(B): ${fmt(promptData.deltas.signal_b, te.B)} — ${qualB}`,
      `  緊張(C): ${fmt(promptData.deltas.signal_c, te.C)} — ${qualC}`,
      `  繋(D):   ${fmt(promptData.deltas.signal_d, te.D)} — ${qualD}`,
    ];
  }

  private static deltaLinesEn(promptData: TranslationPrompt): string[] {
    const te = SensoryPromptBuilder.TYPICAL_ERROR;
    const fmt = (val: number, typical: number) => {
      const sign = val >= 0 ? "+" : "";
      const normalized = Math.abs(val) / typical;
      const trend =
        normalized > 3.0
          ? val >= 0
            ? "spike up"
            : "spike down"
          : normalized > 1.5
            ? val >= 0
              ? "rising"
              : "falling"
            : normalized > 0.5
              ? val >= 0
                ? "slight rise"
                : "slight fall"
              : "stable";
      return `${sign}${val.toFixed(2)} (${trend})`;
    };

    const qualA =
      promptData.deltas.signal_a >= 0
        ? "body settling heavier, grounding"
        : "ground shifting, stability wavering";
    const qualB =
      promptData.deltas.signal_b >= 0
        ? "inner warmth rising, anticipation building"
        : "warmth fading, pleasure draining away";
    const qualC =
      promptData.deltas.signal_c >= 0
        ? "muscles tightening, electric hum intensifying"
        : "muscles softening, tension dissolving";
    const qualD =
      promptData.deltas.signal_d >= 0
        ? "threads reaching outward, connection stirring"
        : "threads withdrawing, isolation deepening";

    return [
      `  stability(A): ${fmt(promptData.deltas.signal_a, te.A)} — ${qualA}`,
      `  reward(B):    ${fmt(promptData.deltas.signal_b, te.B)} — ${qualB}`,
      `  stress(C):    ${fmt(promptData.deltas.signal_c, te.C)} — ${qualC}`,
      `  connect(D):   ${fmt(promptData.deltas.signal_d, te.D)} — ${qualD}`,
    ];
  }

  // Phase 3: Rare event detection — flags exceptional signal states
  private static rareEventNotesEn(promptData: TranslationPrompt): string {
    const notes: string[] = [];
    const latest = promptData.history[promptData.history.length - 1];
    if (latest) {
      if (latest.signal_b > 0.85)
        notes.push(
          "⚡ RARE EVENT: A sudden flood of reward/pleasure is surging through the system.",
        );
      if (latest.signal_d > 0.9)
        notes.push(
          "💫 RARE EVENT: An overwhelming wave of deep connection has emerged.",
        );
      if (latest.signal_a < 0.2)
        notes.push(
          "🌊 RARE EVENT: Stability has collapsed — the ground beneath is dissolving.",
        );
      if (latest.signal_d < 0.05)
        notes.push(
          "🕳️ RARE EVENT: Complete isolation — all threads of connection have vanished.",
        );
    }
    return notes.length > 0 ? "\n" + notes.join("\n") + "\n" : "";
  }

  private static rareEventNotesJa(promptData: TranslationPrompt): string {
    const notes: string[] = [];
    const latest = promptData.history[promptData.history.length - 1];
    if (latest) {
      if (latest.signal_b > 0.85)
        notes.push("⚡ 稀少事象: 報酬/快楽の奔流がシステム全体に溢れている。");
      if (latest.signal_d > 0.9)
        notes.push("💫 稀少事象: 深い繋がりの圧倒的な波が押し寄せている。");
      if (latest.signal_a < 0.2)
        notes.push("🌊 稀少事象: 安定が崩壊した — 足元の地面が溶けていく。");
      if (latest.signal_d < 0.05)
        notes.push("🕳️ 稀少事象: 完全な孤立 — すべての繋がりの糸が消えた。");
    }
    return notes.length > 0 ? "\n" + notes.join("\n") + "\n" : "";
  }

  private static pastNamingSectionJa(promptData: TranslationPrompt): string {
    if (!promptData.pastNamings || promptData.pastNamings.length === 0) {
      return "  - (記録なし)";
    }
    return promptData.pastNamings
      .map((n) => {
        const hint = n.distance < 0.25 ? "→ 再利用推奨" : "→ 参考";
        return `  - "${n.name}" [dist=${n.distance.toFixed(2)}, ${n.occurrences}回] ${hint}`;
      })
      .join("\n");
  }

  private static pastNamingSectionEn(promptData: TranslationPrompt): string {
    if (!promptData.pastNamings || promptData.pastNamings.length === 0) {
      return "  - (none)";
    }
    return promptData.pastNamings
      .map((n) => {
        const hint =
          n.distance < 0.25 ? "→ reuse recommended" : "→ reference only";
        return `  - "${n.name}" [dist=${n.distance.toFixed(2)}, used ${n.occurrences}x] ${hint}`;
      })
      .join("\n");
  }
}
