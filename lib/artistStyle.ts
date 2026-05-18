// ============================================================
// lib/artistStyle.ts — Phase 7: Artist Style Engine (MongoDB)
// ============================================================
import mongoose, { Document, Schema } from 'mongoose';
import connectDB from './db';
import { getArtistMemory } from './artistMemory';

// ---- Types ----
export type DeliveryBias = 'chant' | 'singjay' | 'deejay';

export interface CadenceProfile {
    avgIOIms: number;
    syllableDensity: number;
    avgPhraseLen: number;
    syncopationScore: number;
}

export interface RhythmProfile {
    dominantPattern: string;
    pocketPosition: 'ahead' | 'on' | 'behind';
    swingAmount: number;
    grooveDepth: number;
}

export interface HookStructure {
    preferredBarLength: number;
    sectionTypes: string[];
    repeatRatio: number;
    contrastLevel: number;
}

export interface EnergyCurve {
    intro: number;
    verse: number;
    chorus: number;
    bridge: number;
    outro: number;
}

export interface ArtistStyleProfileData {
    artistId: string;
    cadenceProfile: CadenceProfile;
    rhythmProfile: RhythmProfile;
    hookStructure: HookStructure;
    energyCurve: EnergyCurve;
    accentTendency: string;
    deliveryBias: DeliveryBias;
    updatedAt: Date;
    createdAt: Date;
}

export interface ArtistStyleProfileDocument extends ArtistStyleProfileData, Document {}

// ---- Schema ----
const ArtistStyleProfileSchema = new Schema<ArtistStyleProfileDocument>({
    artistId: { type: String, required: true, unique: true, index: true },
    cadenceProfile: {
          avgIOIms: { type: Number, default: 500 },
          syllableDensity: { type: Number, default: 4 },
          avgPhraseLen: { type: Number, default: 8 },
          syncopationScore: { type: Number, default: 0.5 },
    },
    rhythmProfile: {
          dominantPattern: { type: String, default: 'dancehall' },
          pocketPosition: { type: String, enum: ['ahead','on','behind'], default: 'on' },
          swingAmount: { type: Number, default: 0.5 },
          grooveDepth: { type: Number, default: 0.5 },
    },
    hookStructure: {
          preferredBarLength: { type: Number, default: 8 },
          sectionTypes: { type: [String], default: ['chorus','verse'] },
          repeatRatio: { type: Number, default: 0.5 },
          contrastLevel: { type: Number, default: 0.5 },
    },
    energyCurve: {
          intro: { type: Number, default: 0.4 },
          verse: { type: Number, default: 0.6 },
          chorus: { type: Number, default: 0.9 },
          bridge: { type: Number, default: 0.7 },
          outro: { type: Number, default: 0.3 },
    },
    accentTendency: { type: String, default: 'light-patois' },
    deliveryBias: { type: String, enum: ['chant','singjay','deejay'], default: 'deejay' },
}, { timestamps: true });

const ArtistStyleProfileModel: mongoose.Model<ArtistStyleProfileDocument> =
    mongoose.models.ArtistStyleProfile ||
    mongoose.model<ArtistStyleProfileDocument>('ArtistStyleProfile', ArtistStyleProfileSchema);

// ---- analyzeArtistStyle ----
export function analyzeArtistStyle(creationData: {
    pocketPosition?: 'ahead' | 'on' | 'behind';
    energyLevel?: number;
    style?: string;
    accentProfile?: string;
    mode?: string;
    hookRhythmTemplate?: string;
    syllableDensity?: number;
    syncopationScore?: number;
    swingAmount?: number;
    grooveDepth?: number;
}): Partial<ArtistStyleProfileData> {
    const deliveryMap: Record<string, DeliveryBias> = {
          deejay: 'deejay', singjay: 'singjay', chant: 'chant',
          toasting: 'deejay', spoken: 'chant', radio: 'singjay', neutral: 'singjay',
    };
    return {
          cadenceProfile: {
                  avgIOIms: 500,
                  syllableDensity: creationData.syllableDensity ?? 4,
                  avgPhraseLen: 8,
                  syncopationScore: creationData.syncopationScore ?? 0.5,
          },
          rhythmProfile: {
                  dominantPattern: creationData.style ?? 'dancehall',
                  pocketPosition: creationData.pocketPosition ?? 'on',
                  swingAmount: creationData.swingAmount ?? 0.5,
                  grooveDepth: creationData.grooveDepth ?? 0.5,
          },
          energyCurve: {
                  intro: (creationData.energyLevel ?? 0.7) * 0.5,
                  verse: (creationData.energyLevel ?? 0.7) * 0.75,
                  chorus: creationData.energyLevel ?? 0.9,
                  bridge: (creationData.energyLevel ?? 0.7) * 0.8,
                  outro: (creationData.energyLevel ?? 0.7) * 0.35,
          },
          accentTendency: creationData.accentProfile ?? 'light-patois',
          deliveryBias: deliveryMap[creationData.mode ?? 'deejay'] ?? 'deejay',
    };
}

// ---- suggestArtistStyle ----
export async function suggestArtistStyle(artistId: string): Promise<ArtistStyleProfileDocument> {
    await connectDB();
    const memory = await getArtistMemory(artistId);

  // Derive style from memory
  const recentN = memory.recentCreations.slice(0, 10);
    const avgEnergy = recentN.length
      ? recentN.reduce((s, c) => s + c.energyLevel, 0) / recentN.length
          : memory.preferredEnergy;

  const pocketCounts = { ahead: 0, on: 0, behind: 0 };
    recentN.forEach(c => { pocketCounts[c.pocketPosition] = (pocketCounts[c.pocketPosition] || 0) + 1; });
    const dominantPocket = (Object.entries(pocketCounts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? 'on') as 'ahead'|'on'|'behind';

  const styleCounts: Record<string, number> = {};
    recentN.forEach(c => { styleCounts[c.style] = (styleCounts[c.style] || 0) + 1; });
    const dominantStyle = Object.entries(styleCounts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? 'dancehall';

  const deliveryMap: Record<string, DeliveryBias> = { deejay:'deejay', singjay:'singjay', chant:'chant' };
    const rawMode = memory.preferredModes[0] ?? 'deejay';
    const deliveryBias: DeliveryBias = deliveryMap[rawMode] ?? 'deejay';

  const styleData: Partial<ArtistStyleProfileData> = {
        cadenceProfile: { avgIOIms: 500, syllableDensity: 4, avgPhraseLen: 8, syncopationScore: 0.5 },
        rhythmProfile: { dominantPattern: dominantStyle, pocketPosition: dominantPocket, swingAmount: 0.5, grooveDepth: 0.5 },
        hookStructure: {
                preferredBarLength: 8,
                sectionTypes: memory.hookPatterns.length ? memory.hookPatterns.slice(0,3) : ['chorus','verse'],
                repeatRatio: 0.5,
                contrastLevel: 0.5,
        },
        energyCurve: {
                intro: avgEnergy * 0.5,
                verse: avgEnergy * 0.75,
                chorus: avgEnergy,
                bridge: avgEnergy * 0.8,
                outro: avgEnergy * 0.35,
        },
        accentTendency: memory.preferredAccentProfiles[0] ?? 'light-patois',
        deliveryBias,
  };

  return ArtistStyleProfileModel.findOneAndUpdate(
    { artistId },
    { $set: styleData },
    { upsert: true, new: true }
      );
}
