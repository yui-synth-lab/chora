import { existsSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const root = fileURLToPath(new URL('..', import.meta.url));
const dbPath = join(root, 'data', 'chora.db');

if (!existsSync(dbPath)) {
  console.log('データベースが見つかりません。リセット不要です。');
  process.exit(0);
}

const stats = statSync(dbPath);
const sizeMb = (stats.size / 1024 / 1024).toFixed(2);

console.log(`対象: ${dbPath}`);
console.log(`サイズ: ${sizeMb} MB`);
console.log('');
console.log('⚠️  すべてのパルス、予測、命名、翻訳イベントが削除されます。');

const force = process.argv.includes('--force') || process.argv.includes('-f');

if (force) {
  rmSync(dbPath);
  console.log('データベースをリセットしました。次回起動時に新規作成されます。');
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('本当にリセットしますか？ [y/N] ', answer => {
  rl.close();
  if (answer.toLowerCase() === 'y') {
    rmSync(dbPath);
    console.log('データベースをリセットしました。次回起動時に新規作成されます。');
  } else {
    console.log('キャンセルしました。');
  }
});
