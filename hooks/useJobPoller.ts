// ============================================================
// hooks/useJobPoller.ts
// Polls /api/status/:jobId until completed or failed
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';

export type JobStatus = 'idle' | 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';

export interface JobPollResult {
  jobId: string;
  status: JobStatus;
  progress: number;
  completedWorkers: string[];
  pendingWorkers: string[];
  results?: Record<string, unknown>;
  packagePath?: string;
  error?: string;
}

interface UseJobPollerOptions {
  pollIntervalMs?: number;
  onComplete?: (result: JobPollResult) => void;
  onError?: (error: string) => void;
}

interface UseJobPollerReturn {
  jobId: string | null;
  status: JobStatus;
  progress: number;
  completedWorkers: string[];
  pendingWorkers: string[];
  results: Record<string, unknown> | null;
  packagePath: string | null;
  error: string | null;
  uploadAudio: (file: File, userId?: string) => Promise<void>;
  reset: () => void;
}

export function useJobPoller(options: UseJobPollerOptions = {}): UseJobPollerReturn {
  const { pollIntervalMs = 2000, onComplete, onError } = options;

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [completedWorkers, setCompletedWorkers] = useState<string[]>([]);
  const [pendingWorkers, setPendingWorkers] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [packagePath, setPackagePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeJobRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async (id: string) => {
    try {
      const resp = await fetch(`/api/status/${id}`);
      if (!resp.ok) {
        const body = await resp.json();
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      const data: JobPollResult = await resp.json();

      setProgress(data.progress);
      setCompletedWorkers(data.completedWorkers ?? []);
      setPendingWorkers(data.pendingWorkers ?? []);
      setStatus(data.status as JobStatus);

      if (data.status === 'completed') {
        setResults(data.results ?? null);
        setPackagePath(data.packagePath ?? null);
        stopPolling();
        onComplete?.(data);
      } else if (data.status === 'failed') {
        setError(data.error ?? 'Job failed');
        stopPolling();
        onError?.(data.error ?? 'Job failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Polling error';
      setError(msg);
      stopPolling();
      onError?.(msg);
    }
  }, [stopPolling, onComplete, onError]);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    activeJobRef.current = id;
    poll(id);
    intervalRef.current = setInterval(() => {
      if (activeJobRef.current === id) poll(id);
    }, pollIntervalMs);
  }, [poll, stopPolling, pollIntervalMs]);

  const uploadAudio = useCallback(async (file: File, userId?: string) => {
    setStatus('uploading');
    setProgress(0);
    setError(null);
    setResults(null);
    setPackagePath(null);
    setCompletedWorkers([]);
    setPendingWorkers([]);

    const formData = new FormData();
    formData.append('audio', file);
    if (userId) formData.append('userId', userId);

    try {
      const resp = await fetch('/api/audio-upload', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const body = await resp.json();
        throw new Error(body.error || `Upload failed: HTTP ${resp.status}`);
      }

      const { jobId: id } = await resp.json();
      setJobId(id);
      setStatus('queued');
      startPolling(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setStatus('failed');
      setError(msg);
      onError?.(msg);
    }
  }, [startPolling, onError]);

  const reset = useCallback(() => {
    stopPolling();
    activeJobRef.current = null;
    setJobId(null);
    setStatus('idle');
    setProgress(0);
    setCompletedWorkers([]);
    setPendingWorkers([]);
    setResults(null);
    setPackagePath(null);
    setError(null);
  }, [stopPolling]);

  useEffect(() => {
    return () => { stopPolling(); };
  }, [stopPolling]);

  return {
    jobId,
    status,
    progress,
    completedWorkers,
    pendingWorkers,
    results,
    packagePath,
    error,
    uploadAudio,
    reset,
  };
}
