import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess, type Plan, type SubscriptionStatus } from "@/lib/auth/permissions";
import { FUTURE_SELF_SCENARIOS } from "@/lib/longevity/futureSelfSimulator";
import { storeSemanticMemory } from "@/lib/memory/semanticMemory";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

const BASE_SELECT_FIELDS =
  "id,title,description,scenario_ids,controls,projection,future_self,share_token,is_public,created_at,updated_at";
const SELECT_FIELDS = `${BASE_SELECT_FIELDS},parent_scenario_id,version_number,protocol_id`;

type ScenarioQueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

export async function GET() {
  try {
    const user = await requireUser();
    const admin = getSupabaseAdmin();
    await requireFutureSelfAccess(admin, user.id);
    const result = await admin
      .from("future_self_scenarios")
      .select(SELECT_FIELDS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);
    const { data, error } = await retryWithoutPhase5LinkColumns(result, () =>
      admin
        .from("future_self_scenarios")
        .select(BASE_SELECT_FIELDS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12)
    );

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({
          scenarios: [],
          migrationRequired: true,
          message: "Apply the future_self_scenarios Supabase migration to save scenarios.",
        });
      }

      throw error;
    }

    return NextResponse.json({ scenarios: data || [] });
  } catch (error) {
    if (error instanceof FutureSelfScenarioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Could not load saved scenarios.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const admin = getSupabaseAdmin();
    await requireFutureSelfAccess(admin, user.id);
    const body = await readJsonBody(request);
    const scenarioIds = sanitizeScenarioIds(body?.scenarioIds);
    const futureSelf = safeRecord(body?.futureSelf);
    const projection = safeRecord(body?.projection);
    const controls = safeRecord(body?.controls);
    const parentScenarioId = sanitizeUuid(body?.parentScenarioId);
    const versionNumber = Math.max(1, Math.min(99, Number(body?.versionNumber) || 1));
    const title = sanitizeText(body?.title, 88) || buildScenarioTitle(scenarioIds);
    const description =
      sanitizeText(body?.description, 220) ||
      sanitizeText(futureSelf.summary, 220) ||
      "Saved future-self projection.";

    const insertPayload = {
      user_id: user.id,
      title,
      description,
      scenario_ids: scenarioIds,
      controls,
      projection,
      future_self: futureSelf,
      is_public: body?.isPublic === true,
      parent_scenario_id: parentScenarioId || null,
      version_number: versionNumber,
    };
    const result = await admin
      .from("future_self_scenarios")
      .insert(insertPayload)
      .select(SELECT_FIELDS)
      .single();
    const { data, error } = await retryInsertWithoutPhase5LinkColumns(result, () =>
      admin
        .from("future_self_scenarios")
        .insert({
          user_id: user.id,
          title,
          description,
          scenario_ids: scenarioIds,
          controls,
          projection,
          future_self: futureSelf,
          is_public: body?.isPublic === true,
        })
        .select(BASE_SELECT_FIELDS)
        .single()
    );

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          {
            error:
              "The future_self_scenarios table is not live yet. Apply the Supabase migration, then save again.",
          },
          { status: 500 }
        );
      }

      throw error;
    }

    await storeSemanticMemory({
      content: [
        `Saved future-self scenario: ${title}`,
        description,
        scenarioIds.length ? `Selected levers: ${scenarioIds.join(", ")}` : "",
        futureSelf.summary ? `Projection summary: ${futureSelf.summary}` : "",
      ].filter(Boolean).join("\n"),
      importance: 0.8,
      metadata: {
        scenarioIds,
        isPublic: body?.isPublic === true,
        storedBy: "future_self_scenario",
      },
      sourceId: typeof data === "object" && data && "id" in data ? String(data.id) : undefined,
      sourceType: "future_self_scenario",
      supabase: admin,
      title,
      userId: user.id,
    });

    return NextResponse.json({ scenario: data });
  } catch (error) {
    if (error instanceof FutureSelfScenarioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Could not save future-self scenario.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function requireUser() {
  const supabase = await getSupabaseUserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new FutureSelfScenarioError("Unauthorized", 401);
  }

  return user;
}

async function requireFutureSelfAccess(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data } = await admin
    .from("profiles")
    .select("plan,subscription_status")
    .eq("user_id", userId)
    .maybeSingle();
  const profile = data as {
    plan?: Plan | null;
    subscription_status?: SubscriptionStatus | null;
  } | null;

  if (
    canAccess(
      profile?.plan || null,
      profile?.subscription_status || null,
      "future_self_simulator"
    )
  ) {
    return;
  }

  throw new FutureSelfScenarioError(
    "Future-self scenario modeling is included in Elite and Sovereign.",
    403
  );
}

async function getSupabaseUserClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function sanitizeScenarioIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  const allowed = new Set(FUTURE_SELF_SCENARIOS.map((scenario) => scenario.id));
  return Array.from(
    new Set(
      value.filter(
        (scenarioId): scenarioId is string =>
          typeof scenarioId === "string" && allowed.has(scenarioId)
      )
    )
  ).slice(0, 5);
}

function buildScenarioTitle(scenarioIds: string[]) {
  const titles = FUTURE_SELF_SCENARIOS
    .filter((scenario) => scenarioIds.includes(scenario.id))
    .map((scenario) => scenario.title);

  if (!titles.length) return "My 180-day optimized self";
  if (titles.length === 1) return titles[0];
  return titles.slice(0, 3).join(" + ");
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
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

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.message?.includes("future_self_scenarios") ||
    error.message?.includes("schema cache")
  );
}

function isMissingPhase5LinkColumn(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST204" ||
    error?.message?.includes("parent_scenario_id") ||
    error?.message?.includes("version_number") ||
    error?.message?.includes("protocol_id")
  );
}

async function retryWithoutPhase5LinkColumns(
  result: ScenarioQueryResult,
  fallback: () => PromiseLike<ScenarioQueryResult>
) {
  if (isMissingPhase5LinkColumn(result.error)) {
    return fallback();
  }

  return result;
}

async function retryInsertWithoutPhase5LinkColumns(
  result: ScenarioQueryResult,
  fallback: () => PromiseLike<ScenarioQueryResult>
) {
  if (isMissingPhase5LinkColumn(result.error)) {
    return fallback();
  }

  return result;
}

class FutureSelfScenarioError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
