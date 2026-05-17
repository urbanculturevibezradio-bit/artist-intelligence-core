import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../lib/db';
import mongoose, { Schema, Model, Document } from 'mongoose';
import type { VocalDemo } from '../../../lib/vocalEngine';

// Lightweight model ref (avoids circular import with worker)
interface VocalDemoDocument extends VocalDemo, Document {}
const VocalDemoModel: Model<VocalDemoDocument> =
  (mongoose.models.VocalDemo as Model<VocalDemoDocument>) ||
  mongoose.model<VocalDemoDocument>('VocalDemo', new Schema({}, { strict: false, timestamps: true }));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId, templateId } = req.query;
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId query param required' });
  }

  try {
    await connectDB();
    const query: Record<string, string> = { jobId };
    if (typeof templateId === 'string') query.templateId = templateId;

    const demos = await VocalDemoModel.find(query).sort({ generatedAt: -1 }).limit(10).lean();
    if (!demos.length) return res.status(404).json({ error: 'No vocal demos found for this job' });

    return res.status(200).json({
      jobId,
      demos: demos.map(d => ({
        templateId: d.templateId,
        artistId: d.artistId,
        wavUrl: d.wavUrl,
        durationMs: d.durationMs,
        status: d.status,
        error: d.error,
        voiceConfig: d.voiceConfig,
        fxChain: d.fxChain,
        generatedAt: d.generatedAt,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
