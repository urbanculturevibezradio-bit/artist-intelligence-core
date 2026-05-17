// ============================================================
// components/VersionGenerator.tsx
// Generates 3-5 riddim variations from same hum, shows as selectable cards
// ============================================================
'use client';
import { useState, useCallback } from 'react';
import StemWaveform from './StemWaveform';
import type { RiddimStyleOption } from '@/hooks/useRiddimMixer';

interface RiddimVariation {
  id: string;
  label: string;
  style: RiddimStyleOption;
  bpm: number;
  key: string;
  grooveType: string;
  swingRatio: number;
  description: string;
  color: string;
  emoji: string;
  isGenerating: boolean;
}

const VARIATION_PRESETS: Omit<RiddimVariation, 'id' | 'isGenerating'>[] = [
  {
    label: 'Steppa Cut',
    style: 'steppa',
    bpm: 90,
    key: 'A minor',
    grooveType: 'straight',
    swingRatio: 0.50,
    description: 'Heavy sub-bass four-on-floor. Soundsystem pressure.',
    color: '#00e5ff',
    emoji: '🔊',
  },
  {
    label: 'Bashment Fire',
    style: 'bashment',
    bpm: 100,
    key: 'A minor',
    grooveType: 'straight',
    swingRatio: 0.52,
    description: 'Digital dancehall vibes. Syncopated hi-hats, rolling bass.',
    color: '#f5c842',
    emoji: '🔥',
  },
  {
    label: 'Roots Vibration',
    style: 'roots',
    bpm: 72,
    key: 'A minor',
    grooveType: 'straight',
    swingRatio: 0.50,
    description: 'Classic one-drop. Nyahbinghi percussion, deep roots feel.',
    color: '#39ff14',
    emoji: '🌿',
  },
  {
    label: 'Afro Riddim',
    style: 'afro-fusion',
    bpm: 112,
    key: 'A minor',
    grooveType: 'swing',
    swingRatio: 0.62,
    description: 'Afrobeats poly-rhythms fused with reggae skank chords.',
    color: '#8b5cf6',
    emoji: '🌍',
  },
  {
    label: 'Rub-A-Dub Special',
    style: 'rub-a-dub',
    bpm: 82,
    key: 'A minor',
    grooveType: 'straight',
    swingRatio: 0.51,
    description: 'Early digital era computerized riddim. Sparse and hypnotic.',
    color: '#ff3b3b',
    emoji: '💿',
  },
];

interface VersionGeneratorProps {
  jobId?: string;
  humKey?: string;
  onSelectVariation?: (variation: RiddimVariation) => void;
}

export default function VersionGenerator({ jobId, humKey = 'A minor', onSelectVariation }: VersionGeneratorProps) {
  const [variations, setVariations] = useState<RiddimVariation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variantCount, setVariantCount] = useState(4);

  const generateVariations = useCallback(async () => {
    setIsGenerating(true);
    setSelectedId(null);

    // Simulated generation delay (in production: call /api/generate-variations)
    await new Promise((r) => setTimeout(r, 1800));

    const shuffled = [...VARIATION_PRESETS]
      .sort(() => Math.random() - 0.5)
      .slice(0, variantCount);

    const newVariations: RiddimVariation[] = shuffled.map((preset, idx) => ({
      ...preset,
      id: `var_${Date.now()}_${idx}`,
      key: humKey,
      bpm: preset.bpm + Math.floor(Math.random() * 6 - 3),
      isGenerating: false,
    }));

    setVariations(newVariations);
    setIsGenerating(false);
  }, [variantCount, humKey]);

  const selectVariation = useCallback((v: RiddimVariation) => {
    setSelectedId(v.id);
    onSelectVariation?.(v);
  }, [onSelectVariation]);

  const regenerateSingle = useCallback(async (id: string) => {
    setVariations((prev) => prev.map((v) => v.id === id ? { ...v, isGenerating: true } : v));
    await new Promise((r) => setTimeout(r, 1200));
    setVariations((prev) => prev.map((v) => {
      if (v.id !== id) return v;
      return {
        ...v,
        bpm: v.bpm + Math.floor(Math.random() * 8 - 4),
        swingRatio: Math.round((v.swingRatio + (Math.random() * 0.06 - 0.03)) * 100) / 100,
        isGenerating: false,
      };
    }));
  }, []);

  const stemTypes: Array<'drums' | 'bass' | 'chords' | 'perc'> = ['drums', 'bass', 'chords', 'perc'];

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="riddim-card p-4 flex flex-wrap items-center gap-4">
        <div>
          <span className="text-xs text-gray-500 block mb-1">Variations</span>
          <div className="flex gap-1">
            {[3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setVariantCount(n)}
                className={`w-8 h-8 rounded text-sm font-bold border transition-colors ${
                  variantCount === n
                    ? 'border-yellow-400 text-yellow-400 bg-yellow-400/10'
                    : 'border-[#333] text-gray-500 hover:border-yellow-400/50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generateVariations}
          disabled={isGenerating || !jobId}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm uppercase tracking-wider border transition-all ${
            isGenerating || !jobId
              ? 'border-gray-700 text-gray-600 cursor-not-allowed'
              : 'border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 active:scale-95'
          }`}
        >
          {isGenerating ? (
            <>
              <span className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
              Generating {variantCount} variations...
            </>
          ) : (
            `⚡ Generate ${variantCount} Variations`
          )}
        </button>

        {!jobId && (
          <span className="text-xs text-gray-600">Upload audio first to generate variations</span>
        )}
      </div>

      {/* Variation cards */}
      {variations.length > 0 && (
        <div className={`grid gap-3 ${variantCount === 3 ? 'grid-cols-1 sm:grid-cols-3' : variantCount === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-5'}`}>
          {variations.map((v) => (
            <button
              key={v.id}
              onClick={() => selectVariation(v)}
              className={`riddim-card p-4 text-left flex flex-col gap-3 transition-all cursor-pointer w-full ${
                selectedId === v.id ? 'selected' : 'hover:border-gray-600'
              }`}
            >
              {/* Emoji + label */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{v.emoji}</span>
                  <div>
                    <div className="text-xs font-bold text-white">{v.label}</div>
                    <div
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: v.color }}
                    >
                      {v.style}
                    </div>
                  </div>
                </div>
                {selectedId === v.id && (
                  <span className="text-yellow-400 text-lg">✓</span>
                )}
              </div>

              {/* Mini waveforms */}
              <div className="grid grid-cols-2 gap-1">
                {stemTypes.map((st) => (
                  <StemWaveform
                    key={st}
                    color={v.color}
                    stemType={st}
                    isPlaying={selectedId === v.id}
                    width={70}
                    height={20}
                  />
                ))}
              </div>

              {/* Stats */}
              <div className="flex gap-3 flex-wrap">
                <div className="text-center">
                  <div className="text-sm font-bold text-white font-mono">{v.bpm}</div>
                  <div className="text-[9px] text-gray-500">BPM</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white">{v.key.split(' ')[0]}</div>
                  <div className="text-[9px] text-gray-500">{v.key.split(' ')[1]}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: v.color }}>{Math.round(v.swingRatio * 100)}%</div>
                  <div className="text-[9px] text-gray-500">SWING</div>
                </div>
              </div>

              {/* Description */}
              <p className="text-[10px] text-gray-500 leading-relaxed">{v.description}</p>

              {/* Regen button */}
              <button
                onClick={(e) => { e.stopPropagation(); regenerateSingle(v.id); }}
                disabled={v.isGenerating}
                className="text-[10px] text-gray-600 hover:text-yellow-400 border border-[#2a2a2a] hover:border-yellow-400/30 rounded px-2 py-1 transition-colors w-full text-center"
              >
                {v.isGenerating ? 'Regenerating...' : '↺ Regenerate this cut'}
              </button>
            </button>
          ))}
        </div>
      )}

      {variations.length === 0 && !isGenerating && (
        <div className="riddim-card p-12 flex flex-col items-center justify-center gap-3 text-center">
          <div className="text-4xl">🎵</div>
          <p className="text-gray-500 text-sm">Click Generate to create riddim variations from your hum</p>
          <p className="text-gray-600 text-xs">Each variation explores a different style and groove feel</p>
        </div>
      )}
    </div>
  );
}
