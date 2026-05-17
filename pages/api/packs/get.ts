import type { NextApiRequest, NextApiResponse } from 'next';
import { getArtistPack } from '../../../lib/artistPacks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { packId } = req.query;
  if (!packId || typeof packId !== 'string') {
    return res.status(400).json({ error: 'packId query param required' });
  }
  try {
    const pack = await getArtistPack(packId);
    if (!pack) return res.status(404).json({ error: 'Pack not found' });
    return res.status(200).json(pack);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
