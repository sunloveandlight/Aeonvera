import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVE_HEALTH_PROFILE_COOKIE = "aeonvera.activeHealthProfileId";

export type ActiveHealthProfileContext = {
  loginUserId: string;
  workspaceId: string | null;
  healthProfileId: string | null;
  legacyUserId: string;
  mode: "legacy_user" | "health_profile";
  role: "owner" | "member" | "viewer";
};

export type HealthSubjectFilter =
  | {
      column: "user_id";
      value: string;
      mode: "legacy_user";
    }
  | {
      column: "health_profile_id";
      value: string;
      mode: "health_profile";
    };

type HealthProfileAccessRow = {
  workspace_id: string | null;
  health_profile_id: string | null;
  role: ActiveHealthProfileContext["role"] | null;
};

type ResolveActiveHealthProfileOptions = {
  supabase: SupabaseClient;
  loginUserId: string;
  requestedHealthProfileId?: string | null;
};

export function createLegacyActiveHealthProfileContext(
  loginUserId: string
): ActiveHealthProfileContext {
  return {
    loginUserId,
    workspaceId: null,
    healthProfileId: null,
    legacyUserId: loginUserId,
    mode: "legacy_user",
    role: "owner",
  };
}

export async function resolveActiveHealthProfileContext({
  supabase,
  loginUserId,
  requestedHealthProfileId,
}: ResolveActiveHealthProfileOptions): Promise<ActiveHealthProfileContext> {
  const baseQuery = supabase
    .from("health_profile_access")
    .select("workspace_id, health_profile_id, role")
    .eq("user_id", loginUserId)
    .eq("status", "active");

  const query = requestedHealthProfileId
    ? baseQuery.eq("health_profile_id", requestedHealthProfileId)
    : baseQuery.order("created_at", { ascending: true }).limit(1);

  const { data, error } = await query.maybeSingle<HealthProfileAccessRow>();

  if (error || !data?.workspace_id || !data.health_profile_id) {
    return createLegacyActiveHealthProfileContext(loginUserId);
  }

  return {
    loginUserId,
    workspaceId: data.workspace_id,
    healthProfileId: data.health_profile_id,
    legacyUserId: loginUserId,
    mode: "health_profile",
    role: data.role || "viewer",
  };
}

export function getHealthSubjectFilter(
  context: ActiveHealthProfileContext
): HealthSubjectFilter {
  if (context.healthProfileId) {
    return {
      column: "health_profile_id",
      value: context.healthProfileId,
      mode: "health_profile",
    };
  }

  return {
    column: "user_id",
    value: context.legacyUserId,
    mode: "legacy_user",
  };
}
