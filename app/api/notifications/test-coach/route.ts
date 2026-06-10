import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { deliverCoachNotifications } from "@/lib/notifications/coachDelivery";
import type { JarvisMessage } from "@/lib/voice/jarvisResponseEngine";
import type { LongevityAlert } from "@/lib/coach/longevityCoach";

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

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const [{ data: profile }, { data: latestProtocol }] = await Promise.all([
      admin
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("optimization_protocols")
        .select("protocol")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const protocol = latestProtocol?.protocol as OptimizationProtocol | undefined;
    const topAction = protocol?.primary_protocol?.[0];
    const title = protocol ? "Optimization protocol focus" : "Coach delivery test";
    const message =
      protocol?.coach_message ||
      protocol?.summary ||
      "This is a test proactive coach message from Aeonvera.";
    const recommendation =
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
      type: normalizeAlertType(topAction?.domain),
      severity: topAction?.impact === "high" ? "medium" : "low",
      title,
      message,
      recommendation,
      confidence: 0.8,
    };

    const { data: storedAlert, error: alertError } = await admin
      .from("health_alerts")
      .insert({
        user_id: user.id,
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

    const jarvis: JarvisMessage = {
      mode: "notification",
      tone: protocol ? "direct" : "neutral",
      message: profile?.display_name
        ? `${profile.display_name}, ${message}`
        : message,
      actions,
    };

    const delivery = await deliverCoachNotifications({
      supabase: admin,
      userId: user.id,
      alerts: [storedAlert],
      jarvis,
    });

    return NextResponse.json({
      success: true,
      delivery,
      protocol_context: Boolean(protocol),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send test coach message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeAlertType(domain?: string): LongevityAlert["type"] {
  const value = domain?.toLowerCase() || "";

  if (value.includes("sleep")) return "sleep";
  if (value.includes("recover") || value.includes("stress")) return "recovery";
  if (value.includes("nutrition") || value.includes("metabolic")) return "nutrition";
  if (value.includes("movement") || value.includes("training") || value.includes("activity")) {
    return "activity";
  }

  return "risk";
}
