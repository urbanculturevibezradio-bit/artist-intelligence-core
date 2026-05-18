import type { NextApiRequest, NextApiResponse } from 'next';
import { getTrainingDataset } from '../../../../lib/voiceTraining';
import { CaribbeanVoiceModelDoc } from '../../../../lib/caribbeanVoices';
import connectDB from '../../../../lib/db';

// STUB: Training is not yet implemented. This route validates the request
// and returns a pending status. Wire to a real training provider when ready.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { voiceId, datasetId } = req.body;
  if (!voiceId || !datasetId) {
    return res.status(400).json({ error: 'voiceId and datasetId required' });
  }
  try {
    await connectDB();
    const voice = await CaribbeanVoiceModelDoc.findOne({ voiceId });
    if (!voice) return res.status(404).json({ error: 'Voice model not found' });
    const dataset = await getTrainingDataset(datasetId);
    if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
    // Stub: mark as processing
    dataset.status = 'processing';
    await (dataset as any).save();
    return res.status(202).json({
      status: 'queued',
      message: 'Training is stubbed. Integrate a real TTS provider to enable fine-tuning.',
      voiceId, datasetId,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
