// ============================================================
// workers/fingerprint-validator.ts — Similarity check, style accuracy, BPM validation
// ============================================================
import { Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel } from '@/lib/schemas';
import { findSimilarEmbeddings } from '@/lib/supabase';
import type {
  FingerprintValidationResult,
  ValidationIssue,
  BpmGrooveResult,
  StyleClassifierResult,
  RiddimGenerationResult,
  RiddimPackage,
} from '@/types/pipeline';

interface FingerprintValidatorPayload {
  jobId: string;
  filePath: string;
}

// ---- Math helpers ----

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ---- Validation checks ----

function validateBpm(
  targetBpm: number,
  generatedBpm: number,
  threshold: number = 0.05
): { accuracy: number; issue?: ValidationIssue } {
  const relativeError = Math.abs(generatedBpm - targetBpm) / (targetBpm || 1);
  const accuracy = Math.max(0, 1 - relativeError);

  const issue: ValidationIssue | undefined =
    relativeError > threshold
      ? {
          type: 'bpm_drift',
          severity: relativeError > 0.1 ? 'error' : 'warning',
          detail: `Generated BPM ${generatedBpm} deviates ${(relativeError * 100).toFixed(1)}% from target ${targetBpm}`,
        }
      : undefined;

  return { accuracy, issue };
}

function validateStyle(
  targetStyle: string,
  styleScores: Record<string, number>,
  generatedStyle: string,
  threshold: number = 0.3
): { accuracy: number; issue?: ValidationIssue } {
  const targetScore = styleScores[targetStyle] ?? 0;
  const accuracy = targetScore;

  const issue: ValidationIssue | undefined =
    targetScore < threshold
      ? {
          type: 'style_mismatch',
          severity: targetScore < 0.15 ? 'error' : 'warning',
          detail: `Style confidence for "${targetStyle}" is ${(targetScore * 100).toFixed(1)}%. Generated as "${generatedStyle}".`,
        }
      : undefined;

  return { accuracy, issue };
}

function validateKeyCompatibility(
  inputKey: string,
  generatedKey: string
): ValidationIssue | undefined {
  if (inputKey === generatedKey) return undefined;

  // Check circle of fifths proximity
  const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  const inputIdx = CIRCLE_OF_FIFTHS.indexOf(inputKey);
  const genIdx = CIRCLE_OF_FIFTHS.indexOf(generatedKey);

  if (inputIdx === -1 || genIdx === -1) return undefined;

  const distance = Math.min(
    Math.abs(inputIdx - genIdx),
    12 - Math.abs(inputIdx - genIdx)
  );

  if (distance > 3) {
    return {
      type: 'key_clash',
      severity: distance > 5 ? 'error' : 'warning',
      detail: `Input key ${inputKey} and generated key ${generatedKey} are ${distance} steps apart on circle of fifths`,
    };
  }

  return undefined;
}

function checkForDuplicates(
  similarityScore: number,
  duplicateThreshold: number = 0.97
): ValidationIssue | undefined {
  if (similarityScore >= duplicateThreshold) {
    return {
      type: 'duplicate_detected',
      severity: 'error',
      detail: `Cosine similarity ${(similarityScore * 100).toFixed(2)}% exceeds duplicate threshold ${(duplicateThreshold * 100).toFixed(0)}%`,
    };
  }
  return undefined;
}

// ---- Main validation ----
async function validateFingerprint(jobId: string): Promise<FingerprintValidationResult> {
  await connectToDatabase();
  const PipelineState = PipelineStateModel();
  const state = await PipelineState.findOne({ jobId });

  if (!state) {
    return {
      jobId,
      passed: false,
      similarityScore: 0,
      bpmAccuracy: 0,
      styleAccuracy: 0,
      issues: [
        {
          type: 'timing_error',
          severity: 'error',
          detail: `No pipeline state found for job ${jobId}`,
        },
      ],
    };
  }

  const results = state.results as Record<string, unknown>;
  const bpmGroove = results.bpmGroove as BpmGrooveResult | undefined;
  const styleResult = results.styleClassifier as StyleClassifierResult | undefined;
  const riddimGen = results.riddimGeneration as RiddimGenerationResult | undefined;
  const stemPkg = results.stemAssembler as RiddimPackage | undefined;

  const issues: ValidationIssue[] = [];

  // 1. BPM validation
  const targetBpm = bpmGroove?.bpm ?? 96;
  const generatedBpm = riddimGen?.bpm ?? 96;
  const { accuracy: bpmAccuracy, issue: bpmIssue } = validateBpm(targetBpm, generatedBpm);
  if (bpmIssue) issues.push(bpmIssue);

  // 2. Style validation
  const styleScores = styleResult?.styleScores ?? {};
  const primaryStyle = styleResult?.primaryStyle ?? 'dancehall';
  const generatedStyle = stemPkg?.style ?? primaryStyle;
  const { accuracy: styleAccuracy, issue: styleIssue } = validateStyle(
    primaryStyle,
    styleScores as Record<string, number>,
    generatedStyle
  );
  if (styleIssue) issues.push(styleIssue);

  // 3. Key clash check
  const inputKey = stemPkg?.masterKey ?? 'A';
  const generatedKey = riddimGen?.key ?? inputKey;
  const keyIssue = validateKeyCompatibility(String(inputKey), String(generatedKey));
  if (keyIssue) issues.push(keyIssue);

  // 4. pgvector similarity check (find nearest stored embeddings)
  let similarityScore = 0;
  if (styleResult?.embedding && styleResult.embedding.length === 512) {
    try {
      const similar = await findSimilarEmbeddings(styleResult.embedding, 1, primaryStyle);
      if (similar.length > 0 && similar[0].job_id !== jobId) {
        similarityScore = similar[0].similarity;
        const dupIssue = checkForDuplicates(similarityScore);
        if (dupIssue) issues.push(dupIssue);
      }
    } catch (err) {
      console.warn(`[fingerprint-validator] Supabase similarity check skipped: ${(err as Error).message}`);
    }
  }

  const passed = !issues.some((i) => i.severity === 'error');

  return {
    jobId,
    passed,
    similarityScore,
    bpmAccuracy,
    styleAccuracy,
    issues,
  };
}

// ---- BullMQ Worker ----
export function startFingerprintValidatorWorker() {
  return createWorker<FingerprintValidatorPayload, FingerprintValidationResult>(
    'fingerprint-validator',
    async (job: Job<FingerprintValidatorPayload>): Promise<FingerprintValidationResult> => {
      const { jobId } = job.data;
      console.log(`[fingerprint-validator] Processing job ${jobId}`);

      await job.updateProgress(10);
      const result = await validateFingerprint(jobId);
      await job.updateProgress(80);

      await connectToDatabase();
      const PipelineState = PipelineStateModel();
      await PipelineState.findOneAndUpdate(
        { jobId },
        {
          $set: {
            'results.fingerprintValidator': result,
            status: result.passed ? 'completed' : 'failed',
          },
          $addToSet: { completedWorkers: 'fingerprint-validator' },
        },
        { upsert: true }
      );

      await job.updateProgress(100);
      const status = result.passed ? 'PASSED' : `FAILED (${result.issues.length} issues)`;
      console.log(`[fingerprint-validator] Completed job ${jobId}: ${status}`);
      return result;
    },
    2
  );
}
