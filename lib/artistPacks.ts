import mongoose, { Document, Model, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import connectDB from './db';
import { PipelineStateModel } from './schemas';
import { VocalDemoModel } from '../workers/vocal-generator';

export interface ArtistPackAssets {
  riddimPackageUrl?: string;
  stemUrls: string[];
  flowPatternSummary?: object;
  pocketMapSummary?: object;
  hookTemplates: object[];
  vocalDemoUrls: string[];
}

export interface ArtistPack {
  packId: string;
  artistId: string;
  name: string;
  jobIds: string[];
  assets: ArtistPackAssets;
  totalDurationMs: number;
  bpmRange: { min: number; max: number };
  styles: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ArtistPackDocument extends ArtistPack, Document {}

const ArtistPackSchema = new Schema<ArtistPackDocument>({
  packId:          { type: String, required: true, unique: true, index: true },
  artistId:        { type: String, required: true, index: true },
  name:            { type: String, required: true },
  jobIds:          { type: [String], default: [] },
  assets:          { type: Object, default: {} },
  totalDurationMs: { type: Number, default: 0 },
  bpmRange:        { type: { min: Number, max: Number }, default: { min: 120, max: 120 } },
  styles:          { type: [String], default: [] },
}, { timestamps: true });

export const ArtistPackModel: Model<ArtistPackDocument> =
  (mongoose.models.ArtistPack as Model<ArtistPackDocument>) ||
  mongoose.model<ArtistPackDocument>('ArtistPack', ArtistPackSchema);

export async function createArtistPack(
  artistId: string,
  jobIds: string[],
  name?: string,
): Promise<ArtistPackDocument> {
  await connectDB();
  const packId = uuidv4();

  // Gather assets from each job
  const stemUrls: string[] = [];
  const vocalDemoUrls: string[] = [];
  const hookTemplates: object[] = [];
  const bpms: number[] = [];
  const styles: Set<string> = new Set();
  let totalDurationMs = 0;
  let flowPatternSummary: object | undefined;
  let pocketMapSummary: object | undefined;

  for (const jobId of jobIds) {
    const state = await PipelineStateModel.findOne({ jobId }).lean();
    if (!state) continue;
    if (state.bpmGroove?.bpm) bpms.push(state.bpmGroove.bpm);
    if (state.styleClassifier?.topStyle) styles.add(state.styleClassifier.topStyle);
    if (state.riddimPackage?.stemUrls) stemUrls.push(...state.riddimPackage.stemUrls);
    if (state.riddimPackage?.totalDurationMs) totalDurationMs += state.riddimPackage.totalDurationMs;
    if (state.hookIdeas?.templates) hookTemplates.push(...state.hookIdeas.templates.slice(0, 2));
    if (!flowPatternSummary && state.flowPattern) {
      flowPatternSummary = {
        pocketPosition: state.flowPattern.pocketPosition,
        syncopationScore: state.flowPattern.syncopationScore,
        avgPhraseLength: state.flowPattern.avgPhraseLength,
      };
    }
    if (!pocketMapSummary && state.pocketMap) {
      pocketMapSummary = {
        totalBars: state.pocketMap.totalBars,
        globalPocketPosition: state.pocketMap.globalPocketPosition,
      };
    }
    const vocals = await VocalDemoModel.find({ jobId, status: 'completed' }).lean();
    vocalDemoUrls.push(...vocals.map((v: any) => v.wavUrl));
  }

  const bpmMin = bpms.length ? Math.min(...bpms) : 120;
  const bpmMax = bpms.length ? Math.max(...bpms) : 120;

  return ArtistPackModel.create({
    packId,
    artistId,
    name: name ?? 'Pack ' + new Date().toISOString().slice(0,10),
    jobIds,
    assets: { stemUrls, vocalDemoUrls, hookTemplates, flowPatternSummary, pocketMapSummary },
    totalDurationMs,
    bpmRange: { min: bpmMin, max: bpmMax },
    styles: Array.from(styles),
  });
}

export async function getArtistPack(packId: string): Promise<ArtistPackDocument | null> {
  await connectDB();
  return ArtistPackModel.findOne({ packId });
}

export async function listArtistPacks(artistId: string): Promise<ArtistPackDocument[]> {
  await connectDB();
  return ArtistPackModel.find({ artistId }).sort({ createdAt: -1 }).limit(50);
}
