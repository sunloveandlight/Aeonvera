import OpenAI from "openai";
import type { getSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export type SemanticMemory = {
  id: string;
  source_type: string;
  source_id: string | null;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  occurred_at: string | null;
  similarity?: number;
};

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
let openaiClient: OpenAI | null | undefined;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (openaiClient === undefined) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function retrieveSemanticMemories({
  healthProfileId,
  limit = 12,
  query,
  supabase,
  threshold = 0.62,
  userId,
}: {
  healthProfileId?: string | null;
  limit?: number;
  query: string;
  supabase: SupabaseAdmin;
  threshold?: number;
  userId: string;
}): Promise<SemanticMemory[]> {
  const embedding = await embedText(query);
  if (!embedding) return [];

  const { data, error } = healthProfileId
    ? await supabase.rpc("match_semantic_memories_for_health_profile", {
        match_count: limit,
        match_threshold: threshold,
        query_embedding: embedding,
        target_health_profile_id: healthProfileId,
      })
    : await supabase.rpc("match_semantic_memories_for_user", {
        match_count: limit,
        match_threshold: threshold,
        query_embedding: embedding,
        target_user_id: userId,
      });

  if (error) {
    if (isSemanticMemoryMissing(error)) return [];
    console.error("[Semantic Memory Retrieve Error]", error.message);
    return [];
  }

  return Array.isArray(data) ? (data as SemanticMemory[]) : [];
}

export async function listRecentSemanticMemories({
  healthProfileId,
  limit = 10,
  supabase,
  userId,
}: {
  healthProfileId?: string | null;
  limit?: number;
  supabase: SupabaseAdmin;
  userId: string;
}): Promise<SemanticMemory[]> {
  const { data, error } = await supabase
    .from("semantic_memories")
    .select("id, source_type, source_id, title, content, metadata, importance, occurred_at")
    .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
    .order("importance", { ascending: false })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(limit, 1), 24));

  if (error) {
    if (isSemanticMemoryMissing(error)) return [];
    console.error("[Semantic Memory Recent Error]", error.message);
    return [];
  }

  return Array.isArray(data) ? (data as SemanticMemory[]) : [];
}

export async function storeSemanticMemory({
  content,
  healthProfileId,
  importance = 0.55,
  metadata = {},
  occurredAt,
  sourceId,
  sourceType,
  supabase,
  title,
  userId,
}: {
  content: string;
  healthProfileId?: string | null;
  importance?: number;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  sourceId?: string;
  sourceType: string;
  supabase: SupabaseAdmin;
  title?: string;
  userId: string;
}) {
  const normalized = content.trim().slice(0, 6000);
  if (!normalized) return;

  // Dedup before embedding so unchanged content never burns an embedding call.
  // A (source_type, source_id) pair is treated as a stable key and updated in place;
  // otherwise an identical (source_type, content) row is skipped entirely.
  try {
    if (sourceId) {
      const { data: existing, error: lookupError } = await supabase
        .from("semantic_memories")
        .select("id, content")
        .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
        .eq("source_type", sourceType)
        .eq("source_id", sourceId)
        .maybeSingle();
      if (lookupError && isSemanticMemoryMissing(lookupError)) return;
      if (existing) {
        if (existing.content === normalized) return;
        const refreshed = await embedText(normalized);
        if (!refreshed) return;
        await supabase
          .from("semantic_memories")
          .update({
            content: normalized,
            embedding: refreshed,
            importance: clampImportance(importance),
            metadata,
            occurred_at: occurredAt || new Date().toISOString(),
            title: title?.trim().slice(0, 180) || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        return;
      }
    } else {
      const { data: dupe, error: dupeError } = await supabase
        .from("semantic_memories")
        .select("id")
        .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
        .eq("source_type", sourceType)
        .eq("content", normalized)
        .limit(1)
        .maybeSingle();
      if (dupeError && isSemanticMemoryMissing(dupeError)) return;
      if (dupe) return;
    }
  } catch {
    // Dedup is best-effort; fall through to a normal insert if the probe fails.
  }

  const embedding = await embedText(normalized);
  if (!embedding) return;

  const { error } = await supabase.from("semantic_memories").insert({
    content: normalized,
    embedding,
    ...(healthProfileId ? { health_profile_id: healthProfileId } : {}),
    importance: clampImportance(importance),
    metadata,
    occurred_at: occurredAt || new Date().toISOString(),
    source_id: sourceId || null,
    source_type: sourceType,
    title: title?.trim().slice(0, 180) || null,
    user_id: userId,
  });

  if (error) {
    if (!isSemanticMemoryMissing(error)) {
      console.error("[Semantic Memory Store Error]", error.message);
    }
    return;
  }

  await enforceMemoryCap(supabase, userId);
}

// Keep per-user memory bounded: drop the least-important / oldest rows past the cap.
const MEMORY_CAP = 800;

async function enforceMemoryCap(supabase: SupabaseAdmin, userId: string) {
  try {
    const { count, error } = await supabase
      .from("semantic_memories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error || !count || count <= MEMORY_CAP) return;

    const { data: stale } = await supabase
      .from("semantic_memories")
      .select("id")
      .eq("user_id", userId)
      .order("importance", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(count - MEMORY_CAP);

    const ids = (stale || []).map((row) => row.id);
    if (ids.length) {
      await supabase.from("semantic_memories").delete().in("id", ids);
    }
  } catch {
    // Cap enforcement is best-effort and must never block a write.
  }
}

async function embedText(input: string) {
  const openai = getOpenAI();
  if (!openai) return null;

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: input.slice(0, 8000),
    });

    return response.data[0]?.embedding || null;
  } catch (error) {
    console.error(
      "[Semantic Memory Embedding Error]",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

function clampImportance(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
}

function isSemanticMemoryMissing(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.message?.includes("semantic_memories") ||
    error.message?.includes("match_semantic_memories")
  );
}
