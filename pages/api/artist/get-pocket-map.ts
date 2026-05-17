import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../lib/db';
import { PipelineStateModel } from '../../../lib/schemas';
import { analyseFlowPattern } from '../../../lib/flowPatterns';
import { buildPocketMap } from '../../../lib/pocketMap';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId } = req.query;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId query param required' });
  }

  try {
    await connectDB();
    const state = await PipelineStateModel.findOne({ jobId });
    if (!state) return res.status(404).json({ error: 'Job not found' });

    const timing = state.whisperTiming;
    const groove = state.bpmGroove;
    if (!timing || !groove) {
      return res.status(202).json({ status: 'pending', message: 'Timing/groove data not yet available' });
    }

    const flow = analyseFlowPattern(jobId, timing, groove);
    const pocketMap = buildPocketMap(jobId, flow, groove);

    return res.status(200).json({ jobId, flow, pocketMap });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
