# CHORA プロジェクトレビュー

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

### 8. メモリ decay がウォールクロックではなくサイクル数ベース

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
