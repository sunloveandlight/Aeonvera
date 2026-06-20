import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireServerFeatureAccess } from "@/lib/auth/serverFeatureAccess";
import {
  frozenHealthProfilePayload,
  getHealthSubjectFilter,
  getRequestedHealthProfileId,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type LifeDomainKey =
  | "health"
  | "performance"
  | "cognition"
  | "sleep"
  | "learning"
  | "productivity"
  | "emotional_resilience"
  | "stress"
  | "relationships"
  | "purpose"
  | "financial_health";

type PriorityRow = {
  completed_at?: string | null;
  created_at?: string;
  desired_outcome?: string | null;
  domain: LifeDomainKey;
  horizon_days?: number;
  id: string;
  next_action?: string | null;
  priority?: number;
  status?: "active" | "paused" | "completed" | "archived";
  title: string;
  updated_at?: string;
};

const SELECT_FIELDS =
  "id,domain,title,desired_outcome,next_action,priority,horizon_days,status,created_at,updated_at,completed_at";

const LIFE_DOMAINS = new Set<LifeDomainKey>([
  "health",
  "performance",
  "cognition",
  "sleep",
  "learning",
  "productivity",
  "emotional_resilience",
  "stress",
  "relationships",
  "purpose",
  "financial_health",
]);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireLifeOsAccess(request);
    if (auth.response) return auth.response;

    const admin = getSupabaseAdmin();
    const healthFilter = getHealthSubjectFilter(auth.healthProfileContext);
    const { data, error } = await admin
      .from("life_os_priorities")
      .select(SELECT_FIELDS)
      .eq(healthFilter.column, healthFilter.value)
      .neq("status", "archived")
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(24);

    if (error) {
      if (isMissingPrioritiesTable(error)) {
        return NextResponse.json({
          migrationRequired: true,
          message:
            "Apply supabase/migrations/20260613150000_life_os_priorities.sql to enable Life OS priorities.",
          priorities: [],
        });
      }
      throw error;
    }

    return NextResponse.json({ priorities: mapPriorities(data || []) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Life OS priorities.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "life-os-priority-create", 30, 60_000);
    if (limited) return limited;

    const auth = await requireLifeOsAccess(request);
    if (auth.response) return auth.response;
    if (auth.healthProfileContext.isFrozen) {
      return NextResponse.json(frozenHealthProfilePayload(), { status: 423 });
    }

    const body = await request.json().catch(() => ({}));
    const domain = sanitizeDomain(body?.domain);
    const title = sanitizeText(body?.title, 120);

    if (!domain || !title) {
      return NextResponse.json(
        { error: "Choose a domain and describe the priority." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("life_os_priorities")
      .insert({
        user_id: auth.userId,
        ...healthSubjectInsertFields(auth.healthProfileContext),
        desired_outcome: sanitizeText(body?.desiredOutcome, 220),
        domain,
        horizon_days: clampNumber(body?.horizonDays, 7, 365, 90),
        next_action: sanitizeText(body?.nextAction, 220),
        priority: clampNumber(body?.priority, 1, 5, 3),
        source: "life_os",
        title,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      if (isMissingPrioritiesTable(error)) {
        return NextResponse.json(
          {
            error:
              "Apply supabase/migrations/20260613150000_life_os_priorities.sql in Supabase first.",
            migrationRequired: true,
          },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ priority: mapPriority(data as PriorityRow) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create Life OS priority.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "life-os-priority-update", 60, 60_000);
    if (limited) return limited;

    const auth = await requireLifeOsAccess(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";
    const status = sanitizeStatus(body?.status);

    if (!isUuid(id) || !status) {
      return NextResponse.json({ error: "Priority not found." }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const healthFilter = getHealthSubjectFilter(auth.healthProfileContext);
    const { data, error } = await admin
      .from("life_os_priorities")
      .update({
        completed_at: status === "completed" ? new Date().toISOString() : null,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq(healthFilter.column, healthFilter.value)
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;

    return NextResponse.json({ priority: mapPriority(data as PriorityRow) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update Life OS priority.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

async function requireLifeOsAccess(request: NextRequest): Promise<{
  healthProfileContext: ActiveHealthProfileContext;
  response: NextResponse | null;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      healthProfileContext: null as never,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: "",
    };
  }

  const admin = getSupabaseAdmin();
  const entitlement = await requireServerFeatureAccess({
    feature: "life_os",
    lockedMessage: "Unlock Sovereign to manage Life OS priorities.",
    supabase: admin,
    userId: user.id,
  });

  if (!entitlement.allowed) {
    return { healthProfileContext: null as never, response: entitlement.response, userId: "" };
  }

  const healthProfileContext = await resolveActiveHealthProfileContext({
    supabase: admin,
    loginUserId: user.id,
    requestedHealthProfileId: getRequestedHealthProfileId(request),
  });

  return { healthProfileContext, response: null, userId: user.id };
}

function mapPriorities(rows: PriorityRow[]) {
  return rows.map(mapPriority);
}

function mapPriority(row: PriorityRow) {
  return {
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    desiredOutcome: row.desired_outcome || "",
    domain: row.domain,
    horizonDays: row.horizon_days || 90,
    id: row.id,
    nextAction: row.next_action || "",
    priority: row.priority || 3,
    status: row.status || "active",
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function sanitizeDomain(value: unknown): LifeDomainKey | null {
  return typeof value === "string" && LIFE_DOMAINS.has(value as LifeDomainKey)
    ? (value as LifeDomainKey)
    : null;
}

function sanitizeStatus(value: unknown) {
  return value === "active" ||
    value === "paused" ||
    value === "completed" ||
    value === "archived"
    ? value
    : null;
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isMissingPrioritiesTable(error: { code?: string; message?: string }) {
  return error.code === "42P01" || /life_os_priorities/i.test(error.message || "");
}
