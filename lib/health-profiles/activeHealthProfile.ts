import type { SupabaseClient } from "@supabase/supabase-js";
import { isHealthProfileFrozen } from "@/lib/health-profiles/profileEntitlements";

export const ACTIVE_HEALTH_PROFILE_COOKIE = "aeonvera.activeHealthProfileId";

type ActiveHealthProfileCookieRequest = {
  cookies: {
    get(name: string): { value?: string } | undefined;
  };
};

export type ActiveHealthProfileContext = {
  loginUserId: string;
  workspaceId: string | null;
  healthProfileId: string | null;
  legacyUserId: string;
  mode: "legacy_user" | "health_profile";
  role: "owner" | "editor" | "viewer";
  isFrozen: boolean;
};

export class FrozenHealthProfileError extends Error {
  statusCode = 423;

  constructor() {
    super("This health profile is frozen on the current membership.");
    this.name = "FrozenHealthProfileError";
  }
}

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
    isFrozen: false,
  };
}

export function getRequestedHealthProfileId(
  request: ActiveHealthProfileCookieRequest
) {
  return request.cookies.get(ACTIVE_HEALTH_PROFILE_COOKIE)?.value || null;
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

  const frozen = await isHealthProfileFrozen({
    healthProfileId: data.health_profile_id,
    supabase,
    workspaceId: data.workspace_id,
  });

  return {
    loginUserId,
    workspaceId: data.workspace_id,
    healthProfileId: data.health_profile_id,
    legacyUserId: loginUserId,
    mode: "health_profile",
    role: data.role || "viewer",
    isFrozen: frozen,
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

type HealthSubjectFilterable = {
  eq(column: string, value: string): unknown;
};

export function applyHealthSubjectFilter<T>(
  query: T & HealthSubjectFilterable,
  context: ActiveHealthProfileContext
): T {
  const filter = getHealthSubjectFilter(context);
  return query.eq(filter.column, filter.value) as T;
}

export function healthSubjectInsertFields(
  context: ActiveHealthProfileContext
) {
  return { health_profile_id: context.healthProfileId };
}

export function assertHealthProfileWritable(context: ActiveHealthProfileContext) {
  if (context.isFrozen) {
    throw new FrozenHealthProfileError();
  }
}

export function isFrozenHealthProfileError(error: unknown) {
  return error instanceof FrozenHealthProfileError;
}

export function frozenHealthProfilePayload() {
  return {
    error: "This health profile is frozen on the current membership.",
    frozen: true,
    message: "Upgrade or switch to an included profile to make changes.",
  };
}

export function frozenHealthProfileResponse() {
  return Response.json(frozenHealthProfilePayload(), { status: 423 });
}
