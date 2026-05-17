// ============================================================
// workers/whisper-timing.ts - Onset, phrase timing & breath spacing worker
// ============================================================
import { Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel } from '@/lib/schemas';
import type { WhisperTimingResult, OnsetEvent, PhraseSegment } from '@/types/pipeline';
import { analyseFlowPattern } from '../lib/flowPatterns';
import { buildPocketMap } from '../lib/pocketMap';

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
  const durationMs = 16000;
  const onsets: OnsetEvent[] = [];
  let timeMs = 0;

  while (timeMs < durationMs) {
    const isBreath = Math.random() < 0.07;
    onsets.push({ timeMs, strength: 0.4 + Math.random() * 0.6, isBreath });
    timeMs += 80 + Math.floor(Math.random() * 320);
  }

  const breathEvents = onsets.filter(o => o.isBreath);
  const breathSpacing: number[] = [];
  for (let i = 1; i < breathEvents.length; i++) {
    breathSpacing.push(breathEvents[i].timeMs - breathEvents[i-1].timeMs);
  }

  const phrases: PhraseSegment[] = [
    { startMs: 0,     endMs: 4000,  label: 'verse',  syllableCount: 32 },
    { startMs: 4000,  endMs: 8000,  label: 'hook',   syllableCount: 20 },
    { startMs: 8000,  endMs: 12000, label: 'verse',  syllableCount: 34 },
    { startMs: 12000, endMs: 16000, label: 'bridge', syllableCount: 18 },
  ];

  const tempoEstimate = Math.round(onsets.length / (durationMs / 60000));

  return {
    jobId,
    onsets: onsets.map(o => o.timeMs / 1000),
    breathSpacing,
    phrases: phrases.map(p => ({
      startSec: p.startMs / 1000,
      endSec: p.endMs / 1000,
      label: p.label,
      syllableCount: p.syllableCount,
      hasBreathAfter: true,
    })),
    tempoEstimate,
    rawOnsets: onsets,
    rawPhrases: phrases,
    processedAt: new Date(),
  };
}

export const whisperTimingWorker = createWorker<WhisperTimingPayload>(
  'whisper-timing',
  async (job: Job<WhisperTimingPayload>) => {
    const { jobId, filePath } = job.data;
    await connectToDatabase();

    await PipelineStateModel.findOneAndUpdate(
      { jobId },
      { $set: { 'stages.whisperTiming': 'processing' } },
      { upsert: true },
    );

    const result = await extractWhisperTiming(filePath, jobId);

    // Persist timing result
    await PipelineStateModel.findOneAndUpdate(
      { jobId },
      { $set: { whisperTiming: result, 'stages.whisperTiming': 'completed' } },
      { upsert: true },
    );

    // If BPM/groove data already exists, compute and persist flow + pocket map
    const state = await PipelineStateModel.findOne({ jobId });
    if (state?.bpmGroove) {
      const flow = analyseFlowPattern(jobId, result, state.bpmGroove);
      const pocketMap = buildPocketMap(jobId, flow, state.bpmGroove);
      await PipelineStateModel.findOneAndUpdate(
        { jobId },
        { $set: { flowPattern: flow, pocketMap } },
      );
    }

    return result;
  },
);
