import mongoose, { Document, Model, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import connectDB from './db';

export interface TrainingDataset {
  datasetId: string;
  voiceId: string;
  name: string;
  description: string;
  audioFileUrls: string[];    // URLs to training audio samples
  transcriptUrls: string[];   // Corresponding transcripts
  accentProfile: string;
  mode: string;
  durationMs: number;
  sampleCount: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  providerJobId?: string;     // External training job ID (e.g. 11Labs)
  createdAt: Date;
  updatedAt: Date;
}

interface TrainingDatasetDocument extends TrainingDataset, Document {}

const TrainingDatasetSchema = new Schema<TrainingDatasetDocument>({
  datasetId:     { type: String, required: true, unique: true, index: true },
  voiceId:       { type: String, required: true, index: true },
  name:          { type: String, required: true },
  description:   { type: String, default: '' },
  audioFileUrls: { type: [String], default: [] },
  transcriptUrls:{ type: [String], default: [] },
  accentProfile: { type: String, default: 'neutral' },
  mode:          { type: String, default: 'neutral' },
  durationMs:    { type: Number, default: 0 },
  sampleCount:   { type: Number, default: 0 },
  status:        { type: String, enum: ['pending','processing','ready','failed'], default: 'pending' },
  providerJobId: { type: String },
}, { timestamps: true });

export const TrainingDatasetModel: Model<TrainingDatasetDocument> =
  (mongoose.models.TrainingDataset as Model<TrainingDatasetDocument>) ||
  mongoose.model<TrainingDatasetDocument>('TrainingDataset', TrainingDatasetSchema);

/** Stub: Register a training dataset record. No actual training is triggered. */
export async function registerTrainingDataset(
  voiceId: string,
  metadata: {
    name: string;
    description?: string;
    audioFileUrls?: string[];
    transcriptUrls?: string[];
    accentProfile?: string;
    mode?: string;
    durationMs?: number;
    sampleCount?: number;
  },
): Promise<TrainingDatasetDocument> {
  await connectDB();
  return TrainingDatasetModel.create({
    datasetId: uuidv4(),
    voiceId,
    name: metadata.name,
    description: metadata.description ?? '',
    audioFileUrls: metadata.audioFileUrls ?? [],
    transcriptUrls: metadata.transcriptUrls ?? [],
    accentProfile: metadata.accentProfile ?? 'neutral',
    mode: metadata.mode ?? 'neutral',
    durationMs: metadata.durationMs ?? 0,
    sampleCount: metadata.sampleCount ?? 0,
    status: 'pending',
  });
}

/** Stub: List all training datasets (optionally filtered by voiceId). */
export async function listTrainingDatasets(voiceId?: string): Promise<TrainingDatasetDocument[]> {
  await connectDB();
  const filter = voiceId ? { voiceId } : {};
  return TrainingDatasetModel.find(filter).sort({ createdAt: -1 }).limit(100);
}

/** Stub: Get a single training dataset. */
export async function getTrainingDataset(datasetId: string): Promise<TrainingDatasetDocument | null> {
  await connectDB();
  return TrainingDatasetModel.findOne({ datasetId });
}
