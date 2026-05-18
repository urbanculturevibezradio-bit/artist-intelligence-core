import type { NextApiRequest, NextApiResponse } from 'next';
import { synthesizeCaribbeanSpeech } from '../../../../lib/caribbeanVoices';
import type { VocalMode, AccentProfile } from '../../../../lib/caribbeanVoices';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { voiceId, text, phonemes, pocketMap, mode, energy, accentProfile } = req.body;
  if (!voiceId || !mode || !accentProfile) {
    return res.status(400).json({ error: 'voiceId, mode, accentProfile required' });
  }
  if (!text && !phonemes) {
    return res.status(400).json({ error: 'text or phonemes required' });
  }
  try {
    const result = await synthesizeCaribbeanSpeech({
      voiceId,
      text: text as string | undefined,
      phonemes,
      pocketMap,
      mode: mode as VocalMode,
      energy: typeof energy === 'number' ? energy : 0.7,
      accentProfile: accentProfile as AccentProfile,
    });
    // Return WAV audio as binary response for preview
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', result.audioBuffer.length);
    res.setHeader('X-Duration-Ms', result.durationMs);
    res.setHeader('X-Phoneme-Count', result.phonemeCount);
    return res.status(200).send(result.audioBuffer);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
