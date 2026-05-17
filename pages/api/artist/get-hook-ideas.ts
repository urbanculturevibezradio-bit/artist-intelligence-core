import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../lib/db';
import { PipelineStateModel } from '../../../lib/schemas';
import { analyseFlowPattern } from '../../../lib/flowPatterns';
import { buildPocketMap } from '../../../lib/pocketMap';
import { generateHookIdeas } from '../../../lib/hookEngine';
import { getOrCreateArtistProfile } from '../../../lib/artistMemory';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId, artistId } = req.query;
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

    // Build flow + pocket
    const flow = analyseFlowPattern(jobId, timing, groove);
    const pocketMap = buildPocketMap(jobId, flow, groove);

    // Get artist preferences (fallback to anonymous)
    const resolvedArtistId = typeof artistId === 'string' ? artistId : 'anonymous';
    const profile = await getOrCreateArtistProfile(resolvedArtistId);

    // Generate hook ideas
    const hookIdeas = generateHookIdeas(jobId, flow, profile.preferences);

    return res.status(200).json({
      jobId,
      artistId: resolvedArtistId,
      flow: {
        pocketPosition: flow.pocketPosition,
        pocketOffsetMs: flow.pocketOffsetMs,
        syncopationScore: flow.syncopationScore,
        avgSyllableDensity: flow.avgSyllableDensity,
        avgPhraseLength: flow.avgPhraseLength,
      },
      pocketMapSummary: {
        totalBars: pocketMap.totalBars,
        globalPocketPosition: pocketMap.globalPocketPosition,
        globalOffsetMs: pocketMap.globalOffsetMs,
      },
      hookIdeas,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
