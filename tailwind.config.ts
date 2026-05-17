import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './styles/**/*.css',
  ],
  theme: {
    extend: {
      colors: {
        riddim: {
          black: '#0a0a0a',
          dark: '#111111',
          card: '#1a1a1a',
          border: '#2a2a2a',
          gold: '#f5c842',
          green: '#39ff14',
          red: '#ff3b3b',
          purple: '#8b5cf6',
          cyan: '#00e5ff',
          muted: '#555555',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'waveform': 'waveform 1.2s ease-in-out infinite',
        'spin-slow': 'spin 4s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        waveform: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        glow: {
          from: { boxShadow: '0 0 4px #f5c842' },
          to: { boxShadow: '0 0 16px #f5c842, 0 0 32px #f5c84266' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
