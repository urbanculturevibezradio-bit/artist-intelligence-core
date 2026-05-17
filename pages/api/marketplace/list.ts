import type { NextApiRequest, NextApiResponse } from 'next';
import { listMarketplaceItems, MarketplaceItemType } from '../../../lib/marketplace';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const type = req.query.type as MarketplaceItemType | undefined;
    const artistId = typeof req.query.artistId === 'string' ? req.query.artistId : undefined;
    const tags = typeof req.query.tags === 'string' ? req.query.tags.split(',') : undefined;
    const featured = req.query.featured === 'true' ? true : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const items = await listMarketplaceItems(type, { artistId, tags, featured, limit });
    return res.status(200).json({ items });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
