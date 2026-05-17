// ============================================================
// pages/riddim-studio.tsx
// Main RiddimStudio page — wires all UI components together
// ============================================================
'use client';
import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import RiddimMixer from '@/components/RiddimMixer';
import VersionGenerator from '@/components/VersionGenerator';
import FinalizeRiddim from '@/components/FinalizeRiddim';
import { useJobPoller } from '@/hooks/useJobPoller';
import '@/styles/globals.css';

type StudioTab = 'upload' | 'mixer' | 'versions' | 'finalize';

const TABS: Array<{ id: StudioTab; label: string; emoji: string }> = [
  { id: 'upload',   label: 'Upload',    emoji: '🎤' },
  { id: 'mixer',    label: 'Mixer',     emoji: '🎛️' },
  { id: 'versions', label: 'Versions',  emoji: '🎵' },
  { id: 'finalize', label: 'Finalize',  emoji: '📦' },
];

const WORKER_LABELS: Record<string, string> = {
  'whisper-timing': 'Timing',
  'melody-extraction': 'Melody',
  'bpm-groove': 'BPM',
  'style-classifier': 'Style',
  'riddim-generator': 'Generate',
  'stem-assembler': 'Assemble',
  'fingerprint-validator': 'Validate',
};

const WORKER_ORDER = [
  'whisper-timing', 'melody-extraction', 'bpm-groove', 'style-classifier',
  'riddim-generator', 'stem-assembler', 'fingerprint-validator',
];

export default function RiddimStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>('upload');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { jobId, status, progress, completedWorkers, pendingWorkers, results, error, uploadAudio, reset } = useJobPoller({
    onComplete: () => setActiveTab('mixer'),
    onError: (e) => console.error('[Studio] Pipeline error:', e),
  });

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'wav' && ext !== 'mp3') {
      alert('Please upload a .wav or .mp3 file');
      return;
    }
    await uploadAudio(file);
  }, [uploadAudio]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const humKey = (results?.melodyExtraction as { key?: string })?.key ?? 'A';
  const detectedStyle = (results?.styleClassifier as { primaryStyle?: string })?.primaryStyle ?? 'dancehall';
  const detectedBpm = (results?.bpmGroove as { bpm?: number })?.bpm ?? 96;

  return (
    <>
      <Head>
        <title>Riddim Studio — Season to Taste</title>
        <meta name="description" content="AI-powered hum-to-riddim production studio" />
      </Head>

      <div className="min-h-screen bg-[#0a0a0a] bg-grid-dark text-white">
        {/* Header */}
        <header className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-sm">🎵</div>
            <div>
              <h1 className="text-sm font-bold text-white">Riddim Studio</h1>
              <p className="text-[10px] text-gray-500">Season to Taste</p>
            </div>
          </div>

          {/* Job status pill */}
          {jobId && (
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-mono text-gray-600">
                {jobId.slice(0, 8)}...
              </div>
              <div className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${
                status === 'completed' ? 'border-green-500 text-green-400' :
                status === 'failed' ? 'border-red-500 text-red-400' :
                'border-yellow-400/50 text-yellow-400'
              }`}>
                {status === 'completed' ? '✓ Ready' : status === 'failed' ? '✗ Failed' : `${progress}%`}
              </div>
              <button onClick={reset} className="text-[10px] text-gray-600 hover:text-red-400 transition-colors">✕</button>
            </div>
          )}
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Tab navigation */}
          <div className="flex gap-1 mb-6 bg-[#111] p-1 rounded-xl w-fit">
            {TABS.map((tab) => {
              const isLocked = (tab.id === 'mixer' || tab.id === 'versions') && !jobId;
              const isFinalLocked = tab.id === 'finalize' && status !== 'completed';
              const disabled = isLocked || isFinalLocked;
              return (
                <button
                  key={tab.id}
                  onClick={() => !disabled && setActiveTab(tab.id)}
                  disabled={disabled}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30'
                      : disabled
                      ? 'text-gray-700 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Pipeline progress bar */}
          {jobId && status !== 'completed' && status !== 'failed' && (
            <div className="riddim-card p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white uppercase tracking-wide">Pipeline Processing</span>
                <span className="text-xs text-yellow-400 font-mono">{progress}%</span>
              </div>
              <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {WORKER_ORDER.map((w) => {
                  const done = completedWorkers.includes(w);
                  const pending = pendingWorkers.includes(w);
                  const active = !done && !pending;
                  return (
                    <div
                      key={w}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all ${
                        done ? 'border-green-600 text-green-400 bg-green-400/5' :
                        'border-[#333] text-gray-600'
                      }`}
                    >
                      {done ? '✓ ' : ''}{WORKER_LABELS[w]}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="riddim-card p-4 mb-6 border-red-900 bg-red-900/10">
              <p className="text-sm text-red-400">⚠ {error}</p>
              <button onClick={reset} className="mt-2 text-xs text-gray-500 hover:text-white underline">Reset and try again</button>
            </div>
          )}

          {/* ---- UPLOAD TAB ---- */}
          {activeTab === 'upload' && (
            <div className="max-w-lg mx-auto flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Hum Your Riddim</h2>
                <p className="text-gray-400 text-sm">Upload a .wav or .mp3 of your hum, melody, or vocal reference.<br />The AI pipeline will extract timing, melody, BPM, and style — then build your riddim.</p>
              </div>

              {/* Drop zone */}
              <div
                onDragEnter={() => setDragActive(true)}
                onDragLeave={() => setDragActive(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`riddim-card p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
                  dragActive ? 'border-yellow-400 bg-yellow-400/5 glow-gold' : 'hover:border-gray-600'
                } ${status === 'uploading' || status === 'queued' || status === 'processing' ? 'pointer-events-none' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".wav,.mp3,audio/wav,audio/mpeg"
                  onChange={handleInputChange}
                  className="hidden"
                />
                {status === 'uploading' || status === 'queued' || status === 'processing' ? (
                  <>
                    <div className="w-12 h-12 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                    <p className="text-sm text-yellow-400">{status === 'uploading' ? 'Uploading...' : 'Processing pipeline...'}</p>
                    {jobId && <p className="text-xs text-gray-500 font-mono">Job: {jobId.slice(0,16)}...</p>}
                  </>
                ) : (
                  <>
                    <div className="text-5xl">{dragActive ? '🎶' : '🎤'}</div>
                    <div className="text-center">
                      <p className="text-white font-semibold">{dragActive ? 'Drop to upload' : 'Drop audio here'}</p>
                      <p className="text-gray-500 text-xs mt-1">or click to browse — .wav or .mp3, max 50MB</p>
                    </div>
                    <div className="flex gap-2">
                      {['wav', 'mp3'].map((fmt) => (
                        <span key={fmt} className="px-2 py-0.5 rounded bg-[#222] text-[10px] text-gray-400 uppercase font-mono">{fmt}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Pipeline steps preview */}
              <div className="riddim-card p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">What happens next</p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { step: 1, label: 'Onset & Timing Extraction', desc: 'Detects note onsets, phrase timing, breath spacing', color: '#f5c842' },
                    { step: 2, label: 'Melody Analysis', desc: 'Extracts pitch curve, key, scale, intervals', color: '#39ff14' },
                    { step: 3, label: 'BPM & Groove Detection', desc: 'Finds BPM, swing ratio, syncopation', color: '#00e5ff' },
                    { step: 4, label: 'Style Classification', desc: 'Identifies dancehall, roots, afro-fusion and more', color: '#8b5cf6' },
                    { step: 5, label: 'Riddim Generation', desc: 'Builds drums, bass, chords, percussion, FX patterns', color: '#f5c842' },
                    { step: 6, label: 'Stem Assembly', desc: 'Renders and packages all stems', color: '#39ff14' },
                    { step: 7, label: 'Fingerprint Validation', desc: 'Checks style accuracy and originality', color: '#00e5ff' },
                  ].map(({ step, label, desc, color }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5" style={{ borderColor: color, color }}>
                        {step}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{label}</p>
                        <p className="text-[10px] text-gray-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---- MIXER TAB ---- */}
          {activeTab === 'mixer' && (
            <div>
              {results && (
                <div className="flex gap-4 flex-wrap mb-4">
                  {[
                    { label: 'Key', value: `${humKey} minor`, color: '#8b5cf6' },
                    { label: 'BPM', value: `${detectedBpm}`, color: '#f5c842' },
                    { label: 'Style', value: detectedStyle, color: '#00e5ff' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[#111] border border-[#222] rounded-lg px-4 py-2">
                      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
                      <div className="text-sm font-bold capitalize" style={{ color }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
              <RiddimMixer jobId={jobId ?? undefined} initialStyle={detectedStyle as any} />
            </div>
          )}

          {/* ---- VERSIONS TAB ---- */}
          {activeTab === 'versions' && (
            <VersionGenerator
              jobId={jobId ?? undefined}
              humKey={humKey}
              onSelectVariation={(v) => {
                console.log('Selected variation:', v);
              }}
            />
          )}

          {/* ---- FINALIZE TAB ---- */}
          {activeTab === 'finalize' && (
            <FinalizeRiddim
              jobId={jobId ?? undefined}
              onFinalized={(pkg) => console.log('Package ready:', pkg)}
            />
          )}
        </main>
      </div>
    </>
  );
}
