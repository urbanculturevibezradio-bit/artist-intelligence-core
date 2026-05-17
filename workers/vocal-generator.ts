import path from 'path';
import fs from 'fs';
import { Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { connectToDatabase } from '@/lib/db';
import { PipelineStateModel } from '@/lib/schemas';
import { getOrCreateArtistProfile } from '@/lib/artistMemory';
import {
  generateHookVocal,
  applyVoiceModel,
  applyVocalFX,
  FX_PRESETS,
  VoiceModelConfig,
  VocalFXChain,
  VocalDemo,
} from '@/lib/vocalEngine';
import { buildPocketMap } from '@/lib/pocketMap';
import { analyseFlowPattern } from '@/lib/flowPatterns';
import mongoose, { Schema, Model, Document } from 'mongoose';

// ---- VocalDemo Mongoose schema ----
interface VocalDemoDocument extends VocalDemo, Document {}

const VocalDemoSchema = new Schema<VocalDemoDocument>({
  jobId:            { type: String, required: true, index: true },
  artistId:         { type: String, required: true },
  templateId:       { type: String, required: true },
  phonemeSequence:  { type: Object, required: true },
  voiceConfig:      { type: Object, required: true },
  fxChain:          { type: Object, required: true },
  wavUrl:           { type: String, required: true },
  durationMs:       { type: Number, required: true },
  status:           { type: String, enum: ['pending','processing','completed','failed'], default: 'pending' },
  error:            { type: String },
  generatedAt:      { type: Date, default: Date.now },
}, { timestamps: true });

export const VocalDemoModel: Model<VocalDemoDocument> =
  (mongoose.models.VocalDemo as Model<VocalDemoDocument>) ||
  mongoose.model<VocalDemoDocument>('VocalDemo', VocalDemoSchema);

// ---- Worker payload ----
interface VocalGeneratorPayload {
  jobId: string;
  artistId: string;
  templateId: string;
  fxPreset?: string;
  voiceConfig?: Partial<VoiceModelConfig>;
}

export const vocalGeneratorWorker = createWorker<VocalGeneratorPayload>(
  'vocal-generator',
  async (job: Job<VocalGeneratorPayload>) => {
    const { jobId, artistId, templateId, fxPreset = 'dub', voiceConfig: vcOverride } = job.data;
    await connectToDatabase();

    // Mark pending
    await VocalDemoModel.findOneAndUpdate(
      { jobId, templateId },
      { $set: { status: 'processing', artistId, templateId } },
      { upsert: true },
    );

    try {
      // Load pipeline state
      const state = await PipelineStateModel.findOne({ jobId });
      if (!state?.whisperTiming || !state?.bpmGroove) throw new Error('Pipeline not complete for job ' + jobId);

      // Build pocket map
      const flow = analyseFlowPattern(jobId, state.whisperTiming, state.bpmGroove);
      const pocketMap = buildPocketMap(jobId, flow, state.bpmGroove);

      // Load artist prefs
      const profile = await getOrCreateArtistProfile(artistId);

      // Find template from hook ideas (or use default)
      const template = state.hookIdeas?.templates?.find((t: any) => t.id === templateId) ?? {
        id: templateId, name: 'Default', sectionType: 'chorus',
        barLength: 2, pattern: [1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0],
        accentSteps: [0,8], restSteps: [1,3,5,7,9,11,13,15],
        energyLevel: profile.preferences.energyLevel,
        syncopationLevel: flow.syncopationScore,
        description: 'Auto template',
      };

      // 1. Generate phoneme sequence
      const phonemeSeq = generateHookVocal(jobId, template, pocketMap, profile.preferences);

      // 2. Voice model config
      const voiceConfig: VoiceModelConfig = {
        provider: (process.env.ELEVENLABS_API_KEY ? '11labs' : 'mock') as VoiceModelConfig['provider'],
        voiceId: vcOverride?.voiceId ?? process.env.ELEVENLABS_DEFAULT_VOICE ?? 'mock-voice',
        vocalStyle: vcOverride?.vocalStyle ?? 'deejay',
        stability: vcOverride?.stability ?? 0.5,
        similarityBoost: vcOverride?.similarityBoost ?? 0.75,
        modelId: vcOverride?.modelId,
      };

      // 3. Synthesise
      const rawAudio = await applyVoiceModel(phonemeSeq, voiceConfig);

      // 4. Apply FX
      const fxChain: VocalFXChain = FX_PRESETS[fxPreset] ?? FX_PRESETS['dub'];
      const processedAudio = applyVocalFX(rawAudio, fxChain);

      // 5. Write WAV to /tmp
      const tmpDir = path.join('/tmp', 'vocals');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const filename = jobId + '_' + templateId + '.wav';
      const wavPath = path.join(tmpDir, filename);
      fs.writeFileSync(wavPath, processedAudio);
      const wavUrl = '/api/vocals/stream?jobId=' + jobId + '&templateId=' + templateId;

      // 6. Persist VocalDemo
      await VocalDemoModel.findOneAndUpdate(
        { jobId, templateId },
        { $set: { phonemeSequence: phonemeSeq, voiceConfig, fxChain, wavUrl, durationMs: phonemeSeq.totalDurationMs, status: 'completed', generatedAt: new Date() } },
        { upsert: true, new: true },
      );

      return { jobId, wavUrl, durationMs: phonemeSeq.totalDurationMs };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await VocalDemoModel.findOneAndUpdate(
        { jobId, templateId },
        { $set: { status: 'failed', error: msg } },
      );
      throw err;
    }
  },
);
