import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildHealthState } from "@/lib/state/healthStateEngine";

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
     * STEP 1: FETCH NORMALIZED HEALTH METRICS (NOT RAW WEARABLES)
     */
    const { data: metrics, error } = await supabase
      .from("health_metrics")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!metrics || metrics.length === 0) {
      return NextResponse.json(
        { error: "No health metrics found" },
        { status: 404 }
      );
    }

    /**
     * STEP 2: MAP DB → ENGINE FORMAT
     */
    const formattedMetrics = metrics.map((m) => ({
      userId: m.user_id,
      metricName: m.metric,
      value: Number(m.value),
      timestamp: m.measured_at,
    }));

    /**
     * STEP 3: BUILD HEALTH STATE
     */
    const state = buildHealthState(formattedMetrics);

    if (!state) {
      return NextResponse.json(
        { error: "Failed to build health state" },
        { status: 500 }
      );
    }

    /**
     * STEP 4: SAVE STATE
     */
    const { error: upsertError } = await supabase
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

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      state,
      metricsProcessed: formattedMetrics.length,
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