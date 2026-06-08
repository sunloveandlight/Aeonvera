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
     * STEP 1: FETCH RAW WEARABLE DATA
     */
    const { data: rawMetrics, error: rawError } = await supabase
      .from("wearable_metrics")
      .select("*")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: true });

    if (rawError) {
      return NextResponse.json(
        { error: rawError.message },
        { status: 500 }
      );
    }

    if (!rawMetrics || rawMetrics.length === 0) {
      return NextResponse.json(
        { error: "No wearable metrics found" },
        { status: 404 }
      );
    }

    /**
     * STEP 2: NORMALIZE RAW → CANONICAL
     */
    const normalized = normalizeHealthMetrics(
      rawMetrics.map((m) => ({
        userId: m.user_id,
        source: m.provider,
        metricName: m.metric_name,
        value: Number(m.metric_value),
        timestamp: m.recorded_at,
      }))
    );

    if (!normalized.length) {
      return NextResponse.json(
        { error: "No valid normalized metrics" },
        { status: 400 }
      );
    }

    /**
     * STEP 3: WRITE INTO health_metrics TABLE
     */
    const { error: insertError } = await supabase
      .from("health_metrics")
      .upsert(
        normalized.map((m) => ({
          user_id: m.userId,
          metric: m.metric,
          value: m.value,
          measured_at: m.measured_at,
          source: m.source,
        }))
      );

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    /**
     * STEP 4: BUILD HEALTH STATE FROM CANONICAL DATA
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
     * STEP 5: SAVE HEALTH STATE
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
        },
        {
          onConflict: "user_id",
        }
      );

    if (stateError) {
      return NextResponse.json(
        { error: stateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      normalizedCount: normalized.length,
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