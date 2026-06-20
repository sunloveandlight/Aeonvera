import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireServerFeatureAccess } from "@/lib/auth/serverFeatureAccess";
import {
  getHealthSubjectFilter,
  resolveActiveHealthProfileContext,
  type HealthSubjectFilter,
} from "@/lib/health-profiles/activeHealthProfile";

type LifeDomainKey =
  | "health"
  | "performance"
  | "cognition"
  | "sleep"
  | "learning"
  | "productivity"
  | "emotional_resilience"
  | "stress"
  | "relationships"
  | "purpose"
  | "financial_health";

type LifeDomain = {
  confidence: number;
  currentState: string;
  desiredState: string;
  direction: "improving" | "stable" | "declining" | "learning";
  domain: LifeDomainKey;
  evidence: Record<string, number>;
  keyRisk: string;
  label: string;
  nextAction: string;
  score: number;
};

type LifeProfileRow = {
  confidence?: number | null;
  current_state?: string | null;
  desired_state?: string | null;
  direction?: LifeDomain["direction"] | null;
  domain: LifeDomainKey;
  evidence?: Record<string, number> | null;
  key_risk?: string | null;
  next_action?: string | null;
  score?: number | null;
};

const DOMAIN_LABELS: Record<LifeDomainKey, string> = {
  cognition: "Cognition",
  emotional_resilience: "Emotional resilience",
  financial_health: "Financial health",
  health: "Health",
  learning: "Learning",
  performance: "Performance",
  productivity: "Productivity",
  purpose: "Purpose",
  relationships: "Relationships",
  sleep: "Sleep",
  stress: "Stress",
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const entitlement = await requireServerFeatureAccess({
      feature: "life_os",
      lockedMessage: "Unlock Sovereign to access Life OS.",
      supabase: admin,
      userId: user.id,
    });
    if (!entitlement.allowed) return entitlement.response;

    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
    });
    const healthFilter = getHealthSubjectFilter(healthProfileContext);
    const signals = await loadSignals(admin, user.id, healthFilter);
    const derived = deriveDomains(signals);
    const { data, error } = await admin
      .from("life_os_domain_profiles")
      .select("domain,score,direction,current_state,desired_state,key_risk,next_action,confidence,evidence")
      .eq(healthFilter.column, healthFilter.value);

    const migrationRequired = Boolean(error && isMissingLifeOsTable(error));
    if (error && !migrationRequired) throw error;

    const domains = mergeSavedDomains(derived, (data || []) as LifeProfileRow[]);
    const weakest = [...domains].sort((a, b) => a.score - b.score)[0];
    const strongest = [...domains].sort((a, b) => b.score - a.score)[0];

    return NextResponse.json({
      domains,
      migrationRequired,
      nextBestMove: weakest
        ? {
            domain: weakest.label,
            detail: weakest.nextAction,
            reason: `Aeonvera sees ${weakest.label.toLowerCase()} as the highest-leverage constraint on the current trajectory.`,
          }
        : null,
      summary: buildSummary(domains, signals),
      trajectory: {
        confidence: average(domains.map((domain) => domain.confidence)),
        strongestDomain: strongest?.label || "Learning",
        weakestDomain: weakest?.label || "Learning",
        status: trajectoryStatus(domains),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Life OS.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

async function loadSignals(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  healthFilter: HealthSubjectFilter
) {
  const [
    labs,
    wearables,
    protocols,
    outcomes,
    scenarios,
    clinicalInsights,
    agentPreferences,
    dailyPlans,
    careNetwork,
    biologicalAge,
  ] = await Promise.all([
    safeCount(admin, "lab_biomarkers", healthFilter.value, healthFilter.column),
    safeCount(admin, "wearable_metrics", healthFilter.value, healthFilter.column),
    safeCount(admin, "optimization_protocols", healthFilter.value, healthFilter.column),
    safeCount(admin, "intervention_outcomes", healthFilter.value, healthFilter.column),
    safeCount(admin, "future_self_scenarios", healthFilter.value, healthFilter.column),
    safeCount(admin, "clinical_insights", healthFilter.value, healthFilter.column),
    safeCount(admin, "agent_preferences", healthFilter.value, healthFilter.column),
    safeCount(admin, "daily_execution_plans", healthFilter.value, healthFilter.column),
    safeCount(admin, "care_network_memberships", userId, "owner_user_id"),
    safeCount(admin, "biological_age_history", healthFilter.value, healthFilter.column),
  ]);

  return {
    agentPreferences,
    biologicalAge,
    careNetwork,
    clinicalInsights,
    dailyPlans,
    labs,
    outcomes,
    protocols,
    scenarios,
    wearables,
  };
}

function deriveDomains(signals: Awaited<ReturnType<typeof loadSignals>>): LifeDomain[] {
  return [
    domain("health", score(42, signals.labs, 5, signals.biologicalAge, 4, signals.clinicalInsights, 3), {
      currentState: "Health intelligence is anchored by biomarkers, clinical insights, and biological age.",
      desiredState: "A medically coherent baseline with measurable risk reduction.",
      keyRisk: "Blind spots remain if labs, biomarkers, or clinical review are thin.",
      nextAction: "Keep the clinical packet current and resolve the highest-priority biomarker gap.",
      evidence: { labs: signals.labs, biologicalAge: signals.biologicalAge, clinicalInsights: signals.clinicalInsights },
    }),
    domain("performance", score(38, signals.wearables, 4, signals.protocols, 4, signals.outcomes, 5), {
      currentState: "Performance is modeled from recovery, training behavior, and outcome history.",
      desiredState: "Energy, strength, and endurance move in a planned direction.",
      keyRisk: "Training can become noise without feedback from recovery and adherence.",
      nextAction: "Connect weekly outcomes to the current training and recovery protocol.",
      evidence: { outcomes: signals.outcomes, protocols: signals.protocols, wearables: signals.wearables },
    }),
    domain("cognition", score(34, signals.clinicalInsights, 4, signals.agentPreferences, 3, signals.scenarios, 2), {
      currentState: "Cognition is inferred from clinical questions, memory, planning, and future-self intent.",
      desiredState: "Sharper focus, emotional regulation, and better decision quality.",
      keyRisk: "Cognitive goals stay vague if sleep, stress, and learning inputs are not explicit.",
      nextAction: "Ask Aeonvera for a cognitive longevity plan tied to sleep, training, and nutrition signals.",
      evidence: { agentPreferences: signals.agentPreferences, clinicalInsights: signals.clinicalInsights, scenarios: signals.scenarios },
    }),
    domain("sleep", score(36, signals.wearables, 6, signals.dailyPlans, 2, signals.outcomes, 2), {
      currentState: "Sleep is interpreted through wearable trends, daily plans, and recovery outcomes.",
      desiredState: "Consistent sleep architecture that supports hormonal, cognitive, and metabolic health.",
      keyRisk: "Sleep protocols lose precision if wake time, latency, and recovery trends are missing.",
      nextAction: "Let the coach compare the last seven nights against caffeine, training, and schedule behavior.",
      evidence: { dailyPlans: signals.dailyPlans, outcomes: signals.outcomes, wearables: signals.wearables },
    }),
    domain("learning", score(30, signals.agentPreferences, 4, signals.scenarios, 3, signals.protocols, 2), {
      currentState: "Learning is beginning to form through preference memory and scenario modeling.",
      desiredState: "A personal growth loop that compounds skills and self-knowledge.",
      keyRisk: "Learning can remain reactive without a defined skill trajectory.",
      nextAction: "Define one capability Aeonvera should help compound over the next 90 days.",
      evidence: { agentPreferences: signals.agentPreferences, protocols: signals.protocols, scenarios: signals.scenarios },
    }),
    domain("productivity", score(32, signals.dailyPlans, 5, signals.protocols, 3, signals.agentPreferences, 2), {
      currentState: "Productivity is emerging from autopilot plans, preferences, and execution structure.",
      desiredState: "The day organizes itself around energy, focus, and strategic priorities.",
      keyRisk: "Calendar automation can optimize tasks without understanding deeper priorities.",
      nextAction: "Tell Aeonvera your highest-value weekly outcome so scheduling has a true north.",
      evidence: { agentPreferences: signals.agentPreferences, dailyPlans: signals.dailyPlans, protocols: signals.protocols },
    }),
    domain("emotional_resilience", score(31, signals.outcomes, 3, signals.agentPreferences, 4, signals.clinicalInsights, 2), {
      currentState: "Resilience is inferred from adherence patterns, stress language, and coach memory.",
      desiredState: "Stable emotional recovery under pressure.",
      keyRisk: "Stress interventions become generic if triggers and recovery rituals are not captured.",
      nextAction: "Log the biggest recurring friction point so Aeonvera can adapt tone and intervention timing.",
      evidence: { agentPreferences: signals.agentPreferences, clinicalInsights: signals.clinicalInsights, outcomes: signals.outcomes },
    }),
    domain("stress", score(33, signals.wearables, 3, signals.agentPreferences, 3, signals.outcomes, 3), {
      currentState: "Stress is modeled through recovery, memory, and intervention outcomes.",
      desiredState: "Lower allostatic load with fewer hidden recovery debts.",
      keyRisk: "Stress may look controlled while HRV, sleep, or adherence quietly deteriorate.",
      nextAction: "Let Aeonvera build a weekly stress load review from sleep, recovery, and skipped actions.",
      evidence: { agentPreferences: signals.agentPreferences, outcomes: signals.outcomes, wearables: signals.wearables },
    }),
    domain("relationships", score(28, signals.careNetwork, 6, signals.agentPreferences, 2, signals.scenarios, 1), {
      currentState: "Relationships are represented through care-network support and communication preferences.",
      desiredState: "The right people receive the right context at the right depth.",
      keyRisk: "Support systems stay passive if roles are not assigned clear purpose.",
      nextAction: "Invite one support role or define what kind of accountability would actually help.",
      evidence: { agentPreferences: signals.agentPreferences, careNetwork: signals.careNetwork, scenarios: signals.scenarios },
    }),
    domain("purpose", score(29, signals.scenarios, 5, signals.agentPreferences, 3, signals.dailyPlans, 1), {
      currentState: "Purpose is being inferred from future-self scenarios, preferences, and daily direction.",
      desiredState: "Health optimization serves a clear life trajectory, not just better metrics.",
      keyRisk: "Optimization can become scattered without a future identity to organize decisions.",
      nextAction: "Create a future-self scenario around the person you want to become in 12 months.",
      evidence: { agentPreferences: signals.agentPreferences, dailyPlans: signals.dailyPlans, scenarios: signals.scenarios },
    }),
    domain("financial_health", score(22, signals.scenarios, 1, signals.agentPreferences, 1, signals.dailyPlans, 1), {
      currentState: "Financial health is not deeply modeled yet; Aeonvera is reserving the domain.",
      desiredState: "Financial choices reinforce health, time, resilience, and long-term freedom.",
      keyRisk: "This domain needs explicit goals before it can become intelligent.",
      nextAction: "Define one financial constraint or opportunity that affects health and life design.",
      evidence: { agentPreferences: signals.agentPreferences, dailyPlans: signals.dailyPlans, scenarios: signals.scenarios },
    }),
  ];
}

function domain(
  key: LifeDomainKey,
  scoreValue: number,
  copy: Pick<LifeDomain, "currentState" | "desiredState" | "evidence" | "keyRisk" | "nextAction">
): LifeDomain {
  return {
    confidence: Math.min(0.95, Math.max(0.35, scoreValue / 100)),
    direction: scoreValue >= 70 ? "improving" : scoreValue >= 48 ? "stable" : "learning",
    domain: key,
    label: DOMAIN_LABELS[key],
    score: scoreValue,
    ...copy,
  };
}

function mergeSavedDomains(derived: LifeDomain[], savedRows: LifeProfileRow[]) {
  const saved = new Map(savedRows.map((row) => [row.domain, row]));

  return derived.map((item) => {
    const row = saved.get(item.domain);
    if (!row) return item;

    return {
      ...item,
      confidence: Number(row.confidence ?? item.confidence),
      currentState: row.current_state || item.currentState,
      desiredState: row.desired_state || item.desiredState,
      direction: row.direction || item.direction,
      evidence: row.evidence || item.evidence,
      keyRisk: row.key_risk || item.keyRisk,
      nextAction: row.next_action || item.nextAction,
      score: Number(row.score ?? item.score),
    };
  });
}

function score(base: number, a: number, aw: number, b: number, bw: number, c: number, cw: number) {
  return Math.min(96, Math.round(base + Math.min(6, a) * aw + Math.min(6, b) * bw + Math.min(6, c) * cw));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function trajectoryStatus(domains: LifeDomain[]) {
  const avg = average(domains.map((domain) => domain.score));
  if (avg >= 72) return "compounding";
  if (avg >= 52) return "organized";
  return "forming";
}

function buildSummary(domains: LifeDomain[], signals: Awaited<ReturnType<typeof loadSignals>>) {
  const totalSignals = Object.values(signals).reduce((sum, value) => sum + value, 0);
  const weakest = [...domains].sort((a, b) => a.score - b.score)[0];

  if (!totalSignals) {
    return "Life OS is ready, but it needs more personal signal before it can model the whole trajectory.";
  }

  return `Aeonvera is now reading ${totalSignals} cross-domain signals. The next evolution is to convert health intelligence into life trajectory intelligence, beginning with ${weakest?.label.toLowerCase() || "the clearest constraint"}.`;
}

async function safeCount(
  admin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  userId: string,
  userColumn = "user_id"
) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(userColumn, userId);

  if (error) return 0;
  return count || 0;
}

function isMissingLifeOsTable(error: { code?: string; message?: string }) {
  return error.code === "42P01" || /life_os_domain_profiles/i.test(error.message || "");
}
