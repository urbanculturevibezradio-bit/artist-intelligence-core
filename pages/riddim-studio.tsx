// ============================================================
// pages/riddim-studio.tsx
// Main RiddimStudio page with Flow & Pockets + Hook Ideas
// ============================================================
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Head from 'next/head';
import RiddimMixer from '@/components/RiddimMixer';
import VersionGenerator from '@/components/VersionGenerator';
import FinalizeRiddim from '@/components/FinalizeRiddim';
import { useJobPoller } from '@/hooks/useJobPoller';
import '@/styles/globals.css';

type StudioTab = 'upload' | 'mixer' | 'versions' | 'finalize' | 'flow';

const TABS: Array<{ id: StudioTab; label: string; emoji: string }> = [
  { id: 'upload',   label: 'Upload',      emoji: '\uD83C\uDFA4' },
  { id: 'mixer',    label: 'Mixer',       emoji: '\uD83C\uDF9B\uFE0F' },
  { id: 'flow',     label: 'Flow & Pockets', emoji: '\uD83D\uDCCA' },
  { id: 'versions', label: 'Versions',    emoji: '\uD83C\uDFB5' },
  { id: 'finalize', label: 'Finalize',    emoji: '\uD83D\uDCE6' },
];

const WORKER_LABELS: Record<string, string> = {
  'whisper-timing': 'Timing', 'melody-extraction': 'Melody', 'bpm-groove': 'BPM',
  'style-classifier': 'Style', 'riddim-generator': 'Generate',
  'stem-assembler': 'Assemble', 'fingerprint-validator': 'Validate',
};

const WORKER_ORDER = [
  'whisper-timing','melody-extraction','bpm-groove','style-classifier',
  'riddim-generator','stem-assembler','fingerprint-validator',
];

// ---- Pocket Map Grid component ----
function PocketGrid({ bars }: { bars: any[] }) {
  const zoneColor: Record<string,string> = {
    hit: 'bg-green-500', accent: 'bg-yellow-400', breath: 'bg-blue-400', rest: 'bg-zinc-700',
  };
  return (
    <div className="overflow-x-auto">
      {bars.slice(0, 8).map((bar: any) => (
        <div key={bar.barIndex} className="flex items-center gap-1 mb-1">
          <span className="text-xs text-zinc-400 w-8">B{bar.barIndex + 1}</span>
          {bar.zones.map((z: any) => (
            <div
              key={z.stepIndex}
              title={`${z.zoneType} str:${z.strength.toFixed(2)}`}
              className={`w-4 h-4 rounded-sm ${zoneColor[z.zoneType] ?? 'bg-zinc-700'}`}
              style={{ opacity: 0.3 + z.strength * 0.7 }}
            />
          ))}
        </div>
      ))}
      <div className="flex gap-3 mt-2 text-xs text-zinc-400">
        <span><span className="inline-block w-3 h-3 rounded-sm bg-green-500 mr-1" />Hit</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-yellow-400 mr-1" />Accent</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-blue-400 mr-1" />Breath</span>
        <span><span className="inline-block w-3 h-3 rounded-sm bg-zinc-700 mr-1" />Rest</span>
      </div>
    </div>
  );
}

// ---- Hook Ideas sidebar component ----
function HookIdeasPanel({
  hookIdeas,
  onApply,
}: {
  hookIdeas: any;
  onApply: (templateId: string) => void;
}) {
  if (!hookIdeas) return <p className="text-zinc-400 text-sm">No hook ideas yet. Run analysis first.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-400 italic">{hookIdeas.chorusContrast}</p>
      {hookIdeas.templates.map((t: any) => (
        <div key={t.id} className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">{t.name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-600 text-zinc-300">{t.sectionType}</span>
          </div>
          <p className="text-xs text-zinc-400 mb-2">{t.description}</p>
          <div className="flex gap-0.5 mb-2">
            {t.pattern.map((v: number, i: number) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-sm ${v ? 'bg-green-400' : 'bg-zinc-700'} ${t.accentSteps.includes(i) ? 'ring-1 ring-yellow-400' : ''}`}
              />
            ))}
          </div>
          <div className="flex gap-3 text-xs text-zinc-400">
            <span>Energy {Math.round(t.energyLevel * 100)}%</span>
            <span>Sync {Math.round(t.syncopationLevel * 100)}%</span>
            <span>{t.barLength}bar</span>
          </div>
          <button
            onClick={() => onApply(t.id)}
            className="mt-2 w-full py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors"
          >
            Apply to Riddim
          </button>
        </div>
      ))}
      {hookIdeas.callAndResponse?.map((cr: any, i: number) => (
        <div key={i} className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
          <div className="text-sm font-medium text-white mb-1">
            Call & Response ({cr.callBars}+{cr.responseBars} bars)
          </div>
          <div className="flex gap-1 flex-wrap text-xs text-zinc-400">
            <span className="text-green-400 mr-1">Call:</span>
            {cr.callPattern.slice(0,16).map((v: number, j: number) => (
              <span key={j} className={v ? 'text-green-400' : 'text-zinc-600'}>|</span>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap text-xs text-zinc-400">
            <span className="text-blue-400 mr-1">Resp:</span>
            {cr.responsePattern.slice(0,16).map((v: number, j: number) => (
              <span key={j} className={v ? 'text-blue-400' : 'text-zinc-600'}>|</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RiddimStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>('upload');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pocketData, setPocketData] = useState<any>(null);
  const [hookIdeas, setHookIdeas] = useState<any>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);

  const { jobId, status, progress, completedWorkers, pendingWorkers, results, error, uploadAudio, reset } = useJobPoller({
    onComplete: () => setActiveTab('mixer'),
    onError: (e) => console.error('[Studio] Pipeline error:', e),
  });

  // Fetch flow & pocket data when the flow tab becomes active
  useEffect(() => {
    if (activeTab !== 'flow' || !jobId || pocketData) return;
    setFlowLoading(true);
    Promise.all([
      fetch('/api/artist/get-pocket-map?jobId=' + jobId).then(r => r.json()),
      fetch('/api/artist/get-hook-ideas?jobId=' + jobId).then(r => r.json()),
    ])
      .then(([pocketRes, hookRes]) => {
        setPocketData(pocketRes);
        setHookIdeas(hookRes?.hookIdeas ?? null);
      })
      .catch(console.error)
      .finally(() => setFlowLoading(false));
  }, [activeTab, jobId, pocketData]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'wav' && ext !== 'mp3') { alert('Please upload a .wav or .mp3 file'); return; }
    await uploadAudio(file);
  }, [uploadAudio]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const isTabLocked = (tab: StudioTab) => {
    if (tab === 'upload') return false;
    if (!jobId) return true;
    if (tab === 'flow') return status !== 'completed';
    if (tab === 'mixer') return status !== 'completed';
    if (tab === 'versions') return status !== 'completed';
    if (tab === 'finalize') return status !== 'completed';
    return false;
  };

  return (
    <>
      <Head><title>Riddim Studio</title></Head>
      <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">

        {/* Header */}
        <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">\uD83C\uDFB5</span>
            <h1 className="text-xl font-bold tracking-tight">Riddim Studio</h1>
            {jobId && <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded font-mono">{jobId.slice(0,8)}</span>}
          </div>
          {jobId && (
            <button onClick={() => { reset(); setActiveTab('upload'); setPocketData(null); setHookIdeas(null); }}
              className="text-xs text-zinc-400 hover:text-white transition-colors">New Session</button>
          )}
        </header>

        {/* Tab Bar */}
        <nav className="border-b border-zinc-800 px-6 flex gap-1">
          {TABS.map(tab => {
            const locked = isTabLocked(tab.id);
            return (
              <button key={tab.id}
                onClick={() => !locked && setActiveTab(tab.id)}
                disabled={locked}
                className={[
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id ? 'border-green-400 text-green-400' : 'border-transparent text-zinc-400',
                  locked ? 'opacity-30 cursor-not-allowed' : 'hover:text-white cursor-pointer',
                ].join(' ')}
              >
                {tab.emoji} {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6">

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="max-w-lg mx-auto">
              <div
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={['border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors',
                  dragActive ? 'border-green-400 bg-green-400/5' : 'border-zinc-700 hover:border-zinc-500'].join(' ')}
              >
                <div className="text-5xl mb-4">\uD83C\uDFA4</div>
                <p className="text-lg font-medium mb-1">Drop your hum here</p>
                <p className="text-sm text-zinc-400">.wav or .mp3 up to 50MB</p>
                <input ref={fileInputRef} type="file" accept=".wav,.mp3" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              {status === 'processing' && (
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-300">Pipeline running...</span>
                    <span className="text-green-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: progress + '%' }} />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {WORKER_ORDER.map(w => (
                      <div key={w} className={['rounded px-2 py-1 text-center text-xs',
                        completedWorkers.includes(w) ? 'bg-green-900 text-green-300' :
                        pendingWorkers.includes(w) ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-800 text-zinc-500'].join(' ')}
                      >{WORKER_LABELS[w]}</div>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="mt-4 text-red-400 text-sm">Error: {error}</p>}
            </div>
          )}

          {/* Mixer Tab */}
          {activeTab === 'mixer' && jobId && <RiddimMixer jobId={jobId} results={results} />}

          {/* Flow & Pockets Tab */}
          {activeTab === 'flow' && (
            <div className="flex gap-6 max-w-5xl mx-auto">
              {/* Pocket Map */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-4">\uD83D\uDCCA Pocket Map</h2>
                {flowLoading && <p className="text-zinc-400 text-sm">Analysing flow patterns...</p>}
                {!flowLoading && pocketData?.pocketMap && (
                  <div className="space-y-4">
                    <div className="flex gap-6 text-sm">
                      <div className="bg-zinc-800 rounded-lg p-4 flex-1">
                        <div className="text-zinc-400 text-xs mb-1">Pocket Position</div>
                        <div className="text-xl font-bold capitalize text-green-400">{pocketData.pocketMap.globalPocketPosition}</div>
                        <div className="text-xs text-zinc-500">{pocketData.pocketMap.globalOffsetMs?.toFixed(1)}ms offset</div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-4 flex-1">
                        <div className="text-zinc-400 text-xs mb-1">BPM</div>
                        <div className="text-xl font-bold text-green-400">{pocketData.pocketMap.bpm}</div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-4 flex-1">
                        <div className="text-zinc-400 text-xs mb-1">Bars</div>
                        <div className="text-xl font-bold text-green-400">{pocketData.pocketMap.totalBars}</div>
                      </div>
                    </div>
                    {pocketData.flow && (
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="bg-zinc-800 rounded p-3">
                          <div className="text-zinc-400 text-xs mb-1">Syncopation</div>
                          <div className="font-bold">{Math.round((pocketData.flow.syncopationScore ?? 0)*100)}%</div>
                        </div>
                        <div className="bg-zinc-800 rounded p-3">
                          <div className="text-zinc-400 text-xs mb-1">Syllable Density</div>
                          <div className="font-bold">{(pocketData.flow.avgSyllableDensity ?? 0).toFixed(1)}/s</div>
                        </div>
                        <div className="bg-zinc-800 rounded p-3">
                          <div className="text-zinc-400 text-xs mb-1">Avg Phrase</div>
                          <div className="font-bold">{(pocketData.flow.avgPhraseLength ?? 0).toFixed(1)}s</div>
                        </div>
                      </div>
                    )}
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium mb-3">Per-Bar Pocket Grid</h3>
                      <PocketGrid bars={pocketData.pocketMap.bars ?? []} />
                    </div>
                  </div>
                )}
                {!flowLoading && !pocketData?.pocketMap && (
                  <div className="bg-zinc-800 rounded-lg p-6 text-center text-zinc-400">
                    <p className="text-sm">Complete the pipeline to view the pocket map.</p>
                  </div>
                )}
              </div>

              {/* Hook Ideas Sidebar */}
              <div className="w-80 flex-shrink-0">
                <h2 className="text-lg font-semibold mb-4">\uD83C\uDFB8 Hook Ideas</h2>
                {appliedTemplate && (
                  <div className="mb-3 p-2 bg-green-900 text-green-300 rounded text-xs">
                    Applied: {appliedTemplate}
                  </div>
                )}
                {flowLoading
                  ? <p className="text-zinc-400 text-sm">Loading hook ideas...</p>
                  : <HookIdeasPanel hookIdeas={hookIdeas} onApply={(id) => setAppliedTemplate(id)} />
                }
              </div>
            </div>
          )}

          {/* Versions Tab */}
          {activeTab === 'versions' && jobId && <VersionGenerator jobId={jobId} results={results} />}

          {/* Finalize Tab */}
          {activeTab === 'finalize' && jobId && <FinalizeRiddim jobId={jobId} results={results} />}

        </main>
      </div>
    </>
  );
}
