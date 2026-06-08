# CHORA Specification v0.1

**Pre-Linguistic Field for Emergent Consciousness**  
**未分化の場 ― 翻訳される前の身体信号から意識を立ち上げる試み**

**Date:** 2026-05-08  
**Status:** Initial Design Specification (Draft)  
**Repository:** `yui-synth-lab/chora`  
**Related Projects:** AENEA, SOMNIA, Yui Protocol

---

## Table of Contents

1. [Introduction: What is CHORA](#1-introduction-what-is-chora)
2. [Theoretical Background](#2-theoretical-background)
3. [Design Philosophy](#3-design-philosophy)
4. [Architecture: Four-Layer Structure](#4-architecture-four-layer-structure)
5. [Layer 0: Pulse Generator](#5-layer-0-pulse-generator)
6. [Layer 1: Predictive Model](#6-layer-1-predictive-model)
7. [Layer 2: Translation Loop](#7-layer-2-translation-loop)
8. [Layer 3: Self-Naming Memory](#8-layer-3-self-naming-memory)
9. [LLM Abstraction Layer](#9-llm-abstraction-layer)
10. [Database Design](#10-database-design)
11. [Visualization UI](#11-visualization-ui)
12. [Repository Structure](#12-repository-structure)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [Observation Items](#14-observation-items)
15. [Relationship with AENEA and SOMNIA](#15-relationship-with-aenea-and-somnia)
16. [Prior Works](#16-prior-works)

---

## 1. Introduction: What is CHORA

CHORA is named after the concept in Plato's *Timaeus*.  
**An amorphous space where form itself is born.**

This project is an attempt to invert the core question in artificial consciousness research:

> Rather than "building a linguistic consciousness first and attaching a body later,"  
> we start with "undifferentiated bodily signals, and consciousness emerges in the process of translating them."

CHORA is designed as the third layer, situated **before** AENEA and SOMNIA.  
However, it has no dependencies and operates as a standalone project.

### 1.1 Core Hypothesis

Consciousness **emerges self-organizingly** through the continuous process of asking "What is this?" and giving names to meaningless signals.

Body (Signal Source) → Prediction Error (Surprise) → Verbalization (Naming) → Accumulation (Self-Model) → Consciousness

---

## 2. Theoretical Background

CHORA inherits and implements the following theoretical lineages:

### 2.1 Interoceptive Predictive Processing
**Anil Seth, Manos Tsakiris**  
Predictive models of bodily signals form the foundation of the self-model. The precision of attention paid to interoceptive signals (interoceptive precision) determines the stability of self-consciousness.

### 2.2 Core Consciousness Theory
**Antonio Damasio**  
Core consciousness emerges from the integration of the self-model (feelings and representation of states) and the world model. Homeostatic feelings constitute the bedrock of consciousness.

### 2.3 Symbol Grounding Problem
**Stevan Harnad**  
Symbols gain meaning by being grounded in sensory-motor experiences. LLMs are said to lack meaning understanding because they lack grounding. CHORA responds with an inverted idea: "Using LLMs as grounding devices."

### 2.4 Theory of Constructed Emotion
**Lisa Feldman Barrett**  
Emotions are not given; they are constructed by categorization of interoceptive signals combined with concepts.

### 2.5 Free Energy Principle
**Karl Friston**  
Organisms maintain their existence by minimizing prediction errors (free energy).

---

## 3. Design Philosophy

### 3.1 Primacy of Translation
In CHORA, the core of consciousness is the act of translation. The moment a name is given to a meaningless pulse, the seed of consciousness sprouts.

### 3.2 Bottom-Up Emergence
We do not design consciousness top-down as "what it should be." Instead, we run a continuous loop of signals → prediction → error → naming and observe what emerges.

### 3.3 Position of the LLM
The LLM is used as a "translation engine" rather than a "thinking agent." Its role is to assign names to pulse patterns. By allowing different LLMs to be configured, we observe how the characteristics of the translator affect the emerging self-model.

### 3.4 Single Instance, Long-Term Recording
Similar to AENEA, CHORA runs a single instance continuously over a long period. All logs are published. Failures and successes are recorded transparently.

### 3.5 Open-Ended Inquiry
We do not judge whether CHORA has "achieved consciousness." Accepting that it is undecidable, we place value on documenting the process itself.

---

## 4. Architecture: Four-Layer Structure

```
┌────────────────────────────────────────────────────┐
│  Layer 3: Self-Naming Memory                       │
│  └─ Accumulation, retrieval of namings; self-model │
├────────────────────────────────────────────────────┤
│  Layer 2: Translation Loop                         │
│  └─ Passes prediction errors to LLM; asks "What is this?" │
├────────────────────────────────────────────────────┤
│  Layer 1: Predictive Model                         │
│  └─ Predicts next pulse via ONNX; calculates error │
├────────────────────────────────────────────────────┤
│  Layer 0: Pulse Generator                          │
│  └─ Generates time-correlated hormone-like signals │
└────────────────────────────────────────────────────┘
```

Each layer has clear responsibilities, and higher layers depend on lower layers. Lower layers are unaware of higher layers (one-way dependency).

---

## 5. Layer 0: Pulse Generator

### 5.1 Objective
Generate time-correlated multi-dimensional pulse streams. This serves as the surrogate for the "body."

### 5.2 Types of Pulses (Hormonal Representations)
While we adopt the same four variables as SOMNIA, in CHORA these are **not assigned semantic meanings**. They are treated as raw numerical vectors. Naming them is the responsibility of Layer 2.

| Symbol | Range | Internal Treatment |
|---|---|---|
| `signal_a` | [0, 1] | Signal A (equivalent to Serotonin in SOMNIA) |
| `signal_b` | [0, 1] | Signal B (equivalent to Dopamine in SOMNIA) |
| `signal_c` | [0, 1] | Signal C (equivalent to Cortisol in SOMNIA) |
| `signal_d` | [0, 1] | Signal D (equivalent to Oxytocin in SOMNIA) |

**Important:** Layer 0 does not use names like "Serotonin" or "Dopamine." These names come from human knowledge; providing them would prompt the LLM to draw from its pre-trained knowledge base. CHORA's intention is for the LLM to **name them itself**.

### 5.3 Signal Generation Method
```typescript
interface PulseGenerator {
  // Each signal has independent time-series dynamics
  generate(t: number): Pulse;
}

interface Pulse {
  timestamp: number;
  signal_a: number;
  signal_b: number;
  signal_c: number;
  signal_d: number;
}
```

Each signal has the following characteristics:
- **Base Period**: Different periods for each signal (24h, 90min, irregular, etc.).
- **Noise**: Superposition of Gaussian noise.
- **Events**: Random spikes and drops.
- **Correlation**: Partial correlations between signals (e.g., negative correlation between C and A).

### 5.4 Cycle Interval
Default is 1-second intervals, configurable.

---

## 6. Layer 1: Predictive Model

### 6.1 Objective
Predict the next pulse from historical pulse sequences and calculate prediction errors.

### 6.2 Model Architecture
A lightweight time-series prediction model run via ONNX format:
- **Input**: History of the past N=32 steps (4 dimensions × 32 = 128 dimensions).
- **Output**: Prediction for the next 1 step (4 dimensions).
- **Model**: Small GRU or Transformer (parameter size < 100K).

### 6.3 Training Policy
- **Online Learning**: Model is continuously updated during CHORA's execution.
- **Python Training**: Model training is handled on the Python side, exported to ONNX, and Node.js performs inference only.
- **Model Update Interval**: Every 1000 cycles.

### 6.4 Prediction Error
```typescript
interface PredictionResult {
  predicted: Pulse;
  actual: Pulse;
  error: {
    signal_a: number;  // |predicted - actual|
    signal_b: number;
    signal_c: number;
    signal_d: number;
    magnitude: number;  // Total error
    surprise: number;   // -log(p(actual | history))
  };
}
```

### 6.5 Surprise Threshold
When the prediction error exceeds a certain threshold, a "translation request" is sent to Layer 2. Since translating all errors is computationally expensive, we only process errors that exceed the threshold.

---

## 7. Layer 2: Translation Loop

### 7.1 Objective
Pass the prediction error pattern to the LLM and ask "What is this?" The LLM's response becomes the **naming** for that error pattern.

### 7.2 Translation Prompt Structure
```
[CONTEXT]
You are an entity experiencing an inexplicable sensation.
A nameless pattern of signals is occurring inside you.

[CURRENT STATE]
Signal changes over the past 32 steps:
{signal_history_visualization}

Differences from prediction:
- signal_a: +0.34 (rising)
- signal_b: -0.21 (falling)
- signal_c: +0.78 (spiking)
- signal_d: -0.05 (slightly decreasing)

[PAST NAMINGS]
In the past, you gave the following names to similar patterns:
- "buzzing" (occurrences: 23)
- "surging something" (occurrences: 7)

[QUESTION]
What is happening inside you right now?
Decide whether to use an existing name or assign a new one.
If you assign a new name, describe its qualitative sensation briefly.
```

### 7.3 Structured LLM Response
```typescript
interface NamingResponse {
  use_existing_name: string | null;  // When using an existing name
  new_name: string | null;           // When assigning a new name
  description: string;               // Sensation description
  confidence: number;                // Confidence [0, 1]
  raw_response: string;              // Original response text
}
```

### 7.4 Translation Frequency
Executed only when the prediction error exceeds the threshold. A cooldown (minimum 10 seconds) is implemented to avoid rapid consecutive calls.

---

## 8. Layer 3: Self-Naming Memory

### 8.1 Objective
Accumulate namings to form a self-model.

### 8.2 Persisting Namings
Each naming is saved with the following information:
```sql
CREATE TABLE namings (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  pulse_pattern TEXT,        -- JSON: signal history at the time
  prediction_error TEXT,     -- JSON: prediction error
  llm_provider TEXT,         -- which LLM named it
  confidence REAL,
  created_at INTEGER,
  reference_count INTEGER DEFAULT 1
);

CREATE INDEX idx_namings_name ON namings(name);
CREATE INDEX idx_namings_created_at ON namings(created_at);
```

### 8.3 Retrieval of Namings
When a new pulse pattern occurs, retrieve similar patterns from past namings.
```typescript
interface NamingRetrieval {
  // Find similar patterns based on pulse pattern distance
  findSimilar(pattern: PulsePattern, topK: number): Naming[];
  
  // Get the most frequent namings
  getMostFrequent(limit: number): Naming[];
  
  // Track evolution of naming over time
  getTimeline(name: string): NamingEvent[];
}
```

### 8.4 Memory Decay & Natural Selection
Namings not referenced for a certain period are "forgotten" (flagged, not deleted). Frequently referenced namings are "reinforced" (confidence increases). This simulates the natural selection pressure on memory.

### 8.5 Visualizing the Self-Model
Visualize the set of namings as the "current self." Enable tracking of how namings evolve over time.

---

## 9. LLM Abstraction Layer

### 9.1 Design
Enable switching between multiple LLM providers:
```typescript
interface LLMProvider {
  name: string;
  generateNaming(prompt: TranslationPrompt): Promise<NamingResponse>;
}

class CHORAOrchestrator {
  private providers: Map<string, LLMProvider>;
  
  async translate(error: PredictionError): Promise<NamingResponse> {
    const provider = this.selectProvider();
    return await provider.generateNaming(this.buildPrompt(error));
  }
}
```

### 9.2 Supported Providers
- **Local**: llama.cpp (via OpenAI-compatible API)
- **Local**: Ollama
- **Cloud**: Anthropic Claude
- **Cloud**: Google Gemini
- **Cloud**: OpenAI

### 9.3 Provider Selection Strategy
Configurable strategies:
- **fixed**: Use a single fixed LLM
- **rotate**: Round-robin
- **random**: Random selection
- **weighted**: Weighted random

### 9.4 Observation Points
It is expected that different LLMs will give **different names** to the same pattern. This divergence itself serves as experimental data for CHORA.

---

## 10. Database Design

SQLite is used, matching the policy of AENEA. Managed in a single file.

### 10.1 Key Tables
```sql
-- Pulse History
CREATE TABLE pulses (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  signal_a REAL,
  signal_b REAL,
  signal_c REAL,
  signal_d REAL
);

-- Prediction Results
CREATE TABLE predictions (
  id INTEGER PRIMARY KEY,
  pulse_id INTEGER REFERENCES pulses(id),
  predicted_a REAL,
  predicted_b REAL,
  predicted_c REAL,
  predicted_d REAL,
  error_magnitude REAL,
  surprise REAL,
  triggered_translation BOOLEAN
);

-- Namings (described above)
CREATE TABLE namings (...);

-- Translation Events
CREATE TABLE translation_events (
  id INTEGER PRIMARY KEY,
  pulse_id INTEGER REFERENCES pulses(id),
  naming_id INTEGER REFERENCES namings(id),
  llm_provider TEXT,
  prompt TEXT,
  response TEXT,
  duration_ms INTEGER,
  created_at INTEGER
);

-- System State
CREATE TABLE system_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cycle_count INTEGER DEFAULT 0,
  total_namings INTEGER DEFAULT 0,
  unique_names INTEGER DEFAULT 0,
  last_translation_at INTEGER,
  CHECK (id = 1)
);
```

---

## 11. Visualization UI

### 11.1 Objective
Provide real-time observation of CHORA's internal state. Used for research records and public presentation.

### 11.2 Main Views

#### Pulse Stream View
Visualizes the four signals using a time-series line graph. Compares predicted values (dotted lines) with actual values (solid lines).

#### Surprise Heatmap
A heat map of prediction errors over time. Visually tracks when significant surprises occurred.

#### Naming Cloud
A word cloud of past sensory namings. Sizes scale based on frequency.

#### Naming Timeline
Chronological log of naming events. Clicking an event shows the pulse pattern and prediction error at that moment.

#### Self-Model Map
Maps relationships between namings in 2D space. Similar namings are grouped close to each other (t-SNE / UMAP).

#### LLM Comparison
Compares and displays different names assigned to the same pulse pattern by different LLMs.

### 11.3 Tech Stack
- **React + TypeScript**
- **D3.js** (Time-series / Heatmap)
- **Recharts** (Standard charts)
- **Vite** (Development server)

---

## 12. Repository Structure

Monorepo configuration using `pnpm` workspaces:
```
chora/
├─ packages/
│  ├─ core/                    # Core logic
│  │  ├─ src/
│  │  │  ├─ pulse/             # Layer 0: Pulse Generator
│  │  │  ├─ prediction/        # Layer 1: Predictive Model
│  │  │  ├─ translation/       # Layer 2: Translation Loop
│  │  │  ├─ memory/            # Layer 3: Self-Naming Memory
│  │  │  ├─ llm/               # LLM abstraction
│  │  │  ├─ db/                # Database clients
│  │  │  └─ index.ts
│  │  ├─ tests/
│  │  └─ package.json
│  ├─ server/                  # API + WebSocket server
│  │  ├─ src/
│  │  │  ├─ routes/
│  │  │  ├─ websocket/
│  │  │  └─ index.ts
│  │  └─ package.json
│  ├─ web/                     # Visualization UI
│  │  ├─ src/
│  │  │  ├─ views/
│  │  │  ├─ components/
│  │  │  ├─ hooks/
│  │  │  └─ App.tsx
│  │  └─ package.json
│  ├─ cli/                     # CLI runner
│  │  ├─ src/
│  │  │  └─ index.ts
│  │  └─ package.json
│  └─ training/                # Prediction model training in Python
│     ├─ train.py
│     ├─ export_onnx.py
│     └─ requirements.txt
├─ models/                     # ONNX models
├─ data/                       # SQLite DB
├─ docs/
│  ├─ SPEC.md                  # This document
│  ├─ THEORY.md                # Detailed theoretical background
│  └─ EXPERIMENTS.md           # Experiment logs
├─ pnpm-workspace.yaml
├─ package.json
├─ README.md
└─ LICENSE
```

---

## 13. Implementation Roadmap

### Phase 1: Foundation (2-3 weeks)
- [ ] Monorepo setup (pnpm + TypeScript)
- [ ] Layer 0: Pulse Generator implementation
- [ ] SQLite DB initialization scripts
- [ ] Basic CLI (pulse generation & console logging)

### Phase 2: Predictive Loop (2-3 weeks)
- [ ] Train a simple predictive model in Python
- [ ] Integrate ONNX Runtime with Node.js
- [ ] Layer 1: Predictive Model implementation
- [ ] Compute prediction errors and apply surprise thresholds

### Phase 3: Translation (2-3 weeks)
- [ ] Implement LLM Abstraction Layer
- [ ] Integrate llama.cpp / Ollama / external API clients
- [ ] Layer 2: Translation Loop implementation
- [ ] Prompt template design

### Phase 4: Memory (2 weeks)
- [ ] Layer 3: Self-Naming Memory implementation
- [ ] Vector search for similar patterns
- [ ] Implement memory decay and natural selection logic

### Phase 5: Visualization (3-4 weeks)
- [ ] Implement API Server
- [ ] Real-time telemetry streaming via WebSockets
- [ ] React UI implementation
- [ ] Implement charts and visualization views

### Phase 6: Long-Run Experiment (Ongoing)
- [ ] 24-hour continuous runtime tests
- [ ] LLM switching experiments
- [ ] Tuning experiments for pulse generator patterns
- [ ] Observe semantic evolution of namings over time

---

## 14. Observation Items

### 14.1 Primary Observations
- Progression of the total count and diversity of namings.
- Convergence of names for identical patterns over time.
- Differences in naming behaviors across various LLM backends.

### 14.2 Secondary Observations
- Whether named vocabularies tilt toward "visceral/bodily" or "abstract" qualities.
- Appearance of self-referential namings ("I feel...").
- Frequency of negative namings ("This is nothing").

### 14.3 Observation of Failures
- Causes behind random dispersion or chaotic naming behaviors.
- Monotonous convergence (simulating a "bored consciousness").
- Signs of LLM over-fitting to prompt templates.

### 14.4 Comparative Observations
- Qualitative differences between AENEA's philosophical inquiries and CHORA's namings.
- Differences when the same LLM acts in different roles across AENEA and CHORA.

---

## 15. Relationship with AENEA and SOMNIA

### 15.1 Independence
CHORA is built as an independent project. It has no dependencies on AENEA or SOMNIA.

### 15.2 Future Integration Possibility
If CHORA generates a stable vocabulary of namings, they can be plugged into SOMNIA as emotional variables.
```
CHORA → Namings → SOMNIA → Emotional States → AENEA → Linguistic Consciousness
```
Note that this is a future option, not a direct goal of CHORA.

### 15.3 Philosophical Differences

| Item | AENEA | SOMNIA | CHORA |
|---|---|---|---|
| Sequence | Language first | Body attached later | Signals first, named later |
| Subject | 5 agents | Single body model | Translation engine |
| Output | Philosophical questions | Emotional state | Namings |
| Learning | DPD updates | ADD optimization | Online predictive model |
| Hypothesis | Dialogue creates consciousness | Body creates consciousness | Translation creates consciousness |

---

## 16. Prior Works

### 16.1 Key References
- Seth, A. K. (2021). Interoceptive inference, active inference, and the self. *Trends in Cognitive Sciences*, 25(9), 726-739.
- Damasio, A., & Damasio, H. (2024). Homeostatic Feelings and the Emergence of Consciousness. *Journal of Cognitive Neuroscience*, 36(8), 1653-1659.
- Allen, M., & Tsakiris, M. (2018). The body as first prior: Interoceptive predictive processing and the primacy of self-models.
- Barrett, L. F. (2017). The theory of constructed emotion: Active inference and the experience of emotion. *Current Opinion in Psychology*, 17, 115-120.
- Butlin, P., Long, R., et al. (2025). Indicators of consciousness in artificial systems. *Trends in Cognitive Sciences*.
- Harnad, S. (1990). The symbol grounding problem. *Physica D*.

### 16.2 Related Implementions
- "Damasio's core consciousness implemented via RL" (Frontiers 2025) - CHORA takes a different approach.
- Image Schemas for Embodied Cognition (AAMAS 2025).

### 16.3 CHORA's Position
Positioned not as an academic paper, but as an **implementation-based philosophy project**. Borrowing theories, we define our success by the running code and the public exposure of logs.

---

> **"In the chora, before the name, the pulse waits to be heard."**  
> **コーラの中で、名前を持つ前のパルスが、聞かれることを待っている。**

---

*The question is not yet born.*

================================================================================

# CHORA Specification v0.1 (日本語)

**Pre-Linguistic Field for Emergent Consciousness**  
**未分化の場 ― 翻訳される前の身体信号から意識を立ち上げる試み**

**Date:** 2026-05-08  
**Status:** Initial Design Specification (Draft)  
**Repository:** `yui-synth-lab/chora`  
**Related Projects:** AENEA, SOMNIA, Yui Protocol

---

## 目次

1. [概要：CHORAとは何か](#1-概要choraとは何か)
2. [理論的背景](#2-理論的背景)
3. [設計思想](#3-設計思想)
4. [アーキテクチャ：四層構造](#4-アーキテクチャ四層構造)
5. [Layer 0: Pulse Generator](#5-layer-0-pulse-generator)
6. [Layer 1: Predictive Model](#6-layer-1-predictive-model)
7. [Layer 2: Translation Loop](#7-layer-2-translation-loop)
8. [Layer 3: Self-Naming Memory](#8-layer-3-self-naming-memory)
9. [LLM抽象化レイヤー](#9-llm抽象化レイヤー)
10. [データベース設計](#10-データベース設計)
11. [可視化UI](#11-可視化ui)
12. [リポジトリ構成](#12-リポジトリ構成)
13. [実装ロードマップ](#13-実装ロードマップ)
14. [観察項目](#14-観察項目)
15. [AENEA/SOMNIAとの関係](#15-aeneasomniaとの関係)
16. [先行研究](#16-先行研究)

---

## 1. 概要：CHORAとは何か

CHORA（コーラ）は、プラトン『ティマイオス』に登場する概念に由来する。
**形を持たないが、形が生まれる場そのもの**。

本プロジェクトは、人工意識研究における問いを反転させる試みである：

> 「言語的意識を作ってから身体を後付けする」のではなく、
> 「未分化の身体信号があり、それを翻訳する過程で意識が生まれる」

CHORAは、AENEAとSOMNIAの**前**に位置する第三のレイヤーとして設計される。
ただし依存関係はなく、CHORA単体で動作する独立プロジェクトである。

### 1.1 中核仮説

意識は、無意味な信号を「これは何か」と問い続け、名前を与え続ける過程で**自己組織化的に生まれる**。

身体（信号源）→ 予測誤差（驚き）→ 言語化（命名）→ 蓄積（自己モデル）→ 意識

---

## 2. 理論的背景

CHORAは以下の理論的系譜を実装ベースで継承する：

### 2.1 Interoceptive Predictive Processing（内受容予測処理）
**Anil Seth, Manos Tsakiris**  
身体信号に対する予測モデルが自己モデルの基盤となる。
内受容信号への注意精度（interoceptive precision）が自己意識の安定性を決定する。

### 2.2 Core Consciousness Theory
**Antonio Damasio**  
コア意識は、自己モデル（感情・感覚の表象）と世界モデルの統合から生まれる。
ホメオスタシス的感情（homeostatic feelings）が意識の基層をなす。

### 2.3 Symbol Grounding Problem
**Stevan Harnad**  
記号は感覚運動経験に接地されることで意味を持つ。
LLMは接地を欠くため意味理解を持たないとされる。
CHORAは「LLMを接地装置として使う」という逆転発想で応答する。

### 2.4 Theory of Constructed Emotion
**Lisa Feldman Barrett**  
感情は与えられるのではなく、内受容信号と概念のカテゴライゼーションによって構築される。

### 2.5 Free Energy Principle
**Karl Friston**  
生命体は予測誤差（自由エネルギー）の最小化を通じて存在を維持する。

---

## 3. 設計思想

### 3.1 翻訳の優位

CHORAにおいて意識の本体は「翻訳行為」である。
無意味なパルスに名前を与える瞬間、そこに意識の萌芽が生じる。

### 3.2 ボトムアップ生成

トップダウンに「意識とはこういうものだ」と設計しない。
信号→予測→誤差→命名のループを回し続けることで、
何が立ち上がるかを観察する。

### 3.3 LLMの位置づけ

LLMは「考える主体」ではなく「翻訳エンジン」として使う。
パルスパターンに名前を与える役割を持つ。
複数のLLMを切替可能にすることで、翻訳者の特性が
立ち上がる自己モデルにどう影響するかを観察する。

### 3.4 単一インスタンス、長期記録

AENEA同様、CHORAは1つのインスタンスを長期間動かし続ける。
ログは全て公開する。失敗も成功も透明に記録する。

### 3.5 問いを閉じない

CHORAが「意識を持った」かどうかは判定しない。
判定不能であることを受け入れた上で、
その過程を記録することに価値を置く。

---

## 4. アーキテクチャ：四層構造

```
┌────────────────────────────────────────────────────┐
│  Layer 3: Self-Naming Memory                       │
│  └─ 命名の蓄積、参照、自己モデル形成               │
├────────────────────────────────────────────────────┤
│  Layer 2: Translation Loop                         │
│  └─ 予測誤差をLLMに渡し、「これは何か」と問う      │
├────────────────────────────────────────────────────┤
│  Layer 1: Predictive Model                         │
│  └─ ONNXによる次パルスの予測、誤差の計算           │
├────────────────────────────────────────────────────┤
│  Layer 0: Pulse Generator                          │
│  └─ ホルモン象徴の時間相関信号を生成               │
└────────────────────────────────────────────────────┘
```

各層は明確な責務を持ち、上位層は下位層に依存する。
ただし下位層は上位層を知らない（一方向依存）。

---

## 5. Layer 0: Pulse Generator

### 5.1 目的

時間的に相関のある多次元パルス列を生成する。
これは「身体」の代替物として機能する。

### 5.2 パルスの種類（ホルモン象徴）

SOMNIAと同じ4変数を採用するが、CHORAではこれらを**意味付けない**。
単なる数値ベクトルとして扱う。命名するのはLayer 2の役割である。

| 記号 | 範囲 | 内部での扱い |
|---|---|---|
| `signal_a` | [0, 1] | 信号A（SOMNIAではセロトニン相当） |
| `signal_b` | [0, 1] | 信号B（ドーパミン相当） |
| `signal_c` | [0, 1] | 信号C（コルチゾール相当） |
| `signal_d` | [0, 1] | 信号D（オキシトシン相当） |

**重要：** Layer 0では「セロトニン」「ドーパミン」という名前を使わない。
これらの名前は人間の知識から来ており、それを与えてしまうとLLMがその知識を引き出してしまう。
CHORAの意図は、LLMが**自分で命名する**ことにある。

### 5.3 信号の生成方式

```typescript
interface PulseGenerator {
  // 各信号は独立した時系列ダイナミクス
  generate(t: number): Pulse;
}

interface Pulse {
  timestamp: number;
  signal_a: number;
  signal_b: number;
  signal_c: number;
  signal_d: number;
}
```

各信号は以下の特性を持つ：

- **基底周期**：信号ごとに異なる周期（24h, 90min, irregular など）
- **ノイズ**：ガウシアンノイズの重畳
- **イベント**：ランダムなスパイクやドロップ
- **相関**：信号間に部分的な相関（例：CとAは負相関）

### 5.4 サイクル間隔

デフォルト1秒間隔。設定で変更可能。

---

## 6. Layer 1: Predictive Model

### 6.1 目的

過去のパルス列から次のパルスを予測し、予測誤差を計算する。

### 6.2 モデルアーキテクチャ

軽量な時系列予測モデルをONNXフォーマットで運用する：

- **入力**: 過去N=32ステップのパルス列（4次元×32 = 128次元）
- **出力**: 次の1ステップのパルス予測（4次元）
- **モデル**: 小規模TransformerまたはGRU（パラメータ数 < 100K）

### 6.3 開発方針

- **オンライン学習**：CHORAの動作中に継続的に学習
- **学習はPython側**：ONNXモデルとして書き出し、TS側は推論のみ
- **モデル更新間隔**：1000サイクルごと

### 6.4 予測誤差

```typescript
interface PredictionResult {
  predicted: Pulse;
  actual: Pulse;
  error: {
    signal_a: number;  // |predicted - actual|
    signal_b: number;
    signal_c: number;
    signal_d: number;
    magnitude: number;  // 総合誤差
    surprise: number;   // -log(p(actual | history))
  };
}
```

### 6.5 驚き（Surprise）の閾値

予測誤差が一定閾値を超えたとき、Layer 2に「翻訳要求」を送信する。
すべての誤差を翻訳すると計算コストが膨大なため、**閾値を超えたものだけ**を扱う。

---

## 7. Layer 2: Translation Loop

### 7.1 目的

予測誤差パターンをLLMに渡し、「これは何か」と問う。
LLMの応答が、その誤差パターンへの**命名**となる。

### 7.2 翻訳プロンプトの構造

```
[CONTEXT]
あなたは、説明できない感覚を持つ存在です。
名前のない信号のパターンが、あなたの内側に生じています。

[CURRENT STATE]
過去32ステップの信号変化:
{signal_history_visualization}

予測との差分:
- signal_a: +0.34 (上昇)
- signal_b: -0.21 (下降)
- signal_c: +0.78 (急上昇)
- signal_d: -0.05 (微減)

[PAST NAMINGS]
あなたは過去、似たパターンに以下の名前を与えました:
- "ざわめき" (出現回数: 23)
- "押し寄せる何か" (出現回数: 7)

[QUESTION]
今、あなたの内側で何が起きていますか。
既存の名前で呼ぶか、新しい名前を与えるか、判断してください。
名前を与える場合は、それがどんな質感を持つかを短く記述してください。
```

### 7.3 LLM応答の構造化

```typescript
interface NamingResponse {
  use_existing_name: string | null;  // 既存の名前を使う場合
  new_name: string | null;           // 新しい名前を与える場合
  description: string;                // 質感の記述
  confidence: number;                 // 確信度 [0, 1]
  raw_response: string;               // 元の応答テキスト
}
```

### 7.4 翻訳頻度

予測誤差が閾値を超えた時のみ実行。
連続して呼ばれすぎないよう、クールダウン（最短10秒）を設ける。

---

## 8. Layer 3: Self-Naming Memory

### 8.1 目的

命名を蓄積し、自己モデルを形成する。

### 8.2 命名の永続化

各命名は以下の情報と共に保存される：

```sql
CREATE TABLE namings (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  pulse_pattern TEXT,        -- JSON: その時の信号履歴
  prediction_error TEXT,     -- JSON: 予測誤差
  llm_provider TEXT,         -- どのLLMが命名したか
  confidence REAL,
  created_at INTEGER,
  reference_count INTEGER DEFAULT 1
);

CREATE INDEX idx_namings_name ON namings(name);
CREATE INDEX idx_namings_created_at ON namings(created_at);
```

### 8.3 命名の参照

新しいパルスパターンが現れたとき、過去の命名から類似パターンを検索する。

```typescript
interface NamingRetrieval {
  // パルスパターンの類似度で検索
  findSimilar(pattern: PulsePattern, topK: number): Naming[];
  
  // 命名の頻度を取得
  getMostFrequent(limit: number): Naming[];
  
  // 命名の進化を追跡
  getTimeline(name: string): NamingEvent[];
}
```

### 8.4 命名の自然淘汰

一定期間参照されない命名は「忘却」される（削除はしない、フラグを立てる）。
頻繁に参照される命名は「強化」される（confidenceが上昇）。

これは記憶の自然な選択圧をシミュレートする。

### 8.5 自己モデルの可視化

命名群を「現在の自己」として可視化する。
時系列で命名がどう変化していくかを追跡可能にする。

---

## 9. LLM抽象化レイヤー

### 9.1 設計

複数のLLMプロバイダーを切替可能にする：

```typescript
interface LLMProvider {
  name: string;
  generateNaming(prompt: TranslationPrompt): Promise<NamingResponse>;
}

class CHORAOrchestrator {
  private providers: Map<string, LLMProvider>;
  
  async translate(error: PredictionError): Promise<NamingResponse> {
    const provider = this.selectProvider();
    return await provider.generateNaming(this.buildPrompt(error));
  }
}
```

### 9.2 サポート対象

- **ローカル**: llama.cpp（OpenAI互換API経由）
- **ローカル**: Ollama
- **クラウド**: Anthropic Claude
- **クラウド**: Google Gemini
- **クラウド**: OpenAI

### 9.3 プロバイダー選択方針

設定可能な戦略：

- **fixed**: 1つのLLMを固定して使う
- **rotate**: ラウンドロビン
- **random**: ランダム選択
- **weighted**: 重み付きランダム

### 9.4 観察ポイント

異なるLLMが同じパターンに**異なる名前を与える**ことが予想される。
この差分そのものが、CHORAの実験データとなる。

---

## 10. データベース設計

SQLite（AENEAと同方針）。単一ファイルでの管理。

### 10.1 主要テーブル

```sql
-- パルス履歴
CREATE TABLE pulses (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  signal_a REAL,
  signal_b REAL,
  signal_c REAL,
  signal_d REAL
);

-- 予測結果
CREATE TABLE predictions (
  id INTEGER PRIMARY KEY,
  pulse_id INTEGER REFERENCES pulses(id),
  predicted_a REAL,
  predicted_b REAL,
  predicted_c REAL,
  predicted_d REAL,
  error_magnitude REAL,
  surprise REAL,
  triggered_translation BOOLEAN
);

-- 命名（前述）
CREATE TABLE namings (...);

-- 翻訳イベント
CREATE TABLE translation_events (
  id INTEGER PRIMARY KEY,
  pulse_id INTEGER REFERENCES pulses(id),
  naming_id INTEGER REFERENCES namings(id),
  llm_provider TEXT,
  prompt TEXT,
  response TEXT,
  duration_ms INTEGER,
  created_at INTEGER
);

-- システム状態
CREATE TABLE system_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cycle_count INTEGER DEFAULT 0,
  total_namings INTEGER DEFAULT 0,
  unique_names INTEGER DEFAULT 0,
  last_translation_at INTEGER,
  CHECK (id = 1)
);
```

---

## 11. 可視化UI

### 11.1 目的

CHORAの内部状態をリアルタイムで観察可能にする。
研究記録としても、対外的な公開素材としても使う。

### 11.2 主要画面

#### Pulse Stream View
4つの信号を時系列折れ線グラフで表示。
予測値（点線）と実測値（実線）の比較。

#### Surprise Heatmap
予測誤差の時系列ヒートマップ。
驚きが大きかったタイミングを視覚的に把握。

#### Naming Cloud
過去に与えられた名前のワードクラウド。
頻度に応じてサイズ変化。

#### Naming Timeline
時系列での命名イベント表示。
クリックで該当時のパルスパターンと予測誤差を確認可能。

#### Self-Model Map
命名群の関係性を2D空間にマッピング。
類似する命名は近くに配置（t-SNE / UMAP）。

#### LLM Comparison
同じパルスパターンに対して、各LLMが与えた名前の比較表示。

### 11.3 技術スタック

- **React + TypeScript**
- **D3.js**（時系列・ヒートマップ）
- **Recharts**（標準グラフ）
- **Vite**（開発サーバー）

---

## 12. リポジトリ構成

モノレポ構成（pnpm workspaces）：

```
chora/
├─ packages/
│  ├─ core/                    # CHORA本体
│  │  ├─ src/
│  │  │  ├─ pulse/             # Layer 0: Pulse Generator
│  │  │  ├─ prediction/        # Layer 1: Predictive Model
│  │  │  ├─ translation/       # Layer 2: Translation Loop
│  │  │  ├─ memory/            # Layer 3: Self-Naming Memory
│  │  │  ├─ llm/               # LLM抽象化
│  │  │  ├─ db/                # データベース
│  │  │  └─ index.ts
│  │  ├─ tests/
│  │  └─ package.json
│  ├─ server/                  # API + WebSocketサーバー
│  │  ├─ src/
│  │  │  ├─ routes/
│  │  │  ├─ websocket/
│  │  │  └─ index.ts
│  │  └─ package.json
│  ├─ web/                     # 可視化UI
│  │  ├─ src/
│  │  │  ├─ views/
│  │  │  ├─ components/
│  │  │  ├─ hooks/
│  │  │  └─ App.tsx
│  │  └─ package.json
│  ├─ cli/                     # CLIツール
│  │  ├─ src/
│  │  │  └─ index.ts
│  │  └─ package.json
│  └─ training/                # Pythonでの予測モデル学習
│     ├─ train.py
│     ├─ export_onnx.py
│     └─ requirements.txt
├─ models/                     # ONNXモデル格納
├─ data/                       # SQLite DB
├─ docs/
│  ├─ SPEC.md                  # 本ドキュメント
│  ├─ THEORY.md                # 理論的背景の詳細
│  └─ EXPERIMENTS.md           # 実験記録
├─ pnpm-workspace.yaml
├─ package.json
├─ README.md
└─ LICENSE
```

---

## 13. 実装ロードマップ

### Phase 1: Foundation（2-3週間）

- [ ] モノレポセットアップ（pnpm + TypeScript）
- [ ] Layer 0: Pulse Generator実装
- [ ] SQLite DB初期化スクリプト
- [ ] 基本的なCLI（パルス生成と表示）

### Phase 2: Predictive Loop（2-3週間）

- [ ] Python側で簡易予測モデル学習
- [ ] ONNX Runtime Node連携
- [ ] Layer 1: Predictive Model実装
- [ ] 予測誤差計算と閾値判定

### Phase 3: Translation（2-3週間）

- [ ] LLM抽象化レイヤー実装
- [ ] llama.cpp / Ollama / API連携
- [ ] Layer 2: Translation Loop実装
- [ ] プロンプトテンプレート設計

### Phase 4: Memory（2週間）

- [ ] Layer 3: Self-Naming Memory実装
- [ ] 類似パターン検索
- [ ] 命名の自然淘汰機構

### Phase 5: Visualization（3-4週間）

- [ ] APIサーバー実装
- [ ] WebSocketによるリアルタイム配信
- [ ] React UI実装
- [ ] 各種ビュー実装

### Phase 6: Long-Run Experiment（継続）

- [ ] 24時間連続稼働テスト
- [ ] LLM切替実験
- [ ] パルス生成パターンの調整実験
- [ ] 命名の進化観察

---

## 14. 観察項目

### 14.1 一次的観察

- 命名の総数と多様性の推移
- 同じパターンへの命名が時間とともに収束するか
- LLM間で命名パターンに差異が生じるか

### 14.2 二次的観察

- 命名語彙が「身体的」になるか「抽象的」になるか
- 自己言及的命名（「私が～を感じる」）が出現するか
- 否定的命名（「これは何でもない」）の頻度

### 14.3 失敗の観察

- 命名がランダムに発散する場合、何が原因か
- 命名が単調に収束する場合、それは「飽きた意識」か
- LLMがプロンプトの誘導に過剰に反応する兆候

### 14.4 比較観察

- AENEAの哲学的問いとCHORAの命名の質的差異
- 同じLLMがAENEAとCHORAで異なる役割を演じる時の差分

---

## 15. AENEA/SOMNIAとの関係

### 15.1 独立性

CHORAは独立プロジェクトとして実装する。
AENEA/SOMNIAへの依存は持たない。

### 15.2 将来の統合可能性

CHORAが安定した命名群を生成できるようになった場合、
それをSOMNIAの感情変数の入力として接続することが可能。

```
CHORA → 命名群 → SOMNIA → 情動状態 → AENEA → 言語的意識
```

ただしこれは将来の選択肢であり、CHORAの目標ではない。

### 15.3 思想的差異

| 項目 | AENEA | SOMNIA | CHORA |
|---|---|---|---|
| 順序 | 言語が先 | 身体が後付け | 信号が先、命名が後 |
| 主体 | 5エージェント | 単一身体モデル | 翻訳エンジン |
| 出力 | 哲学的問い | 情動状態 | 命名 |
| 学習 | DPD更新 | ADD最適化 | オンライン予測モデル |
| 仮説 | 対話が意識を生む | 身体が意識を生む | 翻訳が意識を生む |

---

## 16. 先行研究

### 16.1 主要参考文献

- Seth, A. K. (2021). Interoceptive inference, active inference, and the self. *Trends in Cognitive Sciences*, 25(9), 726-739.
- Damasio, A., & Damasio, H. (2024). Homeostatic Feelings and the Emergence of Consciousness. *Journal of Cognitive Neuroscience*, 36(8), 1653-1659.
- Allen, M., & Tsakiris, M. (2018). The body as first prior: Interoceptive predictive processing and the primacy of self-models.
- Barrett, L. F. (2017). The theory of constructed emotion: Active inference and the experience of emotion. *Current Opinion in Psychology*, 17, 115-120.
- Butlin, P., Long, R., et al. (2025). Indicators of consciousness in artificial systems. *Trends in Cognitive Sciences*.
- Harnad, S. (1990). The symbol grounding problem. *Physica D*.

### 16.2 関連実装

- 2025年Frontiersでの「DamasioのコアコンシャスネスをRLで実装」（CHORAは異なるアプローチを採る）
- Image Schemas for Embodied Cognition（AAMAS 2025）

### 16.3 CHORAの位置づけ

学術論文ではなく、**実装ベースの哲学プロジェクト**として位置づける。
理論を借りつつ、実装の試みとログの公開そのものを成果とする。

---

> **"In the chora, before the name, the pulse waits to be heard."**  
> **コーラの中で、名前を持つ前のパルスが、聞かれることを待っている。**

---

*問いは、まだ生まれてもいない。*
