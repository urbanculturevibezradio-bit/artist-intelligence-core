// ============================================================
// workers/melody-extraction.ts — Pitch curve, intervals, contour, key/scale
// ============================================================
import { Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel } from '@/lib/schemas';
import type {
  MelodyExtractionResult,
  PitchPoint,
  MusicalKey,
  MusicalScale,
} from '@/types/pipeline';

interface MelodyExtractionPayload {
  jobId: string;
  filePath: string;
}

// ---- Pitch helpers ----

const NOTE_NAMES: MusicalKey[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
];

function hzToMidi(hz: number): number {
  return Math.round(12 * Math.log2(hz / 440) + 69);
}

function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function detectKey(midiNotes: number[]): { key: MusicalKey; scale: MusicalScale } {
  // Simplified Krumhansl-Schmuckler key-finding
  const chroma = new Array(12).fill(0);
  for (const m of midiNotes) {
    chroma[m % 12] += 1;
  }

  // Major profile (Krumhansl)
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  // Minor profile
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  let bestScore = -Infinity;
  let bestKey: MusicalKey = 'C';
  let bestScale: MusicalScale = 'major';

  for (let root = 0; root < 12; root++) {
    // Rotate chroma and correlate
    const rotated = [...chroma.slice(root), ...chroma.slice(0, root)];
    const total = rotated.reduce((a, b) => a + b, 0) || 1;
    const normalized = rotated.map((v) => v / total);

    const majorScore = normalized.reduce((s, v, i) => s + v * majorProfile[i], 0);
    const minorScore = normalized.reduce((s, v, i) => s + v * minorProfile[i], 0);

    if (majorScore > bestScore) {
      bestScore = majorScore;
      bestKey = NOTE_NAMES[root];
      bestScale = 'major';
    }
    if (minorScore > bestScore) {
      bestScore = minorScore;
      bestKey = NOTE_NAMES[root];
      bestScale = 'minor';
    }
  }

  return { key: bestKey, scale: bestScale };
}

function detectContour(pitchPoints: PitchPoint[]): MelodyExtractionResult['contour'] {
  if (pitchPoints.length < 2) return 'flat';
  const first = pitchPoints[0].hz;
  const last = pitchPoints[pitchPoints.length - 1].hz;
  const mid = pitchPoints[Math.floor(pitchPoints.length / 2)].hz;

  if (mid > Math.max(first, last) + 20) return 'arch';
  if (mid < Math.min(first, last) - 20) return 'valley';
  if (last > first + 30) return 'ascending';
  if (last < first - 30) return 'descending';
  return 'flat';
}

// ---- Main extraction ----
async function extractMelody(filePath: string, jobId: string): Promise<MelodyExtractionResult> {
  // In production: call Python pYIN / CREPE service for true pitch detection
  // const resp = await axios.post(process.env.DSP_SERVICE_URL + '/melody', { filePath });

  // Scaffold output with plausible structure
  const pitchCurve: PitchPoint[] = [];
  const basePitches = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25]; // C4–C5

  for (let i = 0; i < 40; i++) {
    const hz = basePitches[Math.floor(Math.random() * basePitches.length)] * (0.98 + Math.random() * 0.04);
    pitchCurve.push({
      timeMs: i * 400,
      hz,
      midi: hzToMidi(hz),
      confidence: 0.6 + Math.random() * 0.4,
    });
  }

  // Compute semitone intervals
  const intervals: number[] = [];
  for (let i = 1; i < pitchCurve.length; i++) {
    intervals.push(pitchCurve[i].midi - pitchCurve[i - 1].midi);
  }

  const midiNotes = pitchCurve.map((p) => p.midi);
  const { key, scale } = detectKey(midiNotes);
  const contour = detectContour(pitchCurve);

  const hzValues = pitchCurve.map((p) => p.hz);
  const rangeHz = { min: Math.min(...hzValues), max: Math.max(...hzValues) };

  // Dominant notes (top 3 by frequency)
  const noteFreq: Record<string, number> = {};
  for (const p of pitchCurve) {
    const name = midiToNoteName(p.midi);
    noteFreq[name] = (noteFreq[name] || 0) + 1;
  }
  const dominantNotes = Object.entries(noteFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n]) => n);

  return {
    jobId,
    pitchCurve,
    intervals,
    contour,
    key,
    scale,
    rangeHz,
    dominantNotes,
  };
}

// ---- BullMQ Worker ----
export function startMelodyExtractionWorker() {
  return createWorker<MelodyExtractionPayload, MelodyExtractionResult>(
    'melody-extraction',
    async (job: Job<MelodyExtractionPayload>): Promise<MelodyExtractionResult> => {
      const { jobId, filePath } = job.data;
      console.log(`[melody-extraction] Processing job ${jobId}`);

      await job.updateProgress(10);
      const result = await extractMelody(filePath, jobId);
      await job.updateProgress(80);

      await connectToDatabase();
      const PipelineState = PipelineStateModel();
      await PipelineState.findOneAndUpdate(
        { jobId },
        {
          $set: { 'results.melodyExtraction': result },
          $addToSet: { completedWorkers: 'melody-extraction' },
        },
        { upsert: true }
      );

      await job.updateProgress(100);
      console.log(`[melody-extraction] Completed job ${jobId}`);
      return result;
    },
    2
  );
}
