import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import OpenAI from "openai";
import { cookies } from "next/headers";

import { computeAdaptiveWeights } from "@/lib/personalization/adaptiveWeightEngine";
import { buildConversationMemory } from "@/lib/memory/conversationMemoryEngine";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Plan, SubscriptionStatus } from "@/lib/auth/permissions";
import {
  checkAndRecordUsage,
  serializeUsage,
  usageErrorResponse,
} from "@/lib/usage/tierUsage";
import {
  getRequestedHealthProfileId,
  getHealthSubjectFilter,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

let openaiClient: OpenAI | null = null;

type CookieToSet = {
  name: string;
  options?: CookieOptions;
  value: string;
};

type GeneratedLongevityReport = {
  risk_score?: number;
  primary_goal?: string;
  risk_profile?: {
    sleep_risk?: "low" | "medium" | "high";
    metabolic_risk?: "low" | "medium" | "high";
    cardiovascular_risk?: "low" | "medium" | "high";
    lifestyle_risk?: "low" | "medium" | "high";
  };
  strengths?: string[];
  weaknesses?: string[];
  top_priorities?: string[];
  "90_day_plan"?: Array<{
    category: string;
    action: string;
    impact: "low" | "medium" | "high";
  }>;
  behavioral_insights?: string[];
};

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

async function getSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function POST() {
  try {
    const supabase = await getSupabase();
    const cookieStore = await cookies();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: userId,
      requestedHealthProfileId: getRequestedHealthProfileId({ cookies: cookieStore }),
    });
    const healthSubjectFilter = getHealthSubjectFilter(healthProfileContext);

    /**
     * STEP 1 — CORE DATA
     */
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const usage = await checkAndRecordUsage({
      healthProfileId: healthProfileContext.healthProfileId,
      metadata: { source: "longevity_report" },
      meter: "report_generation",
      plan: (profile?.plan as Plan | null) || null,
      status: (profile?.subscription_status as SubscriptionStatus | null) || null,
      supabase: admin,
      userId,
    });

    if (!usage.allowed) {
      return NextResponse.json(
        usageErrorResponse(usage),
        { status: usage.statusCode || 429 }
      );
    }

    const { data: assessment } = await supabase
      .from("longevity_assessments")
      .select("*")
      .eq(healthSubjectFilter.column, healthSubjectFilter.value)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    /**
     * STEP 2 — HEALTH STATE
     */
    const { data: state } = await supabase
      .from("health_states")
      .select("*")
      .eq(healthSubjectFilter.column, healthSubjectFilter.value)
      .single();

    /**
     * STEP 3 — BEHAVIOR MEMORY
     */
    const { data: behaviorEvents } = await supabase
      .from("behavior_events")
      .select("*")
      .eq(healthSubjectFilter.column, healthSubjectFilter.value);

    const adaptiveWeights = computeAdaptiveWeights(
      (behaviorEvents || []).map((e) => ({
        userId,
        eventType: e.event_type,
        reference: e.reference,
        outcome: e.outcome,
        timestamp: e.created_at,
      }))
    );

    /**
     * STEP 4 — CONVERSATION MEMORY
     */
    const { data: conversationEvents } = await supabase
      .from("conversation_events")
      .select("*")
      .eq(healthSubjectFilter.column, healthSubjectFilter.value)
      .order("timestamp", { ascending: true })
      .limit(50);

    const conversationMemory = buildConversationMemory(
      (conversationEvents || []).map((c) => ({
        userId,
        role: c.role,
        content: c.content,
        timestamp: c.timestamp,
        tags: c.tags,
      }))
    );

    /**
     * STEP 5 — PROMPT
     */
    const prompt = `
You are Aeonvera, a longevity intelligence system.

You are now FULLY MEMORY-AWARE.

You maintain continuity across time.

---

## CONVERSATION MEMORY (CRITICAL CONTEXT)
${JSON.stringify(conversationMemory, null, 2)}

---

## BEHAVIOR ADAPTATION SIGNALS
${JSON.stringify(adaptiveWeights, null, 2)}

---

## USER PROFILE
${JSON.stringify(profile, null, 2)}

---

## HEALTH STATE
${JSON.stringify(state, null, 2)}

---

## ASSESSMENT
${JSON.stringify(assessment, null, 2)}

---

IMPORTANT RULES:

- You are not generating a one-off report.
- You are continuing an ongoing relationship with the user.
- You MUST remain consistent with prior emotional tone and context.
- You MUST adapt recommendations based on:
  - behavior adherence
  - conversation history
  - health trends

---

OUTPUT FORMAT (JSON ONLY — no markdown fences, no preamble, raw JSON only):

{
  "risk_score": number,
  "primary_goal": string,
  "risk_profile": {
    "sleep_risk": "low" | "medium" | "high",
    "metabolic_risk": "low" | "medium" | "high",
    "cardiovascular_risk": "low" | "medium" | "high",
    "lifestyle_risk": "low" | "medium" | "high"
  },
  "strengths": [string],
  "weaknesses": [string],
  "top_priorities": [string],
  "90_day_plan": [
    {
      "category": string,
      "action": string,
      "impact": "low" | "medium" | "high"
    }
  ],
  "behavioral_insights": [string]
}
`;

    /**
     * STEP 6 — AI CALL
     */
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a persistent adaptive longevity intelligence. Memory is core to your reasoning. Always respond with raw JSON only — no markdown fences, no extra text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return NextResponse.json({ error: "No AI response" }, { status: 500 });
    }

    /**
     * STEP 7 — STRIP MARKDOWN FENCES BEFORE PARSING
     * GPT models sometimes wrap JSON in ```json ... ``` blocks
     */
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let report: ReturnType<typeof calibrateReportFromAssessment>;
    try {
      report = calibrateReportFromAssessment(
        JSON.parse(cleaned) as GeneratedLongevityReport,
        assessment as Record<string, unknown> | null
      );
    } catch {
      return NextResponse.json(
        { error: "Invalid AI JSON output", raw: cleaned },
        { status: 500 }
      );
    }

    /**
     * STEP 8 — SAVE REPORT
     */
    const { data, error } = await supabase
      .from("longevity_reports")
      .insert({
        ...healthSubjectInsertFields(healthProfileContext),
        user_id: userId,
        assessment_id: assessment?.id,
        report,
        risk_score: report.risk_score,
        primary_goal: report.primary_goal,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const alertSeverity =
      Number(report.risk_score) >= 70
        ? "high"
        : Number(report.risk_score) >= 45
        ? "medium"
        : "low";

    const { data: alert } = await supabase
      .from("health_alerts")
      .insert({
        ...healthSubjectInsertFields(healthProfileContext),
        user_id: userId,
        type: "longevity_report",
        severity: alertSeverity,
        title: "New longevity report is ready",
        message:
          "Aeonvera generated a new biological intelligence report from your latest assessment.",
        recommendation:
          report.top_priorities?.[0] ||
          report.primary_goal ||
          "Review your updated 90-day longevity protocol.",
        confidence: 0.82,
      })
      .select()
      .single();

    const notification = await recordReportNotification({
      healthProfileId: healthProfileContext.healthProfileId,
      userId,
      title: "New longevity report is ready",
      message:
        report.top_priorities?.[0] ||
        report.primary_goal ||
        "Review your updated 90-day longevity protocol.",
      riskScore: report.risk_score,
      alertId: isUuid(alert?.id) ? alert.id : undefined,
    });

    /**
     * STEP 9 — RESPONSE
     */
    return NextResponse.json({
      success: true,
      report: data,
      alert,
      notification,
      memory: conversationMemory,
      adaptive_weights: adaptiveWeights,
      usage: serializeUsage(usage),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

async function recordReportNotification({
  healthProfileId,
  userId,
  title,
  message,
  riskScore,
  alertId,
}: {
  healthProfileId?: string | null;
  userId: string;
  title: string;
  message: string;
  riskScore: number;
  alertId?: string;
}) {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("notification_deliveries")
      .insert({
        ...(healthProfileId ? { health_profile_id: healthProfileId } : {}),
        user_id: userId,
        alert_id: alertId,
        channel: "in_app",
        status: "sent",
        title,
        message,
        payload: {
          source: "longevity_report",
          risk_score: riskScore,
        },
        sent_at: new Date().toISOString(),
      })
      .select("id, channel, status, title, message, payload, error, created_at, sent_at")
      .single();

    if (error) {
      if (!isMissingNotificationTable(error)) {
        console.error("[Report Notification Error]", error.message);
      }

      return null;
    }

    return data;
  } catch (error) {
    console.error(
      "[Report Notification Error]",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

function calibrateReportFromAssessment(
  report: GeneratedLongevityReport,
  assessment: Record<string, unknown> | null
): GeneratedLongevityReport & {
  primary_goal: string;
  risk_profile: NonNullable<GeneratedLongevityReport["risk_profile"]>;
  risk_score: number;
  top_priorities: string[];
} {
  const sleepQuality = numberFromAssessment(assessment?.sleep_quality);
  const sleepHours = numberFromAssessment(assessment?.sleep_hours);
  const exerciseDays = numberFromAssessment(assessment?.exercise_days);
  const stressLevel = numberFromAssessment(assessment?.stress_level);
  const smoking = String(assessment?.smoking || "").toLowerCase();
  const alcoholUse = String(assessment?.alcohol_use || "").toLowerCase();

  const poorSleep =
    (sleepQuality !== null && sleepQuality <= 3) ||
    (sleepHours !== null && sleepHours < 6);
  const sedentary = exerciseDays !== null && exerciseDays <= 1;
  const highStress = stressLevel !== null && stressLevel >= 8;
  const currentSmoking = smoking.includes("current") || smoking === "yes";
  const highAlcohol = alcoholUse.includes("heavy") || alcoholUse.includes("daily");

  let riskFloor = 25;
  if (poorSleep) riskFloor = Math.max(riskFloor, 52);
  if (sedentary) riskFloor = Math.max(riskFloor, 52);
  if (poorSleep && sedentary) riskFloor = Math.max(riskFloor, 66);
  if (highStress) riskFloor = Math.max(riskFloor, 58);
  if (currentSmoking) riskFloor = Math.max(riskFloor, 72);
  if (highAlcohol) riskFloor = Math.max(riskFloor, 60);

  const modelScore = Number(report.risk_score);
  const riskScore = Math.min(
    100,
    Math.max(Number.isFinite(modelScore) ? Math.round(modelScore) : 50, riskFloor)
  );

  const riskProfile = {
    sleep_risk: report.risk_profile?.sleep_risk || "low",
    metabolic_risk: report.risk_profile?.metabolic_risk || "low",
    cardiovascular_risk: report.risk_profile?.cardiovascular_risk || "low",
    lifestyle_risk: report.risk_profile?.lifestyle_risk || "low",
  };

  if (poorSleep) riskProfile.sleep_risk = sleepQuality !== null && sleepQuality <= 2 ? "high" : "medium";
  if (sedentary || currentSmoking || highAlcohol) {
    riskProfile.lifestyle_risk = currentSmoking || (poorSleep && sedentary) ? "high" : "medium";
  }

  const topPriorities = Array.isArray(report.top_priorities) ? [...report.top_priorities] : [];
  if (poorSleep && !topPriorities.some((priority) => /sleep|recovery/i.test(priority))) {
    topPriorities.unshift("Stabilize sleep and recovery quality");
  }
  if (sedentary && !topPriorities.some((priority) => /activity|exercise|training/i.test(priority))) {
    topPriorities.unshift("Increase weekly physical activity");
  }

  return {
    ...report,
    primary_goal: report.primary_goal || "Improve biological resilience",
    risk_profile: riskProfile,
    risk_score: riskScore,
    top_priorities: topPriorities.slice(0, 5),
  };
}

function numberFromAssessment(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isMissingNotificationTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("notification_deliveries") ||
    error.message?.includes("schema cache")
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}
