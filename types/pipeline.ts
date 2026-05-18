// ============================================================
// types/pipeline.ts — Shared TypeScript interfaces & schemas
// ============================================================

export type AudioFormat = 'wav' | 'mp3';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

// ---- Job / Upload ----
export interface UploadJob {
  jobId: string;
  originalFilename: string;
  format: AudioFormat;
  tempPath: string;
  sizeBytes: number;
  uploadedAt: Date;
  status: JobStatus;
  userId?: string;
}

// ---- Onset / Timing ----
export interface OnsetEvent {
  timeMs: number;
  strength: number; // 0-1
  isBreath: boolean;
}

export interface WhisperTimingResult {
  jobId: string;
  durationMs: number;
  onsets: OnsetEvent[];
  phrases: PhraseSegment[];
  breathSpacing: number[]; // gaps in ms between breath events
  tempoEstimate: number; // BPM from onset density
}

export interface PhraseSegment {
  startMs: number;
  endMs: number;
  label: string; // 'verse', 'hook', 'bridge', etc.
  syllableCount?: number;
}

// ---- Melody ----
export type MusicalKey =
  | 'C' | 'C#' | 'Db' | 'D' | 'D#' | 'Eb'
  | 'E' | 'F' | 'F#' | 'Gb' | 'G' | 'G#' | 'Ab'
  | 'A' | 'A#' | 'Bb' | 'B';

export type MusicalScale = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'pentatonic' | 'chromatic';

export interface PitchPoint {
  timeMs: number;
  hz: number;
  midi: number; // 0-127
  confidence: number; // 0-1
}

export interface MelodyExtractionResult {
  jobId: string;
  pitchCurve: PitchPoint[];
  intervals: number[]; // semitone intervals between consecutive notes
  contour: 'ascending' | 'descending' | 'arch' | 'valley' | 'flat';
  key: MusicalKey;
  scale: MusicalScale;
  rangeHz: { min: number; max: number };
  dominantNotes: string[]; // note names e.g. ['C4', 'G4']
}

// ---- BPM / Groove ----
export type GrooveType = 'straight' | 'swing' | 'shuffle' | 'half-time' | 'double-time';

export interface DownbeatEvent {
  timeMs: number;
  barNumber: number;
  confidence: number;
}

export interface BpmGrooveResult {
  jobId: string;
  bpm: number;
  bpmConfidence: number;
  grooveType: GrooveType;
  swingRatio: number; // 0.5 = straight, 0.67 = triplet swing
  syncopation: number; // 0-1 score
  downbeats: DownbeatEvent[];
  timeSignature: string; // '4/4', '3/4', '6/8'
}

// ---- Style ----
export type RiddimStyle =
  | 'dancehall'
  | 'reggae'
  | 'afro-fusion'
  | 'rub-a-dub'
  | 'steppa'
  | 'roots'
  | 'lovers-rock'
  | 'bashment'
  | 'digital-reggae'
  | 'afrobeats';

export interface StyleClassifierResult {
  jobId: string;
  primaryStyle: RiddimStyle;
  styleScores: Record<RiddimStyle, number>; // 0-1 per style
  embedding: number[]; // pgvector-ready 512-dim float array
  confidence: number;
  subgenreTags: string[];
}

// ---- Riddim Generation ----
export interface DrumPattern {
  kick: number[]; // 16-step grid (0/1)
  snare: number[];
  hihat: number[];
  rimshot: number[];
  perc: number[];
  swingAmount: number;
}

export interface BasslinePattern {
  notes: Array<{ step: number; midi: number; velocity: number; durationSteps: number }>;
  octave: number;
  style: 'reggae-skank' | 'steppa-sub' | 'dancehall-rolling' | 'afro-walking';
}

export interface ChordVoicing {
  step: number;
  notes: number[]; // midi note array
  duration: string; // '1/4', '1/2', '1/1'
  velocity: number;
}

export interface RiddimGenerationRequest {
  jobId: string;
  bpm: number;
  key: MusicalKey;
  scale: MusicalScale;
  style: RiddimStyle;
  bars: number; // number of bars to generate
  drums: boolean;
  bassline: boolean;
  chords: boolean;
  percussion: boolean;
  fx: boolean;
  referenceEmbedding?: number[]; // optional style vector
}

export interface RiddimGenerationResult {
  jobId: string;
  bpm: number;
  key: MusicalKey;
  bars: number;
  drums?: DrumPattern;
  bassline?: BasslinePattern;
  chords?: ChordVoicing[];
  percussionLayers?: DrumPattern[];
  fxParameters?: FxParameters;
}

export interface FxParameters {
  reverb: { wet: number; decay: number };
  delay: { bpm: number; feedback: number; wet: number };
  distortion?: { drive: number };
  filterCutoff?: number; // 20-20000 Hz
}

// ---- Stem Assembly ----
export interface StemFile {
  name: string;
  path: string;
  type: 'drums' | 'bass' | 'chords' | 'perc' | 'fx' | 'melody';
  sampleRate: number;
  durationMs: number;
}

export interface RiddimPackage {
  jobId: string;
  packagePath: string;
  stems: StemFile[];
  masterBpm: number;
  masterKey: MusicalKey;
  style: RiddimStyle;
  createdAt: Date;
  totalDurationMs: number;
}

// ---- Fingerprint / Validation ----
export interface FingerprintValidationResult {
  jobId: string;
  passed: boolean;
  similarityScore: number; // 0-1 cosine similarity vs reference
  bpmAccuracy: number; // |generated - target| / target
  styleAccuracy: number; // 0-1
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'bpm_drift' | 'style_mismatch' | 'key_clash' | 'timing_error' | 'duplicate_detected';
  severity: 'warning' | 'error';
  detail: string;
}

// ---- Worker Queue ----
export type WorkerName =
  | 'whisper-timing'
  | 'melody-extraction'
  | 'bpm-groove'
  | 'style-classifier'
  | 'riddim-generator'
  | 'stem-assembler'
  | 'fingerprint-validator';

export interface PipelineJob {
  jobId: string;
  worker: WorkerName;
  payload: unknown;
  priority?: number;
  attempts?: number;
}

export interface PipelineState {
  jobId: string;
  uploadedAt: Date;
  completedWorkers: WorkerName[];
  results: Partial<{
    whisperTiming: WhisperTimingResult;
    melodyExtraction: MelodyExtractionResult;
    bpmGroove: BpmGrooveResult;
    styleClassifier: StyleClassifierResult;
    riddimGeneration: RiddimGenerationResult;
    stemAssembler: RiddimPackage;
    fingerprintValidator: FingerprintValidationResult;
  }>;
  status: JobStatus;
  error?: string;
}

// ---- Flow Pattern ----
export interface PhraseSegment {
  startSec: number;
  endSec: number;
  durationSec: number;
  syllableCount: number;
  syllableDensity: number;
  hasBreathAfter: boolean;
  accentPositions: number[];
}

export interface FlowPatternProfile {
  jobId: string;
  cadence: number;
  avgSyllableDensity: number;
  avgPhraseLength: number;
  avgBreathSpacing: number;
  syncopationScore: number;
  accentPlacement: 'downbeat' | 'backbeat' | 'mixed';
  pocketPosition: 'ahead' | 'on' | 'behind';
  pocketOffsetMs: number;
  phrases: PhraseSegment[];
  totalOnsets: number;
  analyzedAt: Date;
}

// ---- Pocket Map ----
export type ZoneType = 'hit' | 'rest' | 'accent' | 'breath';

export interface PocketZone {
  stepIndex: number;
  zoneType: ZoneType;
  strength: number;
  pocketOffsetMs: number;
}

export interface PocketBar {
  barIndex: number;
  zones: PocketZone[];
  dominantZone: ZoneType;
  avgPocketOffset: number;
}

export interface PocketMap {
  jobId: string;
  bpm: number;
  totalBars: number;
  stepDurationMs: number;
  bars: PocketBar[];
  globalPocketPosition: 'ahead' | 'on' | 'behind';
  globalOffsetMs: number;
  generatedAt: Date;
}

// ---- Hook Ideas ----
export type HookSectionType = 'chorus' | 'verse' | 'bridge' | 'intro' | 'outro';

export interface HookRhythmTemplate {
  id: string;
  name: string;
  sectionType: HookSectionType;
  barLength: number;
  pattern: number[];
  accentSteps: number[];
  restSteps: number[];
  energyLevel: number;
  syncopationLevel: number;
  description: string;
}

export interface CallAndResponsePattern {
  callBars: number;
  responseBars: number;
  callPattern: number[];
  responsePattern: number[];
  callAccents: number[];
  responseAccents: number[];
}

export interface HookIdeas {
  jobId: string;
  templates: HookRhythmTemplate[];
  callAndResponse: CallAndResponsePattern[];
  suggestedBarLengths: number[];
  chorusContrast: string;
  generatedAt: Date;
}

// ---- Artist Profile (summary for API) ----
export interface ArtistPreferencesPublic {
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

export interface ArtistProfileSummary {
  artistId: string;
  displayName?: string;
  preferences: ArtistPreferencesPublic;
  totalSessions: number;
}

// ---- Vocal Engine (Phase 4) ----
export interface Phoneme {
  symbol: string;
  durationMs: number;
  stepIndex: number;
  strength: number;
  isAccent: boolean;
}

export interface PhonemeSequence {
  jobId: string;
  phonemes: Phoneme[];
  totalDurationMs: number;
  bpm: number;
  templateId: string;
}

export type VoiceModelProvider = '11labs' | 'local' | 'mock';
export type VocalStyle = 'deejay' | 'singjay' | 'chant' | 'toasting' | 'spoken';

export interface VoiceModelConfig {
  provider: VoiceModelProvider;
  voiceId: string;
  vocalStyle: VocalStyle;
  stability: number;
  similarityBoost: number;
  modelId?: string;
}

export type FXType = 'reverb' | 'delay' | 'slapback' | 'telephone' | 'dub' | 'chorus' | 'dry';

export interface FXParam {
  fxType: FXType;
  wetDry: number;
  decayMs?: number;
  delayMs?: number;
  feedback?: number;
  cutoffHz?: number;
  modDepth?: number;
}

export interface VocalFXChain {
  chain: FXParam[];
  masterGain: number;
  preDelay?: number;
}

export interface VocalDemo {
  jobId: string;
  artistId: string;
  templateId: string;
  phonemeSequence: PhonemeSequence;
  voiceConfig: VoiceModelConfig;
  fxChain: VocalFXChain;
  wavUrl: string;
  durationMs: number;
  generatedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// ---- Packs & Marketplace (Phase 5) ----
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

export type MarketplaceItemType = 'riddim' | 'stem' | 'voice' | 'hook' | 'pack';

export interface MarketplaceItem {
  itemId: string;
  type: MarketplaceItemType;
  sourceId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  previewUrl?: string;
  downloadUrl?: string;
  tags: string[];
  bpm?: number;
  key?: string;
  style?: string;
  artistId: string;
  featured: boolean;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---- Caribbean Vocal Intelligence (Phase 6) ----
export type VocalMode = 'chant' | 'singjay' | 'deejay' | 'radio' | 'neutral';
export type AccentProfile = 'heavy-patois' | 'light-patois' | 'diaspora' | 'trini' | 'bajan' | 'guyanese';

export interface CaribbeanVoiceModel {
  voiceId: string;
  name: string;
  origin: string;
  accentProfiles: AccentProfile[];
  supportedModes: VocalMode[];
  provider: 'local' | '11labs' | 'mock';
  externalVoiceId?: string;
  sampleUrl?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingDataset {
  datasetId: string;
  voiceId: string;
  name: string;
  description: string;
  audioFileUrls: string[];
  transcriptUrls: string[];
  accentProfile: string;
  mode: string;
  durationMs: number;
  sampleCount: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  providerJobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtistVoiceSettings {
  voiceId: string;
  mode: VocalMode;
  energy: number;
  accentProfile: AccentProfile;
  deliveryStyle: string;
  pitchShiftSt: number;
  reverbWet: number;
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

export interface VocalPerformanceRequest {
  phonemes: PhonemeSequence;
  pocketMap: PocketMap;
  mode: VocalMode;
  energy: number;
  accentProfile: AccentProfile;
}

export interface PerformedPhoneme extends Phoneme {
  absoluteTimeMs: number;
  pocketOffsetMs: number;
  barIndex: number;
  scaledDurationMs: number;
  pitchShiftSt: number;
  breathiness: number;
  accentedSymbol: string;
}

export interface VocalPerformanceSequence {
  phonemes: PerformedPhoneme[];
  totalDurationMs: number;
  bpm: number;
  mode: VocalMode;
  accentProfile: AccentProfile;
  energy: number;
  generatedAt: Date;
}
