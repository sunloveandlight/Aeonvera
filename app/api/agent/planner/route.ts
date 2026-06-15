import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const plan = planCommand(command, currentPage);
    return NextResponse.json(plan);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not plan that action.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function planCommand(command: string, currentPage: string) {
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
      message: `I can create a secure physician link with ${formatSections(sectionPlan.sections)}.`,
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
      message: `I can invite ${email} as ${role} and include ${formatSections(sectionPlan.sections)}.`,
    };
  }

  const planIntent = resolvePlanIntent(text);
  if (planIntent) {
    return {
      action: { intent: planIntent, kind: "plan" },
      confidence: 0.88,
      handled: true,
      message: planIntent.targetPlan
        ? `I can open the ${titleCase(planIntent.targetPlan)} plan flow.`
        : "I can open your membership options.",
    };
  }

  const controlIntent = resolveControlIntent(text);
  if (controlIntent) {
    return {
      action: { intent: controlIntent, kind: "control" },
      confidence: 0.84,
      handled: true,
      message: controlMessage(controlIntent.type),
    };
  }

  const navigation = resolveNavigationIntent(text, currentPage);
  if (navigation) {
    return {
      action: { ...navigation, kind: "navigation" },
      confidence: 0.8,
      handled: true,
      message: `I can open ${navigation.label}.`,
    };
  }

  return {
    action: null,
    confidence: 0,
    handled: false,
  };
}

function resolveControlIntent(text: string) {
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

function resolvePlanIntent(text: string) {
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

function controlMessage(type: string) {
  const messages: Record<string, string> = {
    generate_report: "I can generate the latest longevity report.",
    manage_care_network: "I can open Care Network or create an invite if you give me an email.",
    open_oura: "I can open your wearable data source layer.",
    prepare_today: "I can prepare today's plan.",
    simplify_plan: "I can simplify today's plan.",
    sync_oura: "I can sync Oura now.",
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
