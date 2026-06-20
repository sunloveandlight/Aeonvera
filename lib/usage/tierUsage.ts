import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getUsageLimit,
  isSubscriptionValid,
  PLAN_LABEL,
  type Plan,
  type SubscriptionStatus,
  type UsageMeter,
} from "@/lib/auth/permissions";
import { getWorkspaceSubscriptionForUser } from "@/lib/auth/workspaceSubscription";

type ProfileRow = {
  plan?: Plan | null;
  subscription_status?: SubscriptionStatus | null;
};

type UsageCheck = {
  allowed: boolean;
  limit: number;
  remaining: number;
  used: number;
  meter: UsageMeter;
  periodStart: string;
  plan: Plan | null;
  migrationRequired?: boolean;
  message?: string;
  statusCode?: number;
};

export async function getUserPlanForUsage({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<{
  plan: Plan | null;
  status: SubscriptionStatus | null;
}> {
  const workspaceSubscription = await getWorkspaceSubscriptionForUser({
    supabase,
    userId,
  });

  if (workspaceSubscription) {
    return {
      plan: workspaceSubscription.plan,
      status: workspaceSubscription.status,
    };
  }

  const { data } = await supabase
    .from("profiles")
    .select("plan,subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  const profile = data as ProfileRow | null;

  return {
    plan: profile?.plan || null,
    status: profile?.subscription_status || null,
  };
}

export async function checkAndRecordUsage({
  metadata = {},
  meter,
  plan,
  status,
  supabase,
  userId,
}: {
  metadata?: Record<string, unknown>;
  meter: UsageMeter;
  plan: Plan | null;
  status: SubscriptionStatus | null;
  supabase: SupabaseClient;
  userId: string;
}): Promise<UsageCheck> {
  const check = await getUsageSnapshot({
    meter,
    plan,
    status,
    supabase,
    userId,
  });

  if (!check.allowed || check.migrationRequired) return check;

  const { error } = await supabase.from("usage_events").insert({
    user_id: userId,
    meter,
    plan,
    metadata,
  });

  if (error) {
    if (isMissingUsageTable(error)) {
      return { ...check, migrationRequired: true };
    }

    throw error;
  }

  return {
    ...check,
    used: check.used + 1,
    remaining: Math.max(check.remaining - 1, 0),
  };
}

export async function getUsageSnapshot({
  meter,
  plan,
  status,
  supabase,
  userId,
}: {
  meter: UsageMeter;
  plan: Plan | null;
  status: SubscriptionStatus | null;
  supabase: SupabaseClient;
  userId: string;
}): Promise<UsageCheck> {
  const periodStart = getCurrentMonthStart();
  const limit = getUsageLimit(plan, status, meter);

  if (!plan || !isSubscriptionValid(status) || !limit) {
    return {
      allowed: false,
      limit: 0,
      remaining: 0,
      used: 0,
      meter,
      periodStart,
      plan,
      message: "Activate a plan to use this intelligence layer.",
      statusCode: 402,
    };
  }

  if (limit.monthly <= 0) {
    return {
      allowed: false,
      limit: limit.monthly,
      remaining: 0,
      used: 0,
      meter,
      periodStart,
      plan,
      message: `${limit.label} are not included in ${PLAN_LABEL[plan]}.`,
      statusCode: 403,
    };
  }

  const { count, error } = await supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("meter", meter)
    .gte("created_at", periodStart);

  if (error) {
    if (isMissingUsageTable(error)) {
      return {
        allowed: true,
        limit: limit.monthly,
        remaining: limit.monthly,
        used: 0,
        meter,
        periodStart,
        plan,
        migrationRequired: true,
      };
    }

    throw error;
  }

  const used = count || 0;
  const remaining = Math.max(limit.monthly - used, 0);

  if (remaining <= 0) {
    return {
      allowed: false,
      limit: limit.monthly,
      remaining: 0,
      used,
      meter,
      periodStart,
      plan,
      message: `You have used all ${limit.monthly.toLocaleString()} monthly ${limit.label} included in ${PLAN_LABEL[plan]}.`,
      statusCode: 429,
    };
  }

  return {
    allowed: true,
    limit: limit.monthly,
    remaining,
    used,
    meter,
    periodStart,
    plan,
  };
}

export function usageErrorResponse(check: UsageCheck) {
  return {
    error: check.message || "This tier limit has been reached.",
    usage: serializeUsage(check),
  };
}

export function serializeUsage(check: UsageCheck) {
  return {
    allowed: check.allowed,
    limit: check.limit,
    meter: check.meter,
    migrationRequired: Boolean(check.migrationRequired),
    periodStart: check.periodStart,
    plan: check.plan,
    remaining: check.remaining,
    used: check.used,
  };
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function isMissingUsageTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.message?.includes("usage_events") ||
    error.message?.includes("schema cache")
  );
}
