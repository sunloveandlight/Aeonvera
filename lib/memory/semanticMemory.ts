import OpenAI from "openai";
import type { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActiveHealthProfileContext } from "@/lib/health-profiles/activeHealthProfile";
import { requireProfileWriteAccess } from "@/lib/health-profiles/activeHealthProfile";

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
  memory_kind?: MemoryKind;
  confidence?: number;
  provenance?: Record<string, unknown>;
  is_pinned?: boolean;
  similarity?: number;
};

export type MemoryKind = "fact" | "preference" | "episode" | "insight" | "biological_context";

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
  const query = supabase
    .from("semantic_memories")
    .select(
      "id, source_type, source_id, title, content, metadata, importance, occurred_at, memory_kind, confidence, provenance, is_pinned"
    )
    .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
    .is("superseded_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (!healthProfileId) {
    query.is("health_profile_id", null);
  }

  const { data, error } = await query
    .order("is_pinned", { ascending: false })
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
  confidence = 0.7,
  expiresAt,
  isPinned = false,
  importance = 0.55,
  memoryKind = "episode",
  metadata = {},
  occurredAt,
  provenance = {},
  sourceId,
  sourceType,
  supabase,
  title,
  userId,
  healthProfileContext,
}: {
  content: string;
  healthProfileId?: string | null;
  healthProfileContext?: ActiveHealthProfileContext;
  confidence?: number;
  expiresAt?: string | null;
  isPinned?: boolean;
  importance?: number;
  memoryKind?: MemoryKind;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  provenance?: Record<string, unknown>;
  sourceId?: string;
  sourceType: string;
  supabase: SupabaseAdmin;
  title?: string;
  userId: string;
}) {
  const normalized = content.trim().slice(0, 6000);
  if (!normalized) return;
  if (!canStoreForSubject({ healthProfileContext, healthProfileId, sourceType })) return;

  // Dedup before embedding so unchanged content never burns an embedding call.
  // A (source_type, source_id) pair is treated as a stable key and updated in place;
  // otherwise an identical (source_type, content) row is skipped entirely.
  try {
    if (sourceId) {
      const lookupQuery = supabase
        .from("semantic_memories")
        .select("id, content")
        .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
        .eq("source_type", sourceType)
        .eq("source_id", sourceId)
        .is("superseded_at", null);
      if (!healthProfileId) {
        lookupQuery.is("health_profile_id", null);
      }

      const { data: existing, error: lookupError } = await lookupQuery.maybeSingle();
      if (lookupError && isSemanticMemoryMissing(lookupError)) return;
      if (existing) {
        if (existing.content === normalized) return;
        const refreshed = await embedText(normalized);
        if (!refreshed) return;
        await supabase
          .from("semantic_memories")
          .update({
            content: normalized,
            confidence: clampUnit(confidence, 0.7),
            embedding: refreshed,
            expires_at: expiresAt || null,
            importance: clampImportance(importance),
            is_pinned: isPinned,
            memory_kind: memoryKind,
            metadata,
            occurred_at: occurredAt || new Date().toISOString(),
            provenance,
            title: title?.trim().slice(0, 180) || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        return;
      }
    } else {
      const dupeQuery = supabase
        .from("semantic_memories")
        .select("id")
        .eq(healthProfileId ? "health_profile_id" : "user_id", healthProfileId || userId)
        .eq("source_type", sourceType)
        .eq("content", normalized)
        .is("superseded_at", null)
        .limit(1);
      if (!healthProfileId) {
        dupeQuery.is("health_profile_id", null);
      }

      const { data: dupe, error: dupeError } = await dupeQuery.maybeSingle();
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
    confidence: clampUnit(confidence, 0.7),
    embedding,
    expires_at: expiresAt || null,
    ...(healthProfileId ? { health_profile_id: healthProfileId } : {}),
    importance: clampImportance(importance),
    is_pinned: isPinned,
    memory_kind: memoryKind,
    metadata,
    occurred_at: occurredAt || new Date().toISOString(),
    provenance,
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

  await enforceMemoryCap(supabase, { healthProfileId, userId });
}

function canStoreForSubject({
  healthProfileContext,
  healthProfileId,
  sourceType,
}: {
  healthProfileContext?: ActiveHealthProfileContext;
  healthProfileId?: string | null;
  sourceType: string;
}) {
  if (!healthProfileId) return true;

  if (!healthProfileContext) {
    console.error(
      `[Semantic Memory Store Blocked] ${sourceType} attempted a profile-scoped write without write context.`
    );
    return false;
  }

  if (healthProfileContext.healthProfileId !== healthProfileId) {
    console.error(
      `[Semantic Memory Store Blocked] ${sourceType} attempted to write outside the active health profile.`
    );
    return false;
  }

  try {
    requireProfileWriteAccess(healthProfileContext);
    return true;
  } catch {
    return false;
  }
}

// Keep memory bounded per subject. A caregiver with many profiles should never
// evict one person's context because another profile is chatty.
const MEMORY_CAP = 800;

async function enforceMemoryCap(
  supabase: SupabaseAdmin,
  {
    healthProfileId,
    userId,
  }: {
    healthProfileId?: string | null;
    userId: string;
  }
) {
  try {
    const subjectColumn = healthProfileId ? "health_profile_id" : "user_id";
    const subjectValue = healthProfileId || userId;

    const countQuery = supabase
      .from("semantic_memories")
      .select("id", { count: "exact", head: true })
      .eq(subjectColumn, subjectValue)
      .is("superseded_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    if (!healthProfileId) {
      countQuery.is("health_profile_id", null);
    }

    const { count: subjectCount, error: subjectCountError } = await countQuery;
    if (subjectCountError || !subjectCount || subjectCount <= MEMORY_CAP) return;

    const staleQuery = supabase
      .from("semantic_memories")
      .select("id")
      .eq(subjectColumn, subjectValue)
      .is("superseded_at", null)
      .eq("is_pinned", false)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("importance", { ascending: true })
      .order("created_at", { ascending: true });
    if (!healthProfileId) {
      staleQuery.is("health_profile_id", null);
    }

    const { data: stale } = await staleQuery.limit(subjectCount - MEMORY_CAP);

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

function clampUnit(value: number, fallback: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : fallback));
}

function isSemanticMemoryMissing(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.message?.includes("semantic_memories") ||
    error.message?.includes("match_semantic_memories")
  );
}
