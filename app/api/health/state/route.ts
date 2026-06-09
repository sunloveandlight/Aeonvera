import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildHealthState } from "@/lib/state/healthStateEngine";
import { normalizeHealthMetrics } from "@/lib/metrics/normalizeHealthMetrics";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    /**
     * STEP 1: GET LAST PROCESSING TIME
     */
    const { data: existingState } = await supabase
      .from("health_states")
      .select("last_processed_at")
      .eq("user_id", userId)
      .single();

    const lastProcessedAt = existingState?.last_processed_at ?? null;

    /**
     * STEP 2: FETCH ONLY NEW RAW DATA
     */
    let query = supabase
      .from("wearable_metrics")
      .select("*")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: true });

    if (lastProcessedAt) {
      query = query.gt("recorded_at", lastProcessedAt);
    }

    const { data: rawMetrics, error: rawError } = await query;

    if (rawError) {
      return NextResponse.json(
        { error: rawError.message },
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
      .eq("user_id", userId)
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
    const { error: stateError } = await supabase
      .from("health_states")
      .upsert(
        {
          user_id: userId,
          baseline: state.baseline,
          trends: state.trends,
          risk_scores: state.riskScores,
          insights: state.insights,
          updated_at: state.updatedAt,
          last_processed_at: latestTimestamp,
        },
        { onConflict: "user_id" }
      );

    if (stateError) {
      return NextResponse.json(
        { error: stateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      processed: rawMetrics.length,
      normalized: normalized.length,
      state,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
