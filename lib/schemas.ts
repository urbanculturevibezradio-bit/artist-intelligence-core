// ============================================================
// lib/schemas.ts — Mongoose schemas for MongoDB metadata
// ============================================================
import mongoose, { Schema, Document, Model } from 'mongoose';
import type {
  UploadJob,
  PipelineState,
  WhisperTimingResult,
  MelodyExtractionResult,
  BpmGrooveResult,
  StyleClassifierResult,
  RiddimPackage,
  FingerprintValidationResult,
} from '@/types/pipeline';

// ---- UploadJob Schema ----
export interface IUploadJob extends UploadJob, Document {}

const UploadJobSchema = new Schema<IUploadJob>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    originalFilename: { type: String, required: true },
    format: { type: String, enum: ['wav', 'mp3'], required: true },
    tempPath: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
    },
    userId: { type: String },
  },
  { timestamps: true }
);

// ---- PipelineState Schema ----
export interface IPipelineState extends Document {
  jobId: string;
  uploadedAt: Date;
  completedWorkers: string[];
  results: Record<string, unknown>;
  status: string;
  error?: string;
}

const PipelineStateSchema = new Schema<IPipelineState>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    uploadedAt: { type: Date, default: Date.now },
    completedWorkers: [{ type: String }],
    results: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
    },
    error: { type: String },
  },
  { timestamps: true }
);

// ---- RiddimPackage Schema ----
export interface IRiddimPackage extends RiddimPackage, Document {}

const StemFileSchema = new Schema({
  name: String,
  path: String,
  type: { type: String, enum: ['drums', 'bass', 'chords', 'perc', 'fx', 'melody'] },
  sampleRate: Number,
  durationMs: Number,
});

const RiddimPackageSchema = new Schema<IRiddimPackage>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    packagePath: { type: String, required: true },
    stems: [StemFileSchema],
    masterBpm: { type: Number, required: true },
    masterKey: { type: String, required: true },
    style: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    totalDurationMs: { type: Number, required: true },
  },
  { timestamps: true }
);

// ---- Model factories (singleton pattern for Next.js) ----
function getModel<T extends Document>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, schema);
}

export const UploadJobModel = () => getModel<IUploadJob>('UploadJob', UploadJobSchema);
export const PipelineStateModel = () => getModel<IPipelineState>('PipelineState', PipelineStateSchema);
export const RiddimPackageModel = () => getModel<IRiddimPackage>('RiddimPackage', RiddimPackageSchema);
