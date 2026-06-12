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

type ClinicalResponseInterpretation = {
  action?: {
    detail: string;
    label: string;
    type: string;
  } | null;
  safetyLevel: "routine" | "monitor" | "medical_review" | "urgent";
  status: "active" | "improving" | "unresolved" | "dismissed" | "monitoring";
  statusReason: string;
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
  const interpretation = inferClinicalStatus(cleanAnswer);
  const question = firstString(row.follow_up_questions);
  const metadata = buildResponseMetadata({
    answer: cleanAnswer,
    insight: row,
    interpretation,
    question,
    source,
  });

  const { error: updateError } = await supabase
    .from("clinical_insights")
    .update({
      concern_status: interpretation.status,
      metadata,
      resolved_at: interpretation.status === "dismissed" ? new Date().toISOString() : null,
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
    interpretation,
    supabase,
    userId,
  });

  return {
    action: interpretation.action || planAction,
    insightId: clinicalInsightId,
    question,
    safetyLevel: interpretation.safetyLevel,
    status: interpretation.status,
    statusReason: interpretation.statusReason,
  };
}

function buildResponseMetadata({
  answer,
  insight,
  interpretation,
  question,
  source,
}: {
  answer: string;
  insight: ClinicalInsightRow;
  interpretation: ClinicalResponseInterpretation;
  question: string;
  source: string;
}) {
  const current = isRecord(insight.metadata) ? insight.metadata : {};
  const responses = Array.isArray(current.follow_up_responses)
    ? current.follow_up_responses.slice(-5)
    : [];

  return {
    ...current,
    last_answered_at: new Date().toISOString(),
    last_answer_status: interpretation.status,
    safety_level: interpretation.safetyLevel,
    status_reason: interpretation.statusReason,
    follow_up_responses: [
      ...responses,
      {
        answer,
        answered_at: new Date().toISOString(),
        interpreted_status: interpretation.status,
        question,
        safety_level: interpretation.safetyLevel,
        status_reason: interpretation.statusReason,
        source,
      },
    ],
  };
}

async function maybePrepareClinicalAction({
  answer,
  insight,
  interpretation,
  supabase,
  userId,
}: {
  answer: string;
  insight: ClinicalInsightRow;
  interpretation: ClinicalResponseInterpretation;
  supabase: SupabaseClient;
  userId: string;
}) {
  const status = interpretation.status;
  if (status === "dismissed" || status === "improving") return null;
  if (interpretation.safetyLevel === "urgent" || interpretation.safetyLevel === "medical_review") {
    return null;
  }

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
      safety_level: interpretation.safetyLevel,
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

  if (hasUrgentRedFlag(lower)) {
    return {
      action: {
        type: "clinical_medical_review_recommended",
        label: "Medical review recommended",
        detail:
          "Aeonvera detected a potential red-flag symptom in the follow-up answer. Seek urgent medical care or local emergency support if symptoms are severe, sudden, or worsening.",
      },
      safetyLevel: "urgent",
      status: "unresolved",
      statusReason: "Potential red-flag symptoms were mentioned.",
    } satisfies ClinicalResponseInterpretation;
  }

  if (hasMedicalReviewSignal(lower)) {
    return {
      action: {
        type: "clinical_medical_review_recommended",
        label: "Clinician review recommended",
        detail:
          "Aeonvera marked this thread for clinician review before turning it into an optimization protocol.",
      },
      safetyLevel: "medical_review",
      status: "unresolved",
      statusReason: "The answer mentions symptoms or clinical findings that deserve medical review.",
    } satisfies ClinicalResponseInterpretation;
  }

  if (/(dismiss|ignore|not relevant|false alarm|stop tracking|remove this)/.test(lower)) {
    return {
      action: null,
      safetyLevel: "routine",
      status: "dismissed",
      statusReason: "User dismissed the clinical thread.",
    } satisfies ClinicalResponseInterpretation;
  }

  if (/(better|improved|improving|resolved|gone|stable now|back to normal|symptoms resolved|feel normal)/.test(lower)) {
    return {
      action: null,
      safetyLevel: "monitor",
      status: "improving",
      statusReason: "User reports improvement or resolution; continue monitoring durability.",
    } satisfies ClinicalResponseInterpretation;
  }

  if (/(worse|worsening|still|same|not better|continues|ongoing|higher|up|problem)/.test(lower)) {
    return {
      action: null,
      safetyLevel: "monitor",
      status: "unresolved",
      statusReason: "User reports persistence or worsening.",
    } satisfies ClinicalResponseInterpretation;
  }

  return {
    action: null,
    safetyLevel: "routine",
    status: "monitoring",
    statusReason: "Answer was saved for trend monitoring without clear improvement or worsening.",
  } satisfies ClinicalResponseInterpretation;
}

function hasUrgentRedFlag(lower: string) {
  return /(\bchest pain\b|pressure in my chest|stroke|face droop|slurred speech|one-sided weakness|severe shortness of breath|can't breathe|cannot breathe|fainted|fainting|passed out|suicidal|kill myself|severe allergic|anaphylaxis|blood pressure.*(180|190|200)|hypertensive crisis)/.test(
    lower
  );
}

function hasMedicalReviewSignal(lower: string) {
  return /(sleep apnea|stop breathing|blood in stool|black stool|unexplained weight loss|heart palpitations|irregular heartbeat|new severe headache|abnormal lab|very high|very low|testosterone|thyroid medication|trt|statin|metformin|medication)/.test(
    lower
  );
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
