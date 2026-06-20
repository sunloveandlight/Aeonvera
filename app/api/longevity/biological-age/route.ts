import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  computeBiologicalAge,
} from "@/lib/longevity/biologicalAgeEngine";
import { buildAssessmentInput } from "@/lib/longevity/assessmentInput";
import { loadLatestLabInputValues } from "@/lib/labs/latestLabInputs";
import { requireServerFeatureAccess } from "@/lib/auth/serverFeatureAccess";
import {
  frozenHealthProfilePayload,
  getHealthSubjectFilter,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

async function getSupabaseUser() {
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

export async function GET() {
  try {
    const supabaseUser = await getSupabaseUser();
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const entitlement = await requireServerFeatureAccess({
      feature: "dashboard_access",
      lockedMessage: "Activate Core to view biological age history.",
      supabase,
      userId: user.id,
    });
    if (!entitlement.allowed) return entitlement.response;

    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase,
      loginUserId: user.id,
    });

    const historyFilter = getHealthSubjectFilter(healthProfileContext);
    const { data, error } = await supabase
      .from("biological_age_history")
      .select("id, chronological_age, biological_age, age_delta, score, accuracy_score, category, source, result, created_at")
      .eq(historyFilter.column, historyFilter.value)
      .order("created_at", { ascending: false })
      .limit(24);

    if (error) {
      if (isMissingHistoryTable(error)) {
        return NextResponse.json({ history: [] });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ history: data || [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load biological age history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUser = await getSupabaseUser();
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const supabase = getSupabaseAdmin();
    const entitlement = await requireServerFeatureAccess({
      feature: "dashboard_access",
      lockedMessage: "Activate Core to calculate biological age.",
      supabase,
      userId,
    });
    if (!entitlement.allowed) return entitlement.response;

    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase,
      loginUserId: userId,
    });
    if (healthProfileContext.isFrozen) {
      return NextResponse.json(frozenHealthProfilePayload(), { status: 423 });
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from("longevity_assessments")
      .select("*")
      .eq(
        getHealthSubjectFilter(healthProfileContext).column,
        getHealthSubjectFilter(healthProfileContext).value
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (assessmentError || !assessment) {
      return NextResponse.json(
        { error: "No assessment found." },
        { status: 404 }
      );
    }

    const input = {
      ...buildAssessmentInput(assessment),
      ...(await loadLatestLabInputValues({
        healthProfileId: healthProfileContext.healthProfileId,
        supabase,
        userId,
      })),
    };
    const result = computeBiologicalAge(input);
    const body = await readJsonBody(request);
    const source = normalizeSource(body?.source);

    await supabase
      .from("profiles")
      .update({
        biological_age: result.biologicalAge,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    const { data: historyPoint } = await supabase
      .from("biological_age_history")
      .insert({
        ...healthSubjectInsertFields(healthProfileContext),
        user_id: userId,
        assessment_id: assessment.id,
        chronological_age: result.chronologicalAge,
        biological_age: result.biologicalAge,
        age_delta: result.ageDelta,
        score: result.score,
        accuracy_score: result.accuracyScore,
        category: result.category,
        source,
        result,
      })
      .select("id, chronological_age, biological_age, age_delta, score, accuracy_score, category, source, result, created_at")
      .single();

    return NextResponse.json({ success: true, result, history: historyPoint || null });
  } catch (err: unknown) {
    console.error("Biological age error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeSource(value: unknown) {
  return value === "wearable" || value === "simulation" || value === "system"
    ? value
    : "assessment";
}

function isMissingHistoryTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("biological_age_history") ||
    error.message?.includes("schema cache")
  );
}
