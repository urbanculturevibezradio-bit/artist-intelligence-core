import mongoose, { Document, Model, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import connectDB from './db';
import type { PhonemeSequence } from './vocalEngine';
import type { PocketMap } from './pocketMap';

export type VocalMode = 'chant' | 'singjay' | 'deejay' | 'radio' | 'neutral';
export type AccentProfile = 'heavy-patois' | 'light-patois' | 'diaspora' | 'trini' | 'bajan' | 'guyanese';

export interface CaribbeanVoiceModel {
  voiceId: string;
  name: string;
  origin: string;              // e.g. 'Jamaica', 'Trinidad', 'Barbados'
  accentProfiles: AccentProfile[];
  supportedModes: VocalMode[];
  provider: 'local' | '11labs' | 'mock';
  externalVoiceId?: string;    // 11Labs voice ID if provider=11labs
  sampleUrl?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SynthesisRequest {
  voiceId: string;
  text?: string;
  phonemes?: PhonemeSequence;
  pocketMap?: PocketMap;
  mode: VocalMode;
  energy: number;             // 0-1
  accentProfile: AccentProfile;
}

export interface SynthesisResult {
  voiceId: string;
  mode: VocalMode;
  accentProfile: AccentProfile;
  audioBuffer: Buffer;
  durationMs: number;
  phonemeCount: number;
  synthesizedAt: Date;
}

interface CaribbeanVoiceDocument extends CaribbeanVoiceModel, Document {}

const CaribbeanVoiceSchema = new Schema<CaribbeanVoiceDocument>({
  voiceId:         { type: String, required: true, unique: true, index: true },
  name:            { type: String, required: true },
  origin:          { type: String, required: true },
  accentProfiles:  { type: [String], default: [] },
  supportedModes:  { type: [String], default: [] },
  provider:        { type: String, enum: ['local','11labs','mock'], default: 'mock' },
  externalVoiceId: { type: String },
  sampleUrl:       { type: String },
  active:          { type: Boolean, default: true },
}, { timestamps: true });

export const CaribbeanVoiceModelDoc: Model<CaribbeanVoiceDocument> =
  (mongoose.models.CaribbeanVoice as Model<CaribbeanVoiceDocument>) ||
  mongoose.model<CaribbeanVoiceDocument>('CaribbeanVoice', CaribbeanVoiceSchema);

// Accent phoneme transformation maps
const ACCENT_TRANSFORMS: Record<AccentProfile, Record<string, string>> = {
  'heavy-patois': { th:'d', 'th_v':'d', 'ing':'in', 'er':'a', 'the':'di', 'is':'iz' },
  'light-patois': { th:'t', 'ing':'in', 'er':'a' },
  'diaspora':     { th:'t', 'ing':'ing', 'er':'er' },
  'trini':        { th:'t', 'wh':'w', 'ing':'in', 'er':'ah' },
  'bajan':        { th:'d', 'ing':'in', 'er':'uh', 'ck':'k' },
  'guyanese':     { th:'t', 'ing':'in', 'er':'ah', 'or':'aw' },
};

// Mode energy and rate multipliers
const MODE_PARAMS: Record<VocalMode, { rateMultiplier: number; pitchShift: number; breathiness: number }> = {
  chant:   { rateMultiplier: 0.75, pitchShift: +2, breathiness: 0.3 },
  singjay: { rateMultiplier: 0.9,  pitchShift: +4, breathiness: 0.2 },
  deejay:  { rateMultiplier: 1.1,  pitchShift:  0, breathiness: 0.1 },
  radio:   { rateMultiplier: 1.0,  pitchShift:  0, breathiness: 0.0 },
  neutral: { rateMultiplier: 1.0,  pitchShift:  0, breathiness: 0.1 },
};

function applyAccentToText(text: string, accent: AccentProfile): string {
  const transforms = ACCENT_TRANSFORMS[accent];
  let result = text.toLowerCase();
  for (const [from, to] of Object.entries(transforms)) {
    result = result.replace(new RegExp(from, 'g'), to);
  }
  return result;
}

function buildSilentWav(durationMs: number): Buffer {
  const sr = 44100, samples = Math.floor(sr * durationMs / 1000), dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF',0); buf.writeUInt32LE(36+dataSize,4); buf.write('WAVE',8); buf.write('fmt ',12);
  buf.writeUInt32LE(16,16); buf.writeUInt16LE(1,20); buf.writeUInt16LE(1,22);
  buf.writeUInt32LE(sr,24); buf.writeUInt32LE(sr*2,28); buf.writeUInt16LE(2,32);
  buf.writeUInt16LE(16,34); buf.write('data',36); buf.writeUInt32LE(dataSize,40);
  return buf;
}

export async function loadCaribbeanVoiceModel(voiceId: string): Promise<CaribbeanVoiceDocument | null> {
  await connectDB();
  return CaribbeanVoiceModelDoc.findOne({ voiceId, active: true });
}

export async function synthesizeCaribbeanSpeech(req: SynthesisRequest): Promise<SynthesisResult> {
  await connectDB();
  const model = await CaribbeanVoiceModelDoc.findOne({ voiceId: req.voiceId });
  const modeParams = MODE_PARAMS[req.mode];
  const text = req.text ? applyAccentToText(req.text, req.accentProfile) : '';
  const phonemeCount = req.phonemes?.phonemes.length ?? text.split(' ').length * 3;
  const baseDurationMs = phonemeCount * 80 * (1 / modeParams.rateMultiplier) * (1 + (1 - req.energy) * 0.5);

  let audioBuffer: Buffer;
  if (model?.provider === '11labs' && model.externalVoiceId && process.env.ELEVENLABS_API_KEY) {
    try {
      const resp = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + model.externalVoiceId, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text || 'riddim vibes',
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      audioBuffer = resp.ok ? Buffer.from(await resp.arrayBuffer()) : buildSilentWav(baseDurationMs);
    } catch { audioBuffer = buildSilentWav(baseDurationMs); }
  } else {
    audioBuffer = buildSilentWav(baseDurationMs);
  }

  return {
    voiceId: req.voiceId,
    mode: req.mode,
    accentProfile: req.accentProfile,
    audioBuffer,
    durationMs: baseDurationMs,
    phonemeCount,
    synthesizedAt: new Date(),
  };
}

export async function seedCaribbeanVoices(): Promise<void> {
  await connectDB();
  if (await CaribbeanVoiceModelDoc.countDocuments() > 0) return;
  const seeds = [
    { voiceId: 'cv-jm-deejay-01', name: 'Kingston Deejay', origin: 'Jamaica', accentProfiles: ['heavy-patois','light-patois'], supportedModes: ['deejay','chant','neutral'], provider: 'mock' },
    { voiceId: 'cv-jm-singjay-01', name: 'Yard Singjay', origin: 'Jamaica', accentProfiles: ['heavy-patois','diaspora'], supportedModes: ['singjay','deejay','chant'], provider: 'mock' },
    { voiceId: 'cv-tt-01', name: 'Port of Spain Voice', origin: 'Trinidad', accentProfiles: ['trini','diaspora'], supportedModes: ['radio','deejay','neutral'], provider: 'mock' },
    { voiceId: 'cv-bb-01', name: 'Bajan Chanter', origin: 'Barbados', accentProfiles: ['bajan','light-patois'], supportedModes: ['chant','singjay','neutral'], provider: 'mock' },
    { voiceId: 'cv-gy-01', name: 'Guyanese Flow', origin: 'Guyana', accentProfiles: ['guyanese','diaspora'], supportedModes: ['deejay','radio','neutral'], provider: 'mock' },
  ];
  for (const s of seeds) await CaribbeanVoiceModelDoc.create({ ...s, active: true });
}
