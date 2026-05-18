// ============================================================
// lib/artistMemory.ts — Phase 7: Artist Memory Engine (MongoDB)
// ============================================================
import mongoose, { Document, Schema } from 'mongoose';
import connectDB from './db';

// ---- Interfaces ----
export interface RecentCreation {
    jobId: string;
    timestamp: Date;
    bpm: number;
    key: string;
    style: string;
    riddimFamilies: string[];
    pocketPosition: 'ahead' | 'on' | 'behind';
    energyLevel: number;
    hookRhythmTemplate?: string;
    voiceId?: string;
    mode?: string;
    accentProfile?: string;
}

export interface ArtistMemoryData {
    artistId: string;
    preferredVoices: string[];
    preferredModes: string[];
    preferredAccentProfiles: string[];
    preferredEnergy: number;
    hookPatterns: string[];
    flowPatterns: string[];
    pocketPreferences: ('ahead' | 'on' | 'behind')[];
    lyricalThemes: string[];
    recentCreations: RecentCreation[];
    // legacy compat
  displayName?: string;
    totalSessions: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ArtistMemoryDocument extends ArtistMemoryData, Document {}

// ---- Schema ----
const RecentCreationSchema = new Schema<RecentCreation>({
    jobId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    bpm: { type: Number, default: 90 },
    key: { type: String, default: 'Cm' },
    style: { type: String, default: 'dancehall' },
    riddimFamilies: { type: [String], default: [] },
    pocketPosition: { type: String, enum: ['ahead','on','behind'], default: 'on' },
    energyLevel: { type: Number, default: 0.5 },
    hookRhythmTemplate: { type: String },
    voiceId: { type: String },
    mode: { type: String },
    accentProfile: { type: String },
}, { _id: false });

const ArtistMemorySchema = new Schema<ArtistMemoryDocument>({
    artistId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String },
    preferredVoices: { type: [String], default: [] },
    preferredModes: { type: [String], default: ['deejay'] },
    preferredAccentProfiles: { type: [String], default: ['light-patois'] },
    preferredEnergy: { type: Number, default: 0.7 },
    hookPatterns: { type: [String], default: [] },
    flowPatterns: { type: [String], default: [] },
    pocketPreferences: { type: [String], enum: ['ahead','on','behind'], default: ['on'] },
    lyricalThemes: { type: [String], default: [] },
    recentCreations: { type: [RecentCreationSchema], default: [] },
    totalSessions: { type: Number, default: 0 },
}, { timestamps: true });

const ArtistMemoryModel: mongoose.Model<ArtistMemoryDocument> =
    mongoose.models.ArtistMemory ||
    mongoose.model<ArtistMemoryDocument>('ArtistMemory', ArtistMemorySchema);

// ---- getArtistMemory ----
export async function getArtistMemory(artistId: string): Promise<ArtistMemoryDocument> {
    await connectDB();
    let mem = await ArtistMemoryModel.findOne({ artistId });
    if (!mem) {
          mem = await ArtistMemoryModel.create({ artistId });
    }
    return mem;
}

// ---- updateArtistMemory ----
export async function updateArtistMemory(
    artistId: string,
    data: Partial<ArtistMemoryData>
  ): Promise<ArtistMemoryDocument> {
    await connectDB();
    const existing = await getArtistMemory(artistId);
    const merged = mergeArtistMemory(existing.toObject() as ArtistMemoryData, data);
    await ArtistMemoryModel.updateOne({ artistId }, { $set: merged });
    return getArtistMemory(artistId);
}

// ---- mergeArtistMemory ----
export function mergeArtistMemory(
    existing: ArtistMemoryData,
    incoming: Partial<ArtistMemoryData>
  ): Partial<ArtistMemoryData> {
    const merged: Partial<ArtistMemoryData> = { ...existing };

  if (incoming.preferredVoices?.length) {
        merged.preferredVoices = [...new Set([...existing.preferredVoices, ...incoming.preferredVoices])];
  }
    if (incoming.preferredModes?.length) {
          merged.preferredModes = [...new Set([...existing.preferredModes, ...incoming.preferredModes])];
    }
    if (incoming.preferredAccentProfiles?.length) {
          merged.preferredAccentProfiles = [...new Set([...existing.preferredAccentProfiles, ...incoming.preferredAccentProfiles])];
    }
    if (incoming.preferredEnergy !== undefined) {
          merged.preferredEnergy = incoming.preferredEnergy;
    }
    if (incoming.hookPatterns?.length) {
          merged.hookPatterns = [...new Set([...existing.hookPatterns, ...incoming.hookPatterns])];
    }
    if (incoming.flowPatterns?.length) {
          merged.flowPatterns = [...new Set([...existing.flowPatterns, ...incoming.flowPatterns])];
    }
    if (incoming.pocketPreferences?.length) {
          merged.pocketPreferences = [...new Set([...existing.pocketPreferences, ...incoming.pocketPreferences])] as ('ahead'|'on'|'behind')[];
    }
    if (incoming.lyricalThemes?.length) {
          merged.lyricalThemes = [...new Set([...existing.lyricalThemes, ...incoming.lyricalThemes])];
    }
    if (incoming.recentCreations?.length) {
          const combined = [...existing.recentCreations, ...incoming.recentCreations];
          merged.recentCreations = combined.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
          merged.totalSessions = (existing.totalSessions || 0) + incoming.recentCreations.length;
    }

  return merged;
}

// legacy compat export
export { getArtistMemory as getOrCreateArtistProfile };
export type { ArtistMemoryData as ArtistPreferences };
