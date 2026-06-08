/**
 * Aeonvera — Adaptive Personality Engine (STEP 25)
 * -------------------------------------------------
 * Dynamically adjusts AI coaching personality over time
 */

import { supabase } from "@/lib/supabase/client";

export type PersonalityState = {
  userId: string;

  strictness: number; // 0–100
  empathy: number; // 0–100
  proactivity: number; // 0–100

  lastUpdated: string;
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

  const previous = await getPreviousState(userId);

  const strictness = computeStrictness({
    healthState,
    engagementScore,
    previous,
  });

  const empathy = computeEmpathy({
    memory,
    healthState,
    engagementScore,
    previous,
  });

  const proactivity = computeProactivity({
    engagementScore,
    memory,
    previous,
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
 * STRICTNESS ENGINE
 */
function computeStrictness({
  healthState,
  engagementScore,
  previous,
}: any) {
  const risk =
    (healthState?.riskScores?.sleep ?? 0) +
    (healthState?.riskScores?.activity ?? 0);

  let base = risk / 2;

  if (engagementScore < 0.3) base += 10; // user ignoring system
  if (engagementScore > 0.7) base -= 5;

  return clamp(base, 0, 100);
}

/**
 * EMPATHY ENGINE
 */
function computeEmpathy({
  memory,
  healthState,
  engagementScore,
}: any) {
  let empathy = 60;

  if (memory?.dominantEmotionalTone === "negative") {
    empathy += 20;
  }

  if ((healthState?.riskScores?.sleep ?? 0) > 70) {
    empathy += 10;
  }

  if (engagementScore < 0.4) {
    empathy += 15; // soften tone when user disengaged
  }

  return clamp(empathy, 0, 100);
}

/**
 * PROACTIVITY ENGINE
 */
function computeProactivity({ engagementScore, memory }: any) {
  let p = 50;

  if (engagementScore < 0.4) p += 20;
  if (memory?.recurringTopics?.length > 2) p += 15;

  return clamp(p, 0, 100);
}

/**
 * GET PREVIOUS STATE
 */
async function getPreviousState(userId: string) {
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