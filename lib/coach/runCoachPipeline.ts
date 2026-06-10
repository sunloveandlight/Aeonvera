import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runLongevityCoach } from "./longevityCoach";
import { deliverCoachNotifications } from "@/lib/notifications/coachDelivery";
import { executeAeonveraActions } from "@/lib/execution/aeonveraExecutionEngine";
import { generateJarvisMessage } from "@/lib/voice/jarvisResponseEngine";

/**
 * FULL COACH PIPELINE (V2 UPGRADE)
 * ---------------------------------
 * 1. Fetch health state
 * 2. Run coaching engine using REAL intelligence
 * 3. Store alerts
 */
export async function runCoachPipeline(userId: string) {
  if (!userId) throw new Error("Missing userId");

  const supabase = getSupabaseAdmin();

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
   */
  const enrichedMetrics = [
    ...Object.entries(state.baseline || {}).map(([key, value]) => ({
      userId,
      metricName: key,
      value: Number(value),
      timestamp: state.updated_at,
    })),
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
  let storedAlerts = [];

  if (alerts.length > 0) {
    const { data, error: insertError } = await supabase
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
      )
      .select("id, type, severity, title, message, recommendation, confidence");

    if (insertError) {
      throw new Error(insertError.message);
    }

    storedAlerts = data || [];

    const interventions = alerts.map((alert) => ({
      domain: alert.type,
      action: alert.recommendation,
      reason: alert.message,
      priority: alert.severity === "high" ? 10 : alert.severity === "medium" ? 7 : 4,
    }));

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();

    const jarvis = generateJarvisMessage({
      userName: profile?.display_name || undefined,
      interventions,
      trigger: {
        shouldTrigger: true,
        intensity: alerts.some((alert) => alert.severity === "high")
          ? "high"
          : "medium",
        mode: alerts.some((alert) => alert.severity === "high")
          ? "notification"
          : "dashboard",
        selectedInterventions: interventions,
      },
    });

    await deliverCoachNotifications({
      supabase,
      userId,
      alerts: storedAlerts,
      jarvis,
    });

    await executeAeonveraActions({
      userId,
      priorityQueue: interventions.map((intervention) => ({
        type: "proactive",
        domain: intervention.domain,
        action: intervention.action,
        reason: intervention.reason,
        priority: intervention.priority * 10,
      })),
    });
  }

  return {
    success: true,
    alerts,
    delivered: storedAlerts.length,
  };
}
