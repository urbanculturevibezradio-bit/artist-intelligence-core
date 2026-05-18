// ============================================================
// pages/api/artist/memory/update.ts — POST /api/artist/memory/update
// ============================================================
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../../lib/db';
import { updateArtistMemory } from '../../../../lib/artistMemory';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { artistId, data } = req.body;
    if (!artistId || typeof artistId !== 'string') {
          return res.status(400).json({ error: 'artistId required in body' });
    }
    if (!data || typeof data !== 'object') {
          return res.status(400).json({ error: 'data object required in body' });
    }
    try {
          await connectDB();
          const memory = await updateArtistMemory(artistId, data);
          return res.status(200).json({
                  ok: true,
                  artistId: memory.artistId,
                  preferredVoices: memory.preferredVoices,
                  preferredModes: memory.preferredModes,
                  preferredAccentProfiles: memory.preferredAccentProfiles,
                  preferredEnergy: memory.preferredEnergy,
                  hookPatterns: memory.hookPatterns,
                  flowPatterns: memory.flowPatterns,
                  pocketPreferences: memory.pocketPreferences,
                  lyricalThemes: memory.lyricalThemes,
                  totalSessions: memory.totalSessions,
                  updatedAt: memory.updatedAt,
          });
    } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return res.status(500).json({ error: message });
    }
}
