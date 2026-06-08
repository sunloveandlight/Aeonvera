import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type PersonalityState = {
  userId: string;
  strictness: number;
  empathy: number;
  proactivity: number;
  lastUpdated: string;
};

type LearningSignal = {
  successRate: number;
  domainEffectiveness: Record<string, number>;
  totalSamples: number;
};

/**
 * MAIN ENTRY
 */
export async function updatePersonalityState(params: {
  userId: string;
  healthState: any;
  memory: any;
  recentCoachOutputs: any[];
  engagementScore: number;
}): Promise<PersonalityState> {
  const {
    userId,
    healthState,
    memory,
    recentCoachOutputs,
    engagementScore,
  } = params;

  const supabase = getSupabaseAdmin();

  const previous = await getPreviousState(supabase, userId);
  const learning = await getLearningSignal(supabase, userId);

  const strictness = computeStrictness({
    healthState,
    engagementScore,
    previous,
    learning,
  });

  const empathy = computeEmpathy({
    memory,
    healthState,
    engagementScore,
    previous,
    learning,
  });

  const proactivity = computeProactivity({
    engagementScore,
    memory,
    previous,
    learning,
  });

  const updated: PersonalityState = {
    userId,
    strictness,
    empathy,
    proactivity,
    lastUpdated: new Date().toISOString(),
  };

  await supabase.from("user_personality_state").upsert({
    user_id: userId,
    strictness,
    empathy,
    proactivity,
    updated_at: updated.lastUpdated,
  });

  return updated;
}

/**
 * STRICTNESS EVOLUTION
 */
function computeStrictness({ healthState, engagementScore, previous, learning }: any) {
  const baseRisk =
    (healthState?.riskScores?.sleep ?? 0) +
    (healthState?.riskScores?.activity ?? 0);

  let strictness = baseRisk / 2;

  if (learning.successRate < 0.4) strictness += 15;
  if (learning.successRate > 0.7) strictness -= 10;
  if (engagementScore < 0.3) strictness += 10;

  return clamp(strictness, 0, 100);
}

/**
 * EMPATHY EVOLUTION
 */
function computeEmpathy({ memory, healthState, engagementScore, previous, learning }: any) {
  let empathy = 50;

  if (memory?.dominantEmotionalTone === "negative") empathy += 20;
  if ((healthState?.riskScores?.sleep ?? 0) > 70) empathy += 10;
  if (engagementScore < 0.4) empathy += 10;
  if (learning.successRate < 0.4) empathy += 10;
  if (learning.successRate > 0.7) empathy -= 5;

  return clamp(empathy, 0, 100);
}

/**
 * PROACTIVITY EVOLUTION
 */
function computeProactivity({ engagementScore, memory, previous, learning }: any) {
  let p = 50;

  if (engagementScore < 0.4) p += 20;
  if (memory?.recurringTopics?.length > 2) p += 10;
  if (learning.successRate > 0.7) p += 15;
  if (learning.successRate < 0.4) p -= 10;

  return clamp(p, 0, 100);
}

/**
 * LEARNING SIGNAL FETCH
 */
async function getLearningSignal(
  supabase: ReturnType<typeof import("@/lib/supabase/admin").getSupabaseAdmin>,
  userId: string
): Promise<LearningSignal> {
  const { data } = await supabase
    .from("intervention_outcomes")
    .select("*")
    .eq("user_id", userId)
    .limit(100);

  const outcomes = data || [];

  const successRate =
    outcomes.length > 0
      ? outcomes.filter((o) => o.success).length / outcomes.length
      : 0.5;

  const domainEffectiveness: Record<string, number> = {};

  for (const o of outcomes) {
    if (!domainEffectiveness[o.domain]) {
      domainEffectiveness[o.domain] = 0;
    }
    domainEffectiveness[o.domain] += o.success ? 1 : -1;
  }

  return {
    successRate,
    domainEffectiveness,
    totalSamples: outcomes.length,
  };
}

/**
 * PREVIOUS STATE
 */
async function getPreviousState(
  supabase: ReturnType<typeof import("@/lib/supabase/admin").getSupabaseAdmin>,
  userId: string
) {
  const { data } = await supabase
    .from("user_personality_state")
    .select("*")
    .eq("user_id", userId)
    .single();

  return data || null;
}

/**
 * UTILITY
 */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}