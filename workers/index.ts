// ============================================================
// workers/index.ts — Worker runner entry point
// Run with: npx ts-node workers/index.ts
// ============================================================
import { startWhisperTimingWorker } from './whisper-timing';
import { startMelodyExtractionWorker } from './melody-extraction';
import { startBpmGrooveWorker } from './bpm-groove';
import { startStyleClassifierWorker } from './style-classifier';
import { startRiddimGeneratorWorker } from './riddim-generator';
import { startStemAssemblerWorker } from './stem-assembler';
import { startFingerprintValidatorWorker } from './fingerprint-validator';

console.log('🔥 Starting Hum-to-Riddim Pipeline Workers...');

const workers = [
  { name: 'whisper-timing', start: startWhisperTimingWorker },
  { name: 'melody-extraction', start: startMelodyExtractionWorker },
  { name: 'bpm-groove', start: startBpmGrooveWorker },
  { name: 'style-classifier', start: startStyleClassifierWorker },
  { name: 'riddim-generator', start: startRiddimGeneratorWorker },
  { name: 'stem-assembler', start: startStemAssemblerWorker },
  { name: 'fingerprint-validator', start: startFingerprintValidatorWorker },
];

for (const { name, start } of workers) {
  try {
    const worker = start();
    console.log(`✅ Worker started: ${name}`);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log(`Shutting down ${name}...`);
      await worker.close();
    });
  } catch (err) {
    console.error(`❌ Failed to start worker ${name}: ${(err as Error).message}`);
    process.exit(1);
  }
}

console.log(`🎵 All ${workers.length} pipeline workers running. Listening for jobs...`);

// Keep process alive
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Exiting...');
  process.exit(0);
});
