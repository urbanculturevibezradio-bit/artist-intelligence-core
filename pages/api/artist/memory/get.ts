// ============================================================
// pages/api/artist/memory/get.ts — GET /api/artist/memory/get?artistId=
// ============================================================
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../../lib/db';
import { getArtistMemory } from '../../../../lib/artistMemory';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { artistId } = req.query;
    if (!artistId || typeof artistId !== 'string') {
          return res.status(400).json({ error: 'artistId query param required' });
    }
    try {
          await connectDB();
          const memory = await getArtistMemory(artistId);
          return res.status(200).json({
                  artistId: memory.artistId,
                  preferredVoices: memory.preferredVoices,
                  preferredModes: memory.preferredModes,
                  preferredAccentProfiles: memory.preferredAccentProfiles,
                  preferredEnergy: memory.preferredEnergy,
                  hookPatterns: memory.hookPatterns,
                  flowPatterns: memory.flowPatterns,
                  pocketPreferences: memory.pocketPreferences,
                  lyricalThemes: memory.lyricalThemes,
                  recentCreations: memory.recentCreations.slice(0, 10),
                  totalSessions: memory.totalSessions,
                  updatedAt: memory.updatedAt,
          });
    } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return res.status(500).json({ error: message });
    }
}
