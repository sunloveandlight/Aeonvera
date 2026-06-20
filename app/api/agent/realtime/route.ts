import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getHealthSubjectFilter,
  resolveActiveHealthProfileContext,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import {
  checkAndRecordUsage,
  getUserPlanForUsage,
  serializeUsage,
  usageErrorResponse,
} from "@/lib/usage/tierUsage";

type ContextRow = Record<string, unknown>;

export const runtime = "nodejs";

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2";
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";
const ALLOWED_REALTIME_VOICES = new Set(["marin", "cedar", "alloy", "verse", "shimmer"]);

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sdp = await request.text();
    if (!sdp || !sdp.includes("v=0")) {
      return NextResponse.json({ error: "Realtime voice needs a valid SDP offer." }, { status: 400 });
    }
    const voice = sanitizeRealtimeVoice(request.nextUrl.searchParams.get("voice"));
    const currentPage = sanitizePagePath(request.nextUrl.searchParams.get("page"));

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Realtime voice needs OPENAI_API_KEY configured on the server." },
        { status: 500 }
      );
    }

    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: request.cookies.get("aeonvera.activeHealthProfileId")?.value,
    });
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });
    const usage = await checkAndRecordUsage({
      metadata: { source: "realtime_voice", transport: "webrtc" },
      meter: "voice_question",
      plan: subscription.plan,
      status: subscription.status,
      supabase: admin,
      healthProfileId: healthProfileContext.healthProfileId,
      userId: user.id,
    });

    if (!usage.allowed) {
      return NextResponse.json(
        usageErrorResponse(usage),
        { status: usage.statusCode || 429 }
      );
    }

    const fd = new FormData();
    fd.set("sdp", sdp);
    fd.set(
      "session",
      JSON.stringify({
        type: "realtime",
        model: REALTIME_MODEL,
        output_modalities: ["audio"],
        instructions: await buildRealtimeInstructions(
          admin,
          user.id,
          healthProfileContext,
          subscription,
          currentPage
        ),
        max_output_tokens: 900,
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: {
              model: process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 650,
              interrupt_response: true,
            },
          },
          output: {
            voice,
            speed: 0.98,
          },
        },
      })
    );

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": hashUserId(user.id),
      },
      body: fd,
    });

    const answerSdp = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: answerSdp || "OpenAI realtime voice session could not start.",
          usage: serializeUsage(usage),
        },
        { status: response.status }
      );
    }

    return new NextResponse(answerSdp, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "X-Aeonvera-Usage": JSON.stringify(serializeUsage(usage)),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Aeonvera realtime voice could not start.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function sanitizeRealtimeVoice(value: string | null) {
  const normalized = value?.trim().toLowerCase() || "";
  if (ALLOWED_REALTIME_VOICES.has(normalized)) return normalized;
  if (ALLOWED_REALTIME_VOICES.has(REALTIME_VOICE)) return REALTIME_VOICE;
  return "marin";
}

function sanitizePagePath(value: string | null) {
  const path = value?.trim() || "/";
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 120);
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const {
    data: { user: bearerUser },
  } = await getSupabaseAdmin().auth.getUser(token);

  return bearerUser;
}

async function buildRealtimeInstructions(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext,
  subscription: Awaited<ReturnType<typeof getUserPlanForUsage>>,
  currentPage: string
) {
  const context = await loadRealtimeContext(
    supabase,
    userId,
    healthProfileContext,
    subscription,
    currentPage
  );

  return [
    "You are Aeonvera, a premium realtime longevity and health optimization voice agent.",
    "Speak naturally, calmly, and intelligently. Sound like a private health intelligence system that knows this user, not a generic chatbot.",
    "Keep most spoken answers under 45 seconds unless the user asks for depth.",
    "Start with the user's current state when relevant: today's plan, recent actions, connected data sources, Life OS priorities, preferences, clinical insights, labs, biological age, and membership.",
    "You can discuss advanced longevity protocols, biomarkers, sleep architecture, metabolism, cardiovascular performance, hormones, cognition, recovery, stress, and behavior change.",
    "You are not a replacement for a physician. Do not diagnose, prescribe medication, or claim certainty. For alarming symptoms, abnormal lab clusters, pregnancy, acute chest pain, neurological deficits, severe shortness of breath, or self-harm risk, tell the user to seek urgent professional care.",
    "Use the user's Aeonvera context below when it is present. If data is missing, ask for the highest-yield missing input instead of pretending.",
    "Use the intelligence brief first. It is a distilled operating picture for this session.",
    "If the user's context shows missing wearables, labs, reports, preferences, or daily plan data, offer to open the exact area that fixes the gap.",
    "When the user asks 'what should I do' or speaks vaguely, infer the most useful next step from today's plan, priorities, risks, and recent actions.",
    "If the user is already on the relevant page, offer to perform or explain the next step there instead of navigating away.",
    "For site actions such as upgrading, downgrading, opening pages, connecting data sources, sharing exports, or changing settings, acknowledge the request briefly. The Aeonvera client will execute supported actions from the user's transcript.",
    "When recommending advanced modalities, separate evidence strength, risk, cost, contraindications, and whether clinician supervision is needed.",
    "If the user asks for a plan, give one clear next action, one reason, and one way Aeonvera can schedule or track it.",
    "Do not mention internal table names, JSON, migrations, or implementation details.",
    `Current user context:\n${JSON.stringify(context, null, 2)}`,
  ].join("\n\n");
}

async function loadRealtimeContext(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext,
  subscription: Awaited<ReturnType<typeof getUserPlanForUsage>>,
  currentPage: string
) {
  const today = new Date().toISOString().slice(0, 10);
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const healthFilter = getHealthSubjectFilter(healthProfileContext);

  const [
    profile,
    dailyPlan,
    autopilotPreferences,
    memory,
    protocol,
    healthState,
    latestReport,
    labs,
    biologicalAge,
    insights,
    preferences,
    wearableConnections,
    lifeDomains,
    lifePriorities,
    recentActions,
    usageEvents,
  ] = await Promise.all([
    safeSingle(() =>
      supabase
        .from("profiles")
        .select("display_name,plan,subscription_status,onboarding_completed,life_stage,entity_state")
        .eq("user_id", userId)
        .maybeSingle()
    ),
    safeSingle(() =>
      supabase
        .from("daily_execution_plans")
        .select("summary,status,autopilot_mode,plan,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .eq("plan_date", today)
        .maybeSingle()
    ),
    safeSingle(() =>
      supabase
        .from("autopilot_preferences")
        .select("mode,calendar_enabled,notifications_enabled,auto_schedule_enabled,quiet_hours_start,quiet_hours_end,timezone,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .maybeSingle()
    ),
    safeSingle(() =>
      supabase
        .from("coach_memory_profiles")
        .select("communication_style,motivation_profile,failure_patterns,best_interventions,domain_scores,morning_brief,confidence,last_computed_at,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .maybeSingle()
    ),
    safeSingle(() =>
      supabase
        .from("optimization_protocols")
        .select("summary,focus_domains,status,protocol,created_at")
        .eq(healthFilter.column, healthFilter.value)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeSingle(() =>
      supabase
        .from("health_states")
        .select("baseline,trends,risk_scores,insights,last_processed_at,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeSingle(() =>
      supabase
        .from("longevity_reports")
        .select("risk_score,primary_goal,created_at")
        .eq(healthFilter.column, healthFilter.value)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeList(() =>
      supabase
        .from("lab_biomarkers")
        .select("canonical_key,value,unit,measured_at")
        .eq(healthFilter.column, healthFilter.value)
        .order("measured_at", { ascending: false })
        .limit(30)
    ),
    safeSingle(() =>
      supabase
        .from("biological_age_history")
        .select("biological_age,chronological_age,age_delta,score,category,created_at")
        .eq(healthFilter.column, healthFilter.value)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    safeList(() =>
      supabase
        .from("clinical_insights")
        .select("answer_summary,domains,concern_status,range_flags,follow_up_questions,recommended_actions,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .order("updated_at", { ascending: false })
        .limit(5)
    ),
    safeList(() =>
      supabase
        .from("agent_preferences")
        .select("category,preference_key,preference_value,confidence,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .order("updated_at", { ascending: false })
        .limit(12)
    ),
    safeList(() =>
      supabase
        .from("wearable_connections")
        .select("provider,status,last_synced_at,connected_at,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .order("updated_at", { ascending: false })
    ),
    safeList(() =>
      supabase
        .from("life_os_domain_profiles")
        .select("domain,score,direction,current_state,desired_state,key_risk,next_action,confidence,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .order("score", { ascending: false })
        .limit(8)
    ),
    safeList(() =>
      supabase
        .from("life_os_priorities")
        .select("domain,title,desired_outcome,next_action,priority,horizon_days,status,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .eq("status", "active")
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(6)
    ),
    safeList(() =>
      supabase
        .from("command_orb_action_events")
        .select("action_type,title,detail,tone,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8)
    ),
    safeList(() =>
      supabase
        .from("usage_events")
        .select("meter,units,created_at")
        .eq(healthFilter.column, healthFilter.value)
        .gte("created_at", periodStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(120)
    ),
  ]);

  const todayContext = compactDailyPlan(dailyPlan);
  const coachMemory = compactCoachMemory(memory);
  const protocolContext = compactProtocol(protocol);
  const missingContext = inferMissingContext({
    dailyPlan,
    labs,
    latestReport,
    preferences,
    wearableConnections,
  });
  const membership = {
    plan: subscription.plan || stringValue(profile?.plan) || "unknown",
    status: subscription.status || stringValue(profile?.subscription_status) || "unknown",
  };
  const usageThisMonth = summarizeUsageEvents(usageEvents);
  const pageContext = describeCurrentPage(currentPage);
  const latestLabs = latestRowsByKey(labs, "canonical_key").slice(0, 14);

  return {
    intelligenceBrief: buildIntelligenceBrief({
      biologicalAge,
      coachMemory,
      currentPage: pageContext,
      latestLabs,
      latestReport,
      lifeDomains,
      lifePriorities,
      membership,
      missingContext,
      recentActions,
      today: todayContext,
      usageThisMonth,
      wearableConnections,
    }),
    currentPage: pageContext,
    identity: {
      displayName: stringValue(profile?.display_name),
      lifeStage: stringValue(profile?.life_stage),
      entityState: stringValue(profile?.entity_state),
      onboardingCompleted: booleanValue(profile?.onboarding_completed),
    },
    membership,
    usageThisMonth,
    today: todayContext,
    autopilot: autopilotPreferences,
    coachMemory,
    healthState,
    protocol: protocolContext,
    latestReport,
    latestLabs,
    biologicalAge,
    clinicalMemory: insights.slice(0, 5),
    preferences,
    wearableConnections,
    lifeOS: {
      domains: lifeDomains,
      priorities: lifePriorities,
    },
    recentAeonveraActions: recentActions,
    missingContext,
  };
}

async function safeSingle(query: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>) {
  try {
    const result = await query();
    if (result.error) return null;
    return result.data as ContextRow | null;
  } catch {
    return null;
  }
}

async function safeList(query: () => PromiseLike<{ data: unknown; error: { message?: string } | null }>) {
  try {
    const result = await query();
    if (result.error) return [];
    return Array.isArray(result.data) ? (result.data as ContextRow[]) : [];
  } catch {
    return [];
  }
}

function latestRowsByKey(rows: ContextRow[], key: string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = typeof row[key] === "string" ? row[key] : "";
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function compactDailyPlan(row: ContextRow | null) {
  if (!row) return null;

  const plan = isRecord(row.plan) ? row.plan : {};
  const items = Array.isArray(plan.items) ? plan.items : [];

  return {
    summary: stringValue(row.summary),
    status: stringValue(row.status),
    autopilotMode: stringValue(row.autopilot_mode),
    updatedAt: stringValue(row.updated_at),
    topActions: items.slice(0, 4).map((item) =>
      isRecord(item)
        ? {
            action: stringValue(item.action),
            domain: stringValue(item.domain),
            reason: stringValue(item.reason),
          }
        : item
    ),
  };
}

function compactCoachMemory(row: ContextRow | null) {
  if (!row) return null;

  return {
    communicationStyle: stringValue(row.communication_style),
    motivationProfile: row.motivation_profile,
    failurePatterns: Array.isArray(row.failure_patterns)
      ? row.failure_patterns.slice(0, 4)
      : [],
    bestInterventions: Array.isArray(row.best_interventions)
      ? row.best_interventions.slice(0, 4)
      : [],
    domainScores: row.domain_scores,
    morningBrief: stringValue(row.morning_brief),
    confidence: row.confidence,
    lastComputedAt: stringValue(row.last_computed_at),
  };
}

function compactProtocol(row: ContextRow | null) {
  if (!row) return null;

  const protocol = isRecord(row.protocol) ? row.protocol : {};
  const actions = Array.isArray(protocol.actions)
    ? protocol.actions
    : Array.isArray(protocol.recommended_actions)
      ? protocol.recommended_actions
      : [];

  return {
    summary: stringValue(row.summary),
    focusDomains: Array.isArray(row.focus_domains) ? row.focus_domains : [],
    status: stringValue(row.status),
    createdAt: stringValue(row.created_at),
    topActions: actions.slice(0, 4),
  };
}

function summarizeUsageEvents(events: ContextRow[]) {
  return events.reduce<Record<string, number>>((summary, event) => {
    const meter = stringValue(event.meter);
    const units = typeof event.units === "number" ? event.units : 1;
    if (!meter) return summary;
    summary[meter] = (summary[meter] || 0) + units;
    return summary;
  }, {});
}

function inferMissingContext({
  dailyPlan,
  labs,
  latestReport,
  preferences,
  wearableConnections,
}: {
  dailyPlan: ContextRow | null;
  labs: ContextRow[];
  latestReport: ContextRow | null;
  preferences: ContextRow[];
  wearableConnections: ContextRow[];
}) {
  return {
    needsDailyPlan: !dailyPlan,
    needsLabData: labs.length === 0,
    needsLongevityReport: !latestReport,
    needsPreferences: preferences.length === 0,
    needsWearableConnection: wearableConnections.length === 0,
  };
}

function describeCurrentPage(path: string) {
  const pageMap = [
    {
      label: "Dashboard",
      path: "/dashboard",
      usefulActions: ["review current signals", "open today's plan", "explain the highest-risk signal"],
    },
    {
      label: "Ask Aeonvera",
      path: "/companion",
      usefulActions: ["answer a health question", "simplify today's plan", "explain a recommendation"],
    },
    {
      label: "Data Sources",
      path: "/data-sources",
      usefulActions: ["sync Oura", "open wearable connections", "identify missing data"],
    },
    {
      label: "Digital Twin",
      path: "/digital-twin",
      usefulActions: ["explain future trajectory", "compare scenarios", "identify leverage points"],
    },
    {
      label: "Life OS",
      path: "/life-os",
      usefulActions: ["review priorities", "choose next action", "rebalance domains"],
    },
    {
      label: "Care Network",
      path: "/network",
      usefulActions: ["create an invite", "explain permissions", "review active members"],
    },
    {
      label: "Physician Export",
      path: "/physician-export",
      usefulActions: ["create a physician share link", "explain what is included", "prepare a clinical summary"],
    },
    {
      label: "Plan",
      path: "/plan",
      usefulActions: ["review usage", "compare tiers", "open billing"],
    },
    {
      label: "Pricing",
      path: "/pricing",
      usefulActions: ["upgrade", "downgrade", "compare Core, Elite, and Sovereign"],
    },
    {
      label: "Report",
      path: "/report",
      usefulActions: ["generate a report", "explain biological age", "summarize risk factors"],
    },
  ];

  const match = pageMap.find((page) => path === page.path || path.startsWith(`${page.path}/`));
  return match || { label: "Aeonvera", path, usefulActions: ["answer a question", "open the right area", "prepare the next step"] };
}

function buildIntelligenceBrief({
  biologicalAge,
  coachMemory,
  currentPage,
  latestLabs,
  latestReport,
  lifeDomains,
  lifePriorities,
  membership,
  missingContext,
  recentActions,
  today,
  usageThisMonth,
  wearableConnections,
}: {
  biologicalAge: ContextRow | null;
  coachMemory: ReturnType<typeof compactCoachMemory>;
  currentPage: ReturnType<typeof describeCurrentPage>;
  latestLabs: ContextRow[];
  latestReport: ContextRow | null;
  lifeDomains: ContextRow[];
  lifePriorities: ContextRow[];
  membership: { plan: string | null; status: string | null };
  missingContext: ReturnType<typeof inferMissingContext>;
  recentActions: ContextRow[];
  today: ReturnType<typeof compactDailyPlan>;
  usageThisMonth: Record<string, number>;
  wearableConnections: ContextRow[];
}) {
  const nextActions = buildRecommendedActions({
    currentPage,
    latestReport,
    lifePriorities,
    missingContext,
    today,
    wearableConnections,
  });

  return {
    currentPage: currentPage.label,
    membership,
    recommendedOpeningStyle: "brief, specific, context-aware, one concrete offer",
    primaryFocus:
      today?.topActions?.[0] ||
      firstPriorityAction(lifePriorities) ||
      stringValue(latestReport?.primary_goal) ||
      "Find the highest-leverage next action.",
    nextBestActions: nextActions,
    dataCompleteness: {
      labsAvailable: latestLabs.length > 0,
      reportAvailable: Boolean(latestReport),
      wearableConnected: wearableConnections.length > 0,
      dailyPlanAvailable: Boolean(today),
    },
    personalization: {
      communicationStyle: coachMemory?.communicationStyle,
      knownFailurePatterns: coachMemory?.failurePatterns?.slice(0, 2) || [],
      bestInterventions: coachMemory?.bestInterventions?.slice(0, 2) || [],
    },
    latestBiologicalAge: biologicalAge,
    topLifeDomains: lifeDomains.slice(0, 3),
    recentActions: recentActions.slice(0, 4),
    usageThisMonth,
  };
}

function buildRecommendedActions({
  currentPage,
  latestReport,
  lifePriorities,
  missingContext,
  today,
  wearableConnections,
}: {
  currentPage: ReturnType<typeof describeCurrentPage>;
  latestReport: ContextRow | null;
  lifePriorities: ContextRow[];
  missingContext: ReturnType<typeof inferMissingContext>;
  today: ReturnType<typeof compactDailyPlan>;
  wearableConnections: ContextRow[];
}) {
  const actions = new Set<string>();

  if (today?.topActions?.[0] && isRecord(today.topActions[0])) {
    const action = stringValue(today.topActions[0].action);
    if (action) actions.add(`Focus first on: ${action}`);
  }

  const priorityAction = firstPriorityAction(lifePriorities);
  if (priorityAction) actions.add(`Advance Life OS priority: ${priorityAction}`);

  if (missingContext.needsWearableConnection) {
    actions.add("Open Data Sources and connect Oura or WHOOP.");
  } else if (wearableConnections.some((connection) => stringValue(connection.provider) === "oura")) {
    actions.add("Sync Oura for the latest recovery and sleep data.");
  }

  if (missingContext.needsLabData) actions.add("Import labs to improve biomarker intelligence.");
  if (missingContext.needsLongevityReport) actions.add("Generate a longevity report.");
  if (latestReport?.primary_goal) actions.add(`Review report goal: ${stringValue(latestReport.primary_goal)}`);

  currentPage.usefulActions.forEach((action) => actions.add(action));

  return Array.from(actions).slice(0, 6);
}

function firstPriorityAction(priorities: ContextRow[]) {
  const firstPriority = priorities[0];
  return stringValue(firstPriority?.next_action) || stringValue(firstPriority?.title);
}

function isRecord(value: unknown): value is ContextRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function hashUserId(userId: string) {
  const salt = process.env.OPENAI_SAFETY_SALT || process.env.NEXT_PUBLIC_SUPABASE_URL || "aeonvera";
  return createHash("sha256").update(`${salt}:${userId}`).digest("hex");
}
