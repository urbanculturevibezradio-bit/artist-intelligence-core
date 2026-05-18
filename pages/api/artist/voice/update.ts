import type { NextApiRequest, NextApiResponse } from 'next';
import { updateArtistVoiceProfile, createArtistVoiceProfile } from '../../../../lib/artistVoices';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { artistId, settings } = req.body;
  if (!artistId || !settings) {
    return res.status(400).json({ error: 'artistId and settings required' });
  }
  try {
    let profile;
    if (settings.voiceId) {
      profile = await createArtistVoiceProfile(artistId, settings.voiceId, settings);
    } else {
      profile = await updateArtistVoiceProfile(artistId, settings);
    }
    return res.status(200).json(profile);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
