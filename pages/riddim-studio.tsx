// ============================================================
// pages/riddim-studio.tsx — Phase 5: Packs, Voices, Marketplace tabs
// ============================================================
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Head from 'next/head';
import RiddimMixer from '@/components/RiddimMixer';
import VersionGenerator from '@/components/VersionGenerator';
import FinalizeRiddim from '@/components/FinalizeRiddim';
import { useJobPoller } from '@/hooks/useJobPoller';
import '@/styles/globals.css';

type StudioTab = 'upload'|'mixer'|'flow'|'vocals'|'packs'|'voices'|'marketplace'|'versions'|'finalize';

const TABS: Array<{ id: StudioTab; label: string; emoji: string; requiresJob?: boolean }> = [
  { id:'upload',      label:'Upload',      emoji:'\uD83C\uDFA4' },
  { id:'mixer',       label:'Mixer',       emoji:'\uD83C\uDF9B\uFE0F', requiresJob:true },
  { id:'flow',        label:'Flow',        emoji:'\uD83D\uDCCA', requiresJob:true },
  { id:'vocals',      label:'Vocals',      emoji:'\uD83C\uDFB6', requiresJob:true },
  { id:'packs',       label:'Packs',       emoji:'\uD83D\uDCE6' },
  { id:'voices',      label:'Voices',      emoji:'\uD83C\uDFD9\uFE0F' },
  { id:'marketplace', label:'Marketplace', emoji:'\uD83D\uDECD\uFE0F' },
  { id:'versions',    label:'Versions',    emoji:'\uD83C\uDFB5', requiresJob:true },
  { id:'finalize',    label:'Finalize',    emoji:'\uD83D\uDCBE', requiresJob:true },
];

const WORKER_LABELS: Record<string,string> = {
  'whisper-timing':'Timing','melody-extraction':'Melody','bpm-groove':'BPM',
  'style-classifier':'Style','riddim-generator':'Generate',
  'stem-assembler':'Assemble','fingerprint-validator':'Validate',
};
const WORKER_ORDER = ['whisper-timing','melody-extraction','bpm-groove','style-classifier','riddim-generator','stem-assembler','fingerprint-validator'];
const FX_OPTIONS = ['dry','slapback','dub','reverb','delay','telephone'];
const VOICE_STYLES = ['deejay','singjay','chant','toasting','spoken'];
const VOICE_IDS = [
  { id:'mock-voice', label:'Mock (no API key)' },
  { id:'21m00Tcm4TlvDq8ikWAM', label:'11Labs \u2014 Rachel' },
  { id:'AZnzlk1XvdvUeBnXmlld', label:'11Labs \u2014 Domi' },
  { id:'ErXwobaYiN019PkySvjV',  label:'11Labs \u2014 Antoni' },
];
const ITEM_TYPES = ['','riddim','stem','voice','hook','pack'];

// ---- Pocket Grid ----
function PocketGrid({ bars }: { bars: any[] }) {
  const zoneColor: Record<string,string> = { hit:'bg-green-500',accent:'bg-yellow-400',breath:'bg-blue-400',rest:'bg-zinc-700' };
  return (
    <div className="overflow-x-auto">
      {bars.slice(0,8).map((bar:any) => (
        <div key={bar.barIndex} className="flex items-center gap-1 mb-1">
          <span className="text-xs text-zinc-400 w-8">B{bar.barIndex+1}</span>
          {bar.zones.map((z:any) => (
            <div key={z.stepIndex} title={z.zoneType}
              className={`w-4 h-4 rounded-sm ${zoneColor[z.zoneType]??'bg-zinc-700'}`}
              style={{opacity:0.3+z.strength*0.7}} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- Hook Ideas Panel ----
function HookIdeasPanel({ hookIdeas, onApply }: { hookIdeas:any; onApply:(id:string)=>void }) {
  if (!hookIdeas) return <p className="text-zinc-400 text-sm">No hook ideas yet.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-400 italic">{hookIdeas.chorusContrast}</p>
      {hookIdeas.templates.map((t:any) => (
        <div key={t.id} className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{t.name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-600 text-zinc-300">{t.sectionType}</span>
          </div>
          <div className="flex gap-0.5 mb-2">{t.pattern.map((v:number,i:number) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${v?'bg-green-400':'bg-zinc-700'}`} />
          ))}</div>
          <button onClick={()=>onApply(t.id)} className="w-full py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-medium">Apply to Riddim</button>
        </div>
      ))}
    </div>
  );
}

// ---- Vocals Tab ----
function VocalsTab({ jobId, artistId }: { jobId:string; artistId:string }) {
  const [voiceId, setVoiceId] = useState('mock-voice');
  const [vocalStyle, setVocalStyle] = useState('deejay');
  const [fxPreset, setFxPreset] = useState('dub');
  const [templateId, setTemplateId] = useState('hook-chorus-main');
  const [generating, setGenerating] = useState(false);
  const [demos, setDemos] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const fetchDemos = useCallback(async () => {
    const r = await fetch('/api/vocals/get-vocal?jobId='+jobId).then(x=>x.json()).catch(()=>null);
    if (r?.demos) setDemos(r.demos);
  }, [jobId]);
  useEffect(()=>{ fetchDemos(); },[fetchDemos]);
  const handleGenerate = async () => {
    setGenerating(true); setErr('');
    try {
      const r = await fetch('/api/vocals/generate-hook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId,artistId,templateId,fxPreset,voiceConfig:{voiceId,vocalStyle}})}).then(x=>x.json());
      if (r.error) throw new Error(r.error);
      let attempts=0;
      const poll = setInterval(async()=>{ attempts++; await fetchDemos(); if(attempts>20){clearInterval(poll);setGenerating(false);} },2000);
    } catch(e:any) { setErr(e.message); setGenerating(false); }
  };
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold">\uD83C\uDFB6 Vocal Hook Demo</h2>
      <div className="bg-zinc-800 rounded-xl p-5 space-y-4 border border-zinc-700">
        <div className="grid grid-cols-2 gap-4">
          {[['Voice Model',voiceId,setVoiceId,VOICE_IDS.map(v=>({v:v.id,l:v.label}))],['Vocal Style',vocalStyle,setVocalStyle,VOICE_STYLES.map(s=>({v:s,l:s}))],['FX Chain',fxPreset,setFxPreset,FX_OPTIONS.map(f=>({v:f,l:f}))],['Template',templateId,setTemplateId,[{v:'hook-chorus-main',l:'Chorus'},{v:'hook-verse-flow',l:'Verse'},{v:'hook-bridge',l:'Bridge'},{v:'hook-intro',l:'Intro'},{v:'hook-outro',l:'Outro'}]]].map(([label,val,setter,opts]:any) => (
            <label key={label} className="block">
              <span className="text-xs text-zinc-400 block mb-1">{label}</span>
              <select value={val} onChange={e=>setter(e.target.value)} className="w-full bg-zinc-700 text-white rounded-md px-3 py-2 text-sm border border-zinc-600">
                {opts.map((o:any)=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
          ))}
        </div>
        <button onClick={handleGenerate} disabled={generating} className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm">{generating?'Generating...':'Generate Hook Demo'}</button>
        {err && <p className="text-red-400 text-xs">{err}</p>}
      </div>
      {demos.length>0 && <div className="space-y-3">{demos.map((d,i)=>(
        <div key={i} className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 space-y-2">
          <div className="flex items-center justify-between"><span className="text-sm font-medium">{d.templateId}</span><span className={`text-xs px-2 py-0.5 rounded ${d.status==='completed'?'bg-green-900 text-green-300':'bg-zinc-700 text-zinc-400'}`}>{d.status}</span></div>
          {d.status==='completed' && <audio controls className="w-full" src={d.wavUrl} />}
          {d.error && <p className="text-red-400 text-xs">{d.error}</p>}
        </div>
      ))}</div>}
    </div>
  );
}

// ---- Packs Tab ----
function PacksTab({ artistId, jobId }: { artistId:string; jobId?:string }) {
  const [packs, setPacks] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    fetch('/api/packs/list?artistId='+artistId).then(r=>r.json()).then(d=>{ if(d.packs) setPacks(d.packs); }).catch(()=>{});
  },[artistId]);
  const handleCreate = async () => {
    if (!jobId) return;
    setCreating(true); setMsg('');
    try {
      const r = await fetch('/api/packs/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artistId,jobIds:[jobId]})}).then(x=>x.json());
      if (r.error) throw new Error(r.error);
      setPacks(p=>[r,...p]); setMsg('Pack created: '+r.packId.slice(0,8));
    } catch(e:any){setMsg('Error: '+e.message);} finally{setCreating(false);}
  };
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">\uD83D\uDCE6 Artist Packs</h2>
        {jobId && <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">{creating?'Creating...':'Bundle Current Job'}</button>}
      </div>
      {msg && <p className="text-xs text-zinc-400">{msg}</p>}
      {packs.length===0 && <p className="text-zinc-400 text-sm">No packs yet. Upload and process a job, then bundle it here.</p>}
      {packs.map((p:any)=>(
        <div key={p.packId} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-zinc-400 font-mono">{p.packId.slice(0,8)} \u2022 {p.jobIds.length} job(s)</div>
            </div>
            <div className="text-right text-xs text-zinc-400">
              <div>BPM {p.bpmRange?.min}\u2013{p.bpmRange?.max}</div>
              <div>{(p.totalDurationMs/1000).toFixed(1)}s</div>
            </div>
          </div>
          {p.assets?.stemUrls?.length>0 && (
            <div>
              <div className="text-xs text-zinc-400 mb-1">Stems ({p.assets.stemUrls.length})</div>
              <div className="flex flex-wrap gap-2">{p.assets.stemUrls.map((u:string,i:number)=>(
                <a key={i} href={u} download className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300">\uD83D\uDD0A Stem {i+1}</a>
              ))}</div>
            </div>
          )}
          {p.assets?.vocalDemoUrls?.length>0 && (
            <div>
              <div className="text-xs text-zinc-400 mb-1">Vocal Demos ({p.assets.vocalDemoUrls.length})</div>
              <div className="space-y-1">{p.assets.vocalDemoUrls.map((u:string,i:number)=>(
                <audio key={i} controls className="w-full" src={u} />
              ))}</div>
            </div>
          )}
          {p.styles?.length>0 && <div className="flex gap-2">{p.styles.map((s:string)=>(<span key={s} className="text-xs px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded">{s}</span>))}</div>}
        </div>
      ))}
    </div>
  );
}

// ---- Voices Tab ----
function VoicesTab({ onApply }: { onApply:(voiceId:string,style:string,fx:string)=>void }) {
  const [packs, setPacks] = useState<any[]>([]);
  const [previewIdx, setPreviewIdx] = useState<string|null>(null);
  useEffect(()=>{ fetch('/api/voices/list').then(r=>r.json()).then(d=>{ if(d.packs) setPacks(d.packs); }).catch(()=>{}); },[]);
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-lg font-semibold">\uD83C\uDFD9\uFE0F Voice Packs</h2>
      {packs.length===0 && <p className="text-zinc-400 text-sm">Loading voice packs...</p>}
      {packs.map((p:any)=>(
        <div key={p.packId} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{p.description}</div>
            </div>
            <div className="flex gap-2">{p.tags.map((t:string)=>(<span key={t} className="text-xs px-2 py-0.5 bg-zinc-600 text-zinc-300 rounded">{t}</span>))}</div>
          </div>
          {p.previewUrl && previewIdx===p.packId && <audio autoPlay controls className="w-full" src={p.previewUrl} />}
          <div className="flex gap-2">
            {p.previewUrl && <button onClick={()=>setPreviewIdx(prev=>prev===p.packId?null:p.packId)} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs">{previewIdx===p.packId?'Stop':'\u25B6 Preview'}</button>}
            <button onClick={()=>onApply(p.voices[0]?.voiceId??'mock-voice',p.voices[0]?.vocalStyle??'deejay',p.defaultFxPreset??'dub')} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium">Apply to Vocals</button>
          </div>
          <div className="space-y-1">{p.voices.map((v:any,i:number)=>(
            <div key={i} className="flex items-center justify-between text-xs bg-zinc-900 rounded px-3 py-2">
              <span className="text-zinc-300">{v.vocalStyle}</span>
              <span className="text-zinc-500 font-mono">{v.provider} / {v.voiceId.slice(0,12)}...</span>
            </div>
          ))}</div>
        </div>
      ))}
    </div>
  );
}

// ---- Marketplace Tab ----
function MarketplaceTab() {
  const [items, setItems] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(()=>{
    setLoading(true);
    const q = typeFilter ? '?type='+typeFilter : '';
    fetch('/api/marketplace/list'+q).then(r=>r.json()).then(d=>{ if(d.items) setItems(d.items); }).catch(()=>{}).finally(()=>setLoading(false));
  },[typeFilter]);
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">\uD83D\uDECD\uFE0F Marketplace</h2>
        <div className="flex gap-2">{ITEM_TYPES.map(t=>(
          <button key={t} onClick={()=>setTypeFilter(t)} className={`px-3 py-1 rounded text-xs font-medium ${typeFilter===t?'bg-green-600 text-white':'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{t||'All'}</button>
        ))}</div>
      </div>
      {loading && <p className="text-zinc-400 text-sm">Loading...</p>}
      {!loading && items.length===0 && <p className="text-zinc-400 text-sm">No items listed yet. Create packs and register them to the marketplace.</p>}
      <div className="grid grid-cols-2 gap-4">{items.map((item:any)=>(
        <div key={item.itemId} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-sm">{item.title}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{item.description}</div>
            </div>
            {item.featured && <span className="text-xs px-1.5 py-0.5 bg-yellow-600 text-white rounded">Featured</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="px-1.5 py-0.5 bg-zinc-700 rounded">{item.type}</span>
            {item.bpm && <span>{item.bpm} BPM</span>}
            {item.style && <span>{item.style}</span>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-green-400">{item.price===0?'Free':'$'+(item.price/100).toFixed(2)}</span>
            <div className="flex gap-2">
              {item.previewUrl && <a href={item.previewUrl} className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded">\u25B6 Preview</a>}
              {item.downloadUrl && <a href={'/api/marketplace/get?itemId='+item.itemId+'&download=true'} className="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded">\u2193 Get</a>}
            </div>
          </div>
          <div className="text-xs text-zinc-500">{item.downloadCount} downloads</div>
        </div>
      ))}</div>
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
  const [appliedTemplate, setAppliedTemplate] = useState<string|null>(null);
  const artistId = 'default-artist';

  const { jobId, status, progress, completedWorkers, pendingWorkers, results, error, uploadAudio, reset } = useJobPoller({
    onComplete: ()=>setActiveTab('mixer'),
    onError: (e)=>console.error('[Studio]',e),
  });

  useEffect(()=>{
    if (activeTab!=='flow'||!jobId||pocketData) return;
    setFlowLoading(true);
    Promise.all([
      fetch('/api/artist/get-pocket-map?jobId='+jobId).then(r=>r.json()),
      fetch('/api/artist/get-hook-ideas?jobId='+jobId).then(r=>r.json()),
    ]).then(([pm,hi])=>{ setPocketData(pm); setHookIdeas(hi?.hookIdeas??null); })
      .catch(console.error).finally(()=>setFlowLoading(false));
  },[activeTab,jobId,pocketData]);

  const handleFile = useCallback(async (file:File)=>{
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext!=='wav'&&ext!=='mp3'){alert('Upload .wav or .mp3');return;}
    await uploadAudio(file);
  },[uploadAudio]);

  const handleDrop = useCallback((e:React.DragEvent)=>{
    e.preventDefault(); setDragActive(false);
    const f=e.dataTransfer.files?.[0]; if(f) handleFile(f);
  },[handleFile]);

  const isTabLocked = (tab: StudioTab) => {
    const def = TABS.find(t=>t.id===tab);
    if (!def?.requiresJob) return false;
    if (!jobId) return true;
    return status!=='completed';
  };

  return (
    <>
      <Head><title>Riddim Studio</title></Head>
      <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
        <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">\uD83C\uDFB5</span>
            <h1 className="text-xl font-bold">Riddim Studio</h1>
            {jobId && <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded font-mono">{jobId.slice(0,8)}</span>}
          </div>
          {jobId && <button onClick={()=>{reset();setActiveTab('upload');setPocketData(null);setHookIdeas(null);}} className="text-xs text-zinc-400 hover:text-white">New Session</button>}
        </header>
        <nav className="border-b border-zinc-800 px-4 flex gap-0.5 overflow-x-auto">
          {TABS.map(tab=>{
            const locked=isTabLocked(tab.id);
            return <button key={tab.id} onClick={()=>!locked&&setActiveTab(tab.id)} disabled={locked}
              className={['px-3 py-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors',
                activeTab===tab.id?'border-green-400 text-green-400':'border-transparent text-zinc-400',
                locked?'opacity-30 cursor-not-allowed':'hover:text-white cursor-pointer'].join(' ')}
            >{tab.emoji} {tab.label}</button>;
          })}
        </nav>
        <main className="flex-1 p-6">

          {activeTab==='upload' && (
            <div className="max-w-lg mx-auto">
              <div onDragOver={e=>{e.preventDefault();setDragActive(true);}} onDragLeave={()=>setDragActive(false)}
                onDrop={handleDrop} onClick={()=>fileInputRef.current?.click()}
                className={['border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors',
                  dragActive?'border-green-400 bg-green-400/5':'border-zinc-700 hover:border-zinc-500'].join(' ')}
              >
                <div className="text-5xl mb-4">\uD83C\uDFA4</div>
                <p className="text-lg font-medium mb-1">Drop your hum here</p>
                <p className="text-sm text-zinc-400">.wav or .mp3 up to 50MB</p>
                <input ref={fileInputRef} type="file" accept=".wav,.mp3" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}} />
              </div>
              {status==='processing' && (
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between text-sm"><span>Pipeline running...</span><span className="text-green-400">{progress}%</span></div>
                  <div className="w-full bg-zinc-800 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full transition-all" style={{width:progress+'%'}} /></div>
                  <div className="grid grid-cols-4 gap-2">{WORKER_ORDER.map(w=>(<div key={w} className={['rounded px-2 py-1 text-center text-xs',completedWorkers.includes(w)?'bg-green-900 text-green-300':pendingWorkers.includes(w)?'bg-zinc-700 text-zinc-300':'bg-zinc-800 text-zinc-500'].join(' ')}>{WORKER_LABELS[w]}</div>))}</div>
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
                    <div className="flex gap-4">{[['Pocket',pocketData.pocketMap.globalPocketPosition],['BPM',pocketData.pocketMap.bpm],['Bars',pocketData.pocketMap.totalBars]].map(([k,v])=>(
                      <div key={String(k)} className="bg-zinc-800 rounded-lg p-4 flex-1 text-center"><div className="text-zinc-400 text-xs mb-1">{k}</div><div className="text-xl font-bold text-green-400 capitalize">{v}</div></div>
                    ))}</div>
                    <div className="bg-zinc-800 rounded-lg p-4"><h3 className="text-sm font-medium mb-3">Per-Bar Grid</h3><PocketGrid bars={pocketData.pocketMap.bars??[]} /></div>
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

          {activeTab==='packs' && <PacksTab artistId={artistId} jobId={status==='completed'?jobId:undefined} />}

          {activeTab==='voices' && <VoicesTab onApply={(vid,vs,fx)=>{ console.log('Voice applied:',vid,vs,fx); setActiveTab('vocals'); }} />}

          {activeTab==='marketplace' && <MarketplaceTab />}

          {activeTab==='versions' && jobId && <VersionGenerator jobId={jobId} results={results} />}

          {activeTab==='finalize' && jobId && <FinalizeRiddim jobId={jobId} results={results} />}

        </main>
      </div>
    </>
  );
}
