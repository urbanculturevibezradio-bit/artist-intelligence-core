import { FlowPatternProfile } from './flowPatterns';
import { BpmGrooveResult } from '../types/pipeline';

export type ZoneType = 'hit' | 'rest' | 'accent' | 'breath';

export interface PocketZone {
  stepIndex: number;   // 0-15 within a bar (16th note grid)
  zoneType: ZoneType;
  strength: number;   // 0-1
  pocketOffsetMs: number; // deviation from strict grid
}

export interface PocketBar {
  barIndex: number;
  zones: PocketZone[];  // 16 zones per bar
  dominantZone: ZoneType;
  avgPocketOffset: number;
}

export interface PocketMap {
  jobId: string;
  bpm: number;
  totalBars: number;
  stepDurationMs: number;   // duration of one 16th note in ms
  bars: PocketBar[];
  globalPocketPosition: FlowPatternProfile['pocketPosition'];
  globalOffsetMs: number;
  generatedAt: Date;
}

/**
 * Build a time-aligned pocket map from a FlowPatternProfile and BPM data.
 * Returns a per-bar grid (16 steps per bar) marking hit/rest/accent/breath zones.
 */
export function buildPocketMap(
  jobId: string,
  flow: FlowPatternProfile,
  groove: BpmGrooveResult,
): PocketMap {
  const beatMs = 60_000 / groove.bpm;
  const barMs = beatMs * 4;
  const stepMs = barMs / 16;

  // Estimate total duration from last phrase end
  const lastPhrase = flow.phrases[flow.phrases.length - 1];
  const totalDurationMs = lastPhrase ? lastPhrase.endSec * 1000 : barMs * 8;
  const totalBars = Math.max(1, Math.ceil(totalDurationMs / barMs));

  // Build a flat step grid covering all bars
  const totalSteps = totalBars * 16;
  const stepGrid: Array<{ zoneType: ZoneType; strength: number; offsetMs: number }> = Array.from(
    { length: totalSteps },
    () => ({ zoneType: 'rest' as ZoneType, strength: 0, offsetMs: 0 }),
  );

  // Mark hit zones from phrase onsets (via cadence approximation)
  flow.phrases.forEach(phrase => {
    const phraseStartMs = phrase.startSec * 1000;
    const phraseEndMs = phrase.endSec * 1000;

    // Space syllables evenly across phrase using cadence
    for (let i = 0; i < phrase.syllableCount; i++) {
      const onsetMs = phraseStartMs + i * flow.cadence;
      if (onsetMs > phraseEndMs) break;

      const stepFloat = (onsetMs + flow.pocketOffsetMs) / stepMs;
      const nearestStep = Math.round(stepFloat);
      const stepIndex = Math.max(0, Math.min(totalSteps - 1, nearestStep));
      const offsetMs = (stepFloat - nearestStep) * stepMs;

      const isAccent = phrase.accentPositions.some(
        pos => Math.abs(pos - i / Math.max(1, phrase.syllableCount - 1)) < 0.15,
      );

      stepGrid[stepIndex] = {
        zoneType: isAccent ? 'accent' : 'hit',
        strength: isAccent ? 1.0 : 0.6,
        offsetMs,
      };
    }

    // Mark breath zone after phrase
    if (phrase.hasBreathAfter) {
      const breathStep = Math.round((phraseEndMs + flow.pocketOffsetMs) / stepMs);
      const idx = Math.max(0, Math.min(totalSteps - 1, breathStep));
      if (stepGrid[idx].zoneType === 'rest') {
        stepGrid[idx] = { zoneType: 'breath', strength: 0.3, offsetMs: 0 };
      }
    }
  });

  // Pack into bars
  const bars: PocketBar[] = [];
  for (let b = 0; b < totalBars; b++) {
    const barSteps = stepGrid.slice(b * 16, b * 16 + 16);
    const zones: PocketZone[] = barSteps.map((s, i) => ({
      stepIndex: i,
      zoneType: s.zoneType,
      strength: s.strength,
      pocketOffsetMs: s.offsetMs,
    }));

    const nonRest = zones.filter(z => z.zoneType !== 'rest');
    const zoneCounts = nonRest.reduce((acc: Record<string,number>, z) => {
      acc[z.zoneType] = (acc[z.zoneType] ?? 0) + 1; return acc;
    }, {});
    const dominantZone: ZoneType = nonRest.length > 0
      ? (Object.entries(zoneCounts).sort((a,b) => b[1]-a[1])[0][0] as ZoneType)
      : 'rest';
    const avgPocketOffset = nonRest.length > 0
      ? nonRest.reduce((a, z) => a + z.pocketOffsetMs, 0) / nonRest.length
      : 0;

    bars.push({ barIndex: b, zones, dominantZone, avgPocketOffset });
  }

  return {
    jobId,
    bpm: groove.bpm,
    totalBars,
    stepDurationMs: stepMs,
    bars,
    globalPocketPosition: flow.pocketPosition,
    globalOffsetMs: flow.pocketOffsetMs,
    generatedAt: new Date(),
  };
}
