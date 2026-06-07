import { createClient } from "@supabase/supabase-js";
import { runLongevityCoach } from "./longevityCoach";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * FULL COACH PIPELINE (V2 UPGRADE)
 * ---------------------------------
 * 1. Fetch health state
 * 2. Run coaching engine using REAL intelligence (no reconstruction)
 * 3. Store alerts
 */
export async function runCoachPipeline(userId: string) {
  if (!userId) throw new Error("Missing userId");

  /**
   * 1. FETCH HEALTH STATE
   */
  const { data: state, error: stateError } = await supabase
    .from("health_states")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (stateError || !state) {
    throw new Error("Health state not found");
  }

  /**
   * 2. TRANSFORM HEALTH STATE → COACH INPUT
   * (NO MORE fakeMetrics)
   */
  const enrichedMetrics = [
    // convert baseline signals
    ...Object.entries(state.baseline || {}).map(([key, value]) => ({
      userId,
      metricName: key,
      value: Number(value),
      timestamp: state.updated_at,
    })),

    // add risk scores as pseudo-metrics (important signal layer)
    ...Object.entries(state.risk_scores || {}).map(([key, value]) => ({
      userId,
      metricName: `risk_${key}`,
      value: Number(value),
      timestamp: state.updated_at,
    })),
  ];

  /**
   * 3. RUN COACH ENGINE
   */
  const alerts = runLongevityCoach(enrichedMetrics);

  /**
   * 4. STORE ALERTS
   */
  if (alerts.length > 0) {
    const { error: insertError } = await supabase
      .from("health_alerts")
      .insert(
        alerts.map((a) => ({
          user_id: userId,
          type: a.type,
          severity: a.severity,
          title: a.title,
          message: a.message,
          recommendation: a.recommendation,
          confidence: a.confidence,
        }))
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  return {
    success: true,
    alerts,
  };
}