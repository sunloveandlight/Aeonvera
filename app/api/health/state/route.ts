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
     * FETCH WEARABLE METRICS
     *
     * Schema:
     * wearable_metrics
     * - user_id
     * - metric_name
     * - metric_value
     * - recorded_at
     */
    const { data: metrics, error } = await supabase
      .from("wearable_metrics")
      .select("*")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const state = buildHealthState(
      (metrics || []).map((m) => ({
        userId: m.user_id,
        metricName: m.metric_name,
        value: Number(m.metric_value),
        timestamp: m.recorded_at,
      }))
    );

    if (!state) {
      return NextResponse.json(
        { error: "No wearable metrics found" },
        { status: 404 }
      );
    }

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
      metricsProcessed: metrics?.length ?? 0,
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