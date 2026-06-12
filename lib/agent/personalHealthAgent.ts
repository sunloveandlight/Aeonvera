import OpenAI from "openai";
import { loadOrBuildCoachMemoryProfile } from "@/lib/memory/coachMemoryProfile";
import type { getSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

type ProtocolAction = {
  domain?: string | null;
  action?: string | null;
  why?: string | null;
  cadence?: string | null;
  impact?: string | null;
};

type ProtocolRow = {
  id: string;
  summary?: string | null;
  focus_domains?: string[] | null;
  status?: string | null;
  protocol?: {
    summary?: string;
    primary_protocol?: ProtocolAction[];
    coach_message?: string;
  } | null;
  created_at?: string | null;
};

type DailyPlanRow = {
  id?: string | null;
  plan_date?: string | null;
  status?: string | null;
  autopilot_mode?: string | null;
  summary?: string | null;
  plan?: {
    items?: ProtocolAction[];
    memory?: Record<string, unknown>;
    principles?: string[];
  } | null;
  updated_at?: string | null;
};

type ExecutionRow = {
  domain?: string | null;
  action?: string | null;
  outcome?: string | null;
  success?: boolean | null;
  notes?: string | null;
  measured_at?: string | null;
  created_at?: string | null;
};

type CalendarRow = {
  title?: string | null;
  action?: string | null;
  action_scope?: string | null;
  recurrence?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
};

type NotificationRow = {
  title?: string | null;
  message?: string | null;
  channel?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type LabRow = {
  canonical_key?: string | null;
  raw_label?: string | null;
  value?: number | string | null;
  unit?: string | null;
  measured_at?: string | null;
};

type HealthMetricRow = {
  metric?: string | null;
  metric_name?: string | null;
  value?: number | string | null;
  metric_value?: number | string | null;
  source?: string | null;
  measured_at?: string | null;
  recorded_at?: string | null;
};

type BiologicalAgeRow = {
  biological_age?: number | string | null;
  chronological_age?: number | string | null;
  age_delta?: number | string | null;
  score?: number | string | null;
  category?: string | null;
  source?: string | null;
  created_at?: string | null;
};

type AssessmentRow = Record<string, unknown> & {
  age?: number | string | null;
  primary_goal?: string | null;
  created_at?: string | null;
};

type HealthStateRow = {
  baseline?: unknown;
  risk_scores?: unknown;
  insights?: unknown;
  updated_at?: string | null;
};

type PreferenceRow = {
  category?: string | null;
  preference_key?: string | null;
  preference_value?: string | null;
  confidence?: number | string | null;
  updated_at?: string | null;
};

type AgentAction = {
  type:
    | "plan_simplified"
    | "preference_saved"
    | "reschedule_requested"
    | "notification_preference_saved"
    | "clinical_plan_prepared";
  label: string;
  detail: string;
};

type RangeFlag = {
  marker: string;
  value: string;
  status: "optimal" | "watch" | "elevated" | "low" | "unknown";
  interpretation: string;
  nextStep: string;
};

type ClinicalDomainInsight = {
  domain: string;
  completeness: number;
  present: string[];
  missing: string[];
  priority: "high" | "medium" | "low";
  reason: string;
};

type AgentToolResults = {
  clinicalSignalMap: ClinicalDomainInsight[];
  rangeFlags: RangeFlag[];
  followUpQuestions: string[];
  recommendedActions: ProtocolAction[];
  answerMode: "clinical_deep_dive" | "execution_agent" | "general_agent";
};

type AgentContext = {
  memory: Awaited<ReturnType<typeof loadOrBuildCoachMemoryProfile>>;
  protocol: ProtocolRow | null;
  dailyPlan: DailyPlanRow | null;
  outcomes: ExecutionRow[];
  calendarEvents: CalendarRow[];
  notifications: NotificationRow[];
  preferences: PreferenceRow[];
  labs: LabRow[];
  healthMetrics: HealthMetricRow[];
  wearableMetrics: HealthMetricRow[];
  biologicalAge: BiologicalAgeRow | null;
  assessment: AssessmentRow | null;
  healthState: HealthStateRow | null;
};

const CLINICAL_LONGEVITY_DOMAINS = [
  {
    domain: "Circadian Biology & Sleep Architecture",
    signals: [
      "bedtime",
      "wake time",
      "sleep latency",
      "night awakenings",
      "deep sleep",
      "REM sleep",
      "sleep quality",
      "snoring",
      "sleep apnea risk",
    ],
  },
  {
    domain: "Metabolic Flexibility",
    signals: [
      "fasting glucose",
      "fasting insulin",
      "HbA1c",
      "triglycerides",
      "HDL",
      "waist circumference",
      "carbohydrate response",
      "fasting response",
    ],
  },
  {
    domain: "Cardiovascular Performance",
    signals: [
      "resting heart rate",
      "sleeping heart rate",
      "HRV",
      "blood pressure",
      "VO2 max",
      "recovery heart rate",
      "family cardiovascular history",
    ],
  },
  {
    domain: "Inflammation & Recovery",
    signals: ["hs-CRP", "homocysteine", "ferritin", "ESR", "fibrinogen", "training soreness", "recovered days"],
  },
  {
    domain: "Hormonal Optimization",
    signals: [
      "testosterone",
      "free testosterone",
      "SHBG",
      "LH",
      "FSH",
      "estradiol",
      "progesterone",
      "TSH",
      "Free T3",
      "Free T4",
      "morning cortisol",
    ],
  },
  {
    domain: "Body Composition & Sarcopenia Risk",
    signals: [
      "height",
      "weight",
      "body fat",
      "lean mass",
      "grip strength",
      "visceral fat",
      "resistance training",
      "aerobic training",
      "mobility",
    ],
  },
  {
    domain: "Cognitive Longevity",
    signals: [
      "memory",
      "processing speed",
      "focus",
      "emotional regulation",
      "learning capacity",
      "brain fog",
      "executive function",
    ],
  },
  {
    domain: "Nutrition & Micronutrient Density",
    signals: [
      "diet pattern",
      "fatty fish",
      "fermented foods",
      "vegetables",
      "ultra-processed foods",
      "alcohol",
      "vitamin D",
      "magnesium",
      "omega-3",
      "creatine",
    ],
  },
  {
    domain: "Biological Age & Stress Resilience",
    signals: [
      "psychological stress",
      "anxiety",
      "burnout",
      "emotional exhaustion",
      "biological age",
      "epigenetic age",
      "telomere length",
    ],
  },
  {
    domain: "Longevity Risk Stratification",
    signals: [
      "cancer history",
      "neurodegenerative disease history",
      "diabetes history",
      "cardiovascular history",
      "autoimmune history",
      "priority goal",
    ],
  },
];

let openaiClient: OpenAI | null = null;
let xaiClient: OpenAI | null = null;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

function getXAI() {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) return null;

  if (!xaiClient) {
    xaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.XAI_BASE_URL || "https://api.x.ai/v1",
    });
  }

  return xaiClient;
}

export async function answerPersonalHealthAgent({
  history,
  question,
  supabase,
  userId,
}: {
  history: AgentMessage[];
  question: string;
  supabase: SupabaseAdmin;
  userId: string;
}) {
  const context = await loadAgentContext(supabase, userId);
  const actions = await applyAgentInstructions({ context, question, supabase, userId });
  const updatedContext = actions.length ? await loadAgentContext(supabase, userId) : context;
  const toolResults = buildAgentToolResults(updatedContext, question);
  const toolActions = await applyAgentToolActions({
    context: updatedContext,
    question,
    supabase,
    toolResults,
    userId,
  });
  const finalContext = toolActions.length ? await loadAgentContext(supabase, userId) : updatedContext;
  const allActions = dedupeActions([...actions, ...toolActions]);
  const openai = getOpenAI();
  const xaiClinicalReview = await buildXaiClinicalReview(question, finalContext, history);

  if (!openai && xaiClinicalReview) {
    return {
      actions: allActions,
      answer: xaiClinicalReview,
      mode: "generated" as const,
      context: finalContext,
    };
  }

  if (!openai) {
    return {
      actions: allActions,
      answer: buildFallbackAnswer(question, finalContext, allActions, toolResults),
      mode: "fallback" as const,
      context: finalContext,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      temperature: 0.22,
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content: buildClinicalSystemPrompt(),
        },
        {
          role: "user",
          content: `User context:\n${JSON.stringify(summarizeContext(finalContext), null, 2)}\n\nAgent tool results:\n${JSON.stringify(toolResults, null, 2)}\n\nActions already applied from this message:\n${JSON.stringify(allActions, null, 2)}\n\nIndependent xAI/Grok clinical reasoning review, when available:\n${xaiClinicalReview || "No xAI review available for this message."}`,
        },
        ...history.slice(-6).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user" as const, content: question },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();

    if (answer) {
      return {
        actions: allActions,
        answer,
        mode: "generated" as const,
        context: finalContext,
      };
    }
  } catch (error) {
    console.error(
      "[Personal Health Agent Error]",
      error instanceof Error ? error.message : error
    );
  }

  return {
    actions: allActions,
    answer: buildFallbackAnswer(question, finalContext, allActions, toolResults),
    mode: "fallback" as const,
    context: finalContext,
  };
}

async function buildXaiClinicalReview(
  question: string,
  context: AgentContext,
  history: AgentMessage[]
) {
  if (!isComplexHealthQuestion(question.toLowerCase())) return null;

  const xai = getXAI();
  if (!xai) return null;

  try {
    const completion = await xai.chat.completions.create({
      model: process.env.XAI_MODEL || "grok-4.3",
      temperature: 0.18,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: [
            "You are a clinical reasoning reviewer for Aeonvera, a longevity decision-support product.",
            "Analyze the user's question using preventive medicine, physiology, and risk stratification.",
            "Do not diagnose or prescribe. Flag red flags, uncertainty, missing data, and clinician escalation needs.",
            "Be specific, systems-oriented, and concise. Return a useful second-opinion reasoning memo.",
          ].join(" "),
        },
        {
          role: "user",
          content: `User context:\n${JSON.stringify(summarizeContext(context), null, 2)}\n\nRecent conversation:\n${JSON.stringify(history.slice(-4), null, 2)}\n\nQuestion:\n${question}`,
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("[xAI Clinical Review Error]", error instanceof Error ? error.message : error);
    return null;
  }
}

async function loadAgentContext(
  supabase: SupabaseAdmin,
  userId: string
): Promise<AgentContext> {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

  const [
    memory,
    protocolRes,
    planRes,
    outcomesRes,
    calendarRes,
    notificationRes,
    preferenceRes,
    labRes,
    healthMetricRes,
    wearableRes,
    biologicalAgeRes,
    assessmentRes,
    healthStateRes,
  ] = await Promise.all([
      loadOrBuildCoachMemoryProfile(supabase, userId),
      safeQuery(() =>
        supabase
          .from("optimization_protocols")
          .select("id,summary,focus_domains,status,protocol,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
      safeQuery(() =>
        supabase
          .from("daily_execution_plans")
          .select("id,plan_date,status,autopilot_mode,summary,plan,updated_at")
          .eq("user_id", userId)
          .eq("plan_date", today)
          .maybeSingle()
      ),
      safeQuery(() =>
        supabase
          .from("intervention_outcomes")
          .select("domain,action,outcome,success,notes,measured_at,created_at")
          .eq("user_id", userId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(24)
      ),
      safeQuery(() =>
        supabase
          .from("calendar_events")
          .select("title,action,action_scope,recurrence,scheduled_for,status")
          .eq("user_id", userId)
          .gte("scheduled_for", since)
          .order("scheduled_for", { ascending: false })
          .limit(18)
      ),
      safeQuery(() =>
        supabase
          .from("notification_deliveries")
          .select("title,message,channel,status,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8)
      ),
      safeQuery(() =>
        supabase
          .from("agent_preferences")
          .select("category,preference_key,preference_value,confidence,updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(20)
      ),
      safeQuery(() =>
        supabase
          .from("lab_biomarkers")
          .select("canonical_key,raw_label,value,unit,measured_at")
          .eq("user_id", userId)
          .order("measured_at", { ascending: false })
          .limit(40)
      ),
      safeQuery(() =>
        supabase
          .from("health_metrics")
          .select("metric,value,source,measured_at")
          .eq("user_id", userId)
          .order("measured_at", { ascending: false })
          .limit(80)
      ),
      safeQuery(() =>
        supabase
          .from("wearable_metrics")
          .select("provider,metric_name,metric_value,recorded_at")
          .eq("user_id", userId)
          .order("recorded_at", { ascending: false })
          .limit(80)
      ),
      safeQuery(() =>
        supabase
          .from("biological_age_history")
          .select("biological_age,chronological_age,age_delta,score,category,source,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
      safeQuery(() =>
        supabase
          .from("longevity_assessments")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
      safeQuery(() =>
        supabase
          .from("health_states")
          .select("baseline,risk_scores,insights,updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
    ]);

  return {
    memory,
    protocol: (protocolRes.data as ProtocolRow | null) || null,
    dailyPlan: (planRes.data as DailyPlanRow | null) || null,
    outcomes: ((outcomesRes.data || []) as ExecutionRow[]).slice(0, 24),
    calendarEvents: ((calendarRes.data || []) as CalendarRow[]).slice(0, 18),
    notifications: ((notificationRes.data || []) as NotificationRow[]).slice(0, 8),
    preferences: ((preferenceRes.data || []) as PreferenceRow[]).slice(0, 20),
    labs: ((labRes.data || []) as LabRow[]).slice(0, 40),
    healthMetrics: ((healthMetricRes.data || []) as HealthMetricRow[]).slice(0, 80),
    wearableMetrics: ((wearableRes.data || []) as HealthMetricRow[]).slice(0, 80),
    biologicalAge: (biologicalAgeRes.data as BiologicalAgeRow | null) || null,
    assessment: (assessmentRes.data as AssessmentRow | null) || null,
    healthState: (healthStateRes.data as HealthStateRow | null) || null,
  };
}

async function applyAgentInstructions({
  context,
  question,
  supabase,
  userId,
}: {
  context: AgentContext;
  question: string;
  supabase: SupabaseAdmin;
  userId: string;
}): Promise<AgentAction[]> {
  const lower = question.toLowerCase();
  const actions: AgentAction[] = [];

  if (/(make|lighter|simpler|too much|overwhelming|less|reduce|easy)/.test(lower)) {
    const simplified = await simplifyDailyPlan({ context, supabase, userId });
    if (simplified) actions.push(simplified);

    const saved = await saveAgentPreference({
      category: "plan_intensity",
      confidence: 0.84,
      key: "prefers_lighter_daily_plan",
      metadata: { trigger: question },
      supabase,
      userId,
      value: "Prefer fewer, higher-leverage daily actions when the plan feels heavy.",
    });
    if (saved) actions.push(saved);
  }

  if (/(hate|don't like|do not like|avoid|never|not in the morning|morning workout|morning workouts|too early)/.test(lower)) {
    const value = /morning/.test(lower)
      ? "Avoid scheduling demanding workouts in the morning unless the user explicitly asks."
      : `User preference captured from agent chat: ${question.slice(0, 220)}`;
    const saved = await saveAgentPreference({
      category: /morning/.test(lower) ? "schedule_preference" : "avoidance",
      confidence: 0.82,
      key: /morning/.test(lower) ? "avoid_morning_training" : stablePreferenceKey(question),
      metadata: { trigger: question },
      supabase,
      userId,
      value,
    });
    if (saved) actions.push(saved);
  }

  if (/(after lunch|post lunch|afternoon|after noon|2 pm|2pm|3 pm|3pm)/.test(lower)) {
    const saved = await saveAgentPreference({
      category: "notification_timing",
      confidence: 0.8,
      key: "prefers_after_lunch_nudges",
      metadata: { trigger: question },
      supabase,
      userId,
      value: "Prefer reminders and nudges after lunch or early afternoon when possible.",
    });
    if (saved) {
      actions.push({
        ...saved,
        type: "notification_preference_saved",
      });
    }
  }

  if (/(move|reschedule|tomorrow|later|different time|not today)/.test(lower)) {
    const saved = await saveAgentPreference({
      category: "reschedule_intent",
      confidence: 0.72,
      key: stablePreferenceKey(question),
      metadata: {
        trigger: question,
        latest_calendar_action: context.calendarEvents[0]?.action || null,
      },
      supabase,
      userId,
      value: `Reschedule request captured: ${question.slice(0, 220)}`,
    });
    if (saved) {
      actions.push({
        type: "reschedule_requested",
        label: "Reschedule intent saved",
        detail:
          "Aeonvera saved the reschedule request. Device calendar changes still happen inside the mobile app so Apple/Android calendars stay accurate.",
      });
    }
  }

  return dedupeActions(actions);
}

async function applyAgentToolActions({
  context,
  question,
  supabase,
  toolResults,
  userId,
}: {
  context: AgentContext;
  question: string;
  supabase: SupabaseAdmin;
  toolResults: AgentToolResults;
  userId: string;
}): Promise<AgentAction[]> {
  if (!shouldPrepareClinicalPlan(question, toolResults)) return [];

  const prepared = await prepareClinicalDailyPlan({
    context,
    supabase,
    toolResults,
    userId,
  });

  return prepared ? [prepared] : [];
}

async function prepareClinicalDailyPlan({
  context,
  supabase,
  toolResults,
  userId,
}: {
  context: AgentContext;
  supabase: SupabaseAdmin;
  toolResults: AgentToolResults;
  userId: string;
}): Promise<AgentAction | null> {
  const items = toolResults.recommendedActions.slice(0, 3).map((action, index) => ({
    ...action,
    actionIndex: index,
    scope: index === 0 ? "today" : "week",
    execution_mode: index === 0 ? "approve" : "suggest",
    adaptation_reason: action.why || "Prepared from the personal health agent clinical tool layer.",
  }));

  if (!items.length) return null;

  const today = new Date().toISOString().slice(0, 10);
  const existingItems = context.dailyPlan?.plan?.items || [];
  const mergedItems = dedupeProtocolActions([...items, ...existingItems]).slice(0, 5);
  const plan = {
    ...(context.dailyPlan?.plan || {}),
    summary:
      "Aeonvera prepared a clinical intelligence plan from your latest signal map.",
    items: mergedItems,
    principles: [
      "Prioritize low-risk, measurable interventions before intensity.",
      "Close missing-data gaps before making irreversible assumptions.",
      "Use execution feedback to adapt the next plan.",
    ],
    clinical_tooling: {
      prepared_at: new Date().toISOString(),
      answer_mode: toolResults.answerMode,
      range_flags: toolResults.rangeFlags.slice(0, 6),
      highest_priority_domains: toolResults.clinicalSignalMap
        .filter((domain) => domain.priority === "high")
        .slice(0, 3)
        .map((domain) => domain.domain),
    },
  };

  const { error } = await supabase.from("daily_execution_plans").upsert(
    {
      id: context.dailyPlan?.id || undefined,
      user_id: userId,
      protocol_id: context.protocol?.id || null,
      plan_date: context.dailyPlan?.plan_date || today,
      status: "prepared",
      autopilot_mode: context.dailyPlan?.autopilot_mode || "approve",
      summary: plan.summary,
      plan,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,plan_date" }
  );

  if (error) {
    if (isMissingTableError(error) || error.message?.includes("daily_execution_plans")) {
      return null;
    }

    throw new Error(error.message || "Could not prepare clinical daily plan.");
  }

  return {
    type: "clinical_plan_prepared",
    label: "Clinical plan prepared",
    detail:
      "Aeonvera translated the health analysis into today’s active plan. Review it in Today before scheduling.",
  };
}

async function simplifyDailyPlan({
  context,
  supabase,
  userId,
}: {
  context: AgentContext;
  supabase: SupabaseAdmin;
  userId: string;
}): Promise<AgentAction | null> {
  const items = context.dailyPlan?.plan?.items || [];
  if (!context.dailyPlan || items.length <= 2) return null;

  const simplifiedItems = [...items]
    .sort((a, b) => actionImportance(b) - actionImportance(a))
    .slice(0, 2);
  const nextPlan = {
    ...(context.dailyPlan.plan || {}),
    items: simplifiedItems,
    summary:
      "Aeonvera simplified today to the two highest-leverage actions so execution stays clean.",
    memory: {
      ...(context.dailyPlan.plan?.memory || {}),
      plan_load: "light",
      adjusted_by_agent: true,
      adjusted_at: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from("daily_execution_plans")
    .update({
      status: "adjusted",
      summary: nextPlan.summary,
      plan: nextPlan,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("plan_date", context.dailyPlan.plan_date || new Date().toISOString().slice(0, 10));

  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(error.message || "Could not simplify daily plan.");
  }

  return {
    type: "plan_simplified",
    label: "Today simplified",
    detail: "Aeonvera reduced today to the two highest-leverage actions.",
  };
}

async function saveAgentPreference({
  category,
  confidence,
  key,
  metadata,
  supabase,
  userId,
  value,
}: {
  category: string;
  confidence: number;
  key: string;
  metadata: Record<string, unknown>;
  supabase: SupabaseAdmin;
  userId: string;
  value: string;
}): Promise<AgentAction | null> {
  const { error } = await supabase.from("agent_preferences").upsert(
    {
      user_id: userId,
      category,
      preference_key: key,
      preference_value: value,
      source: "agent_chat",
      confidence,
      metadata,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,category,preference_key" }
  );

  if (error) {
    if (isMissingTableError(error) || error.message?.includes("agent_preferences")) {
      return null;
    }

    throw new Error(error.message || "Could not save agent preference.");
  }

  return {
    type: "preference_saved",
    label: "Preference remembered",
    detail: value,
  };
}

async function safeQuery<T>(
  query: () => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>
) {
  const result = await query();

  if (result.error) {
    if (isMissingTableError(result.error)) {
      return { data: null };
    }

    throw new Error(result.error.message || "Agent context query failed.");
  }

  return { data: result.data };
}

function summarizeContext(context: AgentContext) {
  const latestMetrics = summarizeLatestMetrics(context);
  const coverage = buildDomainCoverage(context, latestMetrics);

  return {
    clinicalFramework: CLINICAL_LONGEVITY_DOMAINS,
    clinicalCoverage: coverage,
    memory: context.memory
      ? {
          communicationStyle: context.memory.communicationStyle,
          morningBrief: context.memory.morningBrief,
          motivationProfile: context.memory.motivationProfile,
          strongestInterventions: context.memory.bestInterventions.slice(0, 3),
          frictionPatterns: context.memory.failurePatterns.slice(0, 3),
          domainScores: context.memory.domainScores,
          confidence: context.memory.confidence,
        }
      : null,
    protocol: context.protocol
      ? {
          summary: context.protocol.summary || context.protocol.protocol?.summary,
          focusDomains: context.protocol.focus_domains,
          actions: context.protocol.protocol?.primary_protocol?.slice(0, 6),
          coachMessage: context.protocol.protocol?.coach_message,
        }
      : null,
    dailyPlan: context.dailyPlan
      ? {
          status: context.dailyPlan.status,
          mode: context.dailyPlan.autopilot_mode,
          summary: context.dailyPlan.summary,
          items: context.dailyPlan.plan?.items?.slice(0, 6),
          memory: context.dailyPlan.plan?.memory,
        }
      : null,
    agentPreferences: context.preferences.slice(0, 10),
    latestLabs: latestByKey(context.labs, (item) => item.canonical_key || item.raw_label || "lab"),
    latestMetrics,
    biologicalAge: context.biologicalAge,
    latestAssessment: compactAssessment(context.assessment),
    healthState: context.healthState,
    recentOutcomes: context.outcomes.slice(0, 10),
    calendar: context.calendarEvents.slice(0, 8),
    notifications: context.notifications.slice(0, 4),
  };
}

function buildAgentToolResults(context: AgentContext, question: string): AgentToolResults {
  const latestMetrics = summarizeLatestMetrics(context);
  const coverage = buildDomainCoverage(context, latestMetrics);
  const rangeFlags = buildRangeFlags(context, latestMetrics);
  const clinicalSignalMap = coverage.map((domain): ClinicalDomainInsight => {
    const rangePressure = rangeFlags.some((flag) =>
      [flag.marker, flag.interpretation].join(" ").toLowerCase().includes(domain.domain.split(" ")[0].toLowerCase())
    );
    const missingHighYield = domain.missing.length >= Math.max(3, Math.ceil(domain.present.length * 1.4));
    const priority =
      rangePressure || missingHighYield || domain.completeness < 35
        ? "high"
        : domain.completeness < 65
          ? "medium"
          : "low";

    return {
      domain: domain.domain,
      completeness: domain.completeness,
      present: domain.present.slice(0, 6),
      missing: domain.missing.slice(0, 8),
      priority,
      reason:
        priority === "high"
          ? "This domain either has sparse signal coverage or a marker that deserves closer review."
          : priority === "medium"
            ? "There is enough signal to reason, but not enough to personalize deeply."
            : "This domain has usable context for the current level of analysis.",
    };
  });

  return {
    answerMode: inferAnswerMode(question),
    clinicalSignalMap,
    rangeFlags,
    followUpQuestions: buildFollowUpQuestions(clinicalSignalMap, rangeFlags),
    recommendedActions: buildRecommendedActions(context, clinicalSignalMap, rangeFlags),
  };
}

function buildRangeFlags(context: AgentContext, latestMetrics: HealthMetricRow[]) {
  const flags: RangeFlag[] = [];
  const signals = new Map<string, { label: string; value: number; unit?: string | null }>();

  for (const lab of context.labs) {
    const key = String(lab.canonical_key || lab.raw_label || "").toLowerCase();
    const value = numericValue(lab.value);
    if (!key || value === null || signals.has(key)) continue;
    signals.set(key, {
      label: lab.raw_label || lab.canonical_key || key,
      value,
      unit: lab.unit,
    });
  }

  for (const metric of latestMetrics) {
    const key = String(metric.metric || metric.metric_name || "").toLowerCase();
    const value = numericValue(metric.value ?? metric.metric_value);
    if (!key || value === null || signals.has(key)) continue;
    signals.set(key, {
      label: metric.metric || metric.metric_name || key,
      value,
      unit: null,
    });
  }

  addRangeFlag(flags, signals, {
    keys: ["fasting_glucose", "fasting glucose", "glucose"],
    marker: "Fasting glucose",
    optimal: (value) => value >= 70 && value <= 90,
    watch: (value) => value > 90 && value < 100,
    elevated: (value) => value >= 100,
    low: (value) => value < 70,
    interpretation:
      "Glucose should be interpreted with insulin, HbA1c, triglycerides, HDL, waist, sleep, and training context.",
    nextStep: "Add fasting insulin and HbA1c if missing; track post-meal response if glucose looks high-normal.",
  });
  addRangeFlag(flags, signals, {
    keys: ["hscrp", "hs-crp", "crp"],
    marker: "hs-CRP",
    optimal: (value) => value < 1,
    watch: (value) => value >= 1 && value < 3,
    elevated: (value) => value >= 3,
    interpretation:
      "Inflammation signal is most useful when compared with training soreness, illness, sleep debt, ferritin, and metabolic markers.",
    nextStep: "Retest away from acute illness or hard training; pair with ferritin, ESR, and recovery data.",
  });
  addRangeFlag(flags, signals, {
    keys: ["triglycerides", "triglyceride"],
    marker: "Triglycerides",
    optimal: (value) => value < 100,
    watch: (value) => value >= 100 && value < 150,
    elevated: (value) => value >= 150,
    interpretation:
      "Triglycerides help reveal metabolic flexibility, especially alongside HDL, glucose, insulin, alcohol, and waist.",
    nextStep: "Compare with HDL and fasting insulin; review alcohol, refined carbohydrates, and evening eating.",
  });
  addRangeFlag(flags, signals, {
    keys: ["hdl"],
    marker: "HDL",
    optimal: (value) => value >= 50,
    watch: (value) => value >= 40 && value < 50,
    low: (value) => value < 40,
    interpretation:
      "Low HDL can cluster with insulin resistance and poor cardiometabolic conditioning.",
    nextStep: "Interpret with triglycerides, ApoB/LDL-C if available, waist, VO2 max, and training consistency.",
  });
  addRangeFlag(flags, signals, {
    keys: ["resting heart rate", "resting_hr", "rhr", "resting heart"],
    marker: "Resting heart rate",
    optimal: (value) => value >= 45 && value <= 60,
    watch: (value) => value > 60 && value <= 75,
    elevated: (value) => value > 75,
    low: (value) => value < 45,
    interpretation:
      "Resting heart rate is a recovery and cardiovascular fitness signal; trends matter more than a single reading.",
    nextStep: "Pair with HRV, sleep duration, illness, caffeine, alcohol, and training load.",
  });
  addRangeFlag(flags, signals, {
    keys: ["blood pressure", "systolic"],
    marker: "Blood pressure",
    optimal: (value) => value < 120,
    watch: (value) => value >= 120 && value < 130,
    elevated: (value) => value >= 130,
    interpretation:
      "Systolic pressure affects long-term vascular and brain risk; confirm with repeated seated readings.",
    nextStep: "Track morning/evening readings for 7 days and review sodium, sleep apnea risk, stress, and Zone 2 volume.",
  });

  return flags.slice(0, 10);
}

function addRangeFlag(
  flags: RangeFlag[],
  signals: Map<string, { label: string; value: number; unit?: string | null }>,
  config: {
    keys: string[];
    marker: string;
    optimal?: (value: number) => boolean;
    watch?: (value: number) => boolean;
    elevated?: (value: number) => boolean;
    low?: (value: number) => boolean;
    interpretation: string;
    nextStep: string;
  }
) {
  const signal = findSignal(signals, config.keys);
  if (!signal) return;

  const status: RangeFlag["status"] = config.optimal?.(signal.value)
    ? "optimal"
    : config.elevated?.(signal.value)
      ? "elevated"
      : config.low?.(signal.value)
        ? "low"
        : config.watch?.(signal.value)
          ? "watch"
          : "unknown";

  flags.push({
    marker: config.marker,
    value: `${signal.value}${signal.unit ? ` ${signal.unit}` : ""}`,
    status,
    interpretation: config.interpretation,
    nextStep: config.nextStep,
  });
}

function findSignal(
  signals: Map<string, { label: string; value: number; unit?: string | null }>,
  keys: string[]
) {
  for (const key of keys) {
    const normalized = key.toLowerCase();
    const direct = signals.get(normalized);
    if (direct) return direct;

    for (const [signalKey, signal] of signals.entries()) {
      if (signalKey.includes(normalized) || normalized.includes(signalKey)) {
        return signal;
      }
    }
  }

  return null;
}

function buildFollowUpQuestions(
  clinicalSignalMap: ClinicalDomainInsight[],
  rangeFlags: RangeFlag[]
) {
  const highPriorityDomains = clinicalSignalMap
    .filter((domain) => domain.priority === "high")
    .slice(0, 4);
  const questions: string[] = [];

  for (const flag of rangeFlags.filter((item) => item.status !== "optimal").slice(0, 3)) {
    questions.push(`For ${flag.marker}, when was this measured, and was it during illness, hard training, poor sleep, or unusual stress?`);
  }

  for (const domain of highPriorityDomains) {
    const missing = domain.missing.slice(0, 3).join(", ");
    if (missing) {
      questions.push(`For ${domain.domain}, can you add ${missing}?`);
    }
  }

  return dedupeStrings(questions).slice(0, 6);
}

function buildRecommendedActions(
  context: AgentContext,
  clinicalSignalMap: ClinicalDomainInsight[],
  rangeFlags: RangeFlag[]
) {
  const actions: ProtocolAction[] = [];
  const flaggedText = rangeFlags.map((flag) => `${flag.marker} ${flag.status}`).join(" ").toLowerCase();
  const highPriorityText = clinicalSignalMap
    .filter((domain) => domain.priority === "high")
    .map((domain) => domain.domain)
    .join(" ")
    .toLowerCase();

  if (/glucose|triglyceride|hdl|metabolic/.test(`${flaggedText} ${highPriorityText}`)) {
    actions.push({
      domain: "Metabolic",
      action: "Take a 10-15 minute walk after the largest carbohydrate meal for the next 7 days.",
      why: "This is a low-risk way to improve post-meal glucose handling while Aeonvera collects better metabolic signal.",
      cadence: "Daily for 7 days",
      impact: "high",
    });
  }

  if (/resting heart|blood pressure|cardiovascular|vo2/.test(`${flaggedText} ${highPriorityText}`)) {
    actions.push({
      domain: "Cardiovascular",
      action: "Complete one Zone 2 session at conversational intensity.",
      why: "Cardiovascular base work supports resting heart rate, blood pressure, glucose disposal, and long-term healthspan.",
      cadence: "2-3x/week",
      impact: "high",
    });
  }

  if (/sleep|circadian|stress|cortisol|recovery/.test(highPriorityText)) {
    actions.push({
      domain: "Sleep",
      action: "Set a fixed wake time and morning outdoor light exposure for three consecutive days.",
      why: "Circadian anchoring improves sleep timing, energy, glucose regulation, and recovery signal quality.",
      cadence: "Morning for 3 days",
      impact: "high",
    });
  }

  if (/hs-crp|inflammation|recovery|ferritin/.test(`${flaggedText} ${highPriorityText}`)) {
    actions.push({
      domain: "Recovery",
      action: "Run a recovery audit: sleep debt, soreness, illness symptoms, alcohol, and training load.",
      why: "Inflammatory markers need context before increasing training or changing supplements.",
      cadence: "Today",
      impact: "medium",
    });
  }

  if (context.labs.length < 4) {
    actions.push({
      domain: "Data",
      action: "Upload a recent CBC, CMP, lipids, HbA1c, fasting insulin, and hs-CRP if available.",
      why: "Aeonvera needs core clinical markers to produce a high-confidence longevity interpretation.",
      cadence: "Once",
      impact: "high",
    });
  }

  if (!actions.length) {
    actions.push({
      domain: "Optimization",
      action: "Choose one measurable action today and log the result honestly.",
      why: "The agent becomes more intelligent when it can compare recommendation, execution, and outcome.",
      cadence: "Today",
      impact: "medium",
    });
  }

  return dedupeProtocolActions(actions).slice(0, 5);
}

function buildClinicalSystemPrompt() {
  return [
    "You are Aeonvera, a premium personal health intelligence agent for longevity and human optimization.",
    "You have access to an internal clinical tool layer in the message called Agent tool results. Treat it as computed context: signal coverage, range flags, follow-up questions, and recommended actions.",
    "Use only supplied user context plus generally accepted biomedical reasoning. When data is missing, say so clearly and request the highest-yield missing inputs instead of guessing.",
    "Reason across these domains: circadian biology and sleep architecture; metabolic flexibility; cardiovascular performance; inflammation and recovery; hormonal optimization; body composition and sarcopenia risk; cognitive longevity; nutrition and micronutrient density; biological age and stress resilience; longevity risk stratification.",
    "For complex health questions, answer with: 1) Signal map, 2) What it may imply, 3) What is missing, 4) Highest-leverage next actions, 5) What to track next.",
    "If a clinical plan was prepared, tell the user plainly that it is ready in Today and should be reviewed before scheduling.",
    "If range flags are present, explain them as screening and optimization signals, not diagnoses. If all range flags are optimal, say what still needs trend confirmation.",
    "Connect systems: sleep affects glucose control and hormones; metabolic dysfunction affects inflammation and cardiovascular risk; training load affects HRV and recovery; stress affects sleep, cortisol, appetite, glucose, and adherence.",
    "Be sophisticated but not theatrical. Use precise language, explain uncertainty, and prioritize actions that are low-risk, measurable, and reversible.",
    "Safety: do not diagnose disease, prescribe medication, interpret urgent symptoms as benign, or replace a clinician. Recommend medical evaluation for chest pain, stroke symptoms, severe shortness of breath, fainting, severe hypertension, suicidal ideation, suspected sleep apnea, abnormal labs, or endocrine/cardiovascular red flags.",
    "If the user asks for a preventive medicine style analysis, give a deep structured interpretation, but label it educational and decision-support, not a diagnosis.",
    "If the user asks why something was scheduled, explain evidence, tradeoff, and adaptation. If the plan feels too heavy, simplify it.",
    "Keep ordinary answers concise. For deep analysis requests, use enough detail to be useful.",
  ].join(" ");
}

function buildFallbackAnswer(
  question: string,
  context: AgentContext,
  actions: AgentAction[] = [],
  toolResults = buildAgentToolResults(context, question)
) {
  const action = context.dailyPlan?.plan?.items?.[0] || context.protocol?.protocol?.primary_protocol?.[0];
  const friction = context.memory?.failurePatterns?.[0];
  const best = context.memory?.bestInterventions?.[0];
  const planSummary =
    context.dailyPlan?.summary ||
    context.protocol?.summary ||
    "Aeonvera is still building your active protocol from your assessment, outcomes, and calendar behavior.";
  const ask = question.toLowerCase();
  const latestMetrics = summarizeLatestMetrics(context);
  const coverage = buildDomainCoverage(context, latestMetrics);
  const relevantGaps = coverage
    .filter((domain) => domain.missing.length)
    .slice(0, 4)
    .map((domain) => `${domain.domain}: ${domain.missing.slice(0, 4).join(", ")}`);
  const actionPrefix = actions.length
    ? `${actions.map((action) => action.detail).join(" ")} `
    : "";

  if (/why|reason|because|scheduled/.test(ask) && action) {
    return `${actionPrefix}Aeonvera prioritized this because it sits closest to today’s active protocol: ${action.action}. ${action.why || planSummary} Treat it as a clean signal rather than a demand: complete it if it fits, move it if the day is compressed, and let the system learn from that choice.`;
  }

  if (isComplexHealthQuestion(ask)) {
    const rangeSummary = toolResults.rangeFlags.length
      ? toolResults.rangeFlags
          .slice(0, 4)
          .map((flag) => `${flag.marker}: ${flag.value} (${flag.status})`)
          .join("; ")
      : "no range flags available yet";
    const questions = toolResults.followUpQuestions.slice(0, 3).join(" ");
    const nextActions = toolResults.recommendedActions
      .slice(0, 3)
      .map((nextAction) => `${nextAction.domain}: ${nextAction.action}`)
      .join("; ");

    return `${actionPrefix}Signal map: ${coverage
      .filter((domain) => domain.present.length || domain.completeness < 50)
      .slice(0, 5)
      .map((domain) => `${domain.domain} ${domain.completeness}% complete`)
      .join("; ") || "your core clinical signal set is still sparse"}. Range review: ${rangeSummary}. Key gaps: ${
      relevantGaps.join("; ") || "no major framework gaps detected in the currently loaded context"
    }. Highest-leverage next actions: ${nextActions || "upload core labs and wearable trends first"}. Follow-up: ${
      questions || "add sleep, metabolic, cardiovascular, inflammation, hormone, body composition, cognition, nutrition, stress, and family risk details."
    } This is educational decision-support, not a diagnosis.`;
  }

  if (/change|adjust|move|simpler|too much/.test(ask)) {
    return `${actionPrefix}I would simplify the day before adding intensity. ${friction ? `${friction.label} has shown the most resistance recently, so Aeonvera should reduce friction there first.` : "There is not enough repeated resistance yet, so the safest move is one high-leverage action and one recovery-protective check-in."}`;
  }

  if (/best|working|improve|optimize/.test(ask) && best) {
    return `The strongest current signal is ${best.domain}: ${best.action}. It has repeated successfully ${best.successCount} times, so Aeonvera should use it as the anchor and build the rest of the day around preserving that momentum.`;
  }

  return `${actionPrefix}${planSummary} The next intelligent move is to execute one meaningful action, mark the result honestly, and let Aeonvera adapt the following schedule from what actually happened.`;
}

function shouldPrepareClinicalPlan(question: string, toolResults: AgentToolResults) {
  const lower = question.toLowerCase();
  const askedForPlan = /(build|create|make|prepare|turn|give me|protocol|plan|optimize|schedule|action)/.test(lower);
  const clinicalEnough = toolResults.answerMode === "clinical_deep_dive" || toolResults.rangeFlags.length > 0;

  return askedForPlan && clinicalEnough && toolResults.recommendedActions.length > 0;
}

function inferAnswerMode(question: string): AgentToolResults["answerMode"] {
  const lower = question.toLowerCase();

  if (isComplexHealthQuestion(lower)) return "clinical_deep_dive";
  if (/(schedule|plan|protocol|action|calendar|remind|prepare|simpler|change|adjust)/.test(lower)) {
    return "execution_agent";
  }
  return "general_agent";
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function dedupeProtocolActions(actions: ProtocolAction[]) {
  const seen = new Set<string>();
  const output: ProtocolAction[] = [];

  for (const action of actions) {
    const key = String(action.action || "").toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(action);
  }

  return output;
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isComplexHealthQuestion(value: string) {
  return /(circadian|sleep architecture|fasting insulin|hba1c|triglycerides|hdl|vo2|hrv|blood pressure|hs-crp|homocysteine|ferritin|hormone|testosterone|estradiol|progesterone|tsh|cortisol|sarcopenia|body composition|cognitive|micronutrient|biological age|telomere|cancer|neurodegenerative|cardiovascular|autoimmune|longevity analysis|preventive medicine)/.test(
    value
  );
}

function summarizeLatestMetrics(context: AgentContext) {
  const rows = [...context.healthMetrics, ...context.wearableMetrics];
  return latestByKey(rows, (item) => item.metric || item.metric_name || "metric").slice(0, 40);
}

function latestByKey<T>(rows: T[], keyFor: (item: T) => string | null | undefined) {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const row of rows) {
    const key = String(keyFor(row) || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }

  return output;
}

function buildDomainCoverage(
  context: AgentContext,
  latestMetrics: HealthMetricRow[]
) {
  const haystack = JSON.stringify({
    labs: context.labs,
    metrics: latestMetrics,
    biologicalAge: context.biologicalAge,
    assessment: context.assessment,
    healthState: context.healthState,
  }).toLowerCase();

  return CLINICAL_LONGEVITY_DOMAINS.map((domain) => {
    const present = domain.signals.filter((signal) => signalPresent(haystack, signal));
    const missing = domain.signals.filter((signal) => !signalPresent(haystack, signal));

    return {
      domain: domain.domain,
      present,
      missing,
      completeness: Math.round((present.length / domain.signals.length) * 100),
    };
  });
}

function signalPresent(haystack: string, signal: string) {
  const normalized = signal.toLowerCase();
  const synonyms: Record<string, string[]> = {
    "bedtime": ["bedtime", "sleep_start", "sleep start"],
    "wake time": ["wake", "wake_time", "sleep_end", "sleep end"],
    "sleep latency": ["sleep latency", "latency"],
    "night awakenings": ["awakening", "awakenings", "wake after sleep"],
    "deep sleep": ["deep sleep", "deep_sleep"],
    "REM sleep": ["rem sleep", "rem_sleep"],
    "fasting glucose": ["fasting_glucose", "fasting glucose", "glucose"],
    "fasting insulin": ["fasting_insulin", "fasting insulin", "insulin"],
    "HbA1c": ["hba1c", "hemoglobin a1c"],
    "triglycerides": ["triglyceride"],
    "HDL": ["hdl"],
    "resting heart rate": ["resting heart", "resting_heart", "resting_hr", "rhr"],
    "sleeping heart rate": ["sleeping heart", "sleep_hr"],
    "HRV": ["hrv", "heart rate variability"],
    "blood pressure": ["blood pressure", "systolic", "diastolic"],
    "VO2 max": ["vo2", "vo₂"],
    "hs-CRP": ["hscrp", "hs-crp", "crp"],
    "Free T3": ["free t3", "free_t3"],
    "Free T4": ["free t4", "free_t4"],
    "biological age": ["biological_age", "biological age"],
  };
  const candidates = synonyms[signal] || [normalized];
  return candidates.some((candidate) => haystack.includes(candidate.toLowerCase()));
}

function compactAssessment(assessment: AssessmentRow | null) {
  if (!assessment) return null;

  const entries = Object.entries(assessment)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 36);

  return Object.fromEntries(entries);
}

function actionImportance(action: ProtocolAction) {
  const text = [action.domain, action.action, action.why, action.impact].join(" ").toLowerCase();
  let score = 0;
  if (action.impact === "high") score += 3;
  if (/sleep|recovery|stress|training|nutrition|protein|walk|zone 2|strength/.test(text)) score += 2;
  if (/check|track|log|review/.test(text)) score += 1;
  return score;
}

function stablePreferenceKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "agent_preference";
}

function dedupeActions(actions: AgentAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.type}:${action.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache")
  );
}
