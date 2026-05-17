// ============================================================
// pages/api/audio-upload.ts — Audio upload endpoint
// Accepts .wav/.mp3, stores temp file, returns job ID
// ============================================================
import { NextApiRequest, NextApiResponse } from 'next';
import formidable, { Fields, Files, File as FormFile } from 'formidable';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { connectToDatabase } from '@/lib/db';
import { UploadJobModel } from '@/lib/schemas';
import { enqueuePipeline } from '@/lib/queue';
import type { UploadJob, AudioFormat } from '@/types/pipeline';

// Disable default body parser so formidable can handle multipart
export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_FORMATS: AudioFormat[] = ['wav', 'mp3'];
const MAX_FILE_SIZE_MB = 50;
const TEMP_DIR = process.env.TEMP_UPLOAD_DIR || '/tmp/artist-intelligence-uploads';

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

interface UploadResponse {
  jobId: string;
  filename: string;
  format: AudioFormat;
  sizeBytes: number;
  status: 'queued';
  message: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // ---- Parse multipart form ----
  const form = formidable({
    uploadDir: TEMP_DIR,
    keepExtensions: true,
    maxFileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    filter: ({ mimetype }) => {
      return (
        !!mimetype &&
        (mimetype.includes('audio/wav') ||
          mimetype.includes('audio/mpeg') ||
          mimetype.includes('audio/mp3') ||
          mimetype.includes('audio/x-wav'))
      );
    },
  });

  let fields: Fields;
  let files: Files;

  try {
    [fields, files] = await form.parse(req);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown parse error';
    return res.status(400).json({ error: 'File parse failed', details: msg });
  }

  const fileField = files['audio'];
  const audioFile: FormFile | undefined = Array.isArray(fileField)
    ? fileField[0]
    : fileField;

  if (!audioFile) {
    return res.status(400).json({ error: 'No audio file provided. Use field name "audio".' });
  }

  // ---- Validate format ----
  const originalName = audioFile.originalFilename ?? 'unknown';
  const ext = path.extname(originalName).replace('.', '').toLowerCase() as AudioFormat;

  if (!ALLOWED_FORMATS.includes(ext)) {
    // Remove invalid file
    fs.unlink(audioFile.filepath, () => {});
    return res.status(415).json({
      error: `Unsupported format: .${ext}. Allowed: ${ALLOWED_FORMATS.join(', ')}`,
    });
  }

  // ---- Generate Job ID ----
  const jobId = uuidv4();
  const destPath = path.join(TEMP_DIR, `${jobId}.${ext}`);

  // Rename formidable temp file to job-id based name
  fs.renameSync(audioFile.filepath, destPath);

  const uploadData: Omit<UploadJob, '_id'> = {
    jobId,
    originalFilename: originalName,
    format: ext,
    tempPath: destPath,
    sizeBytes: audioFile.size,
    uploadedAt: new Date(),
    status: 'queued',
    userId: (fields.userId?.[0] as string) ?? undefined,
  };

  // ---- Persist to MongoDB ----
  try {
    await connectToDatabase();
    const UploadJob = UploadJobModel();
    await UploadJob.create(uploadData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'DB error';
    return res.status(500).json({ error: 'Failed to persist job metadata', details: msg });
  }

  // ---- Enqueue pipeline workers ----
  try {
    await enqueuePipeline(jobId, destPath);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Queue error';
    // Non-fatal: job is saved, warn but still return success
    console.warn(`[AudioUpload] Queue dispatch warning: ${msg}`);
  }

  return res.status(202).json({
    jobId,
    filename: originalName,
    format: ext,
    sizeBytes: audioFile.size,
    status: 'queued',
    message: `Job ${jobId} queued. Poll /api/status/${jobId} for progress.`,
  });
}
