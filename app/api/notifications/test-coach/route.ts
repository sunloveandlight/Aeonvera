import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { deliverCoachNotifications } from "@/lib/notifications/coachDelivery";
import { generateJarvisMessage } from "@/lib/voice/jarvisResponseEngine";
import type { LongevityAlert } from "@/lib/coach/longevityCoach";
import type { LabTrend } from "@/lib/labs/labTrends";
import { loadLabTrendsForUser } from "@/lib/labs/loadLabTrendsForUser";
import { loadOrBuildCoachMemoryProfile } from "@/lib/memory/coachMemoryProfile";
import { buildDailyIntelligenceBrief } from "@/lib/coach/dailyIntelligenceBrief";

type OptimizationProtocol = {
  summary?: string;
  focus_domains?: string[];
  coach_message?: string;
  primary_protocol?: Array<{
    domain?: string;
    action?: string;
    why?: string;
    impact?: "low" | "medium" | "high";
  }>;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const mobileUser = user || (await getBearerUser(request));

    if (!mobileUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const [{ data: profile }, { data: latestProtocol }, labTrends, coachMemory, dailyBrief] =
      await Promise.all([
        admin
          .from("profiles")
          .select("display_name")
          .eq("user_id", mobileUser.id)
          .maybeSingle(),
        admin
          .from("optimization_protocols")
          .select("protocol")
          .eq("user_id", mobileUser.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        loadLabTrendsForUser(admin, mobileUser.id),
        loadOrBuildCoachMemoryProfile(admin, mobileUser.id),
        buildDailyIntelligenceBrief(admin, mobileUser.id),
      ]);

    const protocol = latestProtocol?.protocol as OptimizationProtocol | undefined;
    const clinicalSignal = pickClinicalSignal(labTrends);
    const topAction = protocol?.primary_protocol?.[0];
    const title = clinicalSignal
      ? clinicalSignal.title
      : protocol
      ? "Optimization protocol focus"
      : "Coach delivery test";
    const message =
      clinicalSignal?.message ||
      protocol?.coach_message ||
      protocol?.summary ||
      "This is a test proactive coach message from Aeonvera.";
    const recommendation =
      clinicalSignal?.recommendation ||
      topAction?.action ||
      protocol?.focus_domains?.[0] ||
      "Your delivery settings are connected.";
    const actions = [
      recommendation,
      ...(protocol?.primary_protocol || [])
        .slice(1, 3)
        .map((item) => item.action)
        .filter((item): item is string => Boolean(item)),
    ];

    const alert: LongevityAlert = {
      type: clinicalSignal?.type || normalizeAlertType(topAction?.domain),
      severity: clinicalSignal?.severity || (topAction?.impact === "high" ? "medium" : "low"),
      title,
      message,
      recommendation,
      confidence: 0.8,
    };

    const { data: storedAlert, error: alertError } = await admin
      .from("health_alerts")
      .insert({
        user_id: mobileUser.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        recommendation: alert.recommendation,
        confidence: alert.confidence,
      })
      .select("id, type, severity, title, message, recommendation, confidence")
      .single();

    if (alertError) {
      return NextResponse.json({ error: alertError.message }, { status: 500 });
    }

    const jarvis = generateJarvisMessage({
      userName: profile?.display_name || undefined,
      preferredTone: coachMemory?.communicationStyle,
      memoryBrief: dailyBrief.message || coachMemory?.morningBrief,
      interventions: [
        {
          domain: alert.type,
          action: recommendation,
          reason: message,
          priority: alert.severity === "high" ? 10 : alert.severity === "medium" ? 7 : 4,
        },
      ],
      trigger: {
        shouldTrigger: true,
        intensity: alert.severity === "high" ? "high" : "medium",
        mode: "notification",
        selectedInterventions: [],
      },
    });

    const delivery = await deliverCoachNotifications({
      supabase: admin,
      userId: mobileUser.id,
      alerts: [storedAlert],
      jarvis,
      memoryTags: [
        ...(clinicalSignal ? [`lab:${clinicalSignal.canonicalKey}:${clinicalSignal.status}`] : []),
        ...(coachMemory ? ["memory:test-coach"] : []),
      ],
    });

    return NextResponse.json({
      success: true,
      delivery,
      protocol_context: Boolean(protocol),
      clinical_context: Boolean(clinicalSignal),
      memory_context: Boolean(coachMemory),
      communication_style: coachMemory?.communicationStyle || null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send test coach message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getBearerUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) return null;

  const admin = getSupabaseAdmin();
  const {
    data: { user },
  } = await admin.auth.getUser(token);

  return user;
}

function pickClinicalSignal(trends: LabTrend[]) {
  const trend =
    trends.find((item) => item.status === "worsening") ||
    trends.find((item) => item.status === "improving");

  if (!trend) return null;

  const unit = trend.unit ? ` ${trend.unit}` : "";
  const worsening = trend.status === "worsening";

  return {
    canonicalKey: trend.canonicalKey,
    status: trend.status,
    type: normalizeAlertType(trend.canonicalKey),
    severity: (worsening ? clinicalSeverity(trend) : "low") as LongevityAlert["severity"],
    title: worsening ? `${trend.label} needs attention` : `${trend.label} is improving`,
    message: worsening
      ? `${trend.label} moved away from target. Latest value: ${trend.latestValue}${unit}.`
      : `${trend.label} is moving in a favorable direction. Latest value: ${trend.latestValue}${unit}.`,
    recommendation: worsening
      ? `Make ${trend.label} the focus of your next protocol review. Target: ${trend.target}.`
      : `Keep the current rhythm steady and retest ${trend.label} on the next lab cycle.`,
  };
}

function normalizeAlertType(domain?: string): LongevityAlert["type"] {
  const value = domain?.toLowerCase() || "";

  if (value.includes("glucose") || value.includes("albumin")) return "nutrition";
  if (value.includes("hscrp") || value.includes("crp")) return "recovery";
  if (value.includes("sleep")) return "sleep";
  if (value.includes("recover") || value.includes("stress")) return "recovery";
  if (value.includes("nutrition") || value.includes("metabolic")) return "nutrition";
  if (value.includes("movement") || value.includes("training") || value.includes("activity")) {
    return "activity";
  }

  return "risk";
}

function clinicalSeverity(trend: LabTrend): LongevityAlert["severity"] {
  return trend.canonicalKey === "hscrp" || trend.canonicalKey === "fasting_glucose"
    ? "high"
    : "medium";
}
