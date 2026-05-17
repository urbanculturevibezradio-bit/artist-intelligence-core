# 🎵 artist-intelligence-core

**Full Hum-to-Riddim AI Pipeline**

Transform a hummed melody or vocal reference into a complete riddim production package — drums, bassline, chords, percussion, and FX — with intelligent style classification and fingerprint validation.

---

## 🏗️ Architecture Overview

```
Audio Upload (.wav/.mp3)
        │
        ▼
┌──────────────────────────┐
│  POST /api/audio-upload  │  ← Next.js API Route (Vercel Serverless)
│  Returns: { jobId }      │
└──────────┬───────────────┘
           │  Enqueues all workers via BullMQ + Redis
           ▼
┌─────────────────────────────────────────────────────────┐
│                   Worker Pipeline                        │
│                                                         │
│  1. whisper-timing      Onsets, phrase timing, breaths  │
│  2. melody-extraction   Pitch curve, key, scale         │
│  3. bpm-groove          BPM, swing, syncopation         │
│  4. style-classifier    Genre + pgvector embedding      │
│  5. riddim-generator    Drums, bass, chords, FX         │
│  6. stem-assembler      WAV stems + manifest            │
│  7. fingerprint-validator Similarity, BPM/style check   │
└─────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│  GET /api/status/:jobId  │  ← Poll for results
└──────────────────────────┘
```

---

## 📁 Project Structure

```
artist-intelligence-core/
├── pages/
│   └── api/
│       ├── audio-upload.ts          # Upload endpoint
│       └── status/
│           └── [jobId].ts           # Status polling
├── workers/
│   ├── index.ts                     # Worker runner entry
│   ├── whisper-timing.ts            # Onset/phrase/breath analysis
│   ├── melody-extraction.ts         # Pitch/key/scale detection
│   ├── bpm-groove.ts                # BPM/swing/syncopation
│   ├── style-classifier.ts          # Genre classification + embeddings
│   ├── riddim-generator.ts          # Pattern generation
│   ├── stem-assembler.ts            # Stem packaging
│   └── fingerprint-validator.ts     # Quality validation
├── lib/
│   ├── db.ts                        # MongoDB singleton
│   ├── schemas.ts                   # Mongoose schemas
│   ├── queue.ts                     # BullMQ worker queue
│   └── supabase.ts                  # pgvector client + helpers
├── types/
│   └── pipeline.ts                  # Shared TypeScript interfaces
├── .env.example
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone https://github.com/urbanculturevibezradio-bit/artist-intelligence-core
cd artist-intelligence-core
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in MONGODB_URI, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REDIS_URL

# 3. Run Supabase migration (once)
# Execute SUPABASE_MIGRATION_SQL from lib/supabase.ts in your Supabase SQL editor

# 4. Start the Next.js dev server
npm run dev

# 5. Start pipeline workers (separate terminal)
npm run worker
```

---

## 🎯 API Reference

### Upload Audio
```http
POST /api/audio-upload
Content-Type: multipart/form-data

Field: audio (File) — .wav or .mp3, max 50MB
Field: userId (string, optional)

Response 202:
{
  "jobId": "uuid-v4",
  "filename": "my-hum.wav",
  "format": "wav",
  "sizeBytes": 1234567,
  "status": "queued",
  "message": "Job abc123 queued. Poll /api/status/abc123 for progress."
}
```

### Poll Status
```http
GET /api/status/:jobId

Response 200:
{
  "jobId": "uuid",
  "status": "processing",
  "progress": 57,
  "completedWorkers": ["whisper-timing", "melody-extraction", "bpm-groove", "style-classifier"],
  "pendingWorkers": ["riddim-generator", "stem-assembler", "fingerprint-validator"]
}

Response 200 (completed):
{
  "jobId": "uuid",
  "status": "completed",
  "progress": 100,
  "completedWorkers": [...all 7 workers...],
  "pendingWorkers": [],
  "packagePath": "/tmp/artist-intelligence-packages/<jobId>/",
  "results": { ...full pipeline results... }
}
```

---

## 🎛️ Supported Styles

| Style | BPM Range | Characteristics |
|-------|-----------|-----------------|
| dancehall | 90–110 | Digital, one-drop, bashment |
| reggae | 60–90 | Roots, skank, irie |
| afro-fusion | 90–130 | Polyrhythmic, highlife, amapiano |
| rub-a-dub | 70–90 | Slack, early digital, computerized |
| steppa | 85–100 | Four-on-floor, sub-bass, soundsystem |
| roots | 60–80 | Nyahbinghi, cultural, dub |
| lovers-rock | 70–95 | Smooth, romantic, UK reggae |
| bashment | 95–115 | Party, gun salute, soca influence |
| digital-reggae | 85–105 | 808, FM synth, MIDI bass |
| afrobeats | 95–125 | Naija, talking drum, percussion-heavy |

---

## 🗄️ Data Storage

- **MongoDB** — Job metadata, pipeline state, riddim packages
- **Supabase pgvector** — 512-dimensional style embeddings for similarity search
- **Redis** — BullMQ job queues for worker orchestration

---

## ⚙️ Tech Stack

- **Runtime**: TypeScript, Next.js 14, Vercel Serverless Functions
- **Queue**: BullMQ + Redis (Upstash for Vercel)
- **Database**: MongoDB + Mongoose
- **Vector Store**: Supabase + pgvector
- **Audio Processing**: Placeholder hooks for librosa/essentia/pYIN/CREPE (Python DSP service)
- **ML**: Style classification with Krumhansl-Schmuckler key detection + feature scoring

---

## 🔌 Production Integration Points

Each worker contains clearly marked hooks for production audio ML services:

```typescript
// In production: call Python DSP service
// const resp = await axios.post(process.env.DSP_SERVICE_URL + '/onset', { filePath });

// In production: use CREPE / pYIN for pitch detection
// const resp = await axios.post(process.env.DSP_SERVICE_URL + '/melody', { filePath });

// In production: use madmom / essentia for BPM tracking
// const resp = await axios.post(process.env.DSP_SERVICE_URL + '/bpm', { filePath });
```

---

## 📝 License

MIT © urbanculturevibezradio-bit
