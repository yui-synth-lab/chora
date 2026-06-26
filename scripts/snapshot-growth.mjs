/**
 * CHORA growth snapshot exporter
 *
 * Captures a comparable snapshot of DB growth state for cross-instance comparison.
 * Run identically on each machine when unique_names crosses the target threshold
 * (default 3000), then diff/compare the resulting JSON files.
 *
 * Usage:
 *   node scripts/snapshot-growth.mjs [outputPath] [--threshold=3000]
 */

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dbPath = path.join(root, 'data', 'chora.db');

const args = process.argv.slice(2);
const thresholdArg = args.find(a => a.startsWith('--threshold='));
const threshold = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 3000;
const outPath = args.find(a => !a.startsWith('--')) ||
  path.join(root, `snapshot-${hostname()}-${Date.now()}.json`);

const db = new DatabaseSync(dbPath);

function dist(col) {
  const buckets = [];
  for (let i = 0; i < 10; i++) {
    const lo = i / 10, hi = (i + 1) / 10;
    const n = db.prepare(`SELECT COUNT(*) c FROM pulses WHERE ${col}>=? AND ${col}<?`).get(lo, hi).c;
    buckets.push(n);
  }
  const stats = db.prepare(`SELECT AVG(${col}) avg, MIN(${col}) mn, MAX(${col}) mx FROM pulses`).get();
  return { avg: stats.avg, min: stats.mn, max: stats.mx, buckets };
}

const ss = db.prepare('SELECT * FROM system_state').get();
const totalNamings = db.prepare('SELECT COUNT(*) c FROM namings').get().c;
const activeCount = db.prepare('SELECT COUNT(*) c FROM namings WHERE forgotten=0').get().c;
const forgottenCount = db.prepare('SELECT COUNT(*) c FROM namings WHERE forgotten=1').get().c;

const topActive = db.prepare(
  'SELECT name, confidence, reference_count, created_at FROM namings WHERE forgotten=0 ORDER BY reference_count DESC LIMIT 50'
).all();

const topForgotten = db.prepare(
  'SELECT name, confidence, reference_count FROM namings WHERE forgotten=1 ORDER BY reference_count DESC LIMIT 30'
).all();

const surprise = db.prepare('SELECT AVG(surprise) avg, MIN(surprise) mn, MAX(surprise) mx FROM predictions').get();
const triggered = db.prepare('SELECT COUNT(*) c FROM predictions WHERE triggered_translation=1').get().c;
const totalPred = db.prepare('SELECT COUNT(*) c FROM predictions').get().c;

// naming creation rate (ms per name, over last 200)
const recentNamings = db.prepare('SELECT created_at FROM namings ORDER BY id DESC LIMIT 200').all();
let msPerName = null;
if (recentNamings.length >= 2) {
  const oldest = recentNamings[recentNamings.length - 1].created_at;
  const newest = recentNamings[0].created_at;
  msPerName = (newest - oldest) / (recentNamings.length - 1);
}

const snapshot = {
  meta: {
    hostname: hostname(),
    exportedAt: new Date().toISOString(),
    thresholdTarget: threshold,
    thresholdReached: ss.unique_names >= threshold,
  },
  system_state: ss,
  growth: {
    total_namings_born: totalNamings,
    active: activeCount,
    forgotten: forgottenCount,
    forgottenRate: totalNamings > 0 ? forgottenCount / totalNamings : 0,
    msPerNameRecent: msPerName,
  },
  signals: {
    signal_a: dist('signal_a'),
    signal_b: dist('signal_b'),
    signal_c: dist('signal_c'),
    signal_d: dist('signal_d'),
  },
  surprise: {
    avg: surprise.avg,
    min: surprise.mn,
    max: surprise.mx,
    triggeredCount: triggered,
    totalPredictions: totalPred,
    triggerRate: totalPred > 0 ? triggered / totalPred : 0,
  },
  vocabulary: {
    topActive,
    topForgotten,
  },
};

writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');

console.log(`Snapshot written to: ${outPath}`);
console.log(`unique_names: ${ss.unique_names} / threshold ${threshold} (${snapshot.meta.thresholdReached ? 'REACHED' : 'not yet'})`);
console.log(`active=${activeCount} forgotten=${forgottenCount} (${(snapshot.growth.forgottenRate*100).toFixed(1)}% forgotten)`);
console.log(`top vocab: ${topActive.slice(0, 5).map(n => `"${n.name}"(ref=${n.reference_count})`).join(', ')}`);
