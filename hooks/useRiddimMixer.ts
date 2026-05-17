// ============================================================
// hooks/useRiddimMixer.ts
// State management for the RiddimMixer component
// ============================================================
import { useState, useCallback } from 'react';

export type StemType = 'drums' | 'bass' | 'chords' | 'perc' | 'fx';
export type RiddimStyleOption =
  | 'dancehall' | 'reggae' | 'afro-fusion' | 'rub-a-dub'
  | 'steppa' | 'roots' | 'lovers-rock' | 'bashment'
  | 'digital-reggae' | 'afrobeats';

export type DrumInstrument = 'kick' | 'snare' | 'hihat' | 'rimshot' | 'perc';
export type BassInstrument = 'sub-bass' | 'fender-bass' | 'synth-bass' | 'upright';
export type ChordInstrument = 'piano' | 'organ' | 'guitar' | 'pad' | 'rhodes';

export interface StemState {
  id: StemType;
  label: string;
  emoji: string;
  volume: number;         // 0–100
  muted: boolean;
  soloed: boolean;
  style: RiddimStyleOption;
  swing: number;          // 0–100 (maps to 0.5–0.67 ratio)
  groove: number;         // 0–100
  instrument: string;
  color: string;
  isRegenerating: boolean;
}

export interface MixerState {
  stems: Record<StemType, StemState>;
  masterBpm: number;
  masterKey: string;
  masterSwing: number;
  isPlaying: boolean;
  soloedStem: StemType | null;
}

const STEM_DEFAULTS: Record<StemType, Omit<StemState, 'id'>> = {
  drums: {
    label: 'Drums',
    emoji: '🥁',
    volume: 80,
    muted: false,
    soloed: false,
    style: 'dancehall',
    swing: 52,
    groove: 65,
    instrument: 'kick',
    color: '#f5c842',
    isRegenerating: false,
  },
  bass: {
    label: 'Bass',
    emoji: '🎸',
    volume: 85,
    muted: false,
    soloed: false,
    style: 'dancehall',
    swing: 50,
    groove: 70,
    instrument: 'sub-bass',
    color: '#39ff14',
    isRegenerating: false,
  },
  chords: {
    label: 'Chords',
    emoji: '🎹',
    volume: 65,
    muted: false,
    soloed: false,
    style: 'dancehall',
    swing: 50,
    groove: 55,
    instrument: 'piano',
    color: '#8b5cf6',
    isRegenerating: false,
  },
  perc: {
    label: 'Percussion',
    emoji: '🪘',
    volume: 60,
    muted: false,
    soloed: false,
    style: 'dancehall',
    swing: 55,
    groove: 75,
    instrument: 'rimshot',
    color: '#00e5ff',
    isRegenerating: false,
  },
  fx: {
    label: 'FX',
    emoji: '✨',
    volume: 45,
    muted: false,
    soloed: false,
    style: 'dancehall',
    swing: 50,
    groove: 40,
    instrument: 'reverb',
    color: '#ff3b3b',
    isRegenerating: false,
  },
};

const STEM_ORDER: StemType[] = ['drums', 'bass', 'chords', 'perc', 'fx'];

function buildDefaultStems(): Record<StemType, StemState> {
  const stems = {} as Record<StemType, StemState>;
  for (const id of STEM_ORDER) {
    stems[id] = { id, ...STEM_DEFAULTS[id] };
  }
  return stems;
}

export const INSTRUMENT_OPTIONS: Record<StemType, string[]> = {
  drums: ['kick', 'snare', 'hihat', 'rimshot', 'perc', '808'],
  bass: ['sub-bass', 'fender-bass', 'synth-bass', 'upright', 'slap-bass'],
  chords: ['piano', 'organ', 'guitar', 'pad', 'rhodes', 'synth-lead'],
  perc: ['rimshot', 'shaker', 'cowbell', 'bongo', 'clave', 'tambourine'],
  fx: ['reverb', 'delay', 'phaser', 'flanger', 'distortion', 'filter-sweep'],
};

export const STYLE_OPTIONS: RiddimStyleOption[] = [
  'dancehall', 'reggae', 'afro-fusion', 'rub-a-dub',
  'steppa', 'roots', 'lovers-rock', 'bashment',
  'digital-reggae', 'afrobeats',
];

interface UseRiddimMixerReturn {
  mixer: MixerState;
  stemOrder: StemType[];
  setStemVolume: (id: StemType, vol: number) => void;
  toggleMute: (id: StemType) => void;
  toggleSolo: (id: StemType) => void;
  setStemStyle: (id: StemType, style: RiddimStyleOption) => void;
  setStemSwing: (id: StemType, swing: number) => void;
  setStemGroove: (id: StemType, groove: number) => void;
  setStemInstrument: (id: StemType, instrument: string) => void;
  regenerateStem: (id: StemType, jobId: string) => Promise<void>;
  setMasterBpm: (bpm: number) => void;
  setMasterKey: (key: string) => void;
  setMasterSwing: (swing: number) => void;
  togglePlayback: () => void;
  resetMixer: () => void;
}

export function useRiddimMixer(initialStyle: RiddimStyleOption = 'dancehall'): UseRiddimMixerReturn {
  const [mixer, setMixer] = useState<MixerState>({
    stems: buildDefaultStems(),
    masterBpm: 96,
    masterKey: 'A minor',
    masterSwing: 50,
    isPlaying: false,
    soloedStem: null,
  });

  const updateStem = useCallback((id: StemType, patch: Partial<StemState>) => {
    setMixer((prev) => ({
      ...prev,
      stems: {
        ...prev.stems,
        [id]: { ...prev.stems[id], ...patch },
      },
    }));
  }, []);

  const setStemVolume = useCallback((id: StemType, vol: number) => {
    updateStem(id, { volume: Math.max(0, Math.min(100, vol)) });
  }, [updateStem]);

  const toggleMute = useCallback((id: StemType) => {
    setMixer((prev) => ({
      ...prev,
      stems: {
        ...prev.stems,
        [id]: { ...prev.stems[id], muted: !prev.stems[id].muted },
      },
    }));
  }, []);

  const toggleSolo = useCallback((id: StemType) => {
    setMixer((prev) => {
      const isSoloed = prev.stems[id].soloed;
      const newSoloed = isSoloed ? null : id;

      const newStems = { ...prev.stems };
      for (const stemId of STEM_ORDER) {
        newStems[stemId] = {
          ...prev.stems[stemId],
          soloed: stemId === id ? !isSoloed : false,
          muted: newSoloed !== null && stemId !== newSoloed
            ? true
            : prev.stems[stemId].muted && stemId !== id,
        };
      }
      return { ...prev, stems: newStems, soloedStem: newSoloed };
    });
  }, []);

  const setStemStyle = useCallback((id: StemType, style: RiddimStyleOption) => {
    updateStem(id, { style });
  }, [updateStem]);

  const setStemSwing = useCallback((id: StemType, swing: number) => {
    updateStem(id, { swing });
  }, [updateStem]);

  const setStemGroove = useCallback((id: StemType, groove: number) => {
    updateStem(id, { groove });
  }, [updateStem]);

  const setStemInstrument = useCallback((id: StemType, instrument: string) => {
    updateStem(id, { instrument });
  }, [updateStem]);

  const regenerateStem = useCallback(async (id: StemType, jobId: string) => {
    updateStem(id, { isRegenerating: true });
    try {
      // In production: call a dedicated regenerate endpoint
      // await fetch(`/api/regenerate-stem`, { method: 'POST', body: JSON.stringify({ jobId, stemType: id, ...mixer.stems[id] }) });
      await new Promise((r) => setTimeout(r, 1500)); // Simulated delay
    } finally {
      updateStem(id, { isRegenerating: false });
    }
  }, [updateStem]);

  const setMasterBpm = useCallback((bpm: number) => {
    setMixer((prev) => ({ ...prev, masterBpm: Math.max(60, Math.min(200, bpm)) }));
  }, []);

  const setMasterKey = useCallback((key: string) => {
    setMixer((prev) => ({ ...prev, masterKey: key }));
  }, []);

  const setMasterSwing = useCallback((swing: number) => {
    setMixer((prev) => ({ ...prev, masterSwing: swing }));
  }, []);

  const togglePlayback = useCallback(() => {
    setMixer((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const resetMixer = useCallback(() => {
    setMixer({
      stems: buildDefaultStems(),
      masterBpm: 96,
      masterKey: 'A minor',
      masterSwing: 50,
      isPlaying: false,
      soloedStem: null,
    });
  }, []);

  return {
    mixer,
    stemOrder: STEM_ORDER,
    setStemVolume,
    toggleMute,
    toggleSolo,
    setStemStyle,
    setStemSwing,
    setStemGroove,
    setStemInstrument,
    regenerateStem,
    setMasterBpm,
    setMasterKey,
    setMasterSwing,
    togglePlayback,
    resetMixer,
  };
}
