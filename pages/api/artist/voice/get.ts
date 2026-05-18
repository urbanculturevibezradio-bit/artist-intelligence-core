import type { NextApiRequest, NextApiResponse } from 'next';
import { getArtistVoiceProfile } from '../../../../lib/artistVoices';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { artistId } = req.query;
  if (!artistId || typeof artistId !== 'string') {
    return res.status(400).json({ error: 'artistId query param required' });
  }
  try {
    const profile = await getArtistVoiceProfile(artistId);
    if (!profile) return res.status(404).json({ error: 'No voice profile found for artist' });
    return res.status(200).json(profile);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
