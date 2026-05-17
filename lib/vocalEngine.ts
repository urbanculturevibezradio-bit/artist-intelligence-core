import type { HookRhythmTemplate, PocketMap, PocketBar } from '../types/pipeline';
import type { ArtistPreferences } from './artistMemory';

// ----- Types (also exported for types/pipeline.ts) -----
export interface Phoneme {
  symbol: string;       // IPA symbol e.g. 'dh','ae','t'
  durationMs: number;
  stepIndex: number;    // 0-15 grid position
  strength: number;     // 0-1 emphasis
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
  stability: number;      // 0-1 (11Labs)
  similarityBoost: number;// 0-1 (11Labs)
  modelId?: string;       // e.g. 'eleven_multilingual_v2'
}

export type FXType = 'reverb' | 'delay' | 'slapback' | 'telephone' | 'dub' | 'chorus' | 'dry';

export interface FXParam {
  fxType: FXType;
  wetDry: number;    // 0-1
  decayMs?: number;
  delayMs?: number;
  feedback?: number; // 0-1
  cutoffHz?: number; // for telephone
  modDepth?: number; // for chorus
}

export interface VocalFXChain {
  chain: FXParam[];
  masterGain: number; // 0-2
  preDelay?: number;  // ms before first FX
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

// ----- FX presets -----
export const FX_PRESETS: Record<string, VocalFXChain> = {
  dry:       { chain: [{ fxType: 'dry', wetDry: 1 }], masterGain: 1 },
  slapback:  { chain: [{ fxType: 'slapback', wetDry: 0.4, delayMs: 65, feedback: 0.1 }], masterGain: 1 },
  dub:       { chain: [{ fxType: 'dub', wetDry: 0.6, delayMs: 375, feedback: 0.45 }, { fxType: 'reverb', wetDry: 0.35, decayMs: 800 }], masterGain: 0.9 },
  telephone: { chain: [{ fxType: 'telephone', wetDry: 0.85, cutoffHz: 3400 }, { fxType: 'chorus', wetDry: 0.1, modDepth: 0.2 }], masterGain: 1.1 },
  reverb:    { chain: [{ fxType: 'reverb', wetDry: 0.5, decayMs: 1200 }], masterGain: 1 },
  delay:     { chain: [{ fxType: 'delay', wetDry: 0.45, delayMs: 250, feedback: 0.3 }], masterGain: 1 },
};

// ----- Style-to-phoneme syllable maps -----
const SYLLABLE_MAPS: Record<VocalStyle, string[]> = {
  deejay:   ['yu','bad','man','inna','di','place','nuh','watch','dis'],
  singjay:  ['oh','yeah','rise','up','feel','di','vibes','inna','di','night'],
  chant:    ['fire','blaze','rise','burn','it','down','higher'],
  toasting: ['big','tune','drop','it','now','move','your','body','go'],
  spoken:   ['listen','close','now','hear','me','speak','the','truth'],
};

// Minimal IPA approximation per syllable
function syllableToPhonemes(syllable: string): string[] {
  const map: Record<string, string[]> = {
    'yu':['j','u:'], 'bad':['b','ae','d'], 'man':['m','ae','n'],
    'fire':['f','aɪ','ə'], 'rise':['r','aɪ','z'], 'yeah':['j','ɛ','ə'],
    'now':['n','aʊ'], 'go':['g','əʊ'], 'listen':['l','ɪ','s','ə','n'],
  };
  return map[syllable] ?? syllable.split('');
}

/**
 * Generate a timing-aligned phoneme sequence from a hook template + pocket map.
 */
export function generateHookVocal(
  jobId: string,
  template: HookRhythmTemplate,
  pocketMap: PocketMap,
  prefs: ArtistPreferences,
): PhonemeSequence {
  const vocalStyle: VocalStyle = (() => {
    const style = (prefs.preferredStyles[0] ?? '').toLowerCase();
    if (style.includes('dancehall')) return 'deejay';
    if (style.includes('reggae') || style.includes('roots')) return 'singjay';
    if (style.includes('steppa')) return 'chant';
    return 'deejay';
  })();
  const syllables = SYLLABLE_MAPS[vocalStyle];
  const phonemes: Phoneme[] = [];
  let syllableIdx = 0;
  const bar = pocketMap.bars[0] as PocketBar | undefined;
  const hitSteps = bar ? bar.zones.filter(z => z.zoneType === 'hit' || z.zoneType === 'accent') : [];
  for (const zone of hitSteps) {
    const syllable = syllables[syllableIdx % syllables.length];
    syllableIdx++;
    const sounds = syllableToPhonemes(syllable);
    const stepDur = pocketMap.stepDurationMs / sounds.length;
    sounds.forEach((sym, i) => {
      phonemes.push({
        symbol: sym,
        durationMs: stepDur,
        stepIndex: zone.stepIndex,
        strength: zone.strength,
        isAccent: zone.zoneType === 'accent' && i === 0,
      });
    });
  }
  return {
    jobId, phonemes,
    totalDurationMs: pocketMap.bars.length * 4 * (60000 / pocketMap.bpm),
    bpm: pocketMap.bpm,
    templateId: template.id,
  };
}

/**
 * Call external TTS/voice API to synthesise vocals from a phoneme sequence.
 * Production: replace mock with real 11Labs or local TTS call.
 */
export async function applyVoiceModel(
  seq: PhonemeSequence,
  config: VoiceModelConfig,
): Promise<Buffer> {
  if (config.provider === '11labs') {
    const text = seq.phonemes.map(p => p.symbol).join(' ');
    const resp = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + config.voiceId,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: config.modelId ?? 'eleven_multilingual_v2',
          voice_settings: { stability: config.stability, similarity_boost: config.similarityBoost },
        }),
      },
    );
    if (!resp.ok) throw new Error('11Labs API error: ' + resp.status);
    return Buffer.from(await resp.arrayBuffer());
  }
  // mock / local: return silent WAV (44 bytes header)
  return buildSilentWav(seq.totalDurationMs);
}

/**
 * Apply FX chain to audio buffer (mock implementation).
 * Production: pipe through ffmpeg, sox, or Web Audio API.
 */
export function applyVocalFX(audioBuffer: Buffer, fxChain: VocalFXChain): Buffer {
  // In production: spawn ffmpeg process with appropriate filters
  // e.g. reverb: aecho, delay: adelay, telephone: highpass+lowpass, chorus: chorus
  // Mock: return the buffer unchanged
  return audioBuffer;
}

// --- WAV helpers ---
function buildSilentWav(durationMs: number): Buffer {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const dataSize = numSamples * 2; // 16-bit mono
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}
