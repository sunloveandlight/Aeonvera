import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { buildHealthState } from "@/lib/state/healthStateEngine";

/**
 * Supabase admin client (server-only)
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/health/state
 * Body: { userId: string }
 *
 * 1. Fetch metrics
 * 2. Build health state
 * 3. Persist to Supabase
 * 4. Return state
 */
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

    /**
     * 1. FETCH METRICS
     */
    const { data: metrics, error } = await supabase
      .from("metrics")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    /**
     * 2. BUILD STATE
     */
    const state = buildHealthState(
      (metrics || []).map((m: any) => ({
        userId: m.user_id,
        metricName: m.metric_name,
        value: Number(m.metric_value),
        timestamp: m.recorded_at,
      }))
    );

    if (!state) {
      return NextResponse.json(
        { error: "No metrics found" },
        { status: 404 }
      );
    }

    /**
     * 3. UPSERT STATE (single source of truth)
     */
    const { error: upsertError } = await supabase
      .from("health_states")
      .upsert({
        user_id: userId,
        baseline: state.baseline,
        trends: state.trends,
        risk_scores: state.riskScores,
        insights: state.insights,
        updated_at: state.updatedAt,
      });

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      );
    }

    /**
     * 4. RETURN STATE
     */
    return NextResponse.json({
      success: true,
      state,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}