import mongoose, { Document, Model, Schema } from 'mongoose';
import connectDB from './db';

export interface ArtistPreferences {
  bpmRange: { min: number; max: number };
  riddimFamilies: string[];
  swingAmount: number;
  grooveDepth: number;
  basslineType: string;
  chordFlavor: string;
  energyLevel: number;
  dominantKey: string;
  preferredStyles: string[];
  avgPhraseBars: number;
  pocketPosition: 'ahead' | 'on' | 'behind';
}

export interface ArtistSessionHistory {
  jobId: string;
  timestamp: Date;
  bpm: number;
  key: string;
  style: string;
  riddimFamilies: string[];
  pocketPosition: 'ahead' | 'on' | 'behind';
  energyLevel: number;
  hookRhythmTemplate?: string;
}

export interface ArtistProfile {
  artistId: string;
  displayName?: string;
  preferences: ArtistPreferences;
  sessionHistory: ArtistSessionHistory[];
  totalSessions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtistProfileDocument extends ArtistProfile, Document {}

const ArtistPreferencesSchema = new Schema<ArtistPreferences>({
  bpmRange:        { type: { min: Number, max: Number }, default: { min: 60, max: 160 } },
  riddimFamilies:  { type: [String], default: [] },
  swingAmount:     { type: Number, default: 0.5 },
  grooveDepth:     { type: Number, default: 0.5 },
  basslineType:    { type: String, default: 'roots' },
  chordFlavor:     { type: String, default: 'minor7' },
  energyLevel:     { type: Number, default: 0.5 },
  dominantKey:     { type: String, default: 'Cm' },
  preferredStyles: { type: [String], default: [] },
  avgPhraseBars:   { type: Number, default: 8 },
  pocketPosition:  { type: String, enum: ['ahead','on','behind'], default: 'on' },
}, { _id: false });

const ArtistSessionHistorySchema = new Schema<ArtistSessionHistory>({
  jobId:              { type: String, required: true },
  timestamp:          { type: Date, default: Date.now },
  bpm:                { type: Number, required: true },
  key:                { type: String, required: true },
  style:              { type: String, required: true },
  riddimFamilies:     { type: [String], default: [] },
  pocketPosition:     { type: String, enum: ['ahead','on','behind'], required: true },
  energyLevel:        { type: Number, required: true },
  hookRhythmTemplate: { type: String },
}, { _id: false });

const ArtistProfileSchema = new Schema<ArtistProfileDocument>({
  artistId:       { type: String, required: true, unique: true, index: true },
  displayName:    { type: String },
  preferences:    { type: ArtistPreferencesSchema, default: () => ({}) },
  sessionHistory: { type: [ArtistSessionHistorySchema], default: [] },
  totalSessions:  { type: Number, default: 0 },
}, { timestamps: true });

export const ArtistProfileModel: Model<ArtistProfileDocument> =
  (mongoose.models.ArtistProfile as Model<ArtistProfileDocument>) ||
  mongoose.model<ArtistProfileDocument>('ArtistProfile', ArtistProfileSchema);

export async function getOrCreateArtistProfile(artistId: string): Promise<ArtistProfileDocument> {
  await connectDB();
  const existing = await ArtistProfileModel.findOne({ artistId });
  if (existing) return existing;
  return ArtistProfileModel.create({
    artistId,
    preferences: {
      bpmRange: { min: 60, max: 160 },
      riddimFamilies: [],
      swingAmount: 0.5,
      grooveDepth: 0.5,
      basslineType: 'roots',
      chordFlavor: 'minor7',
      energyLevel: 0.5,
      dominantKey: 'Cm',
      preferredStyles: [],
      avgPhraseBars: 8,
      pocketPosition: 'on',
    },
    sessionHistory: [],
    totalSessions: 0,
  });
}

export async function updateArtistPreferences(
  artistId: string,
  sessionData: Omit<ArtistSessionHistory, 'timestamp'>,
): Promise<ArtistProfileDocument> {
  await connectDB();
  const profile = await getOrCreateArtistProfile(artistId);
  const prefs = profile.preferences;
  const history = profile.sessionHistory;
  const n = history.length;

  prefs.bpmRange.min = Math.min(prefs.bpmRange.min, sessionData.bpm);
  prefs.bpmRange.max = Math.max(prefs.bpmRange.max, sessionData.bpm);
  prefs.energyLevel = (prefs.energyLevel * n + sessionData.energyLevel) / (n + 1);

  const recentPockets = [...history.slice(-9), sessionData].map(s => s.pocketPosition);
  const pocketCounts = recentPockets.reduce((acc: Record<string,number>, p) => {
    acc[p] = (acc[p] ?? 0) + 1; return acc;
  }, {});
  prefs.pocketPosition = Object.entries(pocketCounts).sort((a,b) => b[1]-a[1])[0][0] as ArtistPreferences['pocketPosition'];

  const allStyles = [...history.map(s => s.style), sessionData.style];
  const styleCounts = allStyles.reduce((acc: Record<string,number>, s) => {
    acc[s] = (acc[s] ?? 0) + 1; return acc;
  }, {});
  prefs.preferredStyles = Object.entries(styleCounts).sort((a,b) => b[1]-a[1]).slice(0,3).map(e => e[0]);

  prefs.riddimFamilies = Array.from(new Set([...prefs.riddimFamilies, ...sessionData.riddimFamilies]));
  prefs.dominantKey = sessionData.key;

  const newSession: ArtistSessionHistory = { ...sessionData, timestamp: new Date() };
  const updatedHistory = [...history, newSession].slice(-50);

  return ArtistProfileModel.findOneAndUpdate(
    { artistId },
    { $set: { preferences: prefs, sessionHistory: updatedHistory }, $inc: { totalSessions: 1 } },
    { new: true, upsert: true },
  ) as Promise<ArtistProfileDocument>;
}
