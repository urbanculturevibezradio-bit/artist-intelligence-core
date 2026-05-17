import type { NextApiRequest, NextApiResponse } from 'next';
import { listVoicePacks, seedDefaultVoicePacks } from '../../../lib/voicePacks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await seedDefaultVoicePacks();
    const tags = typeof req.query.tags === 'string' ? req.query.tags.split(',') : undefined;
    const packs = await listVoicePacks(tags);
    return res.status(200).json({ packs });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
