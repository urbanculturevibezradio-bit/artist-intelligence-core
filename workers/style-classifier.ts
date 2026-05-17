// ============================================================
// workers/style-classifier.ts — Style classification worker
// Classifies: dancehall, reggae, afro-fusion, rub-a-dub, steppa, etc.
// ============================================================
import { Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel } from '@/lib/schemas';
import { upsertStyleEmbedding } from '@/lib/supabase';
import type { StyleClassifierResult, RiddimStyle } from '@/types/pipeline';

interface StyleClassifierPayload {
  jobId: string;
  filePath: string;
}

// ---- Style feature profiles ----
// Each style has characteristic BPM ranges, swing profiles, and spectral features

interface StyleProfile {
  bpmRange: [number, number];
  swingRange: [number, number];
  syncopationRange: [number, number];
  subgenreTags: string[];
}

const STYLE_PROFILES: Record<RiddimStyle, StyleProfile> = {
  dancehall: {
    bpmRange: [90, 110],
    swingRange: [0.50, 0.58],
    syncopationRange: [0.4, 0.7],
    subgenreTags: ['one-drop', 'digital', 'bashment', 'modern-dancehall'],
  },
  reggae: {
    bpmRange: [60, 90],
    swingRange: [0.50, 0.55],
    syncopationRange: [0.3, 0.6],
    subgenreTags: ['roots', 'one-drop', 'skank', 'irie'],
  },
  'afro-fusion': {
    bpmRange: [90, 130],
    swingRange: [0.52, 0.65],
    syncopationRange: [0.5, 0.8],
    subgenreTags: ['afrobeats', 'highlife', 'amapiano', 'afropop'],
  },
  'rub-a-dub': {
    bpmRange: [70, 90],
    swingRange: [0.50, 0.57],
    syncopationRange: [0.35, 0.6],
    subgenreTags: ['slack', 'sleng-teng', 'computerized-riddim', 'early-digital'],
  },
  steppa: {
    bpmRange: [85, 100],
    swingRange: [0.50, 0.53],
    syncopationRange: [0.2, 0.45],
    subgenreTags: ['four-on-floor', 'sub-bass', 'dub-techno', 'soundsystem'],
  },
  roots: {
    bpmRange: [60, 80],
    swingRange: [0.50, 0.54],
    syncopationRange: [0.25, 0.5],
    subgenreTags: ['nyahbinghi', 'cultural', 'rasta', 'dub'],
  },
  'lovers-rock': {
    bpmRange: [70, 95],
    swingRange: [0.52, 0.60],
    syncopationRange: [0.3, 0.55],
    subgenreTags: ['romantic', 'smooth', 'uk-reggae', 'pop-reggae'],
  },
  bashment: {
    bpmRange: [95, 115],
    swingRange: [0.50, 0.57],
    syncopationRange: [0.45, 0.75],
    subgenreTags: ['patois', 'soca-influence', 'party', 'gun-salute'],
  },
  'digital-reggae': {
    bpmRange: [85, 105],
    swingRange: [0.50, 0.55],
    syncopationRange: [0.35, 0.6],
    subgenreTags: ['computer-riddim', 'midi-bass', '808', 'fm-synth'],
  },
  afrobeats: {
    bpmRange: [95, 125],
    swingRange: [0.54, 0.67],
    syncopationRange: [0.5, 0.8],
    subgenreTags: ['naija', 'highlife', 'percussion-heavy', 'talking-drum'],
  },
};

// ---- Scoring ----

function scoreStyle(
  style: RiddimStyle,
  bpm: number,
  swingRatio: number,
  syncopation: number
): number {
  const profile = STYLE_PROFILES[style];
  let score = 0;

  // BPM score
  const [bpmMin, bpmMax] = profile.bpmRange;
  if (bpm >= bpmMin && bpm <= bpmMax) {
    score += 0.4;
  } else {
    const bpmMid = (bpmMin + bpmMax) / 2;
    const bpmSpread = (bpmMax - bpmMin) / 2 + 20;
    score += 0.4 * Math.max(0, 1 - Math.abs(bpm - bpmMid) / bpmSpread);
  }

  // Swing score
  const [sMin, sMax] = profile.swingRange;
  if (swingRatio >= sMin && swingRatio <= sMax) {
    score += 0.3;
  } else {
    const sMid = (sMin + sMax) / 2;
    score += 0.3 * Math.max(0, 1 - Math.abs(swingRatio - sMid) / 0.15);
  }

  // Syncopation score
  const [synMin, synMax] = profile.syncopationRange;
  if (syncopation >= synMin && syncopation <= synMax) {
    score += 0.3;
  } else {
    const synMid = (synMin + synMax) / 2;
    score += 0.3 * Math.max(0, 1 - Math.abs(syncopation - synMid) / 0.3);
  }

  return Math.min(1, score);
}

// ---- Embedding generation (512-dim) ----
function generateStyleEmbedding(
  bpm: number,
  swingRatio: number,
  syncopation: number,
  styleScores: Record<RiddimStyle, number>
): number[] {
  // In production: use OpenAI embeddings or a fine-tuned audio model
  // Here: deterministic pseudo-embedding from features + noise for vector diversity

  const embedding: number[] = new Array(512).fill(0);

  // Feature dimensions 0-9: style scores
  const styles = Object.keys(styleScores) as RiddimStyle[];
  styles.forEach((style, i) => {
    embedding[i] = styleScores[style];
  });

  // Dimensions 10-12: normalized features
  embedding[10] = bpm / 200;
  embedding[11] = swingRatio;
  embedding[12] = syncopation;

  // Fill remaining with feature-derived values
  for (let i = 13; i < 512; i++) {
    // Pseudo-random but deterministic via feature hash
    const seed = (bpm * 31 + swingRatio * 1000 + syncopation * 10000 + i) % 1;
    embedding[i] = Math.sin(seed * Math.PI * 2 * i) * 0.1;
  }

  // L2-normalize
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  return embedding.map((v) => (norm > 0 ? v / norm : 0));
}

// ---- Main classification ----
async function classifyStyle(
  filePath: string,
  jobId: string
): Promise<StyleClassifierResult> {
  // In production: load a fine-tuned audio classifier (e.g., via Hugging Face API or TF.js model)
  // const resp = await axios.post(process.env.ML_SERVICE_URL + '/classify', { filePath });

  // Simulate BPM/groove features (in production these come from bpm-groove results)
  const bpm = 90 + Math.floor(Math.random() * 40);
  const swingRatio = 0.5 + Math.random() * 0.15;
  const syncopation = 0.3 + Math.random() * 0.5;

  // Score all styles
  const styleScores = {} as Record<RiddimStyle, number>;
  const styles = Object.keys(STYLE_PROFILES) as RiddimStyle[];

  for (const style of styles) {
    styleScores[style] = scoreStyle(style, bpm, swingRatio, syncopation);
  }

  // Normalize scores to sum to 1
  const total = Object.values(styleScores).reduce((s, v) => s + v, 0);
  for (const style of styles) {
    styleScores[style] = styleScores[style] / (total || 1);
  }

  // Primary style
  const primaryStyle = styles.reduce((a, b) =>
    styleScores[a] > styleScores[b] ? a : b
  );

  // Sub-genre tags
  const subgenreTags = STYLE_PROFILES[primaryStyle].subgenreTags;

  // Generate embedding
  const embedding = generateStyleEmbedding(bpm, swingRatio, syncopation, styleScores);

  return {
    jobId,
    primaryStyle,
    styleScores,
    embedding,
    confidence: styleScores[primaryStyle],
    subgenreTags,
  };
}

// ---- BullMQ Worker ----
export function startStyleClassifierWorker() {
  return createWorker<StyleClassifierPayload, StyleClassifierResult>(
    'style-classifier',
    async (job: Job<StyleClassifierPayload>): Promise<StyleClassifierResult> => {
      const { jobId, filePath } = job.data;
      console.log(`[style-classifier] Processing job ${jobId}`);

      await job.updateProgress(10);
      const result = await classifyStyle(filePath, jobId);
      await job.updateProgress(70);

      // Persist embedding to Supabase pgvector
      await upsertStyleEmbedding(jobId, result.primaryStyle, result.embedding, {
        confidence: result.confidence,
        subgenreTags: result.subgenreTags,
      });

      await job.updateProgress(85);

      // Persist to MongoDB
      await connectToDatabase();
      const PipelineState = PipelineStateModel();
      await PipelineState.findOneAndUpdate(
        { jobId },
        {
          $set: { 'results.styleClassifier': result },
          $addToSet: { completedWorkers: 'style-classifier' },
        },
        { upsert: true }
      );

      await job.updateProgress(100);
      console.log(`[style-classifier] Completed job ${jobId}: ${result.primaryStyle} (${(result.confidence * 100).toFixed(1)}%)`);
      return result;
    },
    2
  );
}
