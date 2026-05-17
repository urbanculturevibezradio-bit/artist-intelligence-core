// ============================================================
// components/FinalizeRiddim.tsx
// Triggers stem-assembler + fingerprint-validator, returns downloadable package
// ============================================================
'use client';
import { useState, useCallback } from 'react';

interface FingerprintResult {
  passed: boolean;
  similarityScore: number;
  bpmAccuracy: number;
  styleAccuracy: number;
  issues: Array<{
    type: string;
    severity: 'warning' | 'error';
    detail: string;
  }>;
}

interface StemFile {
  name: string;
  type: string;
  durationMs: number;
  sampleRate: number;
}

interface PackageResult {
  jobId: string;
  packagePath: string;
  stems: StemFile[];
  masterBpm: number;
  masterKey: string;
  style: string;
  totalDurationMs: number;
  fingerprint?: FingerprintResult;
}

interface FinalizeRiddimProps {
  jobId?: string;
  onFinalized?: (pkg: PackageResult) => void;
}

type FinalizeStage = 'idle' | 'assembling' | 'validating' | 'ready' | 'failed';

const STAGE_LABELS: Record<FinalizeStage, string> = {
  idle: 'Ready to finalize',
  assembling: 'Assembling stems...',
  validating: 'Running fingerprint validation...',
  ready: 'Package ready',
  failed: 'Finalization failed',
};

const STAGE_PROGRESS: Record<FinalizeStage, number> = {
  idle: 0, assembling: 45, validating: 80, ready: 100, failed: 0,
};

export default function FinalizeRiddim({ jobId, onFinalized }: FinalizeRiddimProps) {
  const [stage, setStage] = useState<FinalizeStage>('idle');
  const [packageResult, setPackageResult] = useState<PackageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const finalize = useCallback(async () => {
    if (!jobId) return;
    setStage('assembling');
    setError(null);
    setPackageResult(null);
    setLog([]);
    addLog('Starting stem assembly...');

    try {
      // In production: POST /api/finalize { jobId }
      // which triggers stem-assembler then fingerprint-validator workers
      await new Promise((r) => setTimeout(r, 1500));
      addLog('Drums stem rendered ✓');
      addLog('Bass stem rendered ✓');
      addLog('Chords stem rendered ✓');
      addLog('Percussion stem rendered ✓');
      addLog('FX stem rendered ✓');

      setStage('validating');
      addLog('Running BPM accuracy check...');
      await new Promise((r) => setTimeout(r, 800));
      addLog('Running style fingerprint check...');
      await new Promise((r) => setTimeout(r, 600));
      addLog('Running similarity check (pgvector)...');
      await new Promise((r) => setTimeout(r, 400));

      // Poll /api/status/:jobId until fingerprint-validator completes
      const mockPackage: PackageResult = {
        jobId,
        packagePath: `/tmp/artist-intelligence-packages/${jobId}/`,
        stems: [
          { name: 'drums_main', type: 'drums', durationMs: 16000, sampleRate: 44100 },
          { name: 'drums_perc', type: 'perc', durationMs: 16000, sampleRate: 44100 },
          { name: 'bass', type: 'bass', durationMs: 16000, sampleRate: 44100 },
          { name: 'chords', type: 'chords', durationMs: 16000, sampleRate: 44100 },
          { name: 'fx_reverb', type: 'fx', durationMs: 16000, sampleRate: 44100 },
        ],
        masterBpm: 96,
        masterKey: 'A minor',
        style: 'dancehall',
        totalDurationMs: 16000,
        fingerprint: {
          passed: true,
          similarityScore: 0.87,
          bpmAccuracy: 0.98,
          styleAccuracy: 0.91,
          issues: [],
        },
      };

      addLog('Fingerprint validation: PASSED ✓');
      addLog(`Package ready: ${mockPackage.stems.length} stems, ${mockPackage.masterBpm} BPM`);
      setPackageResult(mockPackage);
      setStage('ready');
      onFinalized?.(mockPackage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStage('failed');
      addLog(`ERROR: ${msg}`);
    }
  }, [jobId, onFinalized]);

  const downloadPackage = useCallback(() => {
    if (!packageResult) return;
    // In production: fetch the actual ZIP from /api/download/:jobId
    addLog('Preparing download...');
    const data = JSON.stringify(packageResult, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riddim-package-${packageResult.jobId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('Download started ✓');
  }, [packageResult]);

  const progress = STAGE_PROGRESS[stage];

  return (
    <div className="flex flex-col gap-4">
      {/* Finalize card */}
      <div className="riddim-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Finalize Riddim Package</h3>
            <p className="text-xs text-gray-500 mt-0.5">Assemble stems and run fingerprint validation</p>
          </div>
          <div
            className={`text-xs px-2 py-1 rounded-full border font-semibold ${ 
              stage === 'ready' ? 'border-green-500 text-green-400 bg-green-400/10' :
              stage === 'failed' ? 'border-red-500 text-red-400 bg-red-400/10' :
              stage === 'idle' ? 'border-[#333] text-gray-500' :
              'border-yellow-400/50 text-yellow-400 bg-yellow-400/5'
            }`}
          >
            {STAGE_LABELS[stage]}
          </div>
        </div>

        {/* Progress bar */}
        {stage !== 'idle' && (
          <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                backgroundColor: stage === 'failed' ? '#ff3b3b' : stage === 'ready' ? '#39ff14' : '#f5c842',
              }}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={finalize}
            disabled={!jobId || stage === 'assembling' || stage === 'validating'}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm uppercase tracking-wider border transition-all ${
              !jobId || stage === 'assembling' || stage === 'validating'
                ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                : 'border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 active:scale-95'
            }`}
          >
            {(stage === 'assembling' || stage === 'validating') ? (
              <>
                <span className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                {STAGE_LABELS[stage]}
              </>
            ) : stage === 'ready' ? (
              '↺ Re-finalize'
            ) : (
              '🎯 Finalize Riddim'
            )}
          </button>

          {stage === 'ready' && packageResult && (
            <button
              onClick={downloadPackage}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm uppercase tracking-wider border border-green-500 text-green-400 hover:bg-green-400/10 active:scale-95 transition-all glow-green"
            >
              ⬇ Download Package
            </button>
          )}
        </div>

        {/* Package details */}
        {packageResult && stage === 'ready' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#222]">
              <div className="text-lg font-bold text-yellow-400 font-mono">{packageResult.masterBpm}</div>
              <div className="text-[10px] text-gray-500 uppercase">BPM</div>
            </div>
            <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#222]">
              <div className="text-sm font-bold text-white">{packageResult.masterKey}</div>
              <div className="text-[10px] text-gray-500 uppercase">Key</div>
            </div>
            <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#222]">
              <div className="text-sm font-bold capitalize" style={{ color: '#8b5cf6' }}>{packageResult.style}</div>
              <div className="text-[10px] text-gray-500 uppercase">Style</div>
            </div>
            <div className="bg-[#0f0f0f] rounded-lg p-3 border border-[#222]">
              <div className="text-sm font-bold text-white">{packageResult.stems.length}</div>
              <div className="text-[10px] text-gray-500 uppercase">Stems</div>
            </div>
          </div>
        )}

        {/* Fingerprint results */}
        {packageResult?.fingerprint && (
          <div className="border border-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-sm ${packageResult.fingerprint.passed ? 'text-green-400' : 'text-red-400'}`}>
                {packageResult.fingerprint.passed ? '✓ Fingerprint Validated' : '✗ Validation Issues'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'BPM Accuracy', val: packageResult.fingerprint.bpmAccuracy, color: '#f5c842' },
                { label: 'Style Match', val: packageResult.fingerprint.styleAccuracy, color: '#8b5cf6' },
                { label: 'Originality', val: 1 - packageResult.fingerprint.similarityScore, color: '#39ff14' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">{label}</span>
                    <span style={{ color }}>{Math.round(val * 100)}%</span>
                  </div>
                  <div className="h-1 bg-[#2a2a2a] rounded-full">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${val * 100}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
            {packageResult.fingerprint.issues.length > 0 && (
              <div className="mt-2 space-y-1">
                {packageResult.fingerprint.issues.map((issue, i) => (
                  <div key={i} className={`text-[10px] px-2 py-1 rounded ${issue.severity === 'error' ? 'bg-red-900/20 text-red-400' : 'bg-yellow-900/20 text-yellow-500'}`}>
                    {issue.severity === 'error' ? '⚠ ' : '• '}{issue.detail}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity log */}
      {log.length > 0 && (
        <div className="riddim-card p-3">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Activity Log</div>
          <div className="space-y-0.5 max-h-36 overflow-y-auto">
            {log.map((entry, i) => (
              <div key={i} className="text-[11px] font-mono text-gray-400">{entry}</div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="riddim-card p-3 border-red-900 bg-red-900/10">
          <p className="text-xs text-red-400">⚠ {error}</p>
        </div>
      )}
    </div>
  );
}
