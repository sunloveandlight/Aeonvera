import { NextRequest, NextResponse } from "next/server";
import { getCommandOrbToolMeta, type CommandOrbToolId } from "@/lib/agent/commandOrbTools";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import {
  getHealthSubjectFilter,
  resolveActiveHealthProfileContext,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

const SHARE_SECTIONS = [
  "snapshot",
  "biological_age",
  "labs",
  "protocols",
  "outcomes",
  "wearables",
  "clinical_insights",
] as const;

const DEFAULT_SHARE_SECTIONS = [...SHARE_SECTIONS];
const PLAN_ORDER = ["core", "elite", "sovereign"] as const;

type ShareSection = (typeof SHARE_SECTIONS)[number];
type PlanId = (typeof PLAN_ORDER)[number];
type CareRole = "physician" | "coach" | "family";
type ControlIntent =
  | { type: "create_physician_share"; expiresInDays?: number; includedSections?: ShareSection[]; recipientEmail?: string; recipientLabel?: string }
  | { type: "generate_report" }
  | { type: "manage_care_network"; email?: string; expiresInDays?: number; memberName?: string; permissions?: ShareSection[]; role?: CareRole }
  | { type: "open_oura" }
  | { type: "prepare_today" }
  | { type: "simplify_plan" }
  | { type: "sync_oura" };
type PlanIntent = {
  direction: "change" | "downgrade" | "upgrade";
  targetPlan: PlanId | null;
};
type PlannerAction =
  | { intent: ControlIntent; kind: "control" }
  | { intent: PlanIntent; kind: "plan" }
  | { href: string; kind: "navigation"; label: string }
  | { kind: "answer"; text: string };
type ContextRow = Record<string, unknown>;
type UserStatePacket = {
  activeCareMembers: number;
  activePhysicianLinks: number;
  currentPage: ReturnType<typeof describeCurrentPage>;
  dailyPlan: ReturnType<typeof compactDailyPlan>;
  displayName: string | null;
  latestReport: ContextRow | null;
  lifePriorities: ContextRow[];
  membership: {
    plan: PlanId | null;
    status: string | null;
  };
  missingContext: {
    needsCareNetwork: boolean;
    needsDailyPlan: boolean;
    needsLabData: boolean;
    needsLongevityReport: boolean;
    needsWearableConnection: boolean;
  };
  recentActions: ContextRow[];
  topLabs: ContextRow[];
  wearableConnections: ContextRow[];
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const command = sanitizeCommand(body.command);
    const currentPage = sanitizePagePath(body.currentPage);

    if (!command) {
      return NextResponse.json({ action: null, confidence: 0, handled: false });
    }

    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: request.cookies.get("aeonvera.activeHealthProfileId")?.value,
    });
    const userState = await loadUserStatePacket(
      admin,
      user.id,
      healthProfileContext,
      currentPage
    );
    const plan = planCommand(command, currentPage, userState);
    return NextResponse.json(plan);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not plan that action.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function planCommand(command: string, currentPage: string, userState: UserStatePacket) {
  const text = normalize(command);
  const email = extractEmail(command);
  const sectionPlan = extractSectionPlan(text);
  const expiresInDays = extractExpiryDays(text);

  const wantsPhysicianShare =
    /\b(physician|doctor|clinician|medical|clinical)\b.*\b(link|share|export|portal|access)\b/.test(text) ||
    /\b(link|share|export|portal|access)\b.*\b(physician|doctor|clinician|medical|clinical)\b/.test(text);

  if (wantsPhysicianShare) {
    return {
      action: {
        kind: "control",
        intent: {
          expiresInDays,
          includedSections: sectionPlan.sections,
          recipientEmail: email || undefined,
          recipientLabel: extractRecipientLabel(command, email) || "Physician",
          type: "create_physician_share",
        },
      },
      confidence: 0.9,
      handled: true,
      message:
        userState.activePhysicianLinks > 0
          ? `You already have ${userState.activePhysicianLinks} active physician link${userState.activePhysicianLinks === 1 ? "" : "s"}. I can create another secure link with ${formatSections(sectionPlan.sections)}.`
          : `I can create a secure physician link with ${formatSections(sectionPlan.sections)}.`,
      tool: toolMeta("create_physician_share_link"),
    };
  }

  if (email && /\b(invite|add|give access|care network|coach|family|care team)\b/.test(text)) {
    const role = extractCareRole(text);
    return {
      action: {
        kind: "control",
        intent: {
          email,
          expiresInDays,
          memberName: extractRecipientLabel(command, email),
          permissions: sectionPlan.sections,
          role,
          type: "manage_care_network",
        },
      },
      confidence: 0.91,
      handled: true,
      message: `I can invite ${email} as ${role} and include ${formatSections(sectionPlan.sections)}. You currently have ${userState.activeCareMembers} active care-network member${userState.activeCareMembers === 1 ? "" : "s"}.`,
      tool: toolMeta("create_care_network_invite"),
    };
  }

  const planIntent = resolvePlanIntent(text);
  if (planIntent) {
    const targetPlan = planIntent.targetPlan || inferPlanTarget(planIntent.direction, userState.membership.plan);
    return {
      action: { intent: { ...planIntent, targetPlan }, kind: "plan" },
      confidence: 0.88,
      handled: true,
      message: buildPlanMessage(planIntent.direction, targetPlan, userState),
      tool: toolMeta(targetPlan === userState.membership.plan ? "open_billing" : "change_plan"),
    };
  }

  const controlIntent = resolveControlIntent(text);
  if (controlIntent) {
    const refinedIntent = refineControlIntent(controlIntent, userState);
    return {
      action: { intent: refinedIntent, kind: "control" },
      confidence: 0.84,
      handled: true,
      message: controlMessage(refinedIntent.type, userState),
      tool: toolMeta(toolIdForControlIntent(refinedIntent.type)),
    };
  }

  const answerTool = resolveAnswerTool(text, userState);
  if (answerTool) return answerTool;

  const nextBestAction = resolveNextBestAction(text, userState);
  if (nextBestAction) {
    return nextBestAction;
  }

  const navigation = resolveNavigationIntent(text, currentPage);
  if (navigation) {
    return {
      action: { ...navigation, kind: "navigation" },
      confidence: 0.8,
      handled: true,
      message: `I can open ${navigation.label}.`,
      tool: toolMeta("explain_current_page"),
    };
  }

  return {
    action: null,
    confidence: 0,
    handled: false,
  };
}

function toolMeta(id: CommandOrbToolId) {
  return getCommandOrbToolMeta(id);
}

async function loadUserStatePacket(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthProfileContext: ActiveHealthProfileContext,
  currentPage: string
): Promise<UserStatePacket> {
  const today = new Date().toISOString().slice(0, 10);
  const subscription = await getUserPlanForUsage({ supabase, userId });
  const healthFilter = getHealthSubjectFilter(healthProfileContext);

  const [
    profile,
    dailyPlan,
    latestReport,
    labs,
    wearableConnections,
    lifePriorities,
    recentActions,
    activePhysicianLinks,
    activeCareMembers,
  ] = await Promise.all([
    safeSingle(() =>
      supabase
        .from("profiles")
        .select("display_name,plan,subscription_status")
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
        .from("life_os_priorities")
        .select("domain,title,desired_outcome,next_action,priority,horizon_days,status,updated_at")
        .eq(healthFilter.column, healthFilter.value)
        .eq("status", "active")
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(5)
    ),
    safeList(() =>
      supabase
        .from("command_orb_action_events")
        .select("action_type,title,detail,tone,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6)
    ),
    safeCount(() =>
      supabase
        .from("physician_share_links")
        .select("id", { count: "exact", head: true })
        .eq(healthFilter.column, healthFilter.value)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
    ),
    safeCount(() =>
      supabase
        .from("care_network_memberships")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", userId)
        .eq("status", "active")
        .is("revoked_at", null)
    ),
  ]);

  const membership = {
    plan: asPlanId(subscription.plan) || asPlanId(profile?.plan),
    status: subscription.status || stringValue(profile?.subscription_status),
  };

  return {
    activeCareMembers,
    activePhysicianLinks,
    currentPage: describeCurrentPage(currentPage),
    dailyPlan: compactDailyPlan(dailyPlan),
    displayName: stringValue(profile?.display_name),
    latestReport,
    lifePriorities,
    membership,
    missingContext: {
      needsCareNetwork: activeCareMembers === 0,
      needsDailyPlan: !dailyPlan,
      needsLabData: labs.length === 0,
      needsLongevityReport: !latestReport,
      needsWearableConnection: wearableConnections.length === 0,
    },
    recentActions,
    topLabs: latestRowsByKey(labs, "canonical_key"),
    wearableConnections,
  };
}

function resolveControlIntent(text: string): ControlIntent | null {
  if (/\b(simplify|make.*simpler|less overwhelming|highest leverage)\b.*\b(plan|today|protocol|actions?)\b/.test(text)) {
    return { type: "simplify_plan" };
  }

  if (/\b(prepare|build|create|make|refresh)\b.*\b(today|daily|day)\b.*\b(plan|schedule|protocol)\b/.test(text)) {
    return { type: "prepare_today" };
  }

  if (/\b(sync|refresh|update|pull)\b.*\b(oura|wearable|ring|recovery|sleep data)\b/.test(text)) {
    return { type: "sync_oura" };
  }

  if (/\b(connect|open|show)\b.*\b(oura|wearable|data source|data sources)\b/.test(text)) {
    return { type: "open_oura" };
  }

  if (/\b(generate|create|build|refresh|open)\b.*\b(report|longevity report|biological age report)\b/.test(text)) {
    return { type: "generate_report" };
  }

  if (/\b(care network|invite|permissions|family|coach)\b/.test(text)) {
    return { type: "manage_care_network" };
  }

  return null;
}

function refineControlIntent(intent: ControlIntent, userState: UserStatePacket): ControlIntent {
  if (intent.type === "sync_oura" && userState.missingContext.needsWearableConnection) {
    return { type: "open_oura" };
  }

  return intent;
}

function resolveAnswerTool(text: string, userState: UserStatePacket) {
  if (/\b(what do you know|what you know|what do you remember|what you remember|summarize me|my context|my state|what data do you have)\b/.test(text)) {
    const message = buildUserStateSummary(userState);
    return {
      action: { kind: "answer", text: message } satisfies PlannerAction,
      confidence: 0.86,
      handled: true,
      message,
      tool: toolMeta("summarize_user_state"),
    };
  }

  if (/\b(what can i do here|what is this page|explain this page|what can you do here)\b/.test(text)) {
    const message = `You are in ${userState.currentPage.label}. I can ${userState.currentPage.usefulActions.slice(0, 3).join(", ")}.`;
    return {
      action: { kind: "answer", text: message } satisfies PlannerAction,
      confidence: 0.82,
      handled: true,
      message,
      tool: toolMeta("explain_current_page"),
    };
  }

  return null;
}

function resolveNextBestAction(text: string, userState: UserStatePacket) {
  if (!/\b(what next|what should i do|next step|help me|guide me|start|begin|focus on|where should i go)\b/.test(text)) {
    return null;
  }

  const dailyAction = firstDailyAction(userState.dailyPlan);
  if (dailyAction) {
    return {
      action: { intent: { type: "simplify_plan" }, kind: "control" },
      confidence: 0.82,
      handled: true,
      message: `Your strongest next move is already in today's plan: ${dailyAction}. I can simplify it into the two highest-leverage actions.`,
      tool: toolMeta("recommend_next_action"),
    };
  }

  const priorityAction = firstPriorityAction(userState.lifePriorities);
  if (priorityAction) {
    return {
      action: { href: "/life-os", kind: "navigation", label: "Life OS" },
      confidence: 0.8,
      handled: true,
      message: `Your clearest Life OS priority is ${priorityAction}. I can open Life OS so you can move that forward.`,
      tool: toolMeta("recommend_next_action"),
    };
  }

  if (userState.missingContext.needsWearableConnection) {
    return {
      action: { intent: { type: "open_oura" }, kind: "control" },
      confidence: 0.82,
      handled: true,
      message: "The highest-leverage gap is live recovery and sleep data. I can open Data Sources so you can connect Oura.",
      tool: toolMeta("recommend_next_action"),
    };
  }

  if (hasOuraConnection(userState) && staleOuraSync(userState)) {
    return {
      action: { intent: { type: "sync_oura" }, kind: "control" },
      confidence: 0.81,
      handled: true,
      message: "Your Oura connection is available, and the next useful move is refreshing sleep and recovery signals.",
      tool: toolMeta("recommend_next_action"),
    };
  }

  if (userState.missingContext.needsLabData) {
    return {
      action: { href: "/report", kind: "navigation", label: "Report" },
      confidence: 0.78,
      handled: true,
      message: "Your intelligence layer will get much sharper with labs. I can open the report area so you can add biomarkers.",
      tool: toolMeta("recommend_next_action"),
    };
  }

  if (userState.missingContext.needsLongevityReport) {
    return {
      action: { intent: { type: "generate_report" }, kind: "control" },
      confidence: 0.79,
      handled: true,
      message: "The next best step is generating your first longevity report from the data Aeonvera has.",
      tool: toolMeta("recommend_next_action"),
    };
  }

  return {
    action: { href: userState.currentPage.path, kind: "navigation", label: userState.currentPage.label },
    confidence: 0.72,
    handled: true,
    message: `You are in ${userState.currentPage.label}. The most useful things here are ${userState.currentPage.usefulActions.slice(0, 2).join(" and ")}.`,
    tool: toolMeta("recommend_next_action"),
  };
}

function toolIdForControlIntent(type: ControlIntent["type"]): CommandOrbToolId {
  const map: Record<ControlIntent["type"], CommandOrbToolId> = {
    create_physician_share: "create_physician_share_link",
    generate_report: "generate_longevity_report",
    manage_care_network: "create_care_network_invite",
    open_oura: "connect_oura",
    prepare_today: "prepare_daily_plan",
    simplify_plan: "simplify_daily_plan",
    sync_oura: "sync_oura",
  };

  return map[type];
}

function resolvePlanIntent(text: string): PlanIntent | null {
  const targetPlan = extractPlanTarget(text);
  const hasBillingIntent =
    /\b(upgrade|downgrade|change|switch|move|subscribe|subscription|billing|membership|plan)\b/.test(text);

  if (!hasBillingIntent && !targetPlan) return null;

  if (/\b(downgrade|lower|cheaper|reduce)\b/.test(text)) {
    return { direction: "downgrade", targetPlan };
  }

  if (/\b(upgrade|higher|sovereign|elite|executive|unlock)\b/.test(text)) {
    return { direction: "upgrade", targetPlan };
  }

  return { direction: "change", targetPlan };
}

function inferPlanTarget(direction: "change" | "downgrade" | "upgrade", currentPlan: PlanId | null) {
  if (!currentPlan) return direction === "downgrade" ? null : "core";

  const index = PLAN_ORDER.indexOf(currentPlan);
  if (direction === "downgrade") return PLAN_ORDER[Math.max(0, index - 1)] || null;
  if (direction === "upgrade") return PLAN_ORDER[Math.min(PLAN_ORDER.length - 1, index + 1)] || null;
  return null;
}

function buildPlanMessage(
  direction: "change" | "downgrade" | "upgrade",
  targetPlan: PlanId | null,
  userState: UserStatePacket
) {
  if (!targetPlan) return "I can open your membership options so you can choose the right tier.";

  const currentPlan = userState.membership.plan;
  if (currentPlan === targetPlan) {
    return `You are already on ${titleCase(targetPlan)}. I can open billing so you can manage that membership.`;
  }

  const directionLabel =
    direction === "downgrade" ? "downgrade" : direction === "upgrade" ? "upgrade" : "move";
  const from = currentPlan ? ` from ${titleCase(currentPlan)}` : "";
  return `I can ${directionLabel}${from} to ${titleCase(targetPlan)} and show the billing impact before anything changes.`;
}

function resolveNavigationIntent(text: string, currentPage: string) {
  const intents = [
    { href: "/dashboard", label: "Dashboard", pattern: /\b(dashboard|home|overview|command center)\b/ },
    { href: "/companion", label: "Ask Aeonvera", pattern: /\b(ask|companion|coach|chat|talk)\b/ },
    { href: "/digital-twin", label: "Digital Twin", pattern: /\b(digital twin|twin|simulation|timeline)\b/ },
    { href: "/life-os", label: "Life OS", pattern: /\b(life os|life operating system|purpose|trajectory)\b/ },
    { href: "/data-sources", label: "Data Sources", pattern: /\b(data sources?|wearables?|oura|whoop|connect data)\b/ },
    { href: "/physician-export", label: "Physician Export", pattern: /\b(physician export|doctor export|clinical export)\b/ },
    { href: "/network", label: "Care Network", pattern: /\b(care network|network|care team)\b/ },
    { href: "/pricing", label: "Pricing", pattern: /\b(pricing|prices|tiers)\b/ },
    { href: "/plan", label: "Your Plan", pattern: /\b(my plan|your plan|usage|membership)\b/ },
    { href: "/report", label: "Report", pattern: /\b(report|longevity report)\b/ },
  ];

  const match = intents.find((intent) => intent.pattern.test(text));
  if (!match || currentPage === match.href) return null;
  return match;
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
      usefulActions: ["sync Oura", "connect wearable data", "identify missing data"],
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
      label: "Your Plan",
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

function extractSectionPlan(text: string): { sections: ShareSection[] } {
  const includes = new Set<ShareSection>();
  const excludes = new Set<ShareSection>();

  SHARE_SECTIONS.forEach((section) => {
    const aliases = sectionAliases(section);
    const mentioned = aliases.some((alias) => text.includes(alias));
    if (!mentioned) return;

    const exclusionPattern = new RegExp(`\\b(no|not|without|exclude|hide|dont include|don't include)\\b.{0,32}\\b(${aliases.map(escapeRegExp).join("|")})\\b`);
    if (exclusionPattern.test(text)) {
      excludes.add(section);
    } else {
      includes.add(section);
    }
  });

  const base = includes.size ? Array.from(includes) : DEFAULT_SHARE_SECTIONS;
  return { sections: base.filter((section) => !excludes.has(section)) };
}

function extractCareRole(text: string): CareRole {
  if (/\b(coach|trainer|advisor)\b/.test(text)) return "coach";
  if (/\b(family|spouse|partner|parent|mother|father|sister|brother)\b/.test(text)) return "family";
  return "physician";
}

function extractEmail(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
}

function extractExpiryDays(text: string) {
  const match = text.match(/\b(\d{1,2})\s*(day|days|week|weeks)\b/);
  if (!match) return 14;

  const value = Number(match[1]);
  const days = match[2].startsWith("week") ? value * 7 : value;
  return Math.max(1, Math.min(90, days));
}

function extractPlanTarget(text: string): PlanId | null {
  const target = PLAN_ORDER.find((plan) => new RegExp(`\\b${plan}\\b`).test(text));
  return target || null;
}

function extractRecipientLabel(command: string, email?: string) {
  const withoutEmail = email ? command.replace(email, "") : command;
  const match = withoutEmail.match(/\b(?:dr\.?|doctor|physician|coach|for|to|invite)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  return match?.[1]?.trim().slice(0, 80);
}

function sectionAliases(section: ShareSection) {
  const aliases: Record<ShareSection, string[]> = {
    biological_age: ["biological age", "bio age", "age score"],
    clinical_insights: ["clinical insights", "clinical", "insights"],
    labs: ["labs", "lab", "biomarkers", "bloodwork", "blood work"],
    outcomes: ["outcomes", "progress", "results"],
    protocols: ["protocols", "protocol", "recommendations"],
    snapshot: ["snapshot", "summary", "overview"],
    wearables: ["wearables", "wearable", "oura", "whoop", "sleep", "recovery"],
  };

  return aliases[section];
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

async function safeCount(query: () => PromiseLike<{ count: number | null; error: { message?: string } | null }>) {
  try {
    const result = await query();
    if (result.error) return 0;
    return result.count || 0;
  } catch {
    return 0;
  }
}

function compactDailyPlan(row: ContextRow | null) {
  if (!row) return null;

  const plan = isRecord(row.plan) ? row.plan : {};
  const items = Array.isArray(plan.items) ? plan.items : [];

  return {
    autopilotMode: stringValue(row.autopilot_mode),
    status: stringValue(row.status),
    summary: stringValue(row.summary),
    topActions: items.slice(0, 3).map((item) =>
      isRecord(item)
        ? {
            action: stringValue(item.action),
            domain: stringValue(item.domain),
            reason: stringValue(item.reason),
          }
        : item
    ),
    updatedAt: stringValue(row.updated_at),
  };
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

function firstDailyAction(dailyPlan: ReturnType<typeof compactDailyPlan>) {
  const first = dailyPlan?.topActions?.[0];
  return isRecord(first) ? stringValue(first.action) : null;
}

function firstPriorityAction(priorities: ContextRow[]) {
  const firstPriority = priorities[0];
  return stringValue(firstPriority?.next_action) || stringValue(firstPriority?.title);
}

function hasOuraConnection(userState: UserStatePacket) {
  return userState.wearableConnections.some(
    (connection) => stringValue(connection.provider) === "oura"
  );
}

function staleOuraSync(userState: UserStatePacket) {
  const oura = userState.wearableConnections.find(
    (connection) => stringValue(connection.provider) === "oura"
  );
  const lastSyncedAt = stringValue(oura?.last_synced_at);
  if (!lastSyncedAt) return true;

  const lastSync = new Date(lastSyncedAt).getTime();
  if (!Number.isFinite(lastSync)) return true;
  return Date.now() - lastSync > 1000 * 60 * 60 * 18;
}

function buildUserStateSummary(userState: UserStatePacket) {
  const parts = [
    userState.displayName ? `I know this is ${userState.displayName}'s account.` : "I know this signed-in account.",
    userState.membership.plan
      ? `Membership is ${titleCase(userState.membership.plan)} with status ${userState.membership.status || "unknown"}.`
      : "Membership is not fully activated yet.",
    userState.dailyPlan
      ? `Today's plan is available${userState.dailyPlan.summary ? `: ${userState.dailyPlan.summary}` : "."}`
      : "Today's plan has not been prepared yet.",
    userState.latestReport
      ? `A longevity report exists${userState.latestReport.primary_goal ? ` with primary goal: ${stringValue(userState.latestReport.primary_goal)}` : "."}`
      : "No longevity report is available yet.",
    userState.topLabs.length
      ? `I can see ${userState.topLabs.length} recent lab marker${userState.topLabs.length === 1 ? "" : "s"}.`
      : "No lab biomarkers are connected yet.",
    userState.wearableConnections.length
      ? `Wearables connected: ${userState.wearableConnections.map((connection) => stringValue(connection.provider)).filter(Boolean).join(", ")}.`
      : "No wearable source is connected yet.",
    userState.lifePriorities.length
      ? `Top Life OS priority: ${firstPriorityAction(userState.lifePriorities)}.`
      : "No active Life OS priority is set yet.",
    userState.activeCareMembers
      ? `${userState.activeCareMembers} care-network member${userState.activeCareMembers === 1 ? "" : "s"} are active.`
      : "No active care-network members yet.",
  ];

  const gaps = Object.entries(userState.missingContext)
    .filter(([, missing]) => missing)
    .map(([key]) => key.replace(/^needs/, "").replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`));

  if (gaps.length) {
    parts.push(`The biggest data gaps are ${gaps.slice(0, 3).join(", ")}.`);
  }

  return parts.join(" ");
}

function isRecord(value: unknown): value is ContextRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asPlanId(value: unknown): PlanId | null {
  return typeof value === "string" && PLAN_ORDER.includes(value as PlanId)
    ? (value as PlanId)
    : null;
}

function controlMessage(type: string, userState: UserStatePacket) {
  const messages: Record<string, string> = {
    generate_report: userState.missingContext.needsLabData
      ? "I can generate a report now, and it will get sharper once you add labs."
      : "I can generate the latest longevity report from your current data.",
    manage_care_network: userState.activeCareMembers > 0
      ? `I can open Care Network. You currently have ${userState.activeCareMembers} active member${userState.activeCareMembers === 1 ? "" : "s"}.`
      : "I can open Care Network or create an invite if you give me an email.",
    open_oura: userState.missingContext.needsWearableConnection
      ? "I can open Data Sources so you can connect Oura and unlock live recovery signals."
      : "I can open your wearable data source layer.",
    prepare_today: userState.dailyPlan
      ? "I can refresh today's plan using the latest context Aeonvera has."
      : "I can prepare today's first plan from your current signals.",
    simplify_plan: userState.dailyPlan
      ? "I can simplify today's plan into the highest-leverage actions."
      : "I can prepare a simple version of today's plan.",
    sync_oura: hasOuraConnection(userState)
      ? "I can sync Oura now and refresh your sleep and recovery signals."
      : "Oura is not connected yet. I can open Data Sources first.",
  };

  return messages[type] || "I can handle that.";
}

function formatSections(sections: ShareSection[]) {
  if (!sections.length) return "no sections";
  if (sections.length === SHARE_SECTIONS.length) return "the full clinical export";
  return sections.map((section) => section.replace(/_/g, " ")).join(", ");
}

function sanitizeCommand(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

function sanitizePagePath(value: unknown) {
  const path = typeof value === "string" ? value.trim() : "/";
  return path.startsWith("/") ? path.slice(0, 120) : "/";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
