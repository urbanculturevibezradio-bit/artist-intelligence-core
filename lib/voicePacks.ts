import mongoose, { Document, Model, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import connectDB from './db';
import type { VoiceModelConfig, FXType } from './vocalEngine';

export interface VoicePack {
  packId: string;
  name: string;
  description: string;
  voices: VoiceModelConfig[];
  tags: string[];
  previewUrl?: string;
  defaultFxPreset: FXType;
  createdAt: Date;
  updatedAt: Date;
}

interface VoicePackDocument extends VoicePack, Document {}

const VoicePackSchema = new Schema<VoicePackDocument>({
  packId:         { type: String, required: true, unique: true, index: true },
  name:           { type: String, required: true },
  description:    { type: String, default: '' },
  voices:         { type: [Object], default: [] },
  tags:           { type: [String], default: [] },
  previewUrl:     { type: String },
  defaultFxPreset:{ type: String, default: 'dub' },
}, { timestamps: true });

export const VoicePackModel: Model<VoicePackDocument> =
  (mongoose.models.VoicePack as Model<VoicePackDocument>) ||
  mongoose.model<VoicePackDocument>('VoicePack', VoicePackSchema);

export async function registerVoicePack(
  name: string,
  voices: VoiceModelConfig[],
  tags: string[],
  options?: { description?: string; previewUrl?: string; defaultFxPreset?: FXType },
): Promise<VoicePackDocument> {
  await connectDB();
  const packId = uuidv4();
  return VoicePackModel.create({
    packId, name, voices, tags,
    description: options?.description ?? '',
    previewUrl: options?.previewUrl,
    defaultFxPreset: options?.defaultFxPreset ?? 'dub',
  });
}

export async function getVoicePack(packId: string): Promise<VoicePackDocument | null> {
  await connectDB();
  return VoicePackModel.findOne({ packId });
}

export async function listVoicePacks(tags?: string[]): Promise<VoicePackDocument[]> {
  await connectDB();
  const filter = tags?.length ? { tags: { $in: tags } } : {};
  return VoicePackModel.find(filter).sort({ createdAt: -1 }).limit(50);
}

// Seed default voice packs if none exist
export async function seedDefaultVoicePacks(): Promise<void> {
  await connectDB();
  const count = await VoicePackModel.countDocuments();
  if (count > 0) return;
  const defaults = [
    {
      name: 'Dancehall Deejay Pack',
      description: 'Classic deejay voices tuned for dancehall riddims',
      voices: [
        { provider: 'mock', voiceId: 'mock-voice', vocalStyle: 'deejay', stability: 0.5, similarityBoost: 0.75 },
        { provider: '11labs', voiceId: '21m00Tcm4TlvDq8ikWAM', vocalStyle: 'deejay', stability: 0.45, similarityBoost: 0.8 },
      ],
      tags: ['dancehall','deejay','roots'],
      defaultFxPreset: 'slapback',
    },
    {
      name: 'Dub Singjay Pack',
      description: 'Singjay voices with dub FX presets',
      voices: [
        { provider: 'mock', voiceId: 'mock-voice', vocalStyle: 'singjay', stability: 0.6, similarityBoost: 0.7 },
        { provider: '11labs', voiceId: 'AZnzlk1XvdvUeBnXmlld', vocalStyle: 'singjay', stability: 0.55, similarityBoost: 0.75 },
      ],
      tags: ['dub','singjay','steppa'],
      defaultFxPreset: 'dub',
    },
    {
      name: 'Afro Chant Pack',
      description: 'Chant and toasting voices for afro-fusion riddims',
      voices: [
        { provider: 'mock', voiceId: 'mock-voice', vocalStyle: 'chant', stability: 0.7, similarityBoost: 0.65 },
      ],
      tags: ['afro','chant','fusion'],
      defaultFxPreset: 'reverb',
    },
  ];
  for (const d of defaults) {
    await registerVoicePack(d.name, d.voices as VoiceModelConfig[], d.tags, { description: d.description, defaultFxPreset: d.defaultFxPreset as FXType });
  }
}
