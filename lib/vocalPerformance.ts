import type { Phoneme, PhonemeSequence } from './vocalEngine';
import type { PocketMap, PocketZone } from './pocketMap';
import type { VocalMode, AccentProfile } from './caribbeanVoices';

export interface AlignedPhoneme extends Phoneme {
  absoluteTimeMs: number;   // time-aligned to pocket map grid
  pocketOffsetMs: number;   // pocket deviation applied
  barIndex: number;
  stepIndex: number;
}

export interface PerformedPhoneme extends AlignedPhoneme {
  scaledDurationMs: number; // after energy scaling
  pitchShiftSt: number;     // semitones
  breathiness: number;      // 0-1
  accentedSymbol: string;   // symbol after accent transform
}

export interface VocalPerformanceRequest {
  phonemes: PhonemeSequence;
  pocketMap: PocketMap;
  mode: VocalMode;
  energy: number;
  accentProfile: AccentProfile;
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

const MODE_PARAMS: Record<VocalMode, { rateMultiplier: number; pitchShiftSt: number; breathiness: number }> = {
  chant:   { rateMultiplier: 0.75, pitchShiftSt: +2, breathiness: 0.3 },
  singjay: { rateMultiplier: 0.9,  pitchShiftSt: +4, breathiness: 0.2 },
  deejay:  { rateMultiplier: 1.1,  pitchShiftSt:  0, breathiness: 0.1 },
  radio:   { rateMultiplier: 1.0,  pitchShiftSt:  0, breathiness: 0.0 },
  neutral: { rateMultiplier: 1.0,  pitchShiftSt:  0, breathiness: 0.1 },
};

const ACCENT_SYMBOL_MAP: Record<AccentProfile, Record<string, string>> = {
  'heavy-patois': { 'th':'d','v':'b','r':'r' },
  'light-patois': { 'th':'t' },
  'diaspora':     {},
  'trini':        { 'th':'t','wh':'w' },
  'bajan':        { 'th':'d','ck':'k' },
  'guyanese':     { 'th':'t','or':'aw' },
};

/** Align each phoneme to the nearest hit/accent zone in the pocket map. */
export function alignPhonemesToPocket(
  phonemes: PhonemeSequence,
  pocketMap: PocketMap,
): AlignedPhoneme[] {
  const allZones: (PocketZone & { barIndex: number; absoluteTimeMs: number })[] = [];
  for (const bar of pocketMap.bars) {
    const barStartMs = bar.barIndex * 4 * (60000 / pocketMap.bpm);
    for (const zone of bar.zones) {
      if (zone.zoneType === 'hit' || zone.zoneType === 'accent') {
        allZones.push({
          ...zone,
          barIndex: bar.barIndex,
          absoluteTimeMs: barStartMs + zone.stepIndex * pocketMap.stepDurationMs + zone.pocketOffsetMs,
        });
      }
    }
  }

  return phonemes.phonemes.map((p, i) => {
    const zone = allZones[i % Math.max(1, allZones.length)];
    return {
      ...p,
      absoluteTimeMs: zone?.absoluteTimeMs ?? i * 100,
      pocketOffsetMs: zone?.pocketOffsetMs ?? 0,
      barIndex: zone?.barIndex ?? 0,
      stepIndex: zone?.stepIndex ?? p.stepIndex,
    };
  });
}

/** Scale phoneme durations by energy level. Higher energy = shorter, punchier durations. */
export function applyEnergyProfile(
  phonemes: AlignedPhoneme[],
  energy: number,
): AlignedPhoneme[] {
  const energyFactor = 0.5 + (1 - energy) * 0.8; // energy=1 -> 0.5x dur, energy=0 -> 1.3x dur
  return phonemes.map(p => ({ ...p, durationMs: p.durationMs * energyFactor }));
}

/** Transform phoneme symbols according to the accent profile. */
export function applyAccentProfile(
  phonemes: AlignedPhoneme[],
  accentProfile: AccentProfile,
): AlignedPhoneme[] {
  const transforms = ACCENT_SYMBOL_MAP[accentProfile];
  return phonemes.map(p => ({
    ...p,
    symbol: transforms[p.symbol] ?? p.symbol,
  }));
}

/** Full pipeline: align -> energy -> accent -> mode params -> VocalPerformanceSequence. */
export function generatePerformanceSequence(
  req: VocalPerformanceRequest,
): VocalPerformanceSequence {
  const modeParams = MODE_PARAMS[req.mode];
  const aligned = alignPhonemesToPocket(req.phonemes, req.pocketMap);
  const energized = applyEnergyProfile(aligned, req.energy);
  const accented = applyAccentProfile(energized, req.accentProfile);

  const performed: PerformedPhoneme[] = accented.map(p => ({
    ...p,
    scaledDurationMs: p.durationMs * modeParams.rateMultiplier,
    pitchShiftSt: modeParams.pitchShiftSt + (p.isAccent ? 2 : 0),
    breathiness: modeParams.breathiness * (1 - req.energy * 0.5),
    accentedSymbol: p.symbol,
  }));

  const totalDurationMs = performed.reduce((sum, p) => sum + p.scaledDurationMs, 0);

  return {
    phonemes: performed,
    totalDurationMs,
    bpm: req.pocketMap.bpm,
    mode: req.mode,
    accentProfile: req.accentProfile,
    energy: req.energy,
    generatedAt: new Date(),
  };
}
