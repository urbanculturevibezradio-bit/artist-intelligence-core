import type { NextApiRequest, NextApiResponse } from 'next';
import { getOrCreateArtistProfile } from '../../../lib/artistMemory';
import connectDB from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { artistId } = req.query;
  if (!artistId || typeof artistId !== 'string') {
    return res.status(400).json({ error: 'artistId query param required' });
  }

  try {
    await connectDB();
    const profile = await getOrCreateArtistProfile(artistId);

    return res.status(200).json({
      artistId: profile.artistId,
      displayName: profile.displayName,
      preferences: profile.preferences,
      totalSessions: profile.totalSessions,
      recentSessions: profile.sessionHistory.slice(-10).map(s => ({
        jobId: s.jobId,
        timestamp: s.timestamp,
        bpm: s.bpm,
        key: s.key,
        style: s.style,
        pocketPosition: s.pocketPosition,
        energyLevel: s.energyLevel,
      })),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
