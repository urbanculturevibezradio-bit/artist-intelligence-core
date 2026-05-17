import type { NextApiRequest, NextApiResponse } from 'next';
import { createArtistPack } from '../../../lib/artistPacks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { artistId, jobIds, name } = req.body;
  if (!artistId || !Array.isArray(jobIds) || jobIds.length === 0) {
    return res.status(400).json({ error: 'artistId and jobIds[] required' });
  }
  try {
    const pack = await createArtistPack(artistId, jobIds, name);
    return res.status(201).json(pack);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
