import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ACTIVE_HEALTH_PROFILE_COOKIE,
  resolveActiveHealthProfileContext,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

export type AuthenticatedRouteContext = {
  admin: ReturnType<typeof getSupabaseAdmin>;
  healthProfileContext: ActiveHealthProfileContext;
  response: null;
  userId: string;
};

export type UnauthenticatedRouteContext = {
  admin: null;
  healthProfileContext: null;
  response: NextResponse;
  userId: "";
};

export async function requireAuthenticatedRouteContext(
  request?: NextRequest
): Promise<AuthenticatedRouteContext | UnauthenticatedRouteContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      admin: null,
      healthProfileContext: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: "",
    };
  }

  const admin = getSupabaseAdmin();
  const healthProfileContext = await resolveActiveHealthProfileContext({
    supabase: admin,
    loginUserId: user.id,
    requestedHealthProfileId: request?.cookies.get(ACTIVE_HEALTH_PROFILE_COOKIE)?.value,
  });

  return {
    admin,
    healthProfileContext,
    response: null,
    userId: user.id,
  };
}
