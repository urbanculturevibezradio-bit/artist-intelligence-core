import type { NextApiRequest, NextApiResponse } from 'next';
import { listArtistPacks } from '../../../lib/artistPacks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { artistId } = req.query;
  if (!artistId || typeof artistId !== 'string') {
    return res.status(400).json({ error: 'artistId query param required' });
  }
  try {
    const packs = await listArtistPacks(artistId);
    return res.status(200).json({ artistId, packs });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
