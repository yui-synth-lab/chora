import { ChoraDatabase, PulseGenerator } from '@chora/core';
import * as path from 'path';

function createBar(val: number, length = 10): string {
  const filledCount = Math.round(val * length);
  const filled = '█'.repeat(filledCount);
  const empty = '░'.repeat(length - filledCount);
  return `[${filled}${empty}]`;
}

async function main() {
  const dbPath = path.join(process.cwd(), 'data', 'chora.db');
  console.log(`Initializing CHORA Database at: ${dbPath}`);
  
  const db = new ChoraDatabase(dbPath);
  const generator = new PulseGenerator();

  console.log('\n--- CHORA Pulse Generator (Layer 0) Started ---');
  console.log('Press Ctrl+C to terminate loop.\n');

  const intervalMs = 1000;
  
  const tick = () => {
    try {
      const timestamp = Date.now();
      db.incrementCycleCount();
      
      const state = db.getSystemState();
      const pulse = generator.generate(timestamp);
      
      db.insertPulse(pulse);

      const formattedA = pulse.signal_a.toFixed(2);
      const formattedB = pulse.signal_b.toFixed(2);
      const formattedC = pulse.signal_c.toFixed(2);
      const formattedD = pulse.signal_d.toFixed(2);

      const barA = createBar(pulse.signal_a);
      const barB = createBar(pulse.signal_b);
      const barC = createBar(pulse.signal_c);
      const barD = createBar(pulse.signal_d);

      console.log(
        `Cycle #${state.cycle_count.toString().padEnd(4)} | ` +
        `A: ${formattedA} ${barA} | ` +
        `B: ${formattedB} ${barB} | ` +
        `C: ${formattedC} ${barC} | ` +
        `D: ${formattedD} ${barD}`
      );
    } catch (err) {
      console.error('Error during cycle tick:', err);
    }
  };

  tick();
  const timer = setInterval(tick, intervalMs);

  process.on('SIGINT', () => {
    clearInterval(timer);
    db.close();
    console.log('\nDatabase closed. CHORA terminated safely.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
