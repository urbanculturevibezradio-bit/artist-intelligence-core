// ============================================================
// pages/api/status/[jobId].ts — Pipeline status polling endpoint
// GET /api/status/:jobId
// ============================================================
import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel, RiddimPackageModel } from '@/lib/schemas';
import type { PipelineState, WorkerName } from '@/types/pipeline';

const WORKER_ORDER: WorkerName[] = [
  'whisper-timing',
  'melody-extraction',
  'bpm-groove',
  'style-classifier',
  'riddim-generator',
  'stem-assembler',
  'fingerprint-validator',
];

interface StatusResponse {
  jobId: string;
  status: string;
  progress: number; // 0-100
  completedWorkers: WorkerName[];
  pendingWorkers: WorkerName[];
  results?: Record<string, unknown>;
  packagePath?: string;
  error?: string;
  updatedAt?: Date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatusResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId is required' });
  }

  try {
    await connectToDatabase();
    const PipelineState = PipelineStateModel();
    const state = await PipelineState.findOne({ jobId }).lean();

    if (!state) {
      return res.status(404).json({ error: `Job ${jobId} not found` });
    }

    const completedWorkers = (state.completedWorkers ?? []) as WorkerName[];
    const pendingWorkers = WORKER_ORDER.filter((w) => !completedWorkers.includes(w));
    const progress = Math.round((completedWorkers.length / WORKER_ORDER.length) * 100);

    // If completed, fetch package path
    let packagePath: string | undefined;
    if (state.status === 'completed') {
      const RiddimPackage = RiddimPackageModel();
      const pkg = await RiddimPackage.findOne({ jobId }).lean();
      packagePath = pkg?.packagePath;
    }

    return res.status(200).json({
      jobId,
      status: state.status,
      progress,
      completedWorkers,
      pendingWorkers,
      results: state.status === 'completed' ? (state.results as Record<string, unknown>) : undefined,
      packagePath,
      error: state.error,
      updatedAt: (state as Record<string, unknown>).updatedAt as Date | undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to fetch status: ${msg}` });
  }
}
