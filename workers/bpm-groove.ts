// ============================================================
// workers/bpm-groove.ts - BPM, swing, syncopation, downbeat detection
// ============================================================
import { Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel } from '@/lib/schemas';
import type { BpmGrooveResult, DownbeatEvent, GrooveType } from '@/types/pipeline';
import { analyseFlowPattern } from '../lib/flowPatterns';
import { buildPocketMap } from '../lib/pocketMap';

interface BpmGroovePayload {
  jobId: string;
  filePath: string;
  tempoHint?: number;
}

function detectBPM(onsetTimesMs: number[]): number {
  if (onsetTimesMs.length < 4) return 120;
  const iois: number[] = [];
  for (let i = 1; i < onsetTimesMs.length; i++) iois.push(onsetTimesMs[i] - onsetTimesMs[i-1]);
  const histogram: Record<number, number> = {};
  for (const ioi of iois) { const bin = Math.round(ioi/5)*5; histogram[bin] = (histogram[bin]||0)+1; }
  let bestBin = 500, bestCount = 0;
  for (const [bin, count] of Object.entries(histogram)) {
    if (count > bestCount) { bestCount = count; bestBin = Number(bin); }
  }
  return Math.max(60, Math.min(200, Math.round(60000/bestBin)));
}

function computeSwingRatio(onsetTimesMs: number[], bpm: number): number {
  const beatMs = 60000/bpm;
  const eighthMs = beatMs/2;
  const swingDelays: number[] = [];
  for (let i = 0; i < onsetTimesMs.length-1; i++) {
    const ioi = onsetTimesMs[i+1] - onsetTimesMs[i];
    const phase = (ioi % eighthMs) / eighthMs;
    if (phase > 0.1 && phase < 0.9) swingDelays.push(phase);
  }
  return swingDelays.length > 0 ? swingDelays.reduce((a,b)=>a+b,0)/swingDelays.length : 0.5;
}

function computeSyncopation(onsetTimesMs: number[], bpm: number): number {
  const beatMs = 60000/bpm;
  const offbeat = onsetTimesMs.filter(t => {
    const phase = (t % beatMs) / beatMs;
    return phase > 0.2 && phase < 0.8;
  });
  return onsetTimesMs.length > 0 ? offbeat.length / onsetTimesMs.length : 0;
}

function detectDownbeats(onsetTimesMs: number[], bpm: number): DownbeatEvent[] {
  const beatMs = 60000/bpm;
  const barMs = beatMs*4;
  const downbeats: DownbeatEvent[] = [];
  let barStart = onsetTimesMs[0] ?? 0;
  while (barStart < (onsetTimesMs[onsetTimesMs.length-1] ?? 0)) {
    downbeats.push({ timeMs: barStart, confidence: 0.8 + Math.random()*0.2 });
    barStart += barMs;
  }
  return downbeats;
}

function classifyGroove(swingRatio: number, syncopation: number): GrooveType {
  if (swingRatio > 0.62) return 'swung';
  if (syncopation > 0.4) return 'syncopated';
  if (swingRatio < 0.52 && syncopation < 0.2) return 'straight';
  return 'polyrhythmic';
}

async function analyseBpmGroove(filePath: string, jobId: string, tempoHint?: number): Promise<BpmGrooveResult> {
  // Simulate onset detection - replace with DSP service in production
  const durationMs = 16000;
  const onsets: number[] = [];
  let t = 0;
  while (t < durationMs) { onsets.push(t); t += 100 + Math.floor(Math.random()*200); }

  const bpm = tempoHint ?? detectBPM(onsets);
  const swingRatio = computeSwingRatio(onsets, bpm);
  const syncopation = computeSyncopation(onsets, bpm);
  const downbeats = detectDownbeats(onsets, bpm);
  const grooveType = classifyGroove(swingRatio, syncopation);

  return {
    jobId,
    bpm,
    swingRatio,
    syncopationScore: syncopation,
    grooveType,
    downbeats,
    processedAt: new Date(),
  };
}

export const bpmGrooveWorker = createWorker<BpmGroovePayload>(
  'bpm-groove',
  async (job: Job<BpmGroovePayload>) => {
    const { jobId, filePath, tempoHint } = job.data;
    await connectToDatabase();

    await PipelineStateModel.findOneAndUpdate(
      { jobId },
      { $set: { 'stages.bpmGroove': 'processing' } },
      { upsert: true },
    );

    const result = await analyseBpmGroove(filePath, jobId, tempoHint);

    await PipelineStateModel.findOneAndUpdate(
      { jobId },
      { $set: { bpmGroove: result, 'stages.bpmGroove': 'completed' } },
      { upsert: true },
    );

    // If whisper timing already exists, compute and persist flow + pocket map
    const state = await PipelineStateModel.findOne({ jobId });
    if (state?.whisperTiming) {
      const flow = analyseFlowPattern(jobId, state.whisperTiming, result);
      const pocketMap = buildPocketMap(jobId, flow, result);
      await PipelineStateModel.findOneAndUpdate(
        { jobId },
        { $set: { flowPattern: flow, pocketMap } },
      );
    }

    return result;
  },
);
