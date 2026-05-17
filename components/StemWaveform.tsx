// ============================================================
// components/StemWaveform.tsx
// Mini animated waveform display for each stem
// ============================================================
'use client';
import { useRef, useEffect, useCallback } from 'react';

interface StemWaveformProps {
  color?: string;
  isPlaying?: boolean;
  isMuted?: boolean;
  barCount?: number;
  height?: number;
  width?: number;
  stemType?: string;
  className?: string;
}

const STEM_PATTERNS: Record<string, number[]> = {
  drums:  [0.9, 0.3, 0.7, 0.2, 0.85, 0.3, 0.6, 0.2, 0.8, 0.25, 0.7, 0.2, 0.9, 0.3, 0.65, 0.2],
  bass:   [0.7, 0.65, 0.75, 0.7, 0.8, 0.75, 0.7, 0.65, 0.7, 0.75, 0.8, 0.7, 0.65, 0.7, 0.75, 0.7],
  chords: [0.5, 0.55, 0.6, 0.5, 0.55, 0.65, 0.5, 0.55, 0.6, 0.5, 0.55, 0.65, 0.5, 0.6, 0.55, 0.5],
  perc:   [0.4, 0.8, 0.3, 0.7, 0.4, 0.9, 0.3, 0.6, 0.4, 0.75, 0.3, 0.65, 0.35, 0.8, 0.3, 0.7],
  fx:     [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.55, 0.5, 0.45, 0.4, 0.45, 0.5, 0.55, 0.5, 0.45],
};

export default function StemWaveform({
  color = '#f5c842',
  isPlaying = false,
  isMuted = false,
  barCount = 16,
  height = 40,
  width = 120,
  stemType = 'drums',
  className = '',
}: StemWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const basePattern = STEM_PATTERNS[stemType] ?? STEM_PATTERNS.drums;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barW = (canvas.width / dpr) / barCount;
    const gap = barW * 0.25;
    const actualBarW = barW - gap;
    const maxH = (canvas.height / dpr) * 0.9;
    const t = timeRef.current;
    const alpha = isMuted ? 0.25 : 1;
    ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
    for (let i = 0; i < barCount; i++) {
      const base = basePattern[i % basePattern.length];
      const wave = isPlaying ? base * (0.7 + 0.3 * Math.sin(t * 0.05 + i * 0.5)) : base * 0.35;
      const h = Math.max(2, wave * maxH);
      const x = i * barW + gap / 2;
      const y = (canvas.height / dpr - h) / 2;
      const radius = Math.min(2, actualBarW / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + actualBarW - radius, y);
      ctx.quadraticCurveTo(x + actualBarW, y, x + actualBarW, y + radius);
      ctx.lineTo(x + actualBarW, y + h - radius);
      ctx.quadraticCurveTo(x + actualBarW, y + h, x + actualBarW - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    }
    if (isPlaying) timeRef.current += 1;
  }, [color, isPlaying, isMuted, barCount, stemType, basePattern]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, [width, height]);

  useEffect(() => {
    const animate = () => {
      draw();
      if (isPlaying) animFrameRef.current = requestAnimationFrame(animate);
    };
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      draw();
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isPlaying, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height }}
      className={`rounded transition-opacity ${isMuted ? 'opacity-30' : 'opacity-100'} ${className}`}
      aria-label={`${stemType} waveform`}
    />
  );
}
