// ============================================================
// lib/supabase.ts — Supabase client with pgvector support
// ============================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
}

// Singleton client
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

// ---- Embedding helpers ----

/**
 * Upsert a style embedding into pgvector table.
 * Table: style_embeddings(job_id TEXT, style TEXT, embedding VECTOR(512), metadata JSONB)
 */
export async function upsertStyleEmbedding(
  jobId: string,
  style: string,
  embedding: number[],
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('style_embeddings').upsert({
    job_id: jobId,
    style,
    embedding: JSON.stringify(embedding),
    metadata,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Supabase upsert error: ${error.message}`);
}

/**
 * Find nearest-neighbour embeddings for a given query vector.
 * Returns top-k most similar job results.
 */
export async function findSimilarEmbeddings(
  queryEmbedding: number[],
  topK: number = 5,
  styleFilter?: string
): Promise<Array<{ job_id: string; style: string; similarity: number; metadata: Record<string, unknown> }>> {
  const supabase = getSupabaseClient();

  let rpcParams: Record<string, unknown> = {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: topK,
  };
  if (styleFilter) rpcParams.style_filter = styleFilter;

  const { data, error } = await supabase.rpc('match_style_embeddings', rpcParams);
  if (error) throw new Error(`Supabase RPC error: ${error.message}`);
  return data ?? [];
}

// ---- SQL migration (run once) ----
export const SUPABASE_MIGRATION_SQL = `
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Style embeddings table
CREATE TABLE IF NOT EXISTS style_embeddings (
  id          BIGSERIAL PRIMARY KEY,
  job_id      TEXT NOT NULL,
  style       TEXT NOT NULL,
  embedding   VECTOR(512),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS style_embeddings_job_id_idx ON style_embeddings(job_id);
CREATE INDEX IF NOT EXISTS style_embeddings_style_idx ON style_embeddings(style);

-- cosine-similarity match function
CREATE OR REPLACE FUNCTION match_style_embeddings(
  query_embedding  VECTOR(512),
  match_count      INT DEFAULT 5,
  style_filter     TEXT DEFAULT NULL
)
RETURNS TABLE(job_id TEXT, style TEXT, similarity FLOAT, metadata JSONB)
LANGUAGE SQL STABLE
AS $$
  SELECT
    se.job_id,
    se.style,
    1 - (se.embedding <=> query_embedding) AS similarity,
    se.metadata
  FROM style_embeddings se
  WHERE (style_filter IS NULL OR se.style = style_filter)
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
$$;
`;
