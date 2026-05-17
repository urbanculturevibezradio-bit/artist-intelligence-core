// ============================================================
// pages/riddim-studio.tsx — Phase 4: Vocals tab added
// ============================================================
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Head from 'next/head';
import RiddimMixer from '@/components/RiddimMixer';
import VersionGenerator from '@/components/VersionGenerator';
import FinalizeRiddim from '@/components/FinalizeRiddim';
import { useJobPoller } from '@/hooks/useJobPoller';
import '@/styles/globals.css';

type StudioTab = 'upload' | 'mixer' | 'flow' | 'vocals' | 'versions' | 'finalize';

const TABS: Array<{ id: StudioTab; label: string; emoji: string }> = [
  { id: 'upload',   label: 'Upload',         emoji: '\uD83C\uDFA4' },
  { id: 'mixer',    label: 'Mixer',          emoji: '\uD83C\uDF9B\uFE0F' },
  { id: 'flow',     label: 'Flow & Pockets', emoji: '\uD83D\uDCCA' },
  { id: 'vocals',   label: 'Vocals',         emoji: '\uD83C\uDFB6' },
  { id: 'versions', label: 'Versions',       emoji: '\uD83C\uDFB5' },
  { id: 'finalize', label: 'Finalize',       emoji: '\uD83D\uDCE6' },
];

const WORKER_LABELS: Record<string, string> = {
  'whisper-timing':'Timing','melody-extraction':'Melody','bpm-groove':'BPM',
  'style-classifier':'Style','riddim-generator':'Generate',
  'stem-assembler':'Assemble','fingerprint-validator':'Validate',
};
const WORKER_ORDER = [
  'whisper-timing','melody-extraction','bpm-groove','style-classifier',
  'riddim-generator','stem-assembler','fingerprint-validator',
];

const FX_OPTIONS = ['dry','slapback','dub','reverb','delay','telephone'];
const VOICE_STYLES = ['deejay','singjay','chant','toasting','spoken'];
const VOICE_IDS = [
  { id: 'mock-voice',    label: 'Mock (no API key)' },
  { id: '21m00Tcm4TlvDq8ikWAM', label: '11Labs — Rachel' },
  { id: 'AZnzlk1XvdvUeBnXmlld', label: '11Labs — Domi' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: '11Labs — Bella' },
  { id: 'ErXwobaYiN019PkySvjV', label: '11Labs — Antoni' },
];

// ---- Pocket Grid ----
function PocketGrid({ bars }: { bars: any[] }) {
  const zoneColor: Record<string,string> = {
    hit:'bg-green-500', accent:'bg-yellow-400', breath:'bg-blue-400', rest:'bg-zinc-700',
  };
  return (
    <div className="overflow-x-auto">
      {bars.slice(0,8).map((bar: any) => (
        <div key={bar.barIndex} className="flex items-center gap-1 mb-1">
          <span className="text-xs text-zinc-400 w-8">B{bar.barIndex+1}</span>
          {bar.zones.map((z: any) => (
            <div key={z.stepIndex} title={z.zoneType}
              className={`w-4 h-4 rounded-sm ${zoneColor[z.zoneType]??'bg-zinc-700'}`}
              style={{ opacity: 0.3+z.strength*0.7 }} />
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

// ---- Hook Ideas Panel ----
function HookIdeasPanel({ hookIdeas, onApply }: { hookIdeas: any; onApply: (id: string) => void }) {
  if (!hookIdeas) return <p className="text-zinc-400 text-sm">No hook ideas yet.</p>;
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
              <div key={i} className={`w-3 h-3 rounded-sm ${v?'bg-green-400':'bg-zinc-700'} ${t.accentSteps.includes(i)?'ring-1 ring-yellow-400':''}`} />
            ))}
          </div>
          <button onClick={() => onApply(t.id)}
            className="mt-1 w-full py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors">
            Apply to Riddim
          </button>
        </div>
      ))}
    </div>
  );
}

// ---- Vocals Tab ----
function VocalsTab({ jobId, artistId }: { jobId: string; artistId: string }) {
  const [voiceId, setVoiceId] = useState('mock-voice');
  const [vocalStyle, setVocalStyle] = useState('deejay');
  const [fxPreset, setFxPreset] = useState('dub');
  const [templateId, setTemplateId] = useState('hook-chorus-main');
  const [generating, setGenerating] = useState(false);
  const [demos, setDemos] = useState<any[]>([]);
  const [pollError, setPollError] = useState('');

  const fetchDemos = useCallback(async () => {
    const r = await fetch('/api/vocals/get-vocal?jobId=' + jobId).then(x => x.json()).catch(() => null);
    if (r?.demos) setDemos(r.demos);
  }, [jobId]);

  useEffect(() => { fetchDemos(); }, [fetchDemos]);

  const handleGenerate = async () => {
    setGenerating(true); setPollError('');
    try {
      const r = await fetch('/api/vocals/generate-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, artistId, templateId, fxPreset, voiceConfig: { voiceId, vocalStyle } }),
      }).then(x => x.json());
      if (r.error) throw new Error(r.error);
      // Poll until completed
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await fetchDemos();
        const done = demos.some(d => d.templateId === templateId && d.status === 'completed');
        if (done || attempts > 20) { clearInterval(poll); setGenerating(false); }
      }, 2000);
    } catch (e: any) { setPollError(e.message); setGenerating(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold">\uD83C\uDFB6 Vocal Hook Demo</h2>

      {/* Controls */}
      <div className="bg-zinc-800 rounded-xl p-5 space-y-4 border border-zinc-700">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-zinc-400 block mb-1">Voice Model</span>
            <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
              className="w-full bg-zinc-700 text-white rounded-md px-3 py-2 text-sm border border-zinc-600">
              {VOICE_IDS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400 block mb-1">Vocal Style</span>
            <select value={vocalStyle} onChange={e => setVocalStyle(e.target.value)}
              className="w-full bg-zinc-700 text-white rounded-md px-3 py-2 text-sm border border-zinc-600">
              {VOICE_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400 block mb-1">FX Chain</span>
            <select value={fxPreset} onChange={e => setFxPreset(e.target.value)}
              className="w-full bg-zinc-700 text-white rounded-md px-3 py-2 text-sm border border-zinc-600">
              {FX_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400 block mb-1">Hook Template</span>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full bg-zinc-700 text-white rounded-md px-3 py-2 text-sm border border-zinc-600">
              <option value="hook-chorus-main">Main Chorus</option>
              <option value="hook-verse-flow">Verse Flow</option>
              <option value="hook-bridge">Bridge</option>
              <option value="hook-intro">Intro Build</option>
              <option value="hook-outro">Outro Fade</option>
            </select>
          </label>
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
          {generating ? 'Generating...' : 'Generate Hook Demo'}
        </button>
        {pollError && <p className="text-red-400 text-xs">{pollError}</p>}
      </div>

      {/* Demo list */}
      {demos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">Generated Demos</h3>
          {demos.map((d, i) => (
            <div key={i} className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{d.templateId}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${d.status==='completed'?'bg-green-900 text-green-300':d.status==='failed'?'bg-red-900 text-red-300':'bg-zinc-700 text-zinc-400'}`}>
                  {d.status}
                </span>
              </div>
              <div className="text-xs text-zinc-400 flex gap-4">
                <span>Style: {d.voiceConfig?.vocalStyle}</span>
                <span>FX: {d.fxChain?.chain?.[0]?.fxType}</span>
                <span>{Math.round((d.durationMs??0)/1000)}s</span>
              </div>
              {d.status === 'completed' && (
                <audio controls className="w-full mt-1" src={d.wavUrl}>
                  Your browser does not support audio.
                </audio>
              )}
              {d.error && <p className="text-red-400 text-xs">{d.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----
export default function RiddimStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>('upload');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pocketData, setPocketData] = useState<any>(null);
  const [hookIdeas, setHookIdeas] = useState<any>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
  const artistId = 'default-artist';

  const { jobId, status, progress, completedWorkers, pendingWorkers, results, error, uploadAudio, reset } = useJobPoller({
    onComplete: () => setActiveTab('mixer'),
    onError: (e) => console.error('[Studio]', e),
  });

  useEffect(() => {
    if (activeTab !== 'flow' || !jobId || pocketData) return;
    setFlowLoading(true);
    Promise.all([
      fetch('/api/artist/get-pocket-map?jobId=' + jobId).then(r => r.json()),
      fetch('/api/artist/get-hook-ideas?jobId=' + jobId).then(r => r.json()),
    ]).then(([pm, hi]) => { setPocketData(pm); setHookIdeas(hi?.hookIdeas ?? null); })
      .catch(console.error).finally(() => setFlowLoading(false));
  }, [activeTab, jobId, pocketData]);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'wav' && ext !== 'mp3') { alert('Upload .wav or .mp3'); return; }
    await uploadAudio(file);
  }, [uploadAudio]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
  }, [handleFile]);

  const isTabLocked = (tab: StudioTab) => {
    if (tab === 'upload') return false;
    if (!jobId) return true;
    return status !== 'completed';
  };

  return (
    <>
      <Head><title>Riddim Studio</title></Head>
      <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
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
        <nav className="border-b border-zinc-800 px-6 flex gap-1">
          {TABS.map(tab => {
            const locked = isTabLocked(tab.id);
            return (
              <button key={tab.id} onClick={() => !locked && setActiveTab(tab.id)} disabled={locked}
                className={['px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab===tab.id?'border-green-400 text-green-400':'border-transparent text-zinc-400',
                  locked?'opacity-30 cursor-not-allowed':'hover:text-white cursor-pointer'].join(' ')}
              >{tab.emoji} {tab.label}</button>
            );
          })}
        </nav>
        <main className="flex-1 p-6">

          {activeTab === 'upload' && (
            <div className="max-w-lg mx-auto">
              <div onDragOver={e=>{e.preventDefault();setDragActive(true);}} onDragLeave={()=>setDragActive(false)}
                onDrop={handleDrop} onClick={()=>fileInputRef.current?.click()}
                className={['border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors',
                  dragActive?'border-green-400 bg-green-400/5':'border-zinc-700 hover:border-zinc-500'].join(' ')}
              >
                <div className="text-5xl mb-4">\uD83C\uDFA4</div>
                <p className="text-lg font-medium mb-1">Drop your hum here</p>
                <p className="text-sm text-zinc-400">.wav or .mp3 up to 50MB</p>
                <input ref={fileInputRef} type="file" accept=".wav,.mp3" className="hidden"
                  onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}} />
              </div>
              {status==='processing' && (
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-300">Pipeline running...</span>
                    <span className="text-green-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{width:progress+'%'}} />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {WORKER_ORDER.map(w=>(
                      <div key={w} className={['rounded px-2 py-1 text-center text-xs',
                        completedWorkers.includes(w)?'bg-green-900 text-green-300':
                        pendingWorkers.includes(w)?'bg-zinc-700 text-zinc-300':'bg-zinc-800 text-zinc-500'].join(' ')}
                      >{WORKER_LABELS[w]}</div>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="mt-4 text-red-400 text-sm">Error: {error}</p>}
            </div>
          )}

          {activeTab==='mixer' && jobId && <RiddimMixer jobId={jobId} results={results} />}

          {activeTab==='flow' && (
            <div className="flex gap-6 max-w-5xl mx-auto">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-4">\uD83D\uDCCA Pocket Map</h2>
                {flowLoading && <p className="text-zinc-400 text-sm">Analysing...</p>}
                {!flowLoading && pocketData?.pocketMap && (
                  <div className="space-y-4">
                    <div className="flex gap-4 text-sm">
                      {[['Pocket',pocketData.pocketMap.globalPocketPosition],['BPM',pocketData.pocketMap.bpm],['Bars',pocketData.pocketMap.totalBars]].map(([k,v])=>(
                        <div key={String(k)} className="bg-zinc-800 rounded-lg p-4 flex-1 text-center">
                          <div className="text-zinc-400 text-xs mb-1">{k}</div>
                          <div className="text-xl font-bold text-green-400 capitalize">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h3 className="text-sm font-medium mb-3">Per-Bar Grid</h3>
                      <PocketGrid bars={pocketData.pocketMap.bars??[]} />
                    </div>
                  </div>
                )}
              </div>
              <div className="w-72 flex-shrink-0">
                <h2 className="text-lg font-semibold mb-4">\uD83C\uDFB8 Hook Ideas</h2>
                {appliedTemplate && <div className="mb-3 p-2 bg-green-900 text-green-300 rounded text-xs">Applied: {appliedTemplate}</div>}
                {flowLoading?<p className="text-zinc-400 text-sm">Loading...</p>:<HookIdeasPanel hookIdeas={hookIdeas} onApply={setAppliedTemplate} />}
              </div>
            </div>
          )}

          {activeTab==='vocals' && jobId && <VocalsTab jobId={jobId} artistId={artistId} />}

          {activeTab==='versions' && jobId && <VersionGenerator jobId={jobId} results={results} />}

          {activeTab==='finalize' && jobId && <FinalizeRiddim jobId={jobId} results={results} />}

        </main>
      </div>
    </>
  );
}
