import { NextRequest, NextResponse } from "next/server";
import { storeSemanticMemory } from "@/lib/memory/semanticMemory";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  frozenHealthProfileResponse,
  getRequestedHealthProfileId,
  healthProfileWriteAccessDeniedResponse,
  isHealthProfileWriteAccessError,
  requireProfileWriteAccess,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

const ALLOWED_SOURCE_TYPES = new Set([
  "assessment",
  "autopilot_preferences",
  "digital_twin_outcome",
  "future_self_scenario",
  "lab_import",
  "onboarding",
  "user_note",
]);

const ALLOWED_MEMORY_KINDS = new Set([
  "fact",
  "preference",
  "episode",
  "insight",
  "biological_context",
]);

export async function GET(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "semantic-memory-read", 60, 60_000);
    if (limited) return limited;

    const user = await requireUser();
    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    const subjectColumn = healthProfileContext.healthProfileId ? "health_profile_id" : "user_id";
    const subjectValue = healthProfileContext.healthProfileId || user.id;
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 12, 1), 50);

    const query = admin
      .from("semantic_memories")
      .select(
        "id, source_type, source_id, title, content, metadata, importance, occurred_at, created_at, memory_kind, confidence, provenance, is_pinned"
      )
      .eq(subjectColumn, subjectValue)
      .is("superseded_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (!healthProfileContext.healthProfileId) {
      query.is("health_profile_id", null);
    }

    const { data, error } = await query
      .order("is_pinned", { ascending: false })
      .order("importance", { ascending: false })
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      memories: data || [],
      healthProfileId: healthProfileContext.healthProfileId,
      mode: healthProfileContext.mode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load memory.";
    if (message !== "Unauthorized") console.error("Could not load semantic memory:", error);
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : "Internal server error." },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "semantic-memory-write", 40, 60_000);
    if (limited) return limited;

    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const sourceType = sanitizeSourceType(body.sourceType);
    const content = sanitizeText(body.content, 6000);

    if (!sourceType || !content) {
      return NextResponse.json(
        { error: "Memory needs a supported source type and content." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    if (healthProfileContext.isFrozen) return frozenHealthProfileResponse();
    requireProfileWriteAccess(healthProfileContext);

    await storeSemanticMemory({
      content,
      healthProfileId: healthProfileContext.healthProfileId,
      healthProfileContext,
      confidence: clampConfidence(body.confidence),
      expiresAt: sanitizeText(body.expiresAt, 64) || null,
      isPinned: body.isPinned === true,
      importance: clampImportance(body.importance),
      memoryKind: sanitizeMemoryKind(body.memoryKind),
      metadata: safeMetadata(body.metadata),
      occurredAt: new Date().toISOString(),
      provenance: safeMetadata(body.provenance),
      sourceId: sanitizeText(body.sourceId, 160) || undefined,
      sourceType,
      supabase: admin,
      title: sanitizeText(body.title, 180) || undefined,
      userId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isHealthProfileWriteAccessError(error)) return healthProfileWriteAccessDeniedResponse();

    const message = error instanceof Error ? error.message : "Could not store memory.";
    if (message !== "Unauthorized") console.error("Could not store memory:", error);
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : "Internal server error." },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "semantic-memory-delete", 20, 60_000);
    if (limited) return limited;

    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    requireProfileWriteAccess(healthProfileContext);
    const subjectColumn = healthProfileContext.healthProfileId ? "health_profile_id" : "user_id";
    const subjectValue = healthProfileContext.healthProfileId || user.id;

    if (body.all === true) {
      const query = admin
        .from("semantic_memories")
        .delete()
        .eq(subjectColumn, subjectValue);
      if (!healthProfileContext.healthProfileId) {
        query.is("health_profile_id", null);
      }

      const { error } = await query;
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const ids = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter((id): id is string => typeof id === "string").slice(0, 100)
      : [];

    if (!ids.length) {
      return NextResponse.json({ error: "Choose at least one memory to forget." }, { status: 400 });
    }

    const query = admin
      .from("semantic_memories")
      .delete()
      .eq(subjectColumn, subjectValue)
      .in("id", ids);
    if (!healthProfileContext.healthProfileId) {
      query.is("health_profile_id", null);
    }

    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isHealthProfileWriteAccessError(error)) return healthProfileWriteAccessDeniedResponse();

    const message = error instanceof Error ? error.message : "Could not forget memory.";
    if (message !== "Unauthorized") console.error("Could not forget memory:", error);
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : "Internal server error." },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

function sanitizeSourceType(value: unknown) {
  if (typeof value !== "string") return "";
  const sourceType = value.trim().toLowerCase();
  return ALLOWED_SOURCE_TYPES.has(sourceType) ? sourceType : "";
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function clampImportance(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0.62;
  return Math.min(1, Math.max(0.1, number));
}

function clampConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0.7;
  return Math.min(1, Math.max(0, number));
}

function sanitizeMemoryKind(value: unknown) {
  if (typeof value !== "string") return "episode";
  const kind = value.trim().toLowerCase();
  return ALLOWED_MEMORY_KINDS.has(kind)
    ? kind as "fact" | "preference" | "episode" | "insight" | "biological_context"
    : "episode";
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const serialized = JSON.stringify(value);
  if (serialized.length > 4000) {
    return { truncated: true };
  }

  return JSON.parse(serialized) as Record<string, unknown>;
}
