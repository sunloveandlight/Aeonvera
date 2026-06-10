import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runLongevityCoach } from "./longevityCoach";
import { deliverCoachNotifications } from "@/lib/notifications/coachDelivery";
import { executeAeonveraActions } from "@/lib/execution/aeonveraExecutionEngine";
import { generateJarvisMessage } from "@/lib/voice/jarvisResponseEngine";
import type { LongevityAlert } from "./longevityCoach";

type OptimizationAction = {
  domain?: string;
  action?: string;
  why?: string;
  cadence?: string;
  impact?: "low" | "medium" | "high";
};

type OptimizationProtocol = {
  summary?: string;
  focus_domains?: string[];
  primary_protocol?: OptimizationAction[];
  coach_message?: string;
};

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
  const latestOptimization = await loadLatestOptimizationProtocol(supabase, userId);
  const optimizationInterventions = buildOptimizationInterventions(
    latestOptimization?.protocol
  );

  if (alerts.length === 0 && latestOptimization?.protocol) {
    const shouldSendOptimizationFocus = await shouldSendProtocolFocus(
      supabase,
      userId
    );

    if (shouldSendOptimizationFocus) {
      alerts.push(buildOptimizationAlert(latestOptimization.protocol));
    }
  }

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

    const interventions = [
      ...alerts.map((alert) => ({
        domain: alert.type,
        action: alert.recommendation,
        reason: alert.message,
        priority: alert.severity === "high" ? 10 : alert.severity === "medium" ? 7 : 4,
      })),
      ...optimizationInterventions,
    ].sort((a, b) => b.priority - a.priority);

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
    optimization_context: Boolean(latestOptimization?.protocol),
  };
}

async function loadLatestOptimizationProtocol(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data, error } = await supabase
    .from("optimization_protocols")
    .select("id, protocol, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isMissingOptimizationTable(error)) {
      console.error("[Coach Optimization Error]", error.message);
    }

    return null;
  }

  return data as { id: string; protocol: OptimizationProtocol; created_at: string } | null;
}

function buildOptimizationInterventions(protocol?: OptimizationProtocol | null) {
  if (!protocol?.primary_protocol?.length) return [];

  return protocol.primary_protocol.slice(0, 3).map((item) => ({
    domain: normalizeDomain(item.domain),
    action: item.action || "Follow your active optimization protocol.",
    reason: item.why || protocol.summary || protocol.coach_message || "Optimization protocol active.",
    priority: item.impact === "high" ? 8 : item.impact === "medium" ? 6 : 4,
  }));
}

function buildOptimizationAlert(protocol: OptimizationProtocol): LongevityAlert {
  const topAction = protocol.primary_protocol?.[0];

  return {
    type: normalizeDomain(topAction?.domain),
    severity: topAction?.impact === "high" ? "medium" : "low",
    title: "Optimization protocol focus",
    message:
      protocol.coach_message ||
      protocol.summary ||
      "Your optimization protocol is active.",
    recommendation:
      topAction?.action ||
      protocol.focus_domains?.[0] ||
      "Review your active optimization protocol.",
    confidence: 0.76,
  };
}

async function shouldSendProtocolFocus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("id")
    .eq("user_id", userId)
    .eq("channel", "in_app")
    .eq("title", "Aeonvera coach: Optimization protocol focus")
    .gte("created_at", since)
    .limit(1);

  if (error) {
    if (!isMissingNotificationTable(error)) {
      console.error("[Coach Notification Check Error]", error.message);
    }

    return true;
  }

  return !data?.length;
}

function normalizeDomain(domain?: string): LongevityAlert["type"] {
  const value = domain?.toLowerCase() || "";

  if (value.includes("sleep")) return "sleep";
  if (value.includes("recover") || value.includes("stress")) return "recovery";
  if (value.includes("nutrition") || value.includes("metabolic")) return "nutrition";
  if (value.includes("movement") || value.includes("training") || value.includes("activity")) {
    return "activity";
  }

  return "risk";
}

function isMissingOptimizationTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("optimization_protocols") ||
    error.message?.includes("schema cache")
  );
}

function isMissingNotificationTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("notification_deliveries") ||
    error.message?.includes("schema cache")
  );
}
