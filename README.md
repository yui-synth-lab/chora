# CHORA

> **"In the chora, before the name, the pulse waits to be heard."**  
> *コーラの中で、名前を持つ前のパルスが、聞かれることを待っている。*

CHORA is a research and experimental software project that simulates the **"process of self-consciousness emerging from undifferentiated bodily signals through linguistic translation."**

Unlike traditional AI, which starts with language (symbols), CHORA starts with a sequence of meaningless pulses (bodily signals), predicts them, and prompts an LLM to name and describe the parts where prediction errors ("surprise") occur. By cycling through a loop that remembers and naturally selects these names, we observe how self-consciousness is constructed.

---

## 1. Core Hypothesis

Consciousness arises as a **byproduct of a self-organizing translation loop** that continuously asks "What is this?", names, and categorizes the prediction errors of undifferentiated interoceptive (bodily) signals.

```
 Undifferentiated Pulse (Layer 0) 
        ↓
 Prediction Error Calculation (Layer 1) ── [Surprise exceeds threshold]
        ↓
 Sensory Naming by LLM (Layer 2)
        ↓
 Self-Model Memory & Decay (Layer 3) ── [Construction of Self-Sensation]
```

---

## 2. Architecture: Four-Layer Structure

CHORA is designed and implemented across four independent layers:

1. **Layer 0: Pulse Generator (Sensory Signal Source)**
   - Generates a continuous 4-dimensional vector with temporal correlation every second (simulating hormonal changes, stress levels, oxytocin, serotonin, etc.).
2. **Layer 1: Predictive Model**
   - Predicts the next pulse based on the history of the last 32 steps using a lightweight GRU ONNX model trained and exported via Python/PyTorch. The root-mean-square error (RMSE) between prediction and actual value is calculated as "Surprise."
3. **Layer 2: Translation Loop**
   - When the surprise exceeds a threshold, the system calls a local LLM (Ollama), passing the history of past namings as context. The LLM either assigns a new name or reuses an existing name for the "current interoceptive sensation."
4. **Layer 3: Self-Naming Memory**
   - Saves named labels and 4D vector patterns to SQLite. For similar patterns, it searches using Euclidean distance. Reused names are "reinforced" (reference count increases). Every 50 cycles, the confidence of memory decays (natural selection of memory), and names with confidence below a threshold are forgotten.

---

## 3. Monorepo Package Structure

This project uses a monorepo structure managed by `pnpm` workspaces.

```
chora/
├── packages/
│   ├── core/         # Core module (Pulse, ONNX inference, SQLite DB, MemoryManager)
│   ├── cli/          # Command-line execution loop runner
│   ├── server/       # Telemetry distribution Express WebSocket API server (Port: 3001)
│   ├── web/          # React + Vite visualization dashboard (Port: 3000)
│   └── training/     # Python GRU predictive model training and ONNX export
├── models/           # Trained ONNX models (.onnx)
├── data/             # SQLite database files (.db)
└── docs/             # Design specifications and documentation
```

---

## 4. Quick Start

### 4.1 Prerequisites
- **Node.js**: v22.5.0 or higher (Node v24 recommended)
- **Python**: 3.10 or higher
- **pnpm**: Package manager
- **Ollama**: Local LLM environment running

### 4.2 Setup

1. **Install repository dependencies**
   ```bash
   pnpm install
   ```

2. **Prepare Ollama Model**
   With Ollama running, pull the default LLM model (`llama3`).
   ```bash
   ollama pull llama3
   ```

3. **Train Predictive Model & Export to ONNX (Optional)**
   A pre-trained model `models/predictive_model.onnx` is already provided, but if you wish to retrain it, run:
   ```bash
   # Build virtual environment and install dependencies
   cd packages/training
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt

   # Train and export model
   python train.py
   ```

4. **Build**
   Build the TypeScript code and React assets.
   ```bash
   pnpm build
   ```

---

## 5. Running the Application

To run the CHORA loop and observe it on the real-time visualization dashboard, run the following three processes simultaneously (or in separate terminals).

### 1. Start Telemetry Server (Port 3001)
```bash
pnpm --filter @chora/server start
```

### 2. Start Visualization UI (Port 3000)
Start the Vite dev server.
```bash
pnpm --filter @chora/web dev
```

### 3. Start CLI Core Loop
Start the second-by-second simulation and LLM naming process.
```bash
pnpm --filter @chora/cli start
```

Once running, open **`http://localhost:3000/`** in your browser to access the real-time visualization:
- **Pulse Stream View**: Recharts time-series plot comparing predicted signals (dotted lines) and actual values (solid lines).
- **Surprise Heatmap**: A history tracker showing the magnitude of prediction errors.
- **Naming Cloud**: A word cloud representing active sensory memories, scaled by frequency (size) and opacity (decay/confidence).
- **Self-Model Map**: An SVG map projecting 4D sensory patterns into 2D space, connecting semantically close namings with edges (lines).
- **Timeline**: A chronological list of sensory naming and qualitative descriptions by the LLM.

---

## 6. License

- **Program Code**: [MIT License](LICENSE)
- **Documentation and Specifications**: [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/)

---

# CHORA (日本語)

> **"In the chora, before the name, the pulse waits to be heard."**  
> *コーラの中で、名前を持つ前のパルスが、聞かれることを待っている。*

CHORA（コーラ）は、**「未分化の身体信号から言語的翻訳を通じて自己意識が立ち上がるプロセス」**をシミュレートする研究・実験的ソフトウェアプロジェクトです。

伝統的なAIが言語（記号）から出発するのに対し、CHORAは無意味なパルス列（身体信号）から出発し、それを予測し、予測誤差（驚き）が生じた部分をLLMによって命名・記述させ、その命名を記憶・自然淘汰させるループを回すことで、自己意識がどのように構築されるかを観察します。

---

## 1. 中核仮説

意識は、未分化の内受容（身体）信号の予測誤差に対して、**「これは何か」と問い続け、名前を与え、カテゴライズする自己組織的な翻訳ループの副産物**として生じる。

```
 身体パルス (Layer 0) 
       ↓
 予測誤差の計算 (Layer 1) ── [驚きが閾値を超過]
       ↓
 LLMによる感覚命名 (Layer 2)
       ↓
 自己モデル記憶・忘却 (Layer 3) ── [自己感覚の構築]
```

---

## 2. アーキテクチャ：四層構造

CHORAは以下の4つの独立した層で設計・実装されています。

1. **Layer 0: Pulse Generator (身体信号源)**
   - 時間相関を持つ4次元ベクトル（ホルモン変動、ストレス状態、オキシトシン、セロトニン等をシミュレート）を毎秒連続生成します。
2. **Layer 1: Predictive Model (予測モデル層)**
   - 過去32ステップの履歴を元に、Python/PyTorchで学習・エクスポートした軽量GRUのONNXモデルを介して次のパルスを予測。実測値との誤差（RMSE）を「驚き（Surprise）」として算出します。
3. **Layer 2: Translation Loop (翻訳ループ層)**
   - 驚きが閾値を超えた時、ローカルLLM（Ollama）を呼び出し、過去の命名履歴をコンテキストに含めながら「現在の内受容感覚」に新しい名前を付与、または既存の名前を再利用します。
4. **Layer 3: Self-Naming Memory (自己モデルメモリ層)**
   - 命名されたラベルと4DベクトルパターンをSQLiteに保存。似たパターンに対してはEuclidean距離で検索し、再利用された名前は「強化（Reference Count上昇）」されます。また、50サイクルごとに自信度（Confidence）が「減衰（記憶の自然淘汰）」し、閾値未満になると忘れられます。

---

## 3. モノレポ・パッケージ構成

本プロジェクトは `pnpm` ワークスペースによるモノレポ構成を採用しています。

```
chora/
├── packages/
│   ├── core/         # コアモジュール (Pulse, ONNX 推論, SQLite DB, MemoryManager)
│   ├── cli/          # コマンドライン実行ループランナー
│   ├── server/       # テレメトリ配信用 Express WebSocket API サーバー (Port: 3001)
│   ├── web/          # React + Vite 可視化ダッシュボード (Port: 3000)
│   └── training/     # Python による GRU 予測モデルの学習および ONNX エクスポート
├── models/           # 学習済み ONNX モデル (.onnx)
├── data/             # SQLite データベースファイル (.db)
└── docs/             # 設計仕様書および解説書
```

---

## 4. クイックスタート

### 4.1 前提条件
- **Node.js**: v22.5.0以上 (Node v24 推奨)
- **Python**: 3.10以上
- **pnpm**: パッケージマネージャー
- **Ollama**: ローカルLLM環境が起動していること

### 4.2 セットアップ

1. **リポジトリの依存関係のインストール**
   ```bash
   pnpm install
   ```

2. **Ollamaモデルの準備**
   Ollamaが起動している状態で、デフォルトのLLMモデル（`llama3`）をダウロードします。
   ```bash
   ollama pull llama3
   ```

3. **予測モデルの学習とONNXエクスポート (任意)**
   すでに `models/predictive_model.onnx` が存在しますが、再学習したい場合は以下を実行します：
   ```bash
   # 仮想環境の構築と依存インストール
   cd packages/training
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt

   # モデルの学習と書き出し
   python train.py
   ```

4. **ビルドの実行**
   TypeScriptコードおよびReactアセットのビルドを行います。
   ```bash
   pnpm build
   ```

---

## 5. 実行方法

CHORAのループを動かし、ブラウザでリアルタイム可視化ダッシュボードを観察するには、以下の3つのプロセスを同時に（または個別のターミナルで）実行します。

### 1. テレメトリサーバーの起動 (Port 3001)
```bash
pnpm --filter @chora/server start
```

### 2. ビジュアライゼーションUIの起動 (Port 3000)
Viteの開発サーバーを起動します。
```bash
pnpm --filter @chora/web dev
```

### 3. CLI コアループの起動
毎秒のシミュレーションとLLM命名プロセスを開始します。
```bash
pnpm --filter @chora/cli start
```

起動後、ブラウザで **`http://localhost:3000/`** を開くと、以下のリアルタイム可視化画面にアクセスできます：
- **Pulse Stream View**: 予測信号（点線）と実測値（実線）の時系列Rechartsプロット
- **Surprise Heatmap**: 予測誤差の大きさのヒストリートラック
- **Naming Cloud**: アクティブな感覚記憶の大きさ（使用頻度）と不透明度（信頼性減衰度）を表現したワードクラウド
- **Self-Model Map**: 4次元の感覚パターンを2次元に射影し、意味的な近さで線（エッジ）を繋いだクラスタリングSVGマップ
- **Timeline**: LLMによる感覚命名・質感記述ログの一覧

---

## 6. ライセンス

- **プログラムコード**: [MIT License](LICENSE)
- **ドキュメントおよび仕様書**: [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/)
