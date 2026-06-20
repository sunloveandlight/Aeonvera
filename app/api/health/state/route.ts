import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireServerFeatureAccess } from "@/lib/auth/serverFeatureAccess";
import { buildHealthState } from "@/lib/state/healthStateEngine";
import { normalizeHealthMetrics } from "@/lib/metrics/normalizeHealthMetrics";
import { refreshBiologicalAgeForUser } from "@/lib/longevity/refreshBiologicalAge";
import {
  frozenHealthProfilePayload,
  getHealthSubjectFilter,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRequest(req, "health-state-process", 20, 60_000);
    if (limited) return limited;

    const body = await req.json();
    const requestedUserId = body.userId;
    const authorization = await resolveAuthorizedUserId(req, requestedUserId);

    if (!authorization) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { isCron, userId } = authorization;
    const supabase = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase,
      loginUserId: userId,
      requestedHealthProfileId:
        typeof body.healthProfileId === "string"
          ? body.healthProfileId
          : req.cookies.get("aeonvera.activeHealthProfileId")?.value,
    });
    if (healthProfileContext.isFrozen) {
      return NextResponse.json(frozenHealthProfilePayload(), { status: 423 });
    }
    const healthFilter = getHealthSubjectFilter(healthProfileContext);

    if (!isCron) {
      const entitlement = await requireServerFeatureAccess({
        feature: "dashboard_access",
        lockedMessage: "Activate Core to process health-state data.",
        supabase,
        userId,
      });
      if (!entitlement.allowed) return entitlement.response;
    }


    /**
     * STEP 1: GET LAST PROCESSING TIME
     */
    const { data: existingState } = await supabase
      .from("health_states")
      .select("last_processed_at")
      .eq(healthFilter.column, healthFilter.value)
      .single();

    const lastProcessedAt = existingState?.last_processed_at ?? null;

    /**
     * STEP 2: FETCH ONLY NEW RAW DATA
     */
    let query = supabase
      .from("wearable_metrics")
      .select("*")
      .eq(healthFilter.column, healthFilter.value)
      .order("recorded_at", { ascending: true });

    if (lastProcessedAt) {
      query = query.gt("recorded_at", lastProcessedAt);
    }

    const { data: rawMetrics, error: rawError } = await query;

    if (rawError) {
      console.error("Raw wearable metric query failed:", rawError);
      return NextResponse.json(
        { error: "Could not load wearable metrics." },
        { status: 500 }
      );
    }

    if (!rawMetrics || rawMetrics.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No new data to process",
      });
    }

    /**
     * STEP 3: NORMALIZE RAW → CANONICAL
     */
    const normalized = normalizeHealthMetrics(
      rawMetrics.map((m) => ({
        userId: m.user_id,
        source: m.provider || m.source || "manual",
        metricName: m.metric_name,
        value: Number(m.metric_value ?? m.value),
        timestamp: m.recorded_at,
      }))
    );

    /**
     * STEP 4: UPSERT INTO health_metrics
     */
    await supabase.from("health_metrics").upsert(
      normalized.map((m) => ({
        user_id: m.userId,
        ...healthSubjectInsertFields(healthProfileContext),
        metric: m.metric,
        value: m.value,
        measured_at: m.measured_at,
        source: m.source,
      }))
    );

    /**
     * STEP 5: BUILD STATE FROM CANONICAL DATA
     */
    const { data: canonicalMetrics } = await supabase
      .from("health_metrics")
      .select("*")
      .eq(healthFilter.column, healthFilter.value)
      .order("measured_at", { ascending: true });

    const formattedMetrics = (canonicalMetrics || []).map((m) => ({
      userId: m.user_id,
      metricName: m.metric,
      value: Number(m.value),
      timestamp: m.measured_at,
    }));

    const state = buildHealthState(formattedMetrics);

    if (!state) {
      return NextResponse.json(
        { error: "Failed to build health state" },
        { status: 500 }
      );
    }

    /**
     * STEP 6: SAFE LATEST TIMESTAMP (FIXED)
     */
    const latestTimestamp =
      rawMetrics.length > 0
        ? rawMetrics
            .map((m) => m.recorded_at)
            .reduce((max, cur) =>
              new Date(cur) > new Date(max) ? cur : max
            )
        : new Date().toISOString();

    /**
     * STEP 7: SAVE STATE + UPDATE PROCESSING CURSOR
     */
    const statePayload = {
      user_id: userId,
      ...healthSubjectInsertFields(healthProfileContext),
      baseline: state.baseline,
      trends: state.trends,
      risk_scores: state.riskScores,
      insights: state.insights,
      updated_at: state.updatedAt,
      last_processed_at: latestTimestamp,
    };

    const stateError = healthProfileContext.healthProfileId
      ? await upsertHealthStateByProfile(supabase, healthProfileContext.healthProfileId, statePayload)
      : (
          await supabase
            .from("health_states")
            .upsert(statePayload, { onConflict: "user_id" })
        ).error;

    if (stateError) {
      console.error("Health state save failed:", stateError);
      return NextResponse.json(
        { error: "Failed to save health state." },
        { status: 500 }
      );
    }

    const biologicalAge = await refreshBiologicalAgeForUser({
      supabase,
      userId,
      healthProfileId: healthProfileContext.healthProfileId,
      source: "wearable",
    });

    return NextResponse.json({
      success: true,
      processed: rawMetrics.length,
      normalized: normalized.length,
      state,
      biologicalAge,
    });
  } catch (err) {
    console.error("Health state processing failed:", err);
    return NextResponse.json(
      { error: "Failed to process health state." },
      { status: 500 }
    );
  }
}

async function upsertHealthStateByProfile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  healthProfileId: string,
  payload: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("health_states")
    .update(payload)
    .eq("health_profile_id", healthProfileId)
    .select("id")
    .limit(1);

  if (error) return error;
  if (Array.isArray(data) && data.length > 0) return null;

  return (await supabase.from("health_states").insert(payload)).error;
}

async function resolveAuthorizedUserId(req: NextRequest, requestedUserId?: string) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return typeof requestedUserId === "string"
      ? { isCron: true, userId: requestedUserId }
      : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  if (requestedUserId && requestedUserId !== user.id) return null;

  return { isCron: false, userId: user.id };
}
