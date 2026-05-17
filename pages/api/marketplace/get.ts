import type { NextApiRequest, NextApiResponse } from 'next';
import { getMarketplaceItem, incrementDownloadCount } from '../../../lib/marketplace';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { itemId, download } = req.query;
  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).json({ error: 'itemId query param required' });
  }
  try {
    const item = await getMarketplaceItem(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (download === 'true') await incrementDownloadCount(itemId);
    return res.status(200).json(item);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
