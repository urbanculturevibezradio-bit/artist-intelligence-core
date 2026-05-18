import type { NextApiRequest, NextApiResponse } from 'next';
import { CaribbeanVoiceModelDoc, seedCaribbeanVoices } from '../../../../lib/caribbeanVoices';
import connectDB from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    await seedCaribbeanVoices();
    const voices = await CaribbeanVoiceModelDoc.find({ active: true }).lean();
    return res.status(200).json({ voices });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
