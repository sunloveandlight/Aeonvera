import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PLAN_HEALTH_PROFILE_LIMITS,
  PLAN_LABEL,
  type Plan,
  type SubscriptionStatus,
} from "@/lib/auth/permissions";

type WorkspaceRow = {
  current_period_end: string | null;
  id: string;
  max_health_profiles: number | null;
  name: string | null;
  owner_user_id: string;
  plan: Plan | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus | null;
  updated_at: string | null;
};

type WorkspaceMemberRow = {
  role: string | null;
  workspace_id: string;
};

type HealthProfileRow = {
  created_at: string | null;
  display_name: string | null;
  id: string;
  is_primary: boolean | null;
  relationship: string | null;
  status: string | null;
};

type StripeEventRow = {
  id: string;
  created_at?: string | null;
};

type ConciergeRequestRow = {
  contact_email: string | null;
  created_at: string | null;
  fulfillment_checklist: ConciergeChecklistItem[] | null;
  fulfillment_stage: string | null;
  id: string;
  payment_status: string | null;
  requested_scope: string[] | null;
  status: string | null;
};

type ConciergeChecklistItem = {
  key?: string | null;
  label?: string | null;
  status?: string | null;
};

type ReferralApplicationRow = {
  contact_email: string | null;
  created_at: string | null;
  id: string;
  partner_type: string | null;
  referral_code: string | null;
  status: string | null;
};

export type WorkspaceDiagnostics = {
  currentUserRole: string;
  env: Array<{ configured: boolean; name: string }>;
  healthProfiles: {
    active: number;
    frozen: number;
    total: number;
    writable: number;
  };
  planLimits: Array<{ label: string; maxProfiles: number; plan: Plan }>;
  profiles: Array<{
    displayName: string;
    frozen: boolean;
    id: string;
    isPrimary: boolean;
    relationship: string;
    status: string;
  }>;
  revenue: {
    concierge: Array<{
      checklist: Array<{
        key: string;
        label: string;
        status: string;
      }>;
      contactEmail: string;
      createdAt: string | null;
      fulfillmentStage: string;
      id: string;
      paymentStatus: string;
      scopeCount: number;
      status: string;
    }>;
    referrals: Array<{
      contactEmail: string;
      createdAt: string | null;
      id: string;
      partnerType: string;
      referralCode: string;
      status: string;
    }>;
  };
  stripe: {
    customerLinked: boolean;
    latestEventId: string | null;
    priceLinked: boolean;
    recentEventCount: number;
    subscriptionLinked: boolean;
  };
  workspace: {
    currentPeriodEnd: string | null;
    id: string;
    maxHealthProfiles: number;
    name: string;
    plan: Plan;
    planLabel: string;
    status: string;
    subscriptionStatus: SubscriptionStatus;
    updatedAt: string | null;
  };
};

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CORE_PRICE_ID",
  "STRIPE_ELITE_PRICE_ID",
  "STRIPE_SOVEREIGN_PRICE_ID",
  "STRIPE_SOVEREIGN_CONCIERGE_PRICE_ID",
  "NEXT_PUBLIC_SITE_URL",
  "CRON_SECRET",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "OPS_ALERT_EMAIL",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
] as const;

export function getOpsEnvStatus() {
  return REQUIRED_ENV.map((name) => ({
    configured: Boolean(process.env[name]),
    name,
  }));
}

export async function getWorkspaceDiagnostics({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<WorkspaceDiagnostics | null> {
  const membership = await supabase
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<WorkspaceMemberRow>();

  if (membership.error || !membership.data?.workspace_id) {
    return null;
  }

  const workspaceResult = await supabase
    .from("workspaces")
    .select(
      "id,owner_user_id,name,plan,subscription_status,stripe_customer_id,stripe_subscription_id,stripe_price_id,current_period_end,max_health_profiles,status,updated_at"
    )
    .eq("id", membership.data.workspace_id)
    .maybeSingle<WorkspaceRow>();

  if (workspaceResult.error || !workspaceResult.data) {
    return null;
  }

  const workspace = workspaceResult.data;
  const maxHealthProfiles = Math.max(Number(workspace.max_health_profiles) || 1, 1);
  const plan = workspace.plan || "core";
  const subscriptionStatus = workspace.subscription_status || "inactive";

  const { data: profiles, error: profilesError } = await supabase
    .from("health_profiles")
    .select("id,display_name,relationship,is_primary,status,created_at")
    .eq("workspace_id", workspace.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<HealthProfileRow[]>();

  if (profilesError) {
    throw profilesError;
  }

  const activeProfiles = (profiles || []).filter((profile) => profile.status === "active");
  const writableIds = new Set(activeProfiles.slice(0, maxHealthProfiles).map((profile) => profile.id));

  const stripeEvents = await supabase
    .from("stripe_events")
    .select("id")
    .order("id", { ascending: false })
    .limit(10)
    .returns<StripeEventRow[]>();

  const [conciergeRequests, referralApplications] = await Promise.all([
    supabase
      .from("concierge_onboarding_requests")
      .select("id,contact_email,status,payment_status,fulfillment_stage,fulfillment_checklist,requested_scope,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<ConciergeRequestRow[]>(),
    supabase
      .from("referral_partner_applications")
      .select("id,contact_email,partner_type,referral_code,status,created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<ReferralApplicationRow[]>(),
  ]);

  if (conciergeRequests.error) {
    throw conciergeRequests.error;
  }

  if (referralApplications.error) {
    throw referralApplications.error;
  }

  const profileSummaries = (profiles || []).map((profile) => {
    const active = profile.status === "active";
    return {
      displayName: profile.display_name || "Unnamed profile",
      frozen: active && !writableIds.has(profile.id),
      id: profile.id,
      isPrimary: Boolean(profile.is_primary),
      relationship: profile.relationship || "other",
      status: profile.status || "unknown",
    };
  });

  return {
    currentUserRole: membership.data.role || "admin",
    env: getOpsEnvStatus(),
    healthProfiles: {
      active: activeProfiles.length,
      frozen: profileSummaries.filter((profile) => profile.frozen).length,
      total: profiles?.length || 0,
      writable: writableIds.size,
    },
    planLimits: (Object.keys(PLAN_HEALTH_PROFILE_LIMITS) as Plan[]).map((planId) => ({
      label: PLAN_HEALTH_PROFILE_LIMITS[planId].label,
      maxProfiles: PLAN_HEALTH_PROFILE_LIMITS[planId].maxProfiles,
      plan: planId,
    })),
    profiles: profileSummaries,
    revenue: {
      concierge: (conciergeRequests.data || []).map((request) => ({
        checklist: normalizeChecklist(request.fulfillment_checklist),
        contactEmail: request.contact_email || "Unknown",
        createdAt: request.created_at,
        fulfillmentStage: request.fulfillment_stage || "intake_pending",
        id: request.id,
        paymentStatus: request.payment_status || "not_started",
        scopeCount: request.requested_scope?.length || 0,
        status: request.status || "unknown",
      })),
      referrals: (referralApplications.data || []).map((application) => ({
        contactEmail: application.contact_email || "Unknown",
        createdAt: application.created_at,
        id: application.id,
        partnerType: application.partner_type || "unknown",
        referralCode: application.referral_code || "pending",
        status: application.status || "unknown",
      })),
    },
    stripe: {
      customerLinked: Boolean(workspace.stripe_customer_id),
      latestEventId: stripeEvents.data?.[0]?.id || null,
      priceLinked: Boolean(workspace.stripe_price_id),
      recentEventCount: stripeEvents.data?.length || 0,
      subscriptionLinked: Boolean(workspace.stripe_subscription_id),
    },
    workspace: {
      currentPeriodEnd: workspace.current_period_end,
      id: workspace.id,
      maxHealthProfiles,
      name: workspace.name || "Aeonvera workspace",
      plan,
      planLabel: PLAN_LABEL[plan],
      status: workspace.status || "unknown",
      subscriptionStatus,
      updatedAt: workspace.updated_at,
    },
  };
}

function normalizeChecklist(items: ConciergeChecklistItem[] | null) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      key: item.key || item.label || "step",
      label: item.label || item.key || "Concierge step",
      status: item.status || "pending",
    }))
    .slice(0, 8);
}
