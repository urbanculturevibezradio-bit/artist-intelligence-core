// ============================================================
// workers/bpm-groove.ts — BPM, swing, syncopation, downbeat detection
// ============================================================
import { Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel } from '@/lib/schemas';
import type { BpmGrooveResult, DownbeatEvent, GrooveType } from '@/types/pipeline';

interface BpmGroovePayload {
  jobId: string;
  filePath: string;
  tempoHint?: number; // optional hint from whisper-timing
}

// ---- Beat analysis helpers ----

function detectBPM(onsetTimesMs: number[]): number {
  if (onsetTimesMs.length < 4) return 120;

  // Compute inter-onset intervals
  const iois: number[] = [];
  for (let i = 1; i < onsetTimesMs.length; i++) {
    iois.push(onsetTimesMs[i] - onsetTimesMs[i - 1]);
  }

  // Build IOI histogram (bins of 5ms width)
  const histogram: Record<number, number> = {};
  for (const ioi of iois) {
    const bin = Math.round(ioi / 5) * 5;
    histogram[bin] = (histogram[bin] || 0) + 1;
  }

  // Find dominant IOI
  let bestBin = 500; // default 120 BPM
  let bestCount = 0;
  for (const [bin, count] of Object.entries(histogram)) {
    if (count > bestCount) {
      bestCount = count;
      bestBin = Number(bin);
    }
  }

  // Convert ms period to BPM
  const bpm = Math.round(60000 / bestBin);
  // Clamp to musical range 60–200
  return Math.max(60, Math.min(200, bpm));
}

function computeSwingRatio(onsetTimesMs: number[], bpm: number): number {
  const beatMs = 60000 / bpm;
  const eighthMs = beatMs / 2;
  const swingDelays: number[] = [];

  for (let i = 0; i < onsetTimesMs.length - 1; i++) {
    const ioi = onsetTimesMs[i + 1] - onsetTimesMs[i];
    const phase = (ioi % eighthMs) / eighthMs;
    if (phase > 0.1 && phase < 0.9) swingDelays.push(phase);
  }

  if (swingDelays.length === 0) return 0.5;
  return swingDelays.reduce((a, b) => a + b, 0) / swingDelays.length;
}

function computeSyncopation(onsetTimesMs: number[], bpm: number): number {
  const beatMs = 60000 / bpm;
  let syncopatedCount = 0;

  for (const t of onsetTimesMs) {
    const posInBeat = (t % beatMs) / beatMs;
    // Syncopated = onset falls between beat 1/4 and 3/4 of a beat
    if (posInBeat > 0.2 && posInBeat < 0.8) syncopatedCount++;
  }

  return syncopatedCount / Math.max(onsetTimesMs.length, 1);
}

function classifyGroove(swingRatio: number, bpm: number, syncopation: number): GrooveType {
  if (bpm < 75) return 'half-time';
  if (bpm > 150) return 'double-time';
  if (swingRatio > 0.63) return 'shuffle';
  if (swingRatio > 0.58) return 'swing';
  return 'straight';
}

function extractDownbeats(bpm: number, durationMs: number): DownbeatEvent[] {
  const beatMs = 60000 / bpm;
  const barMs = beatMs * 4; // 4/4 time
  const downbeats: DownbeatEvent[] = [];
  let timeMs = 0;
  let barNumber = 1;

  while (timeMs < durationMs) {
    downbeats.push({
      timeMs,
      barNumber,
      confidence: 0.75 + Math.random() * 0.25,
    });
    timeMs += barMs;
    barNumber++;
  }

  return downbeats;
}

// ---- Main analysis ----
async function analyzeBpmGroove(
  filePath: string,
  jobId: string,
  tempoHint?: number
): Promise<BpmGrooveResult> {
  // In production: call essentia / madmom Python service or librosa BPM tracker
  // const resp = await axios.post(process.env.DSP_SERVICE_URL + '/bpm', { filePath });

  const durationMs = 16000;

  // Simulate onsets (in production these come from whisper-timing results)
  const simulatedBpm = tempoHint ?? (80 + Math.floor(Math.random() * 80)); // 80–160 BPM range
  const beatMs = 60000 / simulatedBpm;
  const onsetTimesMs: number[] = [];
  let t = 0;
  while (t < durationMs) {
    onsetTimesMs.push(t + (Math.random() * 20 - 10)); // slight jitter
    t += beatMs / 2; // 8th notes
  }

  const bpm = detectBPM(onsetTimesMs);
  const swingRatio = computeSwingRatio(onsetTimesMs, bpm);
  const syncopation = computeSyncopation(onsetTimesMs, bpm);
  const grooveType = classifyGroove(swingRatio, bpm, syncopation);
  const downbeats = extractDownbeats(bpm, durationMs);

  return {
    jobId,
    bpm,
    bpmConfidence: 0.7 + Math.random() * 0.3,
    grooveType,
    swingRatio,
    syncopation,
    downbeats,
    timeSignature: '4/4',
  };
}

// ---- BullMQ Worker ----
export function startBpmGrooveWorker() {
  return createWorker<BpmGroovePayload, BpmGrooveResult>(
    'bpm-groove',
    async (job: Job<BpmGroovePayload>): Promise<BpmGrooveResult> => {
      const { jobId, filePath, tempoHint } = job.data;
      console.log(`[bpm-groove] Processing job ${jobId}`);

      await job.updateProgress(10);
      const result = await analyzeBpmGroove(filePath, jobId, tempoHint);
      await job.updateProgress(80);

      await connectToDatabase();
      const PipelineState = PipelineStateModel();
      await PipelineState.findOneAndUpdate(
        { jobId },
        {
          $set: { 'results.bpmGroove': result },
          $addToSet: { completedWorkers: 'bpm-groove' },
        },
        { upsert: true }
      );

      await job.updateProgress(100);
      console.log(`[bpm-groove] Completed job ${jobId}: ${result.bpm} BPM, ${result.grooveType}`);
      return result;
    },
    2
  );
}
