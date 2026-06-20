import { NextRequest, NextResponse } from "next/server";
import { storeSemanticMemory } from "@/lib/memory/semanticMemory";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  frozenHealthProfileResponse,
  getRequestedHealthProfileId,
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

    await storeSemanticMemory({
      content,
      healthProfileId: healthProfileContext.healthProfileId,
      importance: clampImportance(body.importance),
      metadata: safeMetadata(body.metadata),
      occurredAt: new Date().toISOString(),
      sourceId: sanitizeText(body.sourceId, 160) || undefined,
      sourceType,
      supabase: admin,
      title: sanitizeText(body.title, 180) || undefined,
      userId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not store memory.";
    if (message !== "Unauthorized") console.error("Could not store memory:", error);
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "semantic-memory-delete", 20, 60_000);
    if (limited) return limited;

    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();

    if (body.all === true) {
      const { error } = await admin.from("semantic_memories").delete().eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const ids = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter((id): id is string => typeof id === "string").slice(0, 100)
      : [];

    if (!ids.length) {
      return NextResponse.json({ error: "Choose at least one memory to forget." }, { status: 400 });
    }

    const { error } = await admin
      .from("semantic_memories")
      .delete()
      .eq("user_id", user.id)
      .in("id", ids);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not forget memory.";
    if (message !== "Unauthorized") console.error("Could not forget memory:", error);
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
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
