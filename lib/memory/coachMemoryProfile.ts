import { buildExecutionSummary, getExecutionWindow } from "@/lib/execution/executionSummary";
import { healthSubjectInsertFields, type ActiveHealthProfileContext } from "@/lib/health-profiles/activeHealthProfile";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type OutcomeRow = {
  domain?: string | null;
  action?: string | null;
  outcome?: string | null;
  success?: boolean | null;
  notes?: string | null;
  measured_at?: string | null;
  created_at?: string | null;
};

type CoachOutputRow = {
  tone?: string | null;
  message?: string | null;
  actions?: string[] | null;
  created_at?: string | null;
};

type FeedbackRow = {
  domain?: string | null;
  action?: string | null;
  outcome?: string | null;
  success?: boolean | null;
  confidence?: number | string | null;
  created_at?: string | null;
};

type CalendarRow = {
  action?: string | null;
  action_scope?: string | null;
  recurrence?: string | null;
  scheduled_for?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const COACH_MEMORY_PROFILE_VERSION = 3;

export type CoachMemoryProfile = {
  communicationStyle: "encouraging" | "accountability" | "direct" | "balanced";
  motivationProfile: {
    primaryDriver: string;
    needs: string;
    toneReason: string;
    version?: number;
  };
  failurePatterns: Array<{
    label: string;
    count: number;
    actions: string[];
  }>;
  bestInterventions: Array<{
    domain: string;
    action: string;
    successCount: number;
  }>;
  domainScores: Record<string, number>;
  morningBrief: string;
  confidence: number;
  lastComputedAt: string;
};

export async function loadOrBuildCoachMemoryProfile(
  supabase: SupabaseAdmin,
  userId: string,
  healthProfileContext?: ActiveHealthProfileContext | null
): Promise<CoachMemoryProfile | null> {
  const existing = await loadStoredCoachMemoryProfile(supabase, userId, healthProfileContext);
  const isFresh =
    existing &&
    existing.motivationProfile.version === COACH_MEMORY_PROFILE_VERSION &&
    Date.now() - new Date(existing.lastComputedAt).getTime() < 6 * 60 * 60 * 1000;

  if (isFresh) return existing;

  const profile = await buildCoachMemoryProfile(supabase, userId, healthProfileContext);
  await storeCoachMemoryProfile(supabase, userId, profile, healthProfileContext);
  return profile;
}

export async function buildCoachMemoryProfile(
  supabase: SupabaseAdmin,
  userId: string,
  healthProfileContext?: ActiveHealthProfileContext | null
): Promise<CoachMemoryProfile> {
  const window = getExecutionWindow();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const subjectColumn = healthProfileContext?.healthProfileId ? "health_profile_id" : "user_id";
  const subjectValue = healthProfileContext?.healthProfileId || userId;

  const [outcomesResult, calendarResult, coachResult, feedbackResult] = await Promise.all([
    supabase
      .from("intervention_outcomes")
      .select("domain, action, outcome, success, notes, measured_at, created_at")
      .eq(subjectColumn, subjectValue)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(160),
    supabase
      .from("calendar_events")
      .select("action, action_scope, recurrence, scheduled_for, status, created_at")
      .eq(subjectColumn, subjectValue)
      .gte("scheduled_for", window.startIso)
      .order("scheduled_for", { ascending: false })
      .limit(100),
    supabase
      .from("coach_outputs")
      .select("tone, message, actions, created_at")
      .eq(subjectColumn, subjectValue)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("behavior_learning_events")
      .select("domain, action, outcome, confidence, created_at")
      .eq(subjectColumn, subjectValue)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  logUnexpectedError("Coach memory outcomes", outcomesResult.error);
  logUnexpectedError("Coach memory calendar", calendarResult.error);
  logUnexpectedError("Coach memory outputs", coachResult.error);
  logUnexpectedError("Coach memory feedback", feedbackResult.error);

  const outcomes = outcomesResult.error ? [] : ((outcomesResult.data || []) as OutcomeRow[]);
  const calendarEvents = calendarResult.error ? [] : ((calendarResult.data || []) as CalendarRow[]);
  const coachOutputs = coachResult.error ? [] : ((coachResult.data || []) as CoachOutputRow[]);
  const feedback = feedbackResult.error ? [] : ((feedbackResult.data || []) as FeedbackRow[]);
  const execution = buildExecutionSummary({ outcomes, calendarEvents });
  const domainScores = buildDomainScores(outcomes, feedback);
  const bestInterventions = buildBestInterventions(outcomes, feedback);
  const communicationStyle = chooseCommunicationStyle({
    score: execution.score,
    total: execution.total,
    skipped: execution.skipped,
    deferred: execution.deferred,
    coachOutputs,
  });
  const failurePatterns = execution.skippedPatterns.slice(0, 4);
  const motivationProfile = buildMotivationProfile({
    communicationStyle,
    executionScore: execution.score,
    failurePatterns,
    bestInterventions,
  });
  const confidence = buildConfidence(execution.total, coachOutputs.length, feedback.length);

  return {
    communicationStyle,
    motivationProfile,
    failurePatterns,
    bestInterventions,
    domainScores,
    morningBrief: buildMorningBrief({
      executionScore: execution.score,
      total: execution.total,
      completed: execution.completed,
      skipped: execution.skipped,
      scheduled: execution.scheduled,
      failurePatterns,
      bestInterventions,
      communicationStyle,
    }),
    confidence,
    lastComputedAt: new Date().toISOString(),
  };
}

export async function loadStoredCoachMemoryProfile(
  supabase: SupabaseAdmin,
  userId: string,
  healthProfileContext?: ActiveHealthProfileContext | null
): Promise<CoachMemoryProfile | null> {
  const subjectColumn = healthProfileContext?.healthProfileId ? "health_profile_id" : "user_id";
  const subjectValue = healthProfileContext?.healthProfileId || userId;
  const { data, error } = await supabase
    .from("coach_memory_profiles")
    .select(
      "communication_style, motivation_profile, failure_patterns, best_interventions, domain_scores, morning_brief, confidence, last_computed_at"
    )
    .eq(subjectColumn, subjectValue)
    .maybeSingle();

  if (error) {
    if (!isMissingMemoryTable(error)) {
      console.error("[Coach Memory Load Error]", error.message);
    }
    return null;
  }

  if (!data) return null;

  return {
    communicationStyle: normalizeCommunicationStyle(data.communication_style),
    motivationProfile: safeObject(data.motivation_profile) as CoachMemoryProfile["motivationProfile"],
    failurePatterns: safeArray(data.failure_patterns) as CoachMemoryProfile["failurePatterns"],
    bestInterventions: safeArray(data.best_interventions) as CoachMemoryProfile["bestInterventions"],
    domainScores: safeObject(data.domain_scores) as Record<string, number>,
    morningBrief: String(data.morning_brief || ""),
    confidence: Number(data.confidence) || 0.35,
    lastComputedAt: String(data.last_computed_at || new Date().toISOString()),
  };
}

async function storeCoachMemoryProfile(
  supabase: SupabaseAdmin,
  userId: string,
  profile: CoachMemoryProfile,
  healthProfileContext?: ActiveHealthProfileContext | null
) {
  const payload = {
    user_id: userId,
    ...(healthProfileContext
      ? healthSubjectInsertFields(healthProfileContext)
      : { health_profile_id: null }),
    communication_style: profile.communicationStyle,
    motivation_profile: profile.motivationProfile,
    failure_patterns: profile.failurePatterns,
    best_interventions: profile.bestInterventions,
    domain_scores: profile.domainScores,
    morning_brief: profile.morningBrief,
    confidence: profile.confidence,
    last_computed_at: profile.lastComputedAt,
    updated_at: new Date().toISOString(),
  };
  const healthProfileId = healthProfileContext?.healthProfileId || null;
  const result = healthProfileId
    ? await updateOrInsertByHealthProfile(supabase, healthProfileId, payload)
    : await supabase.from("coach_memory_profiles").upsert(payload, { onConflict: "user_id" });
  const error = result.error;

  if (error && !isMissingMemoryTable(error)) {
    console.error("[Coach Memory Store Error]", error.message);
  }
}

async function updateOrInsertByHealthProfile(
  supabase: SupabaseAdmin,
  healthProfileId: string,
  payload: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("coach_memory_profiles")
    .update(payload)
    .eq("health_profile_id", healthProfileId)
    .select("id")
    .maybeSingle();

  if (error && !isMissingMemoryTable(error)) return { error };
  if (data) return { error: null };

  return await supabase.from("coach_memory_profiles").insert(payload);
}

function chooseCommunicationStyle({
  score,
  total,
  skipped,
  deferred,
  coachOutputs,
}: {
  score: number;
  total: number;
  skipped: number;
  deferred: number;
  coachOutputs: CoachOutputRow[];
}): CoachMemoryProfile["communicationStyle"] {
  if (total >= 4 && skipped > deferred && score < 50) return "accountability";
  if (total >= 4 && score >= 80) return "direct";
  if (coachOutputs.some((output) => output.tone === "urgent") && score < 65) {
    return "encouraging";
  }
  return "balanced";
}

function buildDomainScores(outcomes: OutcomeRow[], feedback: FeedbackRow[]) {
  const domains = new Map<string, { success: number; total: number }>();

  for (const item of [...outcomes, ...feedback]) {
    const domain = normalizeDomainLabel(item.domain);
    const current = domains.get(domain) || { success: 0, total: 0 };
    current.total += 1;
    if (item.outcome === "success" || item.success === true) current.success += 1;
    domains.set(domain, current);
  }

  return Object.fromEntries(
    Array.from(domains.entries()).map(([domain, value]) => [
      domain,
      value.total ? Math.round((value.success / value.total) * 100) : 0,
    ])
  );
}

function buildBestInterventions(outcomes: OutcomeRow[], feedback: FeedbackRow[]) {
  const successful = new Map<string, { domain: string; action: string; successCount: number }>();

  for (const item of [...outcomes, ...feedback]) {
    if (item.outcome !== "success" && item.success !== true) continue;

    const domain = normalizeDomainLabel(item.domain);
    const action = String(item.action || "Protocol action").slice(0, 180);
    const key = `${domain}:${action.toLowerCase()}`;
    const current = successful.get(key) || { domain, action, successCount: 0 };
    current.successCount += 1;
    successful.set(key, current);
  }

  return Array.from(successful.values())
    .sort((a, b) => b.successCount - a.successCount)
    .slice(0, 5);
}

function buildMotivationProfile({
  communicationStyle,
  executionScore,
  failurePatterns,
  bestInterventions,
}: {
  communicationStyle: CoachMemoryProfile["communicationStyle"];
  executionScore: number;
  failurePatterns: CoachMemoryProfile["failurePatterns"];
  bestInterventions: CoachMemoryProfile["bestInterventions"];
}) {
  const strongest = bestInterventions[0]?.domain || "consistency";
  const hardest = failurePatterns[0]?.label || "execution rhythm";

  return {
    version: COACH_MEMORY_PROFILE_VERSION,
    primaryDriver:
      executionScore >= 80
        ? "momentum"
        : communicationStyle === "accountability"
          ? "clear commitments"
          : "small wins",
    needs:
      communicationStyle === "encouraging"
        ? "supportive language and smaller next steps"
        : communicationStyle === "accountability"
          ? `clear accountability around ${domainPhrase(hardest)} rhythm`
          : `steady emphasis on the ${domainPhrase(strongest)} protocol`,
    toneReason: `Aeonvera selected a ${communicationStyle} coaching style from your recent response patterns.`,
  };
}

function buildMorningBrief({
  executionScore,
  total,
  completed,
  skipped,
  scheduled,
  failurePatterns,
  bestInterventions,
  communicationStyle,
}: {
  executionScore: number;
  total: number;
  completed: number;
  skipped: number;
  scheduled: number;
  failurePatterns: CoachMemoryProfile["failurePatterns"];
  bestInterventions: CoachMemoryProfile["bestInterventions"];
  communicationStyle: CoachMemoryProfile["communicationStyle"];
}) {
  if (!total && scheduled) {
    return `${scheduled} protocol block${scheduled === 1 ? "" : "s"} are scheduled. Today is about closing the loop so Aeonvera can understand what truly fits your life.`;
  }

  if (!total) {
    return "Begin with one deliberate protocol action today. Aeonvera will learn your rhythm from the choices you actually live.";
  }

  const strongest = bestInterventions[0]?.domain;
  const weakest = failurePatterns[0]?.label;

  if (communicationStyle === "accountability" && weakest) {
    return `Good morning. You completed ${completed} of ${total} actions. ${domainPhrase(weakest)} is asking for a simpler path, so today Aeonvera is narrowing the field to what is most doable.`;
  }

  if (executionScore >= 80) {
    return `Good morning. Your protocol rhythm is strong at ${executionScore}%. Keep the structure steady today and let the momentum compound quietly.`;
  }

  return `Good morning. You completed ${completed} of ${total} actions and skipped ${skipped}. ${strongest ? `Your ${domainPhrase(strongest)} work is the most responsive right now. ` : ""}Today is about one deliberate action that restores alignment.`;
}

function buildConfidence(total: number, coachOutputs: number, feedback: number) {
  const raw = 0.25 + Math.min(total, 10) * 0.045 + Math.min(coachOutputs, 8) * 0.025 + Math.min(feedback, 8) * 0.025;
  return Math.min(0.92, Number(raw.toFixed(2)));
}

function normalizeCommunicationStyle(value: unknown): CoachMemoryProfile["communicationStyle"] {
  return value === "encouraging" ||
    value === "accountability" ||
    value === "direct" ||
    value === "balanced"
    ? value
    : "balanced";
}

function normalizeDomainLabel(value: unknown) {
  const domain = typeof value === "string" && value.trim() ? value.trim() : "Optimization";
  return domain.slice(0, 60);
}

function domainPhrase(domain: string) {
  const value = domain.toLowerCase();

  if (value.includes("stress")) return "stress-reduction";
  if (value.includes("sleep")) return "sleep";
  if (value.includes("training") || value.includes("activity")) return "training";
  if (value.includes("nutrition")) return "nutrition";
  if (value.includes("recovery")) return "recovery";

  return domain;
}

function safeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function logUnexpectedError(label: string, error: { code?: string; message?: string } | null) {
  if (!error || isMissingMemorySource(error)) return;
  console.error(`[${label} Error]`, error.message);
}

function isMissingMemoryTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("coach_memory_profiles") ||
    error.message?.includes("schema cache")
  );
}

function isMissingMemorySource(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache")
  );
}
