import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireServerFeatureAccess } from "@/lib/auth/serverFeatureAccess";
import { storeSemanticMemory } from "@/lib/memory/semanticMemory";

const BASE_SELECT =
  "id,domain,action,success,confidence,created_at";
const EXTENDED_SELECT =
  "id,protocol_id,domain,action,success,outcome,confidence,baseline_snapshot,followup_snapshot,notes,measured_at,created_at";

export async function GET() {
  try {
    const user = await requireUser();
    const admin = getSupabaseAdmin();
    const entitlement = await requireServerFeatureAccess({
      feature: "dashboard_access",
      lockedMessage: "Activate Core to track intervention outcomes.",
      supabase: admin,
      userId: user.id,
    });
    if (!entitlement.allowed) return entitlement.response;

    const result = await admin
      .from("intervention_outcomes")
      .select(EXTENDED_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    const { data, error } = await retryWithoutExtendedColumns(result, () =>
      admin
        .from("intervention_outcomes")
        .select(BASE_SELECT)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30)
    );

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({
          outcomes: [],
          migrationRequired: true,
          message: "Apply the intervention outcome migration to track protocol outcomes.",
        });
      }

      throw error;
    }

    return NextResponse.json({ outcomes: data || [] });
  } catch (error) {
    if (error instanceof OutcomeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Could not load intervention outcomes.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const outcome = normalizeOutcome(body.outcome);
    const domain = sanitizeText(body.domain, 80) || "Optimization";
    const action = sanitizeText(body.action, 240);

    if (!action) {
      return NextResponse.json({ error: "Action is required." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const entitlement = await requireServerFeatureAccess({
      feature: "dashboard_access",
      lockedMessage: "Activate Core to track intervention outcomes.",
      supabase: admin,
      userId: user.id,
    });
    if (!entitlement.allowed) return entitlement.response;

    const payload = {
      user_id: user.id,
      protocol_id: sanitizeUuid(body.protocolId) || null,
      domain,
      action,
      outcome,
      success: outcome === "success",
      confidence: normalizeConfidence(body.confidence),
      baseline_snapshot: safeRecord(body.baselineSnapshot),
      followup_snapshot: safeRecord(body.followupSnapshot),
      notes: sanitizeText(body.notes, 500) || null,
      measured_at: new Date().toISOString(),
    };
    const result = await admin
      .from("intervention_outcomes")
      .insert(payload)
      .select(EXTENDED_SELECT)
      .single();
    const { data, error } = await retryWithoutExtendedColumns(result, () =>
      admin
        .from("intervention_outcomes")
        .insert({
          user_id: user.id,
          domain,
          action,
          success: outcome === "success",
          confidence: payload.confidence,
        })
        .select(BASE_SELECT)
        .single()
    );

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          {
            error:
              "The intervention_outcomes table is not live yet. Apply the execution events migration, then try again.",
          },
          { status: 500 }
        );
      }

      throw error;
    }

    await admin.from("behavior_learning_events").insert({
      user_id: user.id,
      domain,
      action,
      outcome,
      confidence: payload.confidence,
      source: "manual",
    });
    await storeSemanticMemory({
      content: [
        `Intervention outcome: ${outcome}`,
        `Domain: ${domain}`,
        `Action: ${action}`,
        payload.notes ? `Notes: ${payload.notes}` : "",
      ].filter(Boolean).join("\n"),
      importance: outcome === "success" ? 0.74 : 0.82,
      metadata: {
        confidence: payload.confidence,
        outcome,
        storedBy: "digital_twin_outcome",
      },
      sourceId: typeof data === "object" && data && "id" in data ? String(data.id) : undefined,
      sourceType: "digital_twin_outcome",
      supabase: admin,
      title: `${domain} ${outcome}`,
      userId: user.id,
    });

    return NextResponse.json({ outcome: data });
  } catch (error) {
    if (error instanceof OutcomeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Could not save intervention outcome.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new OutcomeError("Unauthorized", 401);
  }

  return user;
}

async function readJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeOutcome(value: unknown) {
  return value === "success" || value === "failure" || value === "unknown"
    ? value
    : "unknown";
}

function normalizeConfidence(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue)
    ? Math.max(0, Math.min(1, numberValue))
    : 0.5;
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function sanitizeUuid(value: unknown) {
  if (typeof value !== "string") return "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : "";
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function isMissingExtendedColumn(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST204" ||
    error?.message?.includes("protocol_id") ||
    error?.message?.includes("baseline_snapshot") ||
    error?.message?.includes("followup_snapshot") ||
    error?.message?.includes("measured_at")
  );
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("intervention_outcomes") ||
    error.message?.includes("schema cache")
  );
}

async function retryWithoutExtendedColumns(
  result: {
    data: unknown;
    error: { code?: string; message?: string } | null;
  },
  fallback: () => PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>
) {
  if (isMissingExtendedColumn(result.error)) {
    return fallback();
  }

  return result;
}

class OutcomeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
