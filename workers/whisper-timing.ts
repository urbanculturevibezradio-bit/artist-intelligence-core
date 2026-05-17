// ============================================================
// workers/whisper-timing.ts — Onset, phrase timing & breath spacing worker
// ============================================================
import { Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel } from '@/lib/schemas';
import type { WhisperTimingResult, OnsetEvent, PhraseSegment } from '@/types/pipeline';

interface WhisperTimingPayload {
  jobId: string;
  filePath: string;
}

/**
 * Simulates onset/phrase extraction. In production, replace with:
 * - librosa (Python micro-service) via HTTP
 * - or aubio/essentia WASM bindings
 * - or OpenAI Whisper API with timestamp_granularities=['word','segment']
 */
async function extractWhisperTiming(filePath: string, jobId: string): Promise<WhisperTimingResult> {
  // --- In production: call Python DSP service or Whisper API ---
  // Example call to Python service:
  // const resp = await axios.post(process.env.DSP_SERVICE_URL + '/onset', { filePath });

  // Placeholder: generate representative structure
  const durationMs = 16000; // Assume 16s clip
  const onsets: OnsetEvent[] = [];
  let timeMs = 0;
  let lastBreath = 0;

  // Simulate 60 onsets over the duration
  while (timeMs < durationMs) {
    const isBreath = Math.random() < 0.07; // ~7% chance
    onsets.push({
      timeMs,
      strength: 0.4 + Math.random() * 0.6,
      isBreath,
    });
    if (isBreath) lastBreath = timeMs;
    timeMs += 80 + Math.floor(Math.random() * 320);
  }

  // Build breath spacing array
  const breathEvents = onsets.filter((o) => o.isBreath);
  const breathSpacing: number[] = [];
  for (let i = 1; i < breathEvents.length; i++) {
    breathSpacing.push(breathEvents[i].timeMs - breathEvents[i - 1].timeMs);
  }

  // Approximate phrases (every ~4 bars at 120bpm = every 8000ms)
  const phrases: PhraseSegment[] = [
    { startMs: 0, endMs: 4000, label: 'verse', syllableCount: 32 },
    { startMs: 4000, endMs: 8000, label: 'hook', syllableCount: 20 },
    { startMs: 8000, endMs: 12000, label: 'verse', syllableCount: 34 },
    { startMs: 12000, endMs: 16000, label: 'bridge', syllableCount: 18 },
  ];

  // Tempo estimate from onset density
  const tempoEstimate = Math.round(onsets.length / (durationMs / 60000));

  return {
    jobId,
    durationMs,
    onsets,
    phrases,
    breathSpacing,
    tempoEstimate,
  };
}

// ---- BullMQ Worker ----
export function startWhisperTimingWorker() {
  return createWorker<WhisperTimingPayload, WhisperTimingResult>(
    'whisper-timing',
    async (job: Job<WhisperTimingPayload>): Promise<WhisperTimingResult> => {
      const { jobId, filePath } = job.data;
      console.log(`[whisper-timing] Processing job ${jobId}`);

      await job.updateProgress(10);

      const result = await extractWhisperTiming(filePath, jobId);

      await job.updateProgress(80);

      // Persist results to MongoDB pipeline state
      await connectToDatabase();
      const PipelineState = PipelineStateModel();
      await PipelineState.findOneAndUpdate(
        { jobId },
        {
          $set: { 'results.whisperTiming': result },
          $addToSet: { completedWorkers: 'whisper-timing' },
          status: 'processing',
        },
        { upsert: true }
      );

      await job.updateProgress(100);
      console.log(`[whisper-timing] Completed job ${jobId}`);
      return result;
    },
    2
  );
}
