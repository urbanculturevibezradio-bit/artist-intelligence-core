import { WhisperTimingResult, BpmGrooveResult } from '../types/pipeline';

export type PocketPosition = 'ahead' | 'on' | 'behind';

export interface PhraseSegment {
  startSec: number;
  endSec: number;
  durationSec: number;
  syllableCount: number;
  syllableDensity: number;   // syllables per second
  hasBreathAfter: boolean;
  accentPositions: number[]; // normalized 0-1 positions within phrase
}

export interface FlowPatternProfile {
  jobId: string;
  cadence: number;            // average IOI between onsets (ms)
  avgSyllableDensity: number; // overall syllables per second
  avgPhraseLength: number;    // average phrase length in seconds
  avgBreathSpacing: number;   // average silence between phrases (ms)
  syncopationScore: number;   // 0-1, fraction of offbeat onsets
  accentPlacement: 'downbeat' | 'backbeat' | 'mixed'; 
  pocketPosition: PocketPosition;
  pocketOffsetMs: number;     // signed offset from beat grid (ms)
  phrases: PhraseSegment[];
  totalOnsets: number;
  analyzedAt: Date;
}

// Helpers
function computePocketPosition(offsetMs: number): PocketPosition {
  if (offsetMs < -15) return 'behind';
  if (offsetMs > 15) return 'ahead';
  return 'on';
}

function computeSyncopation(onsets: number[], beatPeriodMs: number): number {
  if (onsets.length === 0) return 0;
  const offbeat = onsets.filter(o => {
    const phase = ((o * 1000) % beatPeriodMs) / beatPeriodMs;
    return phase > 0.2 && phase < 0.8;
  });
  return offbeat.length / onsets.length;
}

function classifyAccent(phrases: PhraseSegment[], beatPeriodMs: number): FlowPatternProfile['accentPlacement'] {
  let downbeatHits = 0, backbeatHits = 0;
  phrases.forEach(phrase => {
    phrase.accentPositions.forEach(pos => {
      const beatFraction = (pos * phrase.durationSec * 1000 % beatPeriodMs) / beatPeriodMs;
      if (beatFraction < 0.15 || beatFraction > 0.85) downbeatHits++;
      else if (beatFraction > 0.4 && beatFraction < 0.6) backbeatHits++;
    });
  });
  if (downbeatHits > backbeatHits * 1.5) return 'downbeat';
  if (backbeatHits > downbeatHits * 1.5) return 'backbeat';
  return 'mixed';
}

/**
 * Analyse whisper-timing + BPM data to build a FlowPatternProfile.
 */
export function analyseFlowPattern(
  jobId: string,
  timing: WhisperTimingResult,
  groove: BpmGrooveResult,
): FlowPatternProfile {
  const beatPeriodMs = 60_000 / groove.bpm;
  const onsets = timing.onsets; // array of onset times in seconds

  // Build phrase segments from timing.phrases
  const phrases: PhraseSegment[] = timing.phrases.map(p => {
    const phraseDur = p.endSec - p.startSec;
    const phraseDurMs = phraseDur * 1000;
    const phraseOnsets = onsets.filter(o => o >= p.startSec && o <= p.endSec);

    // Accent positions: top-25% loudest onsets normalised within phrase
    const accentThreshold = phraseOnsets.length > 0
      ? phraseOnsets.sort().slice(Math.floor(phraseOnsets.length * 0.75))[0]
      : p.startSec;
    const accentPositions = phraseOnsets
      .filter(o => o >= accentThreshold)
      .map(o => (o - p.startSec) / phraseDur);

    return {
      startSec: p.startSec,
      endSec: p.endSec,
      durationSec: phraseDur,
      syllableCount: phraseOnsets.length,
      syllableDensity: phraseDurMs > 0 ? phraseOnsets.length / phraseDur : 0,
      hasBreathAfter: p.hasBreathAfter ?? false,
      accentPositions,
    };
  });

  // Cadence: average IOI between adjacent onsets
  const iois = onsets.slice(1).map((o, i) => (o - onsets[i]) * 1000);
  const cadence = iois.length > 0 ? iois.reduce((a, b) => a + b, 0) / iois.length : beatPeriodMs;

  // Pocket offset: compare first onset of each phrase to nearest beat grid
  const offsets = phrases.map(p => {
    const beatIndex = Math.round((p.startSec * 1000) / beatPeriodMs);
    return (p.startSec * 1000) - beatIndex * beatPeriodMs;
  });
  const pocketOffsetMs = offsets.length > 0 ? offsets.reduce((a, b) => a + b, 0) / offsets.length : 0;

  // Breath spacing: gaps between phrases
  const breathGaps = phrases.slice(1).map((p, i) => (p.startSec - phrases[i].endSec) * 1000);
  const avgBreathSpacing = breathGaps.length > 0 ? breathGaps.reduce((a, b) => a + b, 0) / breathGaps.length : 0;

  const avgSyllableDensity = phrases.length > 0
    ? phrases.reduce((a, p) => a + p.syllableDensity, 0) / phrases.length
    : 0;
  const avgPhraseLength = phrases.length > 0
    ? phrases.reduce((a, p) => a + p.durationSec, 0) / phrases.length
    : 0;

  return {
    jobId,
    cadence,
    avgSyllableDensity,
    avgPhraseLength,
    avgBreathSpacing,
    syncopationScore: computeSyncopation(onsets, beatPeriodMs),
    accentPlacement: classifyAccent(phrases, beatPeriodMs),
    pocketPosition: computePocketPosition(pocketOffsetMs),
    pocketOffsetMs,
    phrases,
    totalOnsets: onsets.length,
    analyzedAt: new Date(),
  };
}
