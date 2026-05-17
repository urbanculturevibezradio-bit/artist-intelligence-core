import { FlowPatternProfile } from './flowPatterns';
import { ArtistPreferences } from './artistMemory';

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

const BASE_PATTERNS: Record<string, number[]> = {
  steppa:    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
  one_drop:  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
  riddim:    [1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0],
  dancehall: [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0],
  afrofusion:[1,0,1,0,1,0,0,1,0,1,0,1,0,0,1,0],
  rub_a_dub: [1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0],
};

function syncopate(pattern: number[], amount: number): number[] {
  const result = [...pattern];
  const shifts = Math.round(amount * 4);
  for (let i = 0; i < shifts; i++) {
    const onIdx = result.findIndex((v, j) => v === 1 && j > 0 && result[j-1] === 0);
    if (onIdx > 0) { result[onIdx] = 0; result[onIdx - 1] = 1; }
  }
  return result;
}

function deriveAccents(pattern: number[]): number[] {
  return pattern.reduce((acc: number[], v, i) => {
    if (v === 1 && (i === 0 || i === 4 || i === 8 || i === 12)) acc.push(i);
    return acc;
  }, []);
}

function buildTemplate(
  id: string,
  name: string,
  sectionType: HookSectionType,
  basePattern: number[],
  syncopationLevel: number,
  energyLevel: number,
  barLength: number,
  description: string,
): HookRhythmTemplate {
  const pattern = syncopate(basePattern, syncopationLevel);
  return {
    id, name, sectionType, barLength, pattern,
    accentSteps: deriveAccents(pattern),
    restSteps: pattern.map((v,i) => v === 0 ? i : -1).filter(i => i >= 0),
    energyLevel, syncopationLevel, description,
  };
}

export function generateHookIdeas(
  jobId: string,
  flow: FlowPatternProfile,
  prefs: ArtistPreferences,
): HookIdeas {
  const topStyle = prefs.preferredStyles[0] ?? 'riddim';
  const styleKey = topStyle.toLowerCase().replace(/-/g,'_').replace(/ /g,'_');
  const basePattern = BASE_PATTERNS[styleKey] ?? BASE_PATTERNS['riddim'];
  const syncScore = flow.syncopationScore;
  const energy = prefs.energyLevel;

  const templates: HookRhythmTemplate[] = [
    buildTemplate('hook-chorus-main','Main Chorus Hook','chorus',basePattern,syncScore,energy,2,
      'Primary chorus pattern with maximum energy and accented downbeats'),
    buildTemplate('hook-verse-flow','Verse Flow Pattern','verse',basePattern,syncScore*0.7,energy*0.75,2,
      'Verse pattern - lighter, more syllabic, leaves space for lyrics'),
    buildTemplate('hook-bridge','Bridge Break','bridge',
      syncopate(basePattern,Math.min(1,syncScore+0.2)),Math.min(1,syncScore+0.2),energy*0.9,1,
      'Bridge pattern with extra syncopation to create tension before return'),
    buildTemplate('hook-intro','Intro Build','intro',basePattern,syncScore*0.4,energy*0.5,4,
      '4-bar intro pattern - sparse, builds gradually'),
    buildTemplate('hook-outro','Outro Fade','outro',basePattern,syncScore*0.3,energy*0.3,4,
      '4-bar outro - removes hits progressively for fade effect'),
  ];

  const callPattern = syncopate(basePattern, syncScore);
  const responsePattern = callPattern.map((v, i) => (v === 0 && i % 2 === 1 ? 1 : 0));

  const callAndResponse: CallAndResponsePattern[] = [
    {
      callBars: 2, responseBars: 2,
      callPattern, responsePattern,
      callAccents: deriveAccents(callPattern),
      responseAccents: deriveAccents(responsePattern),
    },
    {
      callBars: 4, responseBars: 4,
      callPattern: [...callPattern,...callPattern],
      responsePattern: [...responsePattern,...responsePattern],
      callAccents: deriveAccents(callPattern),
      responseAccents: deriveAccents(responsePattern),
    },
  ];

  const barsPerPhrase = Math.max(1, Math.round(prefs.avgPhraseBars));
  const suggestedBarLengths = Array.from(new Set([1,2,barsPerPhrase,barsPerPhrase*2])).sort((a,b)=>a-b);

  const pocketDesc = prefs.pocketPosition === 'ahead'
    ? 'pushing ahead of the beat for urgency'
    : prefs.pocketPosition === 'behind'
    ? 'sitting behind the beat for a relaxed feel'
    : 'locked on the grid';

  const chorusContrast = [
    'Chorus: dense hits (' + Math.round(energy*100) + '% energy), ' + pocketDesc + '.',
    'Verse: ' + Math.round(energy*75) + '% energy with ' + Math.round(syncScore*100) + '% syncopation,',
    'avg phrase of ' + prefs.avgPhraseBars + ' bars.',
    'Bridge: extra syncopation for harmonic tension.',
  ].join(' ');

  return { jobId, templates, callAndResponse, suggestedBarLengths, chorusContrast, generatedAt: new Date() };
}
