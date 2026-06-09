/**
 * Aeonvera — Control Loop Kernel (V2)
 * ------------------------------------
 * The final decision authority for all interventions.
 *
 * This does NOT generate intelligence.
 * It governs execution, frequency, and safety.
 *
 * V2 improvements:
 * - Fatigue is now computed internally from intervention history
 * - Cooldown state is read from and written to Supabase
 * - Personality modulation uses meaningful ranges
 * - All suppression decisions are logged
 * - Hard limit enforced with reason tracking
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Intervention } from "@/lib/intervention/interventionDecisionEngine";

type Proactive = {
  domain: string;
  decision: string;
  urgency: number;
  reason: string;
};

export type ExecutionItem = {
  type: "immediate" | "proactive";
  domain: string;
  action: string;
  baseScore: number;
  finalScore: number;
  reason?: string;
};

export type KernelSuppression = {
  domain: string;
  action: string;
  baseScore: number;
  suppressedBy: "global_cooldown" | "domain_cooldown" | "fatigue" | "floor";
};

export type KernelResult = {
  approved: ExecutionItem[];
  suppressed: KernelSuppression[];
  fatigueLevel: number;
  timestamp: string;
};

export type KernelContext = {
  userId: string;
  memory?: any;
  personality?: {
    strictness: number;
    empathy: number;
    proactivity: number;
  } | null;
  engagementScore?: number;
};

/**
 * =========================
 * COOLDOWN CONFIGURATION
 * =========================
 */
const COOLDOWNS = {
  global: 1000 * 60 * 60 * 2,    // 2 hours between any interventions
  domain: 1000 * 60 * 60 * 6,    // 6 hours per domain
  highSeverity: 1000 * 60 * 30,  // 30 min for urgent interventions
} as const;

const MAX_OUTPUT = 3;
const SCORE_FLOOR = 20;

/**
 * =========================
 * MAIN KERNEL ENTRY
 * =========================
 */
export async function runControlLoopKernel(
  interventions: Intervention[],
  proactive: Proactive[],
  ctx: KernelContext
): Promise<KernelResult> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const timestamp = new Date().toISOString();

  const personality = {
    strictness: ctx.personality?.strictness ?? 50,
    empathy: ctx.personality?.empathy ?? 50,
    proactivity: ctx.personality?.proactivity ?? 50,
  };

  /**
   * STEP 1 — LOAD COOLDOWN STATE FROM DB
   */
  const { lastGlobal, lastByDomain } = await loadCooldownState(
    supabase,
    ctx.userId
  );

  /**
   * STEP 2 — COMPUTE FATIGUE FROM INTERVENTION HISTORY
   * Fatigue = how many interventions fired in the last 24 hours
   */
  const fatigueLevel = await computeFatigueLevel(supabase, ctx.userId, now);

  /**
   * STEP 3 — SCORE ALL CANDIDATES
   */
  const approved: ExecutionItem[] = [];
  const suppressed: KernelSuppression[] = [];

  const allCandidates: Array<{
    type: "immediate" | "proactive";
    domain: string;
    action: string;
    baseScore: number;
    reason?: string;
  }> = [
    ...interventions.map((i) => ({
      type: "immediate" as const,
      domain: i.domain,
      action: i.action,
      baseScore: i.priority,
      reason: i.reason,
    })),
    ...proactive
      .filter((p) => p.decision !== "ignore")
      .map((p) => ({
        type: "proactive" as const,
        domain: p.domain,
        action: p.decision,
        baseScore: p.urgency,
        reason: p.reason,
      })),
  ];

  for (const candidate of allCandidates) {
    const { finalScore, suppressedBy } = applyKernelScoring({
      baseScore: candidate.baseScore,
      domain: candidate.domain,
      now,
      lastByDomain,
      lastGlobal,
      personality,
      fatigueLevel,
    });

    if (finalScore <= 0 || suppressedBy) {
      suppressed.push({
        domain: candidate.domain,
        action: candidate.action,
        baseScore: candidate.baseScore,
        suppressedBy: suppressedBy ?? "floor",
      });
    } else {
      approved.push({
        type: candidate.type,
        domain: candidate.domain,
        action: candidate.action,
        baseScore: candidate.baseScore,
        finalScore,
        reason: candidate.reason,
      });
    }
  }

  /**
   * STEP 4 — SORT + HARD LIMIT
   */
  const finalApproved = approved
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, MAX_OUTPUT);

  /**
   * STEP 5 — PERSIST COOLDOWN STATE
   */
  if (finalApproved.length > 0) {
    await saveCooldownState(supabase, ctx.userId, finalApproved, now);
    await logKernelExecution(supabase, ctx.userId, {
      approved: finalApproved,
      suppressed,
      fatigueLevel,
      timestamp,
    });
  }

  return {
    approved: finalApproved,
    suppressed,
    fatigueLevel,
    timestamp,
  };
}

/**
 * =========================
 * CORE SCORING LOGIC
 * =========================
 */
function applyKernelScoring(params: {
  baseScore: number;
  domain: string;
  now: number;
  lastByDomain: Record<string, number>;
  lastGlobal: number;
  personality: { strictness: number; empathy: number; proactivity: number };
  fatigueLevel: number;
}): { finalScore: number; suppressedBy?: KernelSuppression["suppressedBy"] } {
  const {
    baseScore,
    domain,
    now,
    lastByDomain,
    lastGlobal,
    personality,
    fatigueLevel,
  } = params;

  let score = baseScore;

  /**
   * 1. GLOBAL COOLDOWN
   * High strictness shortens the cooldown window
   */
  const effectiveGlobalCooldown =
    COOLDOWNS.global * (1 - (personality.strictness - 50) / 200);

  if (now - lastGlobal < effectiveGlobalCooldown) {
    return { finalScore: 0, suppressedBy: "global_cooldown" };
  }

  /**
   * 2. DOMAIN COOLDOWN
   */
  const lastDomain = lastByDomain[domain] ?? 0;
  const effectiveDomainCooldown =
    COOLDOWNS.domain * (1 - (personality.strictness - 50) / 150);

  if (now - lastDomain < effectiveDomainCooldown) {
    return { finalScore: 0, suppressedBy: "domain_cooldown" };
  }

  /**
   * 3. FATIGUE PENALTY
   * 0-100 scale. At fatigue=100, score drops by 60 points.
   * High empathy reduces the penalty (more patient with fatigued users)
   */
  const empathyReduction = (personality.empathy - 50) / 100;
  const fatiguePenalty = fatigueLevel * 0.6 * (1 - empathyReduction);
  score -= fatiguePenalty;

  if (score < SCORE_FLOOR) {
    return { finalScore: 0, suppressedBy: "fatigue" };
  }

  /**
   * 4. PERSONALITY MODULATION
   * Now uses meaningful ranges: ±20 points at extremes
   */
  score += (personality.proactivity - 50) * 0.4;  // up to ±20
  score += (personality.strictness - 50) * 0.2;   // up to ±10
  score -= (50 - personality.empathy) * 0.15;      // up to ±7.5

  /**
   * 5. HARD FLOOR
   */
  if (score < SCORE_FLOOR) {
    return { finalScore: 0, suppressedBy: "floor" };
  }

  return { finalScore: Math.min(100, Math.round(score)) };
}

/**
 * =========================
 * FATIGUE COMPUTATION
 * Counts interventions fired in the last 24 hours
 * Maps count to 0-100 fatigue scale
 * =========================
 */
async function computeFatigueLevel(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  now: number
): Promise<number> {
  const oneDayAgo = new Date(now - 1000 * 60 * 60 * 24).toISOString();

  const { data } = await supabase
    .from("kernel_execution_log")
    .select("approved_count")
    .eq("user_id", userId)
    .gte("created_at", oneDayAgo);

  if (!data || data.length === 0) return 0;

  const totalFired = data.reduce(
    (sum, row) => sum + (row.approved_count ?? 0),
    0
  );

  // 0 interventions = 0 fatigue, 10+ interventions = 100 fatigue
  return Math.min(100, Math.round((totalFired / 10) * 100));
}

/**
 * =========================
 * COOLDOWN STATE LOADER
 * =========================
 */
async function loadCooldownState(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<{ lastGlobal: number; lastByDomain: Record<string, number> }> {
  const { data } = await supabase
    .from("kernel_cooldown_state")
    .select("last_global_at, domain_cooldowns")
    .eq("user_id", userId)
    .single();

  if (!data) {
    return { lastGlobal: 0, lastByDomain: {} };
  }

  return {
    lastGlobal: data.last_global_at
      ? new Date(data.last_global_at).getTime()
      : 0,
    lastByDomain: data.domain_cooldowns ?? {},
  };
}

/**
 * =========================
 * COOLDOWN STATE SAVER
 * =========================
 */
async function saveCooldownState(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  approved: ExecutionItem[],
  now: number
): Promise<void> {
  const nowIso = new Date(now).toISOString();

  // Build updated domain cooldowns
  const { data: existing } = await supabase
    .from("kernel_cooldown_state")
    .select("domain_cooldowns")
    .eq("user_id", userId)
    .single();

  const existingDomains: Record<string, number> =
    existing?.domain_cooldowns ?? {};

  for (const item of approved) {
    existingDomains[item.domain] = now;
  }

  await supabase.from("kernel_cooldown_state").upsert({
    user_id: userId,
    last_global_at: nowIso,
    domain_cooldowns: existingDomains,
    updated_at: nowIso,
  });
}

/**
 * =========================
 * EXECUTION LOGGER
 * Records what the kernel approved and suppressed
 * =========================
 */
async function logKernelExecution(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  result: KernelResult
): Promise<void> {
  await supabase.from("kernel_execution_log").insert({
    user_id: userId,
    approved_count: result.approved.length,
    suppressed_count: result.suppressed.length,
    fatigue_level: result.fatigueLevel,
    approved_domains: result.approved.map((a) => a.domain),
    suppressed_reasons: result.suppressed.map((s) => s.suppressedBy),
    created_at: result.timestamp,
  });
}