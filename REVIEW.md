# CHORA Project Review

Review Date: 2026-06-07

---

## Positives

**Clear separation of layers.** The responsibilities of Layers 0–3 are well-separated, and the abstraction of the `LLMProvider` interface is appropriate. The selection of the ONNX + Node.js stack, the adoption of the built-in `node:sqlite` (zero external dependencies), and the design of the visualization dashboard are all well-considered.

---

## Design Issues

### 1. "Surprise" is essentially just detecting spikes in Signal B

```typescript
// generator.ts — signal_b: 1% probability of spiking
if (Math.random() < 0.01) {
  walkB += 0.4;
}
```

What the GRU (hidden=16) fails to predict is not the deterministic sinusoid (signal_a, signal_c), but the stochastic spikes which are unpredictable by design. Almost every moment `triggered_translation = true` occurs simply because "signal_B happened to spike," which is fundamentally different from a cognitive "sensory surprise."

- Lowering the surprise threshold from 0.15 causes unintended triggers as predictions of signal_A/C improve.
- Raising it means only picking up signal_B spikes.
- Connection events in signal_D (0.5%) are similarly unpredictable and end up mixed into the translation triggers.

### 2. LLM does not know the meaning of the signals

What `SensoryPromptBuilder` passes to the LLM is a sequence of numbers like `signal_a: 0.73`. Since the LLM interprets this from scratch on each call, there is no guarantee that "signal_a = 0.73" carries the same semantic meaning across different invocations.

For namings to form a consistent map of internal states:
- Explicitly state the semantics of the signals in the prompt (e.g., "A represents the stability axis, where 0.7 is relatively highly stable"), or
- Pass only descriptions of delta/trends instead of absolute values to make the LLM's interpretation context-dependent.

### 3. Training data covers only 0.58 cycles of the circadian cycle

```python
dataset_size = 50000  # steps
# signal_a period = 86400 steps
# 50000 / 86400 ≈ 0.58 cycles
```

The model does not see the latter half of the 24-hour cycle in the training data and extrapolates during inference. Running CHORA for an extended period systematically increases prediction errors in the latter half of the signal_a cycle, causing artificial "surprises" unrelated to actual state changes.

**Fix:** Extend the training data to cover at least 2 full cycles (172,800 steps).

### 4. PulseGenerator state is lost on restart

```typescript
// Resets to step=0, signalBState=0.5, signalDState=0.3 on every CLI start
const generator = new PulseGenerator();
```

After a restart, the database retains the last 32 steps of the previous session. The GRU uses them to predict the next pulse, but the generator starts from a completely different initial state. This discontinuity causes a burst of artificial surprise spikes immediately after startup.

**Fix:** Persist `step` and state variables (`signalBState`, `signalDState`) in the `system_state` table and restore them on startup.

### 5. `SensoryPromptBuilder.build` is called twice

```typescript
// packages/cli/src/index.ts

// Built once for logging
const rawPromptText = SensoryPromptBuilder.build(promptInput);   // 1st time

// Also built again inside generateNaming
const namingResult = await llm.generateNaming(promptInput);      // 2nd time
```

The exact same prompt is constructed twice on every run. Either `generateNaming` should accept a pre-built prompt string, or the build output should be passed down directly.

### 6. `findSimilar` lacks a distance threshold

```typescript
// packages/core/src/memory/manager.ts
// Even if the distance is 2.0, it gets passed to the LLM as a "similar past naming" as long as it fits in top-K.
return scored.slice(0, topK).map(s => s.naming);
```

When there are only a few namings, completely different sensory states are presented as "similar past experiences." Without a maximum distance threshold (e.g., 0.5), the LLM will continue to reuse unrelated past names.

**Fix:**
```typescript
.filter(s => s.distance < 0.5)  // Filter by threshold
.slice(0, topK)
```

### 7. `OllamaProvider` does not validate the range of confidence

```typescript
// packages/core/src/translation/ollama.ts
confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8
```

Even if the LLM returns `confidence: 5.0` or `confidence: -0.2`, it passes through. Since the decay calculation assumes confidence is within `[0, 1]`, out-of-range values will break memory management.

**Fix:**
```typescript
confidence: typeof parsed.confidence === 'number'
  ? Math.max(0, Math.min(1, parsed.confidence))
  : 0.8
```

### 8. Memory decay is based on cycle counts instead of wall-clock time

Decay runs strictly every 50 cycles (~50 seconds). If CHORA is paused and resumed, the elapsed time during the pause is not reflected in the decay. To represent chronological "forgetting," a timestamp-based decay using `created_at` / `last_accessed_at` would better align with the project's intent.

---

## Conceptual Issues

While this project is advertised as a "pre-linguistic consciousness simulation," its current behavior is closer to:

> **A system that prompts an LLM to name sensory states whenever stochastic spikes are detected.**

In reality, it behaves more like a **noise-driven generative poetry machine**. While this is interesting in its own right, if the framework of "consciousness" is meant to guide design decisions, the following points are worth considering:

- **Lack of context dependency in internal states:** Namings are currently generated using only the "current pulse + top-K neighbors," with no dependency between consecutive events. The previous name does not influence the context of the next.
- **Consistency vs. fluctuation in naming:** The same signal values can yield different names due to the LLM's stochastic output. It remains ambiguous whether this is intended as a feature ("fluctuation") or if it should be controlled for consistency.
- **GRU is never updated:** Periodically fine-tuning the model using actual data collected at runtime would establish a more genuine "learning" loop.

---

## Priority Summary

| Priority | Issue | Target File | Difficulty |
|---|---|---|---|
| High | Persist PulseGenerator state (restart artifact) | `generator.ts`, `db/client.ts`, `cli/index.ts` | Small |
| High | Extend training data to 2+ cycles | `training/train.py` | Very Small |
| Medium | Add distance threshold to `findSimilar` | `memory/manager.ts` | Very Small |
| Medium | Clamp confidence to `[0,1]` | `translation/ollama.ts` | Very Small |
| Medium | Resolve double invocation of `SensoryPromptBuilder.build` | `cli/index.ts`, `translation/ollama.ts` | Small |
| Low | Clarify signal semantics in prompt | `translation/prompt.ts` | Design choice |
| Low | Change decay to timestamp-based | `memory/manager.ts`, `db/client.ts` | Medium |

================================================================================

# CHORA プロジェクトレビュー (日本語)

レビュー日: 2026-06-07

---

## 良い点

**レイヤー分離は明快。** Layer 0–3 の責務がそれぞれ独立しており、`LLMProvider` インターフェースの抽象化も適切。ONNX + Node.js のスタック選択、`node:sqlite` ビルトインの採用（外部依存ゼロ）、ビジュアライゼーションの構成もよく考えられている。

---

## 設計上の問題

### 1. 「驚き」は本質的にシグナル B のスパイク検出でしかない

```typescript
// generator.ts — signal_b: 1% の確率でスパイク
if (Math.random() < 0.01) {
  walkB += 0.4;
}
```

GRU（hidden=16）が予測できないのは決定論的な sinusoid（signal_a, signal_c）ではなく、設計上予測不可能な確率的スパイクです。`triggered_translation = true` になるほぼすべての瞬間は「signal_B が偶然スパイクした」という出来事であり、「感覚的な驚き」とは別物です。

- surprise 閾値 0.15 を下げると signal_A/C の予測精度向上とともに意図せず変化する
- 上げると signal_B スパイクしか拾わなくなる
- signal_D の接続イベント（0.5%）も同様に予測不可能なため、翻訳トリガーに混入する

### 2. LLM は信号の意味を知らない

`SensoryPromptBuilder` が LLM に渡すのは `signal_a: 0.73` のような数値列です。LLM は各呼び出しでゼロから解釈するため、「signal_a = 0.73」が前回と今回で同じ意味を持つ保証がありません。

命名が一貫した内的状態のマッピングを形成するには:
- プロンプトに信号の意味論（「A は安定性の軸で、0.7 は比較的高安定」等）を明示する、または
- 信号の絶対値ではなく delta/trend の記述だけを渡して LLM の解釈を文脈依存にする

### 3. 訓練データがサーカディアンサイクルの 0.58 周期しかカバーしない

```python
dataset_size = 50000  # steps
# signal_a の周期 = 86400 steps
# 50000 / 86400 ≈ 0.58 cycles
```

モデルは 24 時間サイクルの後半を訓練データとして見ておらず、推論時に外挿します。CHORA を長時間運用すると signal_a の後半サイクルで予測誤差が系統的に高くなり、実際の状態変化とは無関係な "驚き" が増加します。

**修正:** 訓練データを最低 2 周期（172,800 steps）に拡張する。

### 4. PulseGenerator の状態が再起動で失われる

```typescript
// CLI 起動のたびに step=0, signalBState=0.5, signalDState=0.3 からリセット
const generator = new PulseGenerator();
```

再起動後、DB には旧セッションの末尾 32 件が残っており、GRU はその続きとして新パルスを予測しますが、新パルスは全く異なる初期状態から生成されます。この不連続が起動直後に人工的な surprise スパイクを大量発生させます。

**修正:** `step` と状態変数（`signalBState`, `signalDState`）を `system_state` テーブルに永続化し、起動時にリストアする。

### 5. `SensoryPromptBuilder.build` が二重呼び出しされている

```typescript
// packages/cli/src/index.ts

// ログ用にビルド
const rawPromptText = SensoryPromptBuilder.build(promptInput);   // 1 回目

// generateNaming 内部でも再度ビルド
const namingResult = await llm.generateNaming(promptInput);      // 2 回目
```

同じプロンプトが毎回 2 回構築されています。`generateNaming` が構築済みプロンプト文字列を受け取るオーバーロードを持つか、構築結果を渡す形にすべきです。

### 6. `findSimilar` に距離閾値がない

```typescript
// packages/core/src/memory/manager.ts
// 距離が 2.0 でも top-5 に入れば「類似した過去の命名」として LLM に渡される
return scored.slice(0, topK).map(s => s.naming);
```

命名が少数しかない段階では、全く異なる感覚状態のものが「似た過去の体験」として提示されます。最大距離閾値（例: 0.5）を設けないと、LLM が無関係な過去名を流用し続けます。

**修正:**
```typescript
.filter(s => s.distance < 0.5)  // 閾値でフィルタ
.slice(0, topK)
```

### 7. `OllamaProvider` が confidence の範囲を検証しない

```typescript
// packages/core/src/translation/ollama.ts
confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8
```

LLM が `confidence: 5.0` や `confidence: -0.2` を返しても通過します。decay 計算は confidence が `[0, 1]` を前提としているため、範囲外の値はメモリ管理を破壊します。

**修正:**
```typescript
confidence: typeof parsed.confidence === 'number'
  ? Math.max(0, Math.min(1, parsed.confidence))
  : 0.8
```

### 8. メモリー decay がウォールクロックではなくサイクル数ベース

decay は 50 サイクルごと（≈ 50 秒間隔）に固定で走ります。CHORA を一時停止して再開した場合、停止中の時間経過が decay に反映されません。時系列的な「忘却」を表現するなら `created_at` / `last_accessed_at` を使ったタイムスタンプベースの decay の方が意図に合います。

---

## 概念レベルの問題

このプロジェクトは "pre-linguistic consciousness simulation" を標榜していますが、現状の動作は:

> **確率的スパイクを検出したとき、LLM に感覚の名付けをさせるシステム**

これは**ノイズ駆動の生成詩マシン**として見た方が実態に近い。それ自体は面白いが、「意識」という枠組みが設計判断に影響するなら、以下を検討する価値がある:

- **内部状態の文脈依存性の欠如:** 現在の命名は「現在のパルス + top-K 近傍」のみで行われ、連続するイベント間の依存関係がない。前の名前が次の名前の文脈として影響しない。
- **命名の一貫性 vs 揺らぎ:** 同じ信号値でも LLM の確率的出力により異なる名前が生まれる。これを「揺らぎ」として活かすか一貫性として制御するかの設計意図が現状曖昧。
- **GRU は決して更新されない:** ランタイムで収集した実データでモデルを定期的に fine-tune すれば、より本物の「学習」ループになる。

---

## 優先順位まとめ

| 優先度 | 問題 | 対象ファイル | 難易度 |
|--------|------|-------------|--------|
| 高 | PulseGenerator 状態の永続化（再起動アーティファクト） | `generator.ts`, `db/client.ts`, `cli/index.ts` | 小 |
| 高 | 訓練データを 2+ 周期に拡張 | `training/train.py` | 極小 |
| 中 | `findSimilar` に距離閾値を追加 | `memory/manager.ts` | 極小 |
| 中 | confidence の `[0,1]` クランプ | `translation/ollama.ts` | 極小 |
| 中 | `SensoryPromptBuilder.build` の二重呼び出し解消 | `cli/index.ts`, `translation/ollama.ts` | 小 |
| 低 | プロンプトに信号の意味論を明示 | `translation/prompt.ts` | 設計判断 |
| 低 | decay をタイムスタンプベースに変更 | `memory/manager.ts`, `db/client.ts` | 中 |
