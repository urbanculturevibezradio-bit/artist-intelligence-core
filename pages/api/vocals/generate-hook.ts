import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../lib/db';
import { getQueue } from '../../../lib/queue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId, artistId, templateId, fxPreset, voiceConfig } = req.body;
  if (!jobId || !artistId || !templateId) {
    return res.status(400).json({ error: 'jobId, artistId, templateId required' });
  }

  try {
    await connectDB();
    const queue = getQueue('vocal-generator');
    const bullJob = await queue.add(
      'generate',
      { jobId, artistId, templateId, fxPreset: fxPreset ?? 'dub', voiceConfig: voiceConfig ?? {} },
      { attempts: 2, backoff: { type: 'exponential', delay: 2000 } },
    );
    return res.status(202).json({ queued: true, bullJobId: bullJob.id, jobId, templateId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
