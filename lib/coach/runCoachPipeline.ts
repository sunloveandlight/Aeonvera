import { createClient } from "@supabase/supabase-js";
import { runLongevityCoach } from "./longevityCoach";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * FULL COACH PIPELINE
 * --------------------
 * 1. Fetch health state
 * 2. Run coaching engine
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
   * 2. RECONSTRUCT METRICS (from state baseline)
   * NOTE: V1 simplification — later we use full time-series memory
   */
  const fakeMetrics = Object.entries(state.baseline).map(
    ([key, value]) => ({
      userId,
      metricName: key,
      value: Number(value),
      timestamp: new Date().toISOString(),
    })
  );

  /**
   * 3. RUN COACH ENGINE
   */
  const alerts = runLongevityCoach(fakeMetrics);

  if (!alerts.length) {
    return { success: true, alerts: [] };
  }

  /**
   * 4. STORE ALERTS
   */
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

  return {
    success: true,
    alerts,
  };
}