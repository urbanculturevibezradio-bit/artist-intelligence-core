// ============================================================
// workers/riddim-generator.ts — Riddim generation request module
// Generates: drums, bassline, chords, percussion, FX
// ============================================================
import { Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel } from '@/lib/schemas';
import type {
  RiddimGenerationRequest,
  RiddimGenerationResult,
  DrumPattern,
  BasslinePattern,
  ChordVoicing,
  FxParameters,
  MusicalKey,
  RiddimStyle,
} from '@/types/pipeline';

interface RiddimGeneratorPayload {
  jobId: string;
  filePath: string;
}

// ---- MIDI helpers ----
const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

function keyToMidi(key: MusicalKey, octave: number = 2): number {
  const idx = CHROMATIC_SCALE.indexOf(key);
  return 12 * (octave + 1) + idx;
}

function getScaleNotes(key: MusicalKey, scale: string, octave: number = 2): number[] {
  const root = keyToMidi(key, octave);
  const intervals = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS.minor;
  return intervals.map((i) => root + i);
}

// ---- Drum pattern generators (16-step grids) ----

function generateDrumPattern(style: RiddimStyle, bpm: number): DrumPattern {
  // One-drop (reggae/roots): kick on beat 3 only, heavy snare on 2&4
  // Dancehall: kick on 1 and 3, snare accents, rolling hi-hats
  // Steppa: four-on-the-floor kick
  // Afro-fusion: syncopated kick, polyrhythmic perc

  const kick = new Array(16).fill(0);
  const snare = new Array(16).fill(0);
  const hihat = new Array(16).fill(0);
  const rimshot = new Array(16).fill(0);
  const perc = new Array(16).fill(0);

  switch (style) {
    case 'steppa':
      // Four-on-floor
      [0, 4, 8, 12].forEach((i) => (kick[i] = 1));
      [4, 12].forEach((i) => (snare[i] = 1));
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((i) => (hihat[i] = 1));
      [6, 14].forEach((i) => (rimshot[i] = 1));
      break;

    case 'dancehall':
    case 'bashment':
      [0, 6, 8, 14].forEach((i) => (kick[i] = 1));
      [4, 12].forEach((i) => (snare[i] = 1));
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].forEach((i) => (hihat[i] = 1));
      [2, 10].forEach((i) => (rimshot[i] = 1));
      [3, 7, 11, 15].forEach((i) => (perc[i] = 1));
      break;

    case 'afro-fusion':
    case 'afrobeats':
      [0, 3, 6, 10, 13].forEach((i) => (kick[i] = 1));
      [4, 8, 12].forEach((i) => (snare[i] = 1));
      [0, 2, 4, 5, 6, 8, 10, 12, 14].forEach((i) => (hihat[i] = 1));
      [1, 5, 9, 13].forEach((i) => (perc[i] = 1));
      break;

    case 'rub-a-dub':
    case 'digital-reggae':
      // Computerized riddim - sparse kick, heavy snare
      [0, 8].forEach((i) => (kick[i] = 1));
      [4, 12, 14].forEach((i) => (snare[i] = 1));
      [0, 4, 8, 12].forEach((i) => (hihat[i] = 1));
      [2, 6, 10].forEach((i) => (rimshot[i] = 1));
      break;

    default: // reggae, roots, lovers-rock
      // Classic one-drop: kick on beat 3 (step 8)
      kick[8] = 1;
      [4, 12].forEach((i) => (snare[i] = 1));
      [0, 4, 8, 12].forEach((i) => (hihat[i] = 1));
      [2, 6, 10, 14].forEach((i) => (rimshot[i] = 1));
      break;
  }

  const swingAmount = style === 'afro-fusion' || style === 'afrobeats' ? 0.6 : 0.52;

  return { kick, snare, hihat, rimshot, perc, swingAmount };
}

// ---- Bassline generator ----

function generateBassline(
  key: MusicalKey,
  scale: string,
  style: RiddimStyle,
  bars: number
): BasslinePattern {
  const scaleNotes = getScaleNotes(key, scale, 1); // sub-bass octave

  const bassStyleMap: Record<RiddimStyle, BasslinePattern['style']> = {
    dancehall: 'dancehall-rolling',
    bashment: 'dancehall-rolling',
    reggae: 'reggae-skank',
    roots: 'reggae-skank',
    'lovers-rock': 'reggae-skank',
    steppa: 'steppa-sub',
    'rub-a-dub': 'steppa-sub',
    'digital-reggae': 'steppa-sub',
    'afro-fusion': 'afro-walking',
    afrobeats: 'afro-walking',
  };

  const bassStyle = bassStyleMap[style] ?? 'reggae-skank';

  // Generate notes array (16 steps × bars)
  const notes: BasslinePattern['notes'] = [];
  const stepsPerBar = 16;
  const root = scaleNotes[0];
  const fifth = scaleNotes[4] ?? root + 7;
  const fourth = scaleNotes[3] ?? root + 5;

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * stepsPerBar;

    switch (bassStyle) {
      case 'reggae-skank':
        notes.push({ step: offset + 0, midi: root, velocity: 100, durationSteps: 4 });
        notes.push({ step: offset + 4, midi: fourth, velocity: 80, durationSteps: 2 });
        notes.push({ step: offset + 8, midi: root, velocity: 95, durationSteps: 4 });
        notes.push({ step: offset + 12, midi: fifth, velocity: 75, durationSteps: 2 });
        break;

      case 'steppa-sub':
        notes.push({ step: offset + 0, midi: root, velocity: 110, durationSteps: 8 });
        notes.push({ step: offset + 8, midi: root - 5, velocity: 100, durationSteps: 8 });
        break;

      case 'dancehall-rolling':
        [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => {
          notes.push({
            step: offset + s,
            midi: s % 4 === 0 ? root : s % 4 === 2 ? fifth : root + 2,
            velocity: 70 + (s % 4 === 0 ? 30 : 10),
            durationSteps: 2,
          });
        });
        break;

      case 'afro-walking':
        [0, 3, 6, 10, 13].forEach((s) => {
          notes.push({
            step: offset + s,
            midi: scaleNotes[Math.floor(Math.random() * Math.min(4, scaleNotes.length))],
            velocity: 80 + Math.floor(Math.random() * 30),
            durationSteps: 2,
          });
        });
        break;
    }
  }

  return { notes, octave: 1, style: bassStyle };
}

// ---- Chord generator ----

function generateChords(
  key: MusicalKey,
  scale: string,
  style: RiddimStyle,
  bars: number
): ChordVoicing[] {
  const root = keyToMidi(key, 3);
  const intervals = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS.minor;

  // Basic chord structures (root, third, fifth in MIDI)
  const chordRoots = [0, intervals[2], intervals[4], intervals[1]].map((i) => root + i);
  const chords: ChordVoicing[] = [];

  for (let bar = 0; bar < bars; bar++) {
    const chordRoot = chordRoots[bar % chordRoots.length];

    // Skank chord (upbeat) for reggae/dancehall
    if (['reggae', 'roots', 'dancehall', 'rub-a-dub'].includes(style)) {
      // Upbeat ska-style chords on beats 2 and 4 (steps 4 and 12)
      [4, 12].forEach((step) => {
        chords.push({
          step: bar * 16 + step,
          notes: [chordRoot, chordRoot + 4, chordRoot + 7],
          duration: '1/4',
          velocity: 75,
        });
      });
    } else if (style === 'steppa') {
      // Whole bar pad
      chords.push({
        step: bar * 16,
        notes: [chordRoot, chordRoot + 3, chordRoot + 7, chordRoot + 10],
        duration: '1/1',
        velocity: 60,
      });
    } else {
      // Afro / lovers-rock: syncopated
      [0, 6, 10].forEach((step) => {
        chords.push({
          step: bar * 16 + step,
          notes: [chordRoot, chordRoot + 4, chordRoot + 7],
          duration: '1/4',
          velocity: 65 + Math.floor(Math.random() * 20),
        });
      });
    }
  }

  return chords;
}

// ---- FX parameters ----

function generateFxParameters(style: RiddimStyle, bpm: number): FxParameters {
  const delayBpm = bpm;
  const fx: FxParameters = {
    reverb: { wet: 0.2, decay: 1.2 },
    delay: { bpm: delayBpm, feedback: 0.3, wet: 0.15 },
  };

  if (style === 'steppa' || style === 'roots') {
    fx.reverb = { wet: 0.5, decay: 3.5 };
    fx.filterCutoff = 800;
  } else if (style === 'dancehall' || style === 'bashment') {
    fx.reverb = { wet: 0.1, decay: 0.6 };
    fx.distortion = { drive: 0.2 };
  } else if (style === 'afro-fusion' || style === 'afrobeats') {
    fx.reverb = { wet: 0.25, decay: 1.8 };
    fx.filterCutoff = 4000;
  }

  return fx;
}

// ---- Main generation ----
async function generateRiddim(
  filePath: string,
  jobId: string
): Promise<RiddimGenerationResult> {
  // In production: load pipeline state from MongoDB to get style/bpm/key results
  // const state = await PipelineState.findOne({ jobId });
  // const { bpm, key, scale, style } = extractFromState(state);

  // Use representative defaults (production reads from prior worker results)
  const bpm = 96;
  const key: MusicalKey = 'A';
  const scale = 'minor';
  const style: RiddimStyle = 'dancehall';
  const bars = 8;

  const drums = generateDrumPattern(style, bpm);
  const bassline = generateBassline(key, scale, style, bars);
  const chords = generateChords(key, scale, style, bars);
  const percussionLayers = [
    generateDrumPattern(style, bpm), // Layer 2 percussion variation
  ];
  const fxParameters = generateFxParameters(style, bpm);

  return {
    jobId,
    bpm,
    key,
    bars,
    drums,
    bassline,
    chords,
    percussionLayers,
    fxParameters,
  };
}

// ---- BullMQ Worker ----
export function startRiddimGeneratorWorker() {
  return createWorker<RiddimGeneratorPayload, RiddimGenerationResult>(
    'riddim-generator',
    async (job: Job<RiddimGeneratorPayload>): Promise<RiddimGenerationResult> => {
      const { jobId, filePath } = job.data;
      console.log(`[riddim-generator] Processing job ${jobId}`);

      await job.updateProgress(10);
      const result = await generateRiddim(filePath, jobId);
      await job.updateProgress(85);

      await connectToDatabase();
      const PipelineState = PipelineStateModel();
      await PipelineState.findOneAndUpdate(
        { jobId },
        {
          $set: { 'results.riddimGeneration': result },
          $addToSet: { completedWorkers: 'riddim-generator' },
        },
        { upsert: true }
      );

      await job.updateProgress(100);
      console.log(`[riddim-generator] Completed job ${jobId}: ${result.bars} bars at ${result.bpm} BPM`);
      return result;
    },
    1 // Lower concurrency — more CPU intensive
  );
}
