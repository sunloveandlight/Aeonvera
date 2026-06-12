import type { SupabaseClient } from "@supabase/supabase-js";

type ClinicalInsightRow = {
  id: string;
  user_id: string;
  answer_summary?: string | null;
  domains?: string[] | null;
  concern_status?: string | null;
  follow_up_questions?: unknown;
  recommended_actions?: unknown;
  metadata?: unknown;
};

type DailyPlanRow = {
  id?: string | null;
  plan_date?: string | null;
  status?: string | null;
  autopilot_mode?: string | null;
  plan?: {
    items?: Array<Record<string, unknown>>;
    principles?: string[];
    [key: string]: unknown;
  } | null;
};

export async function recordClinicalFollowUpAnswer({
  answer,
  clinicalInsightId,
  source = "agent_chat",
  supabase,
  userId,
}: {
  answer: string;
  clinicalInsightId: string;
  source?: "agent_chat" | "voice_agent" | "system";
  supabase: SupabaseClient;
  userId: string;
}) {
  const cleanAnswer = answer.trim().slice(0, 4000);
  if (!cleanAnswer || !clinicalInsightId) {
    return null;
  }

  const { data: insight, error } = await supabase
    .from("clinical_insights")
    .select(
      "id,user_id,answer_summary,domains,concern_status,follow_up_questions,recommended_actions,metadata"
    )
    .eq("id", clinicalInsightId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (!isMissingClinicalTable(error)) {
      console.error("[Clinical Follow-up Response Load Error]", error.message);
    }

    return null;
  }

  if (!insight) return null;

  const row = insight as ClinicalInsightRow;
  const status = inferClinicalStatus(cleanAnswer);
  const question = firstString(row.follow_up_questions);
  const metadata = buildResponseMetadata({
    answer: cleanAnswer,
    insight: row,
    question,
    source,
    status,
  });

  const { error: updateError } = await supabase
    .from("clinical_insights")
    .update({
      concern_status: status,
      metadata,
      resolved_at: status === "dismissed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clinicalInsightId)
    .eq("user_id", userId);

  if (updateError) {
    if (!isMissingClinicalTable(updateError)) {
      console.error("[Clinical Follow-up Response Update Error]", updateError.message);
    }

    return null;
  }

  const planAction = await maybePrepareClinicalAction({
    answer: cleanAnswer,
    insight: row,
    status,
    supabase,
    userId,
  });

  return {
    action: planAction,
    insightId: clinicalInsightId,
    question,
    status,
  };
}

function buildResponseMetadata({
  answer,
  insight,
  question,
  source,
  status,
}: {
  answer: string;
  insight: ClinicalInsightRow;
  question: string;
  source: string;
  status: string;
}) {
  const current = isRecord(insight.metadata) ? insight.metadata : {};
  const responses = Array.isArray(current.follow_up_responses)
    ? current.follow_up_responses.slice(-5)
    : [];

  return {
    ...current,
    last_answered_at: new Date().toISOString(),
    last_answer_status: status,
    follow_up_responses: [
      ...responses,
      {
        answer,
        answered_at: new Date().toISOString(),
        interpreted_status: status,
        question,
        source,
      },
    ],
  };
}

async function maybePrepareClinicalAction({
  answer,
  insight,
  status,
  supabase,
  userId,
}: {
  answer: string;
  insight: ClinicalInsightRow;
  status: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  if (status === "dismissed" || status === "improving") return null;

  const recommendedAction = firstRecommendedAction(insight.recommended_actions);
  if (!recommendedAction) return null;

  const lower = answer.toLowerCase();
  const shouldPrepare =
    status === "unresolved" ||
    /(yes|please|do it|add|plan|protocol|schedule|help me|need|want)/.test(lower);

  if (!shouldPrepare) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_execution_plans")
    .select("id,plan_date,status,autopilot_mode,plan")
    .eq("user_id", userId)
    .eq("plan_date", today)
    .maybeSingle();

  const currentPlan = (data as DailyPlanRow | null)?.plan || {};
  const existingItems = Array.isArray(currentPlan.items) ? currentPlan.items : [];
  const domains = insight.domains?.join(" / ") || "Clinical";
  const item = {
    ...recommendedAction,
    actionIndex: 0,
    adaptation_reason: `Prepared from clinical follow-up response: ${answer.slice(0, 220)}`,
    domain: recommendedAction.domain || domains,
    execution_mode: "approve",
    scope: "today",
  };
  const items = dedupeItems([item, ...existingItems]).slice(0, 5);
  const plan = {
    ...currentPlan,
    summary: "Aeonvera updated today from your clinical follow-up.",
    items,
    principles: [
      ...(Array.isArray(currentPlan.principles) ? currentPlan.principles : []),
      "Close the clinical loop with the smallest measurable next action.",
    ].slice(0, 5),
    clinical_follow_up: {
      answered_at: new Date().toISOString(),
      insight_id: insight.id,
      status,
    },
  };

  const { error } = await supabase.from("daily_execution_plans").upsert(
    {
      id: data?.id || undefined,
      user_id: userId,
      plan_date: today,
      status: "prepared",
      autopilot_mode: data?.autopilot_mode || "approve",
      summary: plan.summary,
      plan,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,plan_date" }
  );

  if (error) {
    if (!isMissingPlanTable(error)) {
      console.error("[Clinical Follow-up Plan Update Error]", error.message);
    }

    return null;
  }

  return {
    type: "clinical_follow_up_plan_updated",
    label: "Clinical plan updated",
    detail: "Aeonvera translated your follow-up answer into today’s active plan.",
  };
}

function inferClinicalStatus(answer: string) {
  const lower = answer.toLowerCase();

  if (/(dismiss|ignore|not relevant|false alarm|stop tracking|remove this)/.test(lower)) {
    return "dismissed";
  }

  if (/(better|improved|improving|resolved|gone|lower|down|stable now|back to normal)/.test(lower)) {
    return "improving";
  }

  if (/(worse|worsening|still|same|not better|continues|ongoing|higher|up|problem)/.test(lower)) {
    return "unresolved";
  }

  return "monitoring";
}

function firstString(value: unknown) {
  if (!Array.isArray(value)) return "";
  const first = value.find((item) => typeof item === "string" && item.trim());
  return typeof first === "string" ? first.trim() : "";
}

function firstRecommendedAction(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) return null;

  for (const item of value) {
    if (isRecord(item) && typeof item.action === "string" && item.action.trim()) {
      return item;
    }

    if (typeof item === "string" && item.trim()) {
      return {
        action: item.trim(),
        domain: "Clinical",
        why: "Prepared from clinical follow-up.",
      };
    }
  }

  return null;
}

function dedupeItems(items: Array<Record<string, unknown>>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.action || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isMissingClinicalTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("clinical_insights") ||
    error.message?.includes("schema cache")
  );
}

function isMissingPlanTable(error: { message?: string; code?: string }) {
  return (
    error.code === "PGRST205" ||
    error.message?.includes("daily_execution_plans") ||
    error.message?.includes("schema cache")
  );
}
