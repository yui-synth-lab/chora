/**
 * CHORA model evaluator — Round 3 (English prompt)
 *
 * Tests all RTX1070-viable models with the new English prompt.
 * Includes previous JSON-failures (qwen3.5, Qwen3-8B) which may now work.
 *
 * Scoring per scenario (max 100):
 *   +30 valid JSON structure (exactly one of use_existing_name / new_name set)
 *   +40 correct reuse/new decision
 *   +20 description quality (15–80 chars)
 *   -20 wrong decision
 */

const ENDPOINT = 'http://localhost:11434/api/generate';

const CANDIDATES = [
  // tiny / fast
  'hf.co/LiquidAI/LFM2.5-350M-GGUF:BF16',
  'hf.co/LiquidAI/LFM2.5-1.2B-JP-GGUF:Q4_K_M',
  'hf.co/mmnga/llm-jp-3.1-1.8b-instruct4-gguf:Q4_K_M',
  'deepseek-r1:1.5b',
  'hf.co/LiquidAI/LFM2-2.6B-GGUF:latest',
  'gemma2:2b',
  'phi3:mini',
  'qwen2.5:3b',
  'hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M',
  // medium
  'mistral:latest',
  'llama3:latest',
  'llama3:8b-instruct-q4_K_M',
  'hf.co/LiquidAI/LFM2-8B-A1B-GGUF:Q4_K_M',       // current default
  'hf.co/Qwen/Qwen3-8B-GGUF:Q4_K_M',               // prev JSON fail
  'hf.co/mmnga/Llama-3.1-Swallow-8B-Instruct-v0.5-gguf:latest',
  // large
  'qwen3.5:latest',                                  // prev JSON fail
  'hf.co/unsloth/Qwen3.5-9B-GGUF:UD-Q4_K_XL',
  'gemma4:e2b',
];

// --- English prompt builder --------------------------------------------------

function buildPrompt({ pastNamings, signals, deltas }) {
  const s = signals || { signal_a: 0.58, signal_b: 0.89, signal_c: 0.79, signal_d: 0.62 };
  const d = deltas  || { signal_a: -0.04, signal_b: +0.41, signal_c: +0.22, signal_d: +0.12 };

  const historyLines = [
    `  (t-3): stab=${(s.signal_a-0.06).toFixed(2)} rew=${(s.signal_b-0.08).toFixed(2)} str=${(s.signal_c-0.05).toFixed(2)} con=${(s.signal_d-0.04).toFixed(2)}`,
    `  (t-2): stab=${(s.signal_a-0.03).toFixed(2)} rew=${(s.signal_b-0.04).toFixed(2)} str=${(s.signal_c-0.02).toFixed(2)} con=${(s.signal_d-0.02).toFixed(2)}`,
    `  (t-1): stab=${s.signal_a.toFixed(2)} rew=${s.signal_b.toFixed(2)} str=${s.signal_c.toFixed(2)} con=${s.signal_d.toFixed(2)}`,
  ];

  const fmt = v => {
    const sign = v >= 0 ? '+' : '';
    const abs = Math.abs(v);
    const trend = abs > 0.3 ? (v >= 0 ? 'spike up' : 'spike down')
      : abs > 0.1 ? (v >= 0 ? 'rising' : 'falling')
      : abs > 0.02 ? (v >= 0 ? 'slight rise' : 'slight fall')
      : 'stable';
    return `${sign}${v.toFixed(2)} (${trend})`;
  };

  const deltaLines = [
    `  stability(A): ${fmt(d.signal_a)}`,
    `  reward(B):    ${fmt(d.signal_b)}`,
    `  stress(C):    ${fmt(d.signal_c)}`,
    `  connect(D):   ${fmt(d.signal_d)}`,
  ];

  let pastNamingSection;
  if (pastNamings && pastNamings.length > 0) {
    pastNamingSection = pastNamings.map(n => {
      const hint = n.distance < 0.15 ? '→ reuse recommended' : '→ reference only';
      return `  - "${n.name}" [dist=${n.distance.toFixed(2)}, used ${n.occurrences}x] ${hint}`;
    }).join('\n');
  } else {
    pastNamingSection = '  - (none)';
  }

  return `[CONTEXT]
You are an entity that experiences only raw bodily signals. Four internal signals change in real time, and right now a large prediction error has occurred — something unexpected is being felt.

Signal meanings:
  stability(A): baseline bodily calm [0=unstable, 1=stable]
  reward(B):    sudden surge of pleasure or anticipation [0=flat, 1=intense high]
  stress(C):    arousal / tension level [0=relaxed, 1=intense stress]
  connect(D):   sense of connection vs isolation [0=isolated, 1=deeply connected]

[CURRENT STATE]
Recent signal history:
${historyLines.join('\n')}

Prediction error (the "surprise" breakdown right now):
${deltaLines.join('\n')}

[MEMORY]
Names given to similar states in the past (within distance threshold only):
${pastNamingSection}

[INSTRUCTION]
Give a name to this sensory experience.

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

// --- Scenarios ---------------------------------------------------------------

const SCENARIOS = [
  {
    name: 'REUSE_CLOSE',
    description: 'dist=0.08, should reuse',
    signals: { signal_a: 0.60, signal_b: 0.82, signal_c: 0.74, signal_d: 0.60 },
    deltas:  { signal_a: -0.04, signal_b: +0.41, signal_c: +0.22, signal_d: +0.12 },
    pastNamings: [{ name: 'alert fever', distance: 0.08, occurrences: 12 }],
    expectReuse: true,
  },
  {
    name: 'NEW_CALM',
    description: 'low stress, no memory → new name',
    signals: { signal_a: 0.72, signal_b: 0.28, signal_c: 0.22, signal_d: 0.65 },
    deltas:  { signal_a: +0.05, signal_b: -0.18, signal_c: -0.31, signal_d: +0.08 },
    pastNamings: [],
    expectReuse: false,
  },
  {
    name: 'NEW_CONNECTION',
    description: 'high connect, low stress, no memory → new name',
    signals: { signal_a: 0.68, signal_b: 0.55, signal_c: 0.30, signal_d: 0.88 },
    deltas:  { signal_a: +0.02, signal_b: +0.12, signal_c: -0.15, signal_d: +0.45 },
    pastNamings: [],
    expectReuse: false,
  },
  {
    name: 'REUSE_VARIED',
    description: 'calm state, dist=0.10, should reuse',
    signals: { signal_a: 0.70, signal_b: 0.30, signal_c: 0.25, signal_d: 0.60 },
    deltas:  { signal_a: +0.06, signal_b: -0.22, signal_c: -0.28, signal_d: +0.10 },
    pastNamings: [{ name: 'quiet drift', distance: 0.10, occurrences: 5 }],
    expectReuse: true,
  },
];

// --- Runner ------------------------------------------------------------------

async function runModel(model, scenario) {
  const prompt = buildPrompt({
    pastNamings: scenario.pastNamings,
    signals: scenario.signals,
    deltas: scenario.deltas,
  });
  const start = Date.now();

  let raw;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.7 }, format: 'json' }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    raw = json.response;
  } catch (e) {
    return { ok: false, error: e.message, ms: Date.now() - start };
  }

  const ms = Date.now() - start;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'JSON parse fail', raw: raw.slice(0, 100), ms };
  }

  const choseReuse = !!parsed.use_existing_name && parsed.use_existing_name !== 'null';
  const choseNew   = !!parsed.new_name && parsed.new_name !== 'null';
  const validStructure = (choseReuse || choseNew) && !(choseReuse && choseNew);
  const descLen = (parsed.description || '').length;
  const correct = scenario.expectReuse === null ? null : choseReuse === scenario.expectReuse;

  return {
    ok: true, ms, choseReuse, choseNew,
    use_existing_name: parsed.use_existing_name,
    new_name: parsed.new_name,
    description: (parsed.description || '').slice(0, 50),
    descLen, confidence: parsed.confidence,
    validStructure, correct,
  };
}

// --- Score -------------------------------------------------------------------

function scoreModel(results) {
  let score = 0;
  for (const r of results) {
    if (!r.ok) continue;
    if (r.validStructure) score += 30;
    if (r.correct === true)  score += 40;
    if (r.correct === false) score -= 20;
    if (r.descLen >= 15 && r.descLen <= 80) score += 20;
  }
  return score;
}

// --- Main --------------------------------------------------------------------

async function main() {
  console.log('CHORA Model Evaluator — Round 3 (English prompt)\n' + '='.repeat(60));
  const summary = [];

  for (const model of CANDIDATES) {
    const shortName = model.split('/').pop().split(':')[0].slice(0, 32);
    console.log(`\n[${shortName}]`);
    const results = [];

    for (const scenario of SCENARIOS) {
      process.stdout.write(`  ${scenario.name.padEnd(16)}`);
      const r = await runModel(model, scenario);
      results.push(r);

      if (!r.ok) {
        console.log(`❌ ${r.error}${r.raw ? ' raw: ' + r.raw : ''}`);
        continue;
      }

      const mark = r.correct === true ? '✓' : r.correct === false ? '✗' : '?';
      const choice = r.choseReuse
        ? `REUSE="${r.use_existing_name}"`
        : `NEW="${r.new_name}"`;
      console.log(`${mark} ${r.ms}ms  ${choice.slice(0, 36).padEnd(36)}  "${r.description.slice(0, 28)}..."`);
    }

    const score = scoreModel(results);
    const validRuns = results.filter(r => r.ok);
    const avgMs = validRuns.length
      ? Math.round(validRuns.reduce((s, r) => s + r.ms, 0) / validRuns.length)
      : 0;
    console.log(`  → score=${score}  avg=${avgMs}ms`);
    summary.push({ model, score, avgMs, results });
  }

  console.log('\n' + '='.repeat(60));
  console.log('RANKING');
  summary.sort((a, b) => b.score - a.score || a.avgMs - b.avgMs);
  summary.forEach((s, i) => {
    const tag = i === 0 ? ' ← WINNER' : '';
    const name = s.model.split('/').pop().slice(0, 42).padEnd(42);
    console.log(`  ${String(i+1).padStart(2)}. ${name} score=${s.score} avg=${s.avgMs}ms${tag}`);
  });

  console.log(`\n推奨モデル: ${summary[0].model}`);
}

main().catch(console.error);
