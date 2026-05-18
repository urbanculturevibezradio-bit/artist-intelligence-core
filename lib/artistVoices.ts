import mongoose, { Document, Model, Schema } from 'mongoose';
import connectDB from './db';
import type { VocalMode, AccentProfile } from './caribbeanVoices';

export interface ArtistVoiceSettings {
  voiceId: string;
  mode: VocalMode;
  energy: number;             // 0-1
  accentProfile: AccentProfile;
  deliveryStyle: string;      // e.g. 'aggressive','smooth','melodic','spoken-word'
  pitchShiftSt: number;       // semitones -12 to +12
  reverbWet: number;          // 0-1
  slapbackEnabled: boolean;
  dubDelayEnabled: boolean;
}

export interface ArtistVoiceProfile {
  artistId: string;
  primaryVoiceId: string;
  settings: ArtistVoiceSettings;
  alternateVoiceIds: string[];
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ArtistVoiceProfileDocument extends ArtistVoiceProfile, Document {}

const ArtistVoiceSettingsSchema = new Schema<ArtistVoiceSettings>({
  voiceId:           { type: String, required: true },
  mode:              { type: String, enum: ['chant','singjay','deejay','radio','neutral'], default: 'deejay' },
  energy:            { type: Number, default: 0.7 },
  accentProfile:     { type: String, enum: ['heavy-patois','light-patois','diaspora','trini','bajan','guyanese'], default: 'light-patois' },
  deliveryStyle:     { type: String, default: 'smooth' },
  pitchShiftSt:      { type: Number, default: 0 },
  reverbWet:         { type: Number, default: 0.2 },
  slapbackEnabled:   { type: Boolean, default: true },
  dubDelayEnabled:   { type: Boolean, default: false },
}, { _id: false });

const ArtistVoiceProfileSchema = new Schema<ArtistVoiceProfileDocument>({
  artistId:          { type: String, required: true, unique: true, index: true },
  primaryVoiceId:    { type: String, required: true },
  settings:          { type: ArtistVoiceSettingsSchema, required: true },
  alternateVoiceIds: { type: [String], default: [] },
  lastUsed:          { type: Date, default: Date.now },
}, { timestamps: true });

export const ArtistVoiceProfileModel: Model<ArtistVoiceProfileDocument> =
  (mongoose.models.ArtistVoiceProfile as Model<ArtistVoiceProfileDocument>) ||
  mongoose.model<ArtistVoiceProfileDocument>('ArtistVoiceProfile', ArtistVoiceProfileSchema);

export async function createArtistVoiceProfile(
  artistId: string,
  voiceId: string,
  settings: Partial<ArtistVoiceSettings>,
): Promise<ArtistVoiceProfileDocument> {
  await connectDB();
  const fullSettings: ArtistVoiceSettings = {
    voiceId,
    mode: settings.mode ?? 'deejay',
    energy: settings.energy ?? 0.7,
    accentProfile: settings.accentProfile ?? 'light-patois',
    deliveryStyle: settings.deliveryStyle ?? 'smooth',
    pitchShiftSt: settings.pitchShiftSt ?? 0,
    reverbWet: settings.reverbWet ?? 0.2,
    slapbackEnabled: settings.slapbackEnabled ?? true,
    dubDelayEnabled: settings.dubDelayEnabled ?? false,
  };
  return ArtistVoiceProfileModel.findOneAndUpdate(
    { artistId },
    { $set: { primaryVoiceId: voiceId, settings: fullSettings, lastUsed: new Date() } },
    { upsert: true, new: true },
  ) as Promise<ArtistVoiceProfileDocument>;
}

export async function getArtistVoiceProfile(artistId: string): Promise<ArtistVoiceProfileDocument | null> {
  await connectDB();
  return ArtistVoiceProfileModel.findOne({ artistId });
}

export async function updateArtistVoiceProfile(
  artistId: string,
  settings: Partial<ArtistVoiceSettings>,
): Promise<ArtistVoiceProfileDocument> {
  await connectDB();
  const update: Record<string, unknown> = { lastUsed: new Date() };
  for (const [k, v] of Object.entries(settings)) {
    update['settings.' + k] = v;
  }
  return ArtistVoiceProfileModel.findOneAndUpdate(
    { artistId },
    { $set: update },
    { upsert: true, new: true },
  ) as Promise<ArtistVoiceProfileDocument>;
}
