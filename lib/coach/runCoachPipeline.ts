import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runLongevityCoach } from "./longevityCoach";
import { deliverCoachNotifications } from "@/lib/notifications/coachDelivery";
import { executeAeonveraActions } from "@/lib/execution/aeonveraExecutionEngine";
import { generateJarvisMessage } from "@/lib/voice/jarvisResponseEngine";
import { buildDailyIntelligenceBrief } from "@/lib/coach/dailyIntelligenceBrief";
import { loadLabTrendsForUser } from "@/lib/labs/loadLabTrendsForUser";
import { buildExecutionSummary, getExecutionWindow } from "@/lib/execution/executionSummary";
import { loadOrBuildCoachMemoryProfile } from "@/lib/memory/coachMemoryProfile";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import {
  createLegacyActiveHealthProfileContext,
  getHealthSubjectFilter,
  healthSubjectInsertFields,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import type { LongevityAlert } from "./longevityCoach";
import {
  buildAdaptiveCoachDecision,
  buildAdaptiveInterventions,
  type AdaptiveCoachContext,
  type OptimizationProtocol,
} from "./adaptiveDailyCoach";

/**
 * FULL COACH PIPELINE (V2 UPGRADE)
 * ---------------------------------
 * 1. Fetch health state
 * 2. Run coaching engine using REAL intelligence
 * 3. Store alerts
 */
export async function runCoachPipeline(
  userId: string,
  healthProfileContext?: ActiveHealthProfileContext | null
) {
  if (!userId) throw new Error("Missing userId");

  const supabase = getSupabaseAdmin();
  const activeHealthProfileContext =
    healthProfileContext || createLegacyActiveHealthProfileContext(userId);
  const healthFilter = getHealthSubjectFilter(activeHealthProfileContext);
  const subscription = await getUserPlanForUsage({ supabase, userId });

  if (!canAccess(subscription.plan, subscription.status, "proactive_coach")) {
    return {
      success: true,
      alerts: [],
      delivered: 0,
      optimization_context: false,
      skipped: true,
      reason: "Proactive coach delivery is not included in this tier.",
    };
  }

  /**
   * 1. FETCH HEALTH STATE
   */
  const { data: state, error: stateError } = await supabase
    .from("health_states")
    .select("*")
    .eq(healthFilter.column, healthFilter.value)
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
  const latestOptimization = await loadLatestOptimizationProtocol(
    supabase,
    userId,
    activeHealthProfileContext
  );
  const adaptiveContext = await loadAdaptiveCoachContext(
    supabase,
    userId,
    activeHealthProfileContext
  );
  const adaptiveDecision = buildAdaptiveCoachDecision({
    baseAlerts: alerts,
    optimizationProtocol: latestOptimization?.protocol,
    context: adaptiveContext,
  });
  const optimizationInterventions = buildOptimizationInterventions(
    latestOptimization?.protocol
  );

  if (!adaptiveDecision.shouldSend) {
    return {
      success: true,
      alerts: [],
      delivered: 0,
      optimization_context: Boolean(latestOptimization?.protocol),
      skipped: true,
      reason: adaptiveDecision.reason,
    };
  }

  /**
   * 4. STORE ALERTS
   */
  let storedAlerts = [];

  if (adaptiveDecision.alerts.length > 0) {
    const { data, error: insertError } = await supabase
      .from("health_alerts")
      .insert(
        adaptiveDecision.alerts.map((a) => ({
          user_id: userId,
          ...healthSubjectInsertFields(activeHealthProfileContext),
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
      ...buildAdaptiveInterventions(adaptiveDecision.alerts),
      ...optimizationInterventions,
    ].sort((a, b) => b.priority - a.priority);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const dailyBrief = await buildDailyIntelligenceBrief(
      supabase,
      userId,
      activeHealthProfileContext
    );

    const jarvis = generateJarvisMessage({
      userName: profile?.display_name || undefined,
      interventions,
      preferredTone: adaptiveContext.coachMemory?.communicationStyle,
      memoryBrief: dailyBrief.message || adaptiveContext.coachMemory?.morningBrief,
      trigger: {
        shouldTrigger: true,
        intensity: adaptiveDecision.intensity,
        mode: adaptiveDecision.mode,
        selectedInterventions: interventions,
      },
    });

    await deliverCoachNotifications({
      supabase,
      userId,
      healthProfileContext: activeHealthProfileContext,
      alerts: storedAlerts,
      jarvis,
      memoryTags: adaptiveDecision.memoryTags,
    });

    await executeAeonveraActions({
      userId,
      healthProfileContext: activeHealthProfileContext,
      priorityQueue: interventions.map((intervention) => ({
        type: "proactive",
        domain: intervention.domain,
        action: intervention.action,
        reason: intervention.reason,
        priority: intervention.priority * 10,
      })),
    });

    await recordCoachOutput({
      userId,
      healthProfileContext: activeHealthProfileContext,
      mode: adaptiveDecision.mode,
      tone: jarvis.tone,
      message: jarvis.message,
      actions: jarvis.actions,
    });
  }

  return {
    success: true,
    alerts: adaptiveDecision.alerts,
    delivered: storedAlerts.length,
    optimization_context: Boolean(latestOptimization?.protocol),
    reason: adaptiveDecision.reason,
  };
}

async function loadLatestOptimizationProtocol(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
) {
  const filter = getHealthSubjectFilter(healthProfileContext);
  const { data, error } = await supabase
    .from("optimization_protocols")
    .select("id, protocol, created_at")
    .eq(filter.column, filter.value)
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

async function loadAdaptiveCoachContext(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
): Promise<AdaptiveCoachContext> {
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const filter = getHealthSubjectFilter(healthProfileContext);

  const [
    metricsResult,
    notificationsResult,
    reportResult,
    behaviorResult,
    labTrends,
    executionSummary,
    coachMemory,
  ] =
    await Promise.all([
      supabase
        .from("health_metrics")
        .select("metric, value, measured_at")
        .eq(filter.column, filter.value)
        .gte("measured_at", since)
        .order("measured_at", { ascending: false })
        .limit(240),
      supabase
        .from("notification_deliveries")
        .select("title, message, created_at, payload")
        .eq(filter.column, filter.value)
        .eq("channel", "in_app")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("longevity_reports")
        .select("risk_score, primary_goal, report, created_at")
        .eq(filter.column, filter.value)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("behavior_events")
        .select("domain, action, outcome, created_at")
        .eq(filter.column, filter.value)
        .order("created_at", { ascending: false })
        .limit(20),
      loadLabTrendsForUser(supabase, userId, healthProfileContext.healthProfileId),
      loadExecutionSummaryForCoach(supabase, userId, healthProfileContext),
      loadOrBuildCoachMemoryProfile(supabase, userId, healthProfileContext),
    ]);

  return {
    metrics: metricsResult.data || [],
    recentNotifications: notificationsResult.data || [],
    latestReport: reportResult.data || null,
    recentBehaviorEvents: behaviorResult.data || [],
    labTrends,
    executionSummary,
    coachMemory,
  };
}

async function loadExecutionSummaryForCoach(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext
) {
  const window = getExecutionWindow();
  const filter = getHealthSubjectFilter(healthProfileContext);
  const [outcomesResult, calendarResult] = await Promise.all([
    supabase
      .from("intervention_outcomes")
      .select("domain, action, outcome, success, notes, measured_at, created_at")
      .eq(filter.column, filter.value)
      .gte("created_at", window.startIso)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("calendar_events")
      .select("action, action_scope, recurrence, scheduled_for, status, created_at")
      .eq(filter.column, filter.value)
      .gte("scheduled_for", window.startIso)
      .order("scheduled_for", { ascending: false })
      .limit(80),
  ]);

  if (outcomesResult.error && !isMissingExecutionTable(outcomesResult.error)) {
    console.error("[Coach Execution Outcomes Error]", outcomesResult.error.message);
  }

  if (calendarResult.error && !isMissingExecutionTable(calendarResult.error)) {
    console.error("[Coach Calendar Events Error]", calendarResult.error.message);
  }

  return buildExecutionSummary({
    calendarEvents: calendarResult.error ? [] : calendarResult.data || [],
    outcomes: outcomesResult.error ? [] : outcomesResult.data || [],
  });
}

async function recordCoachOutput({
  userId,
  healthProfileContext,
  mode,
  tone,
  message,
  actions,
}: {
  userId: string;
  healthProfileContext: ActiveHealthProfileContext;
  mode: string;
  tone: string;
  message: string;
  actions: string[];
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("coach_outputs").insert({
    user_id: userId,
    ...healthSubjectInsertFields(healthProfileContext),
    mode,
    tone,
    message,
    actions,
    source: "cron",
  });

  if (error) {
    console.error("[Coach Output Store Error]", error.message);
  }
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

function isMissingExecutionTable(error: { message?: string; code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("intervention_outcomes") ||
    error.message?.includes("calendar_events") ||
    error.message?.includes("schema cache")
  );
}
