import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Question = {
  id: string;
  domain: string;
  prompt: string;
  options: string[];
};

type ProtocolAction = {
  domain: string;
  action: string;
  why: string;
  cadence: string;
  impact: "low" | "medium" | "high";
};

type WeeklySequence = {
  week: string;
  focus: string;
  actions: string[];
};

type TrackingMetric = {
  metric: string;
  target: string;
  source: string;
};

type OptimizationProtocol = {
  summary: string;
  focus_domains: string[];
  primary_protocol: ProtocolAction[];
  weekly_sequence: WeeklySequence[];
  tracking_metrics: TrackingMetric[];
  coach_message: string;
};

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const answers = sanitizeAnswers(body.answers);
    const questions = sanitizeQuestions(body.questions);
    const context = sanitizeContext(body.context);

    if (!questions.length || Object.keys(answers).length < questions.length) {
      return NextResponse.json(
        { error: "Complete the optimization intake before building a protocol." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const [{ data: profile }, { data: assessment }, { data: healthState }, { data: recentReport }] =
      await Promise.all([
        admin.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        admin
          .from("longevity_assessments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("health_states")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("longevity_reports")
          .select("report, risk_score, primary_goal, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const intakeResult = await admin
      .from("optimization_intakes")
      .insert({
        user_id: user.id,
        answers,
        context,
        questions,
      })
      .select("id, created_at")
      .single();

    if (intakeResult.error) {
      return NextResponse.json(
        {
          error:
            "Optimization tables are not live yet. Apply supabase/migrations/20260610130000_optimization_protocols.sql in Supabase, then try again.",
          details: intakeResult.error.message,
        },
        { status: 500 }
      );
    }

    const generated = await generateProtocol({
      answers,
      questions,
      context,
      profile,
      assessment,
      healthState,
      recentReport,
    });

    const protocolResult = await admin
      .from("optimization_protocols")
      .insert({
        user_id: user.id,
        intake_id: intakeResult.data.id,
        protocol: generated.protocol,
        summary: generated.protocol.summary,
        focus_domains: generated.protocol.focus_domains,
        status: generated.status,
      })
      .select("id, protocol, summary, focus_domains, status, created_at")
      .single();

    if (protocolResult.error) {
      return NextResponse.json(
        { error: protocolResult.error.message },
        { status: 500 }
      );
    }

    await recordOptimizationDelivery({
      userId: user.id,
      protocolId: protocolResult.data.id,
      title: "Optimization protocol is ready",
      message: generated.protocol.coach_message || generated.protocol.summary,
    });

    return NextResponse.json({
      success: true,
      intake: intakeResult.data,
      protocol: protocolResult.data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build optimization protocol.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateProtocol(params: {
  answers: Record<string, string>;
  questions: Question[];
  context: string;
  profile: unknown;
  assessment: unknown;
  healthState: unknown;
  recentReport: unknown;
}): Promise<{ protocol: OptimizationProtocol; status: "generated" | "fallback" }> {
  const openai = getOpenAI();

  if (!openai) {
    return {
      protocol: buildFallbackProtocol(params.answers, params.context),
      status: "fallback",
    };
  }

  const prompt = `
You are Aeonvera, a proactive longevity optimization intelligence.

Build a precise optimization protocol from this user's intake and available health context.
Use the user's constraints, sleep/recovery pattern, assessment, health state, and latest report.
Be specific, measurable, and premium. Avoid medical diagnosis. Prefer lifestyle, tracking, and coachable behavior.

INTAKE ANSWERS:
${JSON.stringify(params.answers, null, 2)}

INTAKE QUESTIONS:
${JSON.stringify(params.questions, null, 2)}

USER CONTEXT:
${params.context || "No extra context provided."}

PROFILE:
${JSON.stringify(params.profile, null, 2)}

ASSESSMENT:
${JSON.stringify(params.assessment, null, 2)}

HEALTH STATE:
${JSON.stringify(params.healthState, null, 2)}

LATEST REPORT:
${JSON.stringify(params.recentReport, null, 2)}

Return raw JSON only. No markdown fences.
Schema:
{
  "summary": string,
  "focus_domains": [string],
  "primary_protocol": [
    {
      "domain": string,
      "action": string,
      "why": string,
      "cadence": string,
      "impact": "low" | "medium" | "high"
    }
  ],
  "weekly_sequence": [
    {
      "week": string,
      "focus": string,
      "actions": [string]
    }
  ],
  "tracking_metrics": [
    {
      "metric": string,
      "target": string,
      "source": string
    }
  ],
  "coach_message": string
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Aeonvera's optimization engine. Respond with strict raw JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      max_tokens: 1400,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return {
        protocol: buildFallbackProtocol(params.answers, params.context),
        status: "fallback",
      };
    }

    const parsed = JSON.parse(stripJsonFences(raw)) as Partial<OptimizationProtocol>;

    return {
      protocol: normalizeProtocol(parsed, params.answers, params.context),
      status: "generated",
    };
  } catch (error) {
    console.error(
      "[Optimization Protocol Error]",
      error instanceof Error ? error.message : error
    );

    return {
      protocol: buildFallbackProtocol(params.answers, params.context),
      status: "fallback",
    };
  }
}

function normalizeProtocol(
  protocol: Partial<OptimizationProtocol>,
  answers: Record<string, string>,
  context: string
): OptimizationProtocol {
  const fallback = buildFallbackProtocol(answers, context);

  return {
    summary: protocol.summary || fallback.summary,
    focus_domains: cleanStringArray(protocol.focus_domains, fallback.focus_domains).slice(0, 5),
    primary_protocol: cleanProtocolActions(
      protocol.primary_protocol,
      fallback.primary_protocol
    ).slice(0, 6),
    weekly_sequence: cleanWeeklySequence(
      protocol.weekly_sequence,
      fallback.weekly_sequence
    ).slice(0, 4),
    tracking_metrics: cleanTrackingMetrics(
      protocol.tracking_metrics,
      fallback.tracking_metrics
    ).slice(0, 5),
    coach_message: protocol.coach_message || fallback.coach_message,
  };
}

function buildFallbackProtocol(
  answers: Record<string, string>,
  context: string
): OptimizationProtocol {
  const priority = answers.priority || "More energy";
  const sleep = answers.sleep || "Inconsistent schedule";
  const nutrition = answers.nutrition || "Protein consistency";
  const training = answers.training || "Inconsistent";
  const metabolic = answers.metabolic || "Glucose stability";
  const stress = answers.stress || "Evening recovery";
  const cognitive = answers.cognitive || "Calm focus";

  return {
    summary: `Your first protocol prioritizes ${priority.toLowerCase()} by tightening sleep, nutrition, movement, and recovery into one measurable rhythm.`,
    focus_domains: ["Sleep", "Metabolic", "Movement", "Recovery"],
    primary_protocol: [
      {
        domain: "Sleep",
        action: `Stabilize the factor most limiting recovery: ${sleep.toLowerCase()}.`,
        why: "Sleep consistency is the highest-leverage signal for recovery, appetite control, glucose stability, and cognitive output.",
        cadence: "Nightly for 14 days",
        impact: "high",
      },
      {
        domain: "Nutrition",
        action: `Build the first meal around ${nutrition.toLowerCase()} and repeat it on workdays.`,
        why: "A repeatable nutrition anchor reduces decision fatigue and improves metabolic predictability.",
        cadence: "5 days per week",
        impact: "medium",
      },
      {
        domain: "Movement",
        action: `Convert your current pattern (${training.toLowerCase()}) into three planned movement blocks.`,
        why: "Planned movement improves adherence and gives Aeonvera a cleaner signal to optimize against.",
        cadence: "3 sessions per week",
        impact: "high",
      },
      {
        domain: "Metabolic",
        action: `Track the metabolic signal you chose first: ${metabolic.toLowerCase()}.`,
        why: "The protocol should improve one measurable metabolic signal before expanding complexity.",
        cadence: "Weekly review",
        impact: "medium",
      },
      {
        domain: "Stress",
        action: `Protect the point where stress most affects you: ${stress.toLowerCase()}.`,
        why: "Lower friction recovery windows improve sleep onset, training readiness, and dietary consistency.",
        cadence: "Daily 10-minute reset",
        impact: "medium",
      },
      {
        domain: "Cognition",
        action: `Schedule one protected block for ${cognitive.toLowerCase()}.`,
        why: "Cognitive performance improves when energy, sleep, and stress interventions are tied to a real weekly output.",
        cadence: "2 blocks per week",
        impact: "medium",
      },
    ],
    weekly_sequence: [
      {
        week: "1-2",
        focus: "Stabilize baseline",
        actions: ["Lock wake time", "Choose the repeatable first meal", "Complete three movement blocks"],
      },
      {
        week: "3-4",
        focus: "Increase precision",
        actions: ["Review resting heart rate and sleep trend", "Adjust training intensity", "Tighten evening recovery"],
      },
      {
        week: "5-8",
        focus: "Compound gains",
        actions: ["Add one advanced metabolic lever", "Progress strength or zone-2 volume", "Regenerate the protocol"],
      },
    ],
    tracking_metrics: [
      { metric: "Resting heart rate", target: "Stable or down 2-4 bpm", source: "Wearable or manual check-in" },
      { metric: "Sleep duration", target: "7.5+ hours average", source: "Wearable or assessment" },
      { metric: "Training adherence", target: "3 planned sessions weekly", source: "Manual check-in" },
      { metric: "Energy", target: "Higher morning score", source: "Optimization intake" },
    ],
    coach_message: context
      ? "I used your extra context to keep this protocol realistic. Start with the first two weeks, then I will adapt it from your trend data."
      : "Start with the first two weeks. Once your wearable and check-in signals update, I will adapt the protocol automatically.",
  };
}

async function recordOptimizationDelivery({
  userId,
  protocolId,
  title,
  message,
}: {
  userId: string;
  protocolId: string;
  title: string;
  message: string;
}) {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("notification_deliveries").insert({
      user_id: userId,
      channel: "in_app",
      status: "sent",
      title,
      message,
      payload: {
        source: "optimization_protocol",
        protocol_id: protocolId,
      },
      sent_at: new Date().toISOString(),
    });

    if (error && !isMissingNotificationTable(error)) {
      console.error("[Optimization Delivery Error]", error.message);
    }
  } catch (error) {
    console.error(
      "[Optimization Delivery Error]",
      error instanceof Error ? error.message : error
    );
  }
}

function sanitizeAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .flatMap(([key, answer]) =>
        key && typeof answer === "string"
          ? [[key.slice(0, 64), answer.slice(0, 160)]]
          : []
      )
  );
}

function sanitizeQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((question) => {
      if (!question || typeof question !== "object") return null;
      const candidate = question as Record<string, unknown>;

      if (
        typeof candidate.id !== "string" ||
        typeof candidate.domain !== "string" ||
        typeof candidate.prompt !== "string"
      ) {
        return null;
      }

      return {
        id: candidate.id.slice(0, 64),
        domain: candidate.domain.slice(0, 80),
        prompt: candidate.prompt.slice(0, 220),
        options: Array.isArray(candidate.options)
          ? candidate.options
              .filter((option): option is string => typeof option === "string")
              .map((option) => option.slice(0, 120))
              .slice(0, 8)
          : [],
      };
    })
    .filter((question): question is Question => Boolean(question));
}

function sanitizeContext(value: unknown) {
  return typeof value === "string" ? value.slice(0, 2400) : "";
}

function stripJsonFences(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function cleanStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value.filter((item): item is string => typeof item === "string");
  return cleaned.length ? cleaned : fallback;
}

function cleanProtocolActions(value: unknown, fallback: ProtocolAction[]) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const action = item as Record<string, unknown>;

      if (
        typeof action.domain !== "string" ||
        typeof action.action !== "string" ||
        typeof action.why !== "string" ||
        typeof action.cadence !== "string"
      ) {
        return null;
      }

      return {
        domain: action.domain,
        action: action.action,
        why: action.why,
        cadence: action.cadence,
        impact: normalizeImpact(action.impact),
      };
    })
    .filter((item): item is ProtocolAction => Boolean(item));

  return cleaned.length ? cleaned : fallback;
}

function cleanWeeklySequence(value: unknown, fallback: WeeklySequence[]) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const sequence = item as Record<string, unknown>;

      if (
        typeof sequence.week !== "string" ||
        typeof sequence.focus !== "string" ||
        !Array.isArray(sequence.actions)
      ) {
        return null;
      }

      return {
        week: sequence.week,
        focus: sequence.focus,
        actions: sequence.actions.filter(
          (action): action is string => typeof action === "string"
        ),
      };
    })
    .filter((item): item is WeeklySequence => Boolean(item));

  return cleaned.length ? cleaned : fallback;
}

function cleanTrackingMetrics(value: unknown, fallback: TrackingMetric[]) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const metric = item as Record<string, unknown>;

      if (
        typeof metric.metric !== "string" ||
        typeof metric.target !== "string" ||
        typeof metric.source !== "string"
      ) {
        return null;
      }

      return {
        metric: metric.metric,
        target: metric.target,
        source: metric.source,
      };
    })
    .filter((item): item is TrackingMetric => Boolean(item));

  return cleaned.length ? cleaned : fallback;
}

function normalizeImpact(value: unknown): ProtocolAction["impact"] {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

function isMissingNotificationTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("notification_deliveries") ||
    error.message?.includes("schema cache")
  );
}
