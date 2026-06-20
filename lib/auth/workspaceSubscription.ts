import type { SupabaseClient } from "@supabase/supabase-js";

import type { Plan, SubscriptionStatus } from "@/lib/auth/permissions";

export type WorkspaceSubscription = {
  workspaceId: string;
  plan: Plan | null;
  status: SubscriptionStatus | null;
};

type WorkspaceMemberRow = {
  workspace_id?: string | null;
};

type WorkspaceRow = {
  id?: string | null;
  plan?: Plan | null;
  subscription_status?: SubscriptionStatus | null;
};

export async function getWorkspaceSubscriptionForUser({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<WorkspaceSubscription | null> {
  const membership = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<WorkspaceMemberRow>();

  if (!membership.error && membership.data?.workspace_id) {
    return getWorkspaceSubscriptionById(supabase, membership.data.workspace_id);
  }

  if (membership.error && !isMissingWorkspaceSchema(membership.error)) {
    return null;
  }

  const ownedWorkspace = await supabase
    .from("workspaces")
    .select("id,plan,subscription_status")
    .eq("owner_user_id", userId)
    .maybeSingle<WorkspaceRow>();

  if (ownedWorkspace.error || !ownedWorkspace.data?.id) {
    return null;
  }

  return {
    workspaceId: ownedWorkspace.data.id,
    plan: ownedWorkspace.data.plan || null,
    status: ownedWorkspace.data.subscription_status || null,
  };
}

async function getWorkspaceSubscriptionById(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<WorkspaceSubscription | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,plan,subscription_status")
    .eq("id", workspaceId)
    .maybeSingle<WorkspaceRow>();

  if (error || !data?.id) {
    return null;
  }

  return {
    workspaceId: data.id,
    plan: data.plan || null,
    status: data.subscription_status || null,
  };
}

function isMissingWorkspaceSchema(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.message?.includes("workspace_members") ||
    error.message?.includes("workspaces") ||
    error.message?.includes("schema cache")
  );
}
