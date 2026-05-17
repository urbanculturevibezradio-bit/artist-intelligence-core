// ============================================================
// workers/stem-assembler.ts — Stem assembly module
// Combines generated stems into a riddim package
// ============================================================
import { Job } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel, RiddimPackageModel } from '@/lib/schemas';
import type {
  RiddimPackage,
  StemFile,
  RiddimGenerationResult,
  MusicalKey,
  RiddimStyle,
} from '@/types/pipeline';

interface StemAssemblerPayload {
  jobId: string;
  filePath: string;
}

const PACKAGES_DIR = process.env.PACKAGES_DIR || '/tmp/artist-intelligence-packages';

// Ensure packages directory exists
if (!fs.existsSync(PACKAGES_DIR)) {
  fs.mkdirSync(PACKAGES_DIR, { recursive: true });
}

// ---- MIDI to WAV stub ----
// In production: use Tone.js server-side render, or call an audio render API
// (e.g., fluidsynth, timidity, or a custom Node audio server)

async function renderStemToWav(
  stemName: string,
  stemType: StemFile['type'],
  jobOutputDir: string,
  bpm: number,
  bars: number
): Promise<StemFile> {
  const sampleRate = 44100;
  const durationMs = (bars * 4 * 60000) / bpm; // bars × 4 beats × 60000ms/beat

  const stemPath = path.join(jobOutputDir, `${stemName}.wav`);

  // In production: render actual audio here
  // For scaffold: create a placeholder file with correct metadata
  const headerBuffer = createWavHeader(sampleRate, durationMs);
  fs.writeFileSync(stemPath, headerBuffer);

  return {
    name: stemName,
    path: stemPath,
    type: stemType,
    sampleRate,
    durationMs,
  };
}

/**
 * Create a minimal valid WAV header (no audio data — placeholder for scaffold)
 */
function createWavHeader(sampleRate: number, durationMs: number): Buffer {
  const numChannels = 2;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(fileSize - 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);          // PCM sub-chunk size
  buf.writeUInt16LE(1, 20);           // PCM format
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);
  buf.writeUInt16LE(bitsPerSample, 36);
  buf.write('data', 38);
  buf.writeUInt32LE(dataSize, 42);
  return buf; // No PCM data — placeholder only
}

// ---- Package manifest ----

function writeManifest(
  jobOutputDir: string,
  pkg: Omit<RiddimPackage, 'packagePath'>
): void {
  const manifestPath = path.join(jobOutputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(pkg, null, 2));
}

// ---- Main assembly ----
async function assembleStems(jobId: string): Promise<RiddimPackage> {
  // Load riddim generation results from MongoDB
  await connectToDatabase();
  const PipelineState = PipelineStateModel();
  const state = await PipelineState.findOne({ jobId });

  const riddimResult = state?.results?.riddimGeneration as RiddimGenerationResult | undefined;
  const bpm = riddimResult?.bpm ?? 96;
  const key: MusicalKey = (riddimResult?.key ?? 'A') as MusicalKey;
  const bars = riddimResult?.bars ?? 8;
  const style: RiddimStyle = (state?.results?.styleClassifier as { primaryStyle?: RiddimStyle })?.primaryStyle ?? 'dancehall';

  // Create output directory for this job
  const jobOutputDir = path.join(PACKAGES_DIR, jobId);
  if (!fs.existsSync(jobOutputDir)) {
    fs.mkdirSync(jobOutputDir, { recursive: true });
  }

  // Render each stem (in production: actual audio rendering)
  const stemDefs: Array<{ name: string; type: StemFile['type'] }> = [
    { name: 'drums_main', type: 'drums' },
    { name: 'drums_perc', type: 'perc' },
    { name: 'bass', type: 'bass' },
    { name: 'chords', type: 'chords' },
    { name: 'fx_reverb', type: 'fx' },
  ];

  const stems: StemFile[] = await Promise.all(
    stemDefs.map(({ name, type }) =>
      renderStemToWav(name, type, jobOutputDir, bpm, bars)
    )
  );

  const totalDurationMs = (bars * 4 * 60000) / bpm;

  const packageData: Omit<RiddimPackage, 'packagePath'> = {
    jobId,
    stems,
    masterBpm: bpm,
    masterKey: key,
    style,
    createdAt: new Date(),
    totalDurationMs,
  };

  writeManifest(jobOutputDir, packageData);

  const pkg: RiddimPackage = {
    ...packageData,
    packagePath: jobOutputDir,
  };

  // Persist to MongoDB
  const RiddimPackageM = RiddimPackageModel();
  await RiddimPackageM.findOneAndUpdate({ jobId }, pkg, { upsert: true, new: true });

  return pkg;
}

// ---- BullMQ Worker ----
export function startStemAssemblerWorker() {
  return createWorker<StemAssemblerPayload, RiddimPackage>(
    'stem-assembler',
    async (job: Job<StemAssemblerPayload>): Promise<RiddimPackage> => {
      const { jobId } = job.data;
      console.log(`[stem-assembler] Processing job ${jobId}`);

      await job.updateProgress(10);
      const result = await assembleStems(jobId);
      await job.updateProgress(85);

      const PipelineState = PipelineStateModel();
      await PipelineState.findOneAndUpdate(
        { jobId },
        {
          $set: { 'results.stemAssembler': result },
          $addToSet: { completedWorkers: 'stem-assembler' },
        },
        { upsert: true }
      );

      await job.updateProgress(100);
      console.log(`[stem-assembler] Completed job ${jobId}: ${result.stems.length} stems at ${result.packagePath}`);
      return result;
    },
    1
  );
}
