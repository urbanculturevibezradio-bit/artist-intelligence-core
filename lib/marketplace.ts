import mongoose, { Document, Model, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import connectDB from './db';

export type MarketplaceItemType = 'riddim' | 'stem' | 'voice' | 'hook' | 'pack';

export interface MarketplaceItem {
  itemId: string;
  type: MarketplaceItemType;
  sourceId: string;      // packId, voicePackId, jobId etc.
  title: string;
  description: string;
  price: number;         // in USD cents; 0 = free
  currency: string;      // 'USD'
  previewUrl?: string;
  downloadUrl?: string;
  tags: string[];
  bpm?: number;
  key?: string;
  style?: string;
  artistId: string;
  featured: boolean;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MarketplaceItemDocument extends MarketplaceItem, Document {}

const MarketplaceItemSchema = new Schema<MarketplaceItemDocument>({
  itemId:        { type: String, required: true, unique: true, index: true },
  type:          { type: String, enum: ['riddim','stem','voice','hook','pack'], required: true, index: true },
  sourceId:      { type: String, required: true },
  title:         { type: String, required: true },
  description:   { type: String, default: '' },
  price:         { type: Number, default: 0 },
  currency:      { type: String, default: 'USD' },
  previewUrl:    { type: String },
  downloadUrl:   { type: String },
  tags:          { type: [String], default: [] },
  bpm:           { type: Number },
  key:           { type: String },
  style:         { type: String },
  artistId:      { type: String, required: true, index: true },
  featured:      { type: Boolean, default: false },
  downloadCount: { type: Number, default: 0 },
}, { timestamps: true });

export const MarketplaceItemModel: Model<MarketplaceItemDocument> =
  (mongoose.models.MarketplaceItem as Model<MarketplaceItemDocument>) ||
  mongoose.model<MarketplaceItemDocument>('MarketplaceItem', MarketplaceItemSchema);

export async function registerMarketplaceItem(
  type: MarketplaceItemType,
  sourceId: string,
  price: number,
  metadata: {
    title: string;
    description?: string;
    artistId: string;
    tags?: string[];
    bpm?: number;
    key?: string;
    style?: string;
    previewUrl?: string;
    downloadUrl?: string;
    featured?: boolean;
  },
): Promise<MarketplaceItemDocument> {
  await connectDB();
  const itemId = uuidv4();
  return MarketplaceItemModel.create({
    itemId, type, sourceId, price,
    title: metadata.title,
    description: metadata.description ?? '',
    artistId: metadata.artistId,
    tags: metadata.tags ?? [],
    bpm: metadata.bpm,
    key: metadata.key,
    style: metadata.style,
    previewUrl: metadata.previewUrl,
    downloadUrl: metadata.downloadUrl,
    featured: metadata.featured ?? false,
  });
}

export async function listMarketplaceItems(
  type?: MarketplaceItemType,
  options?: { artistId?: string; tags?: string[]; featured?: boolean; limit?: number },
): Promise<MarketplaceItemDocument[]> {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (type) filter.type = type;
  if (options?.artistId) filter.artistId = options.artistId;
  if (options?.tags?.length) filter.tags = { $in: options.tags };
  if (options?.featured !== undefined) filter.featured = options.featured;
  return MarketplaceItemModel.find(filter)
    .sort({ featured: -1, downloadCount: -1, createdAt: -1 })
    .limit(options?.limit ?? 50);
}

export async function getMarketplaceItem(itemId: string): Promise<MarketplaceItemDocument | null> {
  await connectDB();
  return MarketplaceItemModel.findOne({ itemId });
}

export async function incrementDownloadCount(itemId: string): Promise<void> {
  await connectDB();
  await MarketplaceItemModel.findOneAndUpdate({ itemId }, { $inc: { downloadCount: 1 } });
}
