import type { SupabaseClient } from "@supabase/supabase-js";

type WorkspaceLimitRow = {
  max_health_profiles: number | null;
};

type WorkspaceProfileRow = {
  id: string;
  created_at: string | null;
  is_primary: boolean | null;
};

export type WorkspaceProfileEntitlements = {
  maxHealthProfiles: number;
  writableProfileIds: Set<string>;
};

export async function getWorkspaceProfileEntitlements({
  supabase,
  workspaceId,
}: {
  supabase: SupabaseClient;
  workspaceId: string;
}): Promise<WorkspaceProfileEntitlements> {
  const [{ data: workspace, error: workspaceError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("max_health_profiles")
        .eq("id", workspaceId)
        .maybeSingle<WorkspaceLimitRow>(),
      supabase
        .from("health_profiles")
        .select("id,is_primary,created_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true })
        .returns<WorkspaceProfileRow[]>(),
    ]);

  if (workspaceError) throw workspaceError;
  if (profilesError) throw profilesError;

  const maxHealthProfiles = Math.max(Number(workspace?.max_health_profiles) || 1, 1);
  const writableProfileIds = new Set(
    (profiles || []).slice(0, maxHealthProfiles).map((profile) => profile.id)
  );

  return { maxHealthProfiles, writableProfileIds };
}

export async function isHealthProfileFrozen({
  healthProfileId,
  supabase,
  workspaceId,
}: {
  healthProfileId: string | null;
  supabase: SupabaseClient;
  workspaceId: string | null;
}) {
  if (!healthProfileId || !workspaceId) return false;

  const entitlements = await getWorkspaceProfileEntitlements({ supabase, workspaceId });
  return !entitlements.writableProfileIds.has(healthProfileId);
}

export async function isHealthProfileFrozenById({
  healthProfileId,
  supabase,
}: {
  healthProfileId: string | null;
  supabase: SupabaseClient;
}) {
  if (!healthProfileId) return false;

  const { data, error } = await supabase
    .from("health_profiles")
    .select("workspace_id")
    .eq("id", healthProfileId)
    .eq("status", "active")
    .maybeSingle<{ workspace_id: string | null }>();

  if (error) throw error;
  if (!data?.workspace_id) return false;

  return isHealthProfileFrozen({
    healthProfileId,
    supabase,
    workspaceId: data.workspace_id,
  });
}
