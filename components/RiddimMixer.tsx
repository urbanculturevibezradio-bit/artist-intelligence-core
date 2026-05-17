// ============================================================
// components/RiddimMixer.tsx
// Full stem mixer: mute/solo, volume, regenerate, style, swing, instrument
// ============================================================
'use client';
import React, { useId } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as Select from '@radix-ui/react-select';
import * as Toggle from '@radix-ui/react-toggle';
import * as Tooltip from '@radix-ui/react-tooltip';
import StemWaveform from './StemWaveform';
import {
  useRiddimMixer,
  STYLE_OPTIONS,
  INSTRUMENT_OPTIONS,
  type StemType,
  type RiddimStyleOption,
} from '@/hooks/useRiddimMixer';

// ---- Knob component ----
interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  color?: string;
  size?: number;
  label?: string;
  onChange: (v: number) => void;
}

function Knob({ value, min = 0, max = 100, color = '#f5c842', size = 44, label, onChange }: KnobProps) {
  const pct = (value - min) / (max - min);
  const startAngle = -225;
  const endAngle = 45;
  const angle = startAngle + pct * (endAngle - startAngle);
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  // Arc path
  const arcStart = (startAngle * Math.PI) / 180;
  const arcEnd = (angle * Math.PI) / 180;
  const totalArc = ((endAngle - startAngle) * Math.PI) / 180;

  const x1 = cx + r * Math.cos(arcStart);
  const y1 = cy + r * Math.sin(arcStart);
  const x2 = cx + r * Math.cos(arcEnd);
  const y2 = cy + r * Math.sin(arcEnd);
  const largeArc = arcEnd - arcStart > Math.PI ? 1 : 0;

  const xTrack1 = cx + r * Math.cos(arcStart);
  const yTrack1 = cy + r * Math.sin(arcStart);
  const xTrack2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
  const yTrack2 = cy + r * Math.sin((endAngle * Math.PI) / 180);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    onChange(Math.max(min, Math.min(max, value + delta)));
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            className="relative cursor-ns-resize select-none"
            style={{ width: size, height: size }}
            onWheel={handleWheel}
          >
            <svg width={size} height={size}>
              {/* Track */}
              <path
                d={`M ${xTrack1} ${yTrack1} A ${r} ${r} 0 1 1 ${xTrack2} ${yTrack2}`}
                stroke="#2a2a2a"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
              {/* Fill */}
              {pct > 0 && (
                <path
                  d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                  stroke={color}
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                />
              )}
              {/* Dot indicator */}
              <circle
                cx={cx + (r - 4) * Math.cos(arcEnd)}
                cy={cy + (r - 4) * Math.sin(arcEnd)}
                r={3}
                fill={color}
              />
              {/* Center fill */}
              <circle cx={cx} cy={cy} r={r * 0.38} fill="#1a1a1a" stroke="#333" strokeWidth="1" />
            </svg>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 bg-black text-xs text-yellow-400 px-2 py-1 rounded border border-yellow-400/30"
            sideOffset={5}
          >
            {label}: {value}
            <Tooltip.Arrow className="fill-black" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// ---- SelectDropdown ----
function SelectDropdown({ value, options, onChange, placeholder }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="flex items-center justify-between w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-md px-2 py-1 text-xs text-gray-300 hover:border-yellow-400/50 transition-colors outline-none min-w-0">
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="ml-1 text-gray-500">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 3L5 7L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl overflow-hidden" position="popper" sideOffset={4}>
          <Select.Viewport className="p-1 max-h-48 overflow-y-auto">
            {options.map((opt) => (
              <Select.Item
                key={opt}
                value={opt}
                className="text-xs text-gray-300 px-3 py-1.5 rounded cursor-pointer hover:bg-yellow-400/10 hover:text-yellow-400 outline-none transition-colors capitalize"
              >
                <Select.ItemText>{opt}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

// ---- StemStrip ----
interface StemStripProps {
  stemId: StemType;
  jobId?: string;
  isPlaying: boolean;
  onMute: () => void;
  onSolo: () => void;
  onVolumeChange: (v: number) => void;
  onStyleChange: (s: RiddimStyleOption) => void;
  onSwingChange: (v: number) => void;
  onGrooveChange: (v: number) => void;
  onInstrumentChange: (i: string) => void;
  onRegenerate: () => void;
  stem: {
    label: string;
    emoji: string;
    volume: number;
    muted: boolean;
    soloed: boolean;
    style: string;
    swing: number;
    groove: number;
    instrument: string;
    color: string;
    isRegenerating: boolean;
  };
}

function StemStrip({ stemId, stem, isPlaying, onMute, onSolo, onVolumeChange, onStyleChange, onSwingChange, onGrooveChange, onInstrumentChange, onRegenerate }: StemStripProps) {
  const id = useId();

  return (
    <div
      className="riddim-card p-3 flex flex-col gap-2 transition-all"
      style={{ borderColor: stem.soloed ? stem.color : undefined }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{stem.emoji}</span>
          <span className="text-xs font-semibold text-white uppercase tracking-wide">{stem.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Mute */}
          <Toggle.Root
            pressed={stem.muted}
            onPressedChange={onMute}
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
              stem.muted
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-transparent border-[#333] text-gray-500 hover:border-red-600 hover:text-red-500'
            }`}
            aria-label="Mute"
          >
            M
          </Toggle.Root>
          {/* Solo */}
          <Toggle.Root
            pressed={stem.soloed}
            onPressedChange={onSolo}
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
              stem.soloed
                ? 'bg-yellow-400 border-yellow-400 text-black'
                : 'bg-transparent border-[#333] text-gray-500 hover:border-yellow-400 hover:text-yellow-400'
            }`}
            aria-label="Solo"
          >
            S
          </Toggle.Root>
        </div>
      </div>

      {/* Waveform */}
      <div className="flex justify-center">
        <StemWaveform
          color={stem.color}
          isPlaying={isPlaying && !stem.muted}
          isMuted={stem.muted}
          stemType={stemId}
          width={160}
          height={36}
        />
      </div>

      {/* Volume slider */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-4">🔊</span>
        <Slider.Root
          className="relative flex items-center select-none flex-1 h-4"
          min={0}
          max={100}
          step={1}
          value={[stem.volume]}
          onValueChange={([v]) => onVolumeChange(v)}
          aria-label="Volume"
        >
          <Slider.Track className="relative bg-[#2a2a2a] rounded-full h-1 flex-1">
            <Slider.Range
              className="absolute h-full rounded-full"
              style={{ backgroundColor: stem.color }}
            />
          </Slider.Track>
          <Slider.Thumb
            className="block w-3 h-3 rounded-full border-2 border-black shadow-md outline-none cursor-pointer hover:scale-110 transition-transform"
            style={{ backgroundColor: stem.color }}
          />
        </Slider.Root>
        <span className="text-[10px] text-gray-400 w-6 text-right">{stem.volume}</span>
      </div>

      {/* Swing + Groove knobs */}
      <div className="flex items-end justify-around">
        <div className="flex flex-col items-center gap-1">
          <Knob value={stem.swing} color={stem.color} size={40} label="Swing" onChange={onSwingChange} />
          <span className="text-[9px] text-gray-500">SWING</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Knob value={stem.groove} color='#8b5cf6' size={40} label="Groove" onChange={onGrooveChange} />
          <span className="text-[9px] text-gray-500">GROOVE</span>
        </div>
      </div>

      {/* Style dropdown */}
      <div>
        <label className="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">Style</label>
        <SelectDropdown
          value={stem.style}
          options={STYLE_OPTIONS}
          onChange={(v) => onStyleChange(v as RiddimStyleOption)}
          placeholder="Select style"
        />
      </div>

      {/* Instrument dropdown */}
      <div>
        <label className="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">Instrument</label>
        <SelectDropdown
          value={stem.instrument}
          options={INSTRUMENT_OPTIONS[stemId] ?? []}
          onChange={onInstrumentChange}
          placeholder="Select instrument"
        />
      </div>

      {/* Regenerate */}
      <button
        onClick={onRegenerate}
        disabled={stem.isRegenerating}
        className={`w-full py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all border ${
          stem.isRegenerating
            ? 'border-gray-700 text-gray-600 cursor-not-allowed'
            : 'border-[#333] text-gray-400 hover:border-yellow-400 hover:text-yellow-400 active:scale-95'
        }`}
      >
        {stem.isRegenerating ? (
          <span className="flex items-center justify-center gap-1">
            <span className="w-3 h-3 border border-gray-600 border-t-yellow-400 rounded-full animate-spin inline-block" />
            Generating...
          </span>
        ) : (
          '↺ Regenerate'
        )}
      </button>
    </div>
  );
}

// ---- Main RiddimMixer ----
interface RiddimMixerProps {
  jobId?: string;
  initialStyle?: RiddimStyleOption;
  onMixerChange?: (mixer: ReturnType<typeof useRiddimMixer>['mixer']) => void;
}

export default function RiddimMixer({ jobId, initialStyle = 'dancehall', onMixerChange }: RiddimMixerProps) {
  const {
    mixer,
    stemOrder,
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
  } = useRiddimMixer(initialStyle);

  const KEY_OPTIONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].flatMap(
    (k) => [`${k} major`, `${k} minor`]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Master controls */}
      <div className="riddim-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlayback}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg transition-all ${
              mixer.isPlaying
                ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400 glow-gold'
                : 'border-[#333] text-gray-400 hover:border-yellow-400'
            }`}
          >
            {mixer.isPlaying ? '⏸' : '▶'}
          </button>
          <span className="text-xs text-gray-500">
            {mixer.isPlaying ? 'PLAYING' : 'STOPPED'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">BPM</span>
          <input
            type="number"
            min={60}
            max={200}
            value={mixer.masterBpm}
            onChange={(e) => setMasterBpm(Number(e.target.value))}
            className="w-16 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-sm text-yellow-400 font-mono text-center outline-none focus:border-yellow-400/50"
          />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-36">
          <span className="text-xs text-gray-500">Key</span>
          <div className="flex-1">
            <SelectDropdown
              value={mixer.masterKey}
              options={KEY_OPTIONS}
              onChange={setMasterKey}
              placeholder="Key"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Master Swing</span>
          <Knob value={mixer.masterSwing} color="#00e5ff" size={36} label="Master Swing" onChange={setMasterSwing} />
        </div>

        <button
          onClick={resetMixer}
          className="ml-auto text-[11px] text-gray-500 hover:text-red-400 border border-[#333] hover:border-red-600 px-3 py-1.5 rounded-md transition-colors uppercase tracking-wider"
        >
          Reset
        </button>
      </div>

      {/* Stem strips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stemOrder.map((stemId) => {
          const stem = mixer.stems[stemId];
          return (
            <StemStrip
              key={stemId}
              stemId={stemId}
              stem={stem}
              jobId={jobId}
              isPlaying={mixer.isPlaying}
              onMute={() => toggleMute(stemId)}
              onSolo={() => toggleSolo(stemId)}
              onVolumeChange={(v) => setStemVolume(stemId, v)}
              onStyleChange={(s) => setStemStyle(stemId, s)}
              onSwingChange={(v) => setStemSwing(stemId, v)}
              onGrooveChange={(v) => setStemGroove(stemId, v)}
              onInstrumentChange={(i) => setStemInstrument(stemId, i)}
              onRegenerate={() => regenerateStem(stemId, jobId ?? '')}
            />
          );
        })}
      </div>
    </div>
  );
}
