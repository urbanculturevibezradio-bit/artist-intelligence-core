// ============================================================
// pages/api/artist/style/suggest.ts — GET /api/artist/style/suggest?artistId=
// ============================================================
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../../lib/db';
import { suggestArtistStyle } from '../../../../lib/artistStyle';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { artistId } = req.query;
    if (!artistId || typeof artistId !== 'string') {
          return res.status(400).json({ error: 'artistId query param required' });
    }
    try {
          await connectDB();
          const style = await suggestArtistStyle(artistId);
          return res.status(200).json({
                  artistId: style.artistId,
                  cadenceProfile: style.cadenceProfile,
                  rhythmProfile: style.rhythmProfile,
                  hookStructure: style.hookStructure,
                  energyCurve: style.energyCurve,
                  accentTendency: style.accentTendency,
                  deliveryBias: style.deliveryBias,
                  updatedAt: style.updatedAt,
          });
    } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return res.status(500).json({ error: message });
    }
}
