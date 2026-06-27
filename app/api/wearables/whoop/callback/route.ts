import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import { exchangeWearableCode, saveWearableConnection } from "@/lib/wearables/oauth";
import {
  ACTIVE_HEALTH_PROFILE_COOKIE,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/dashboard", request.url);

  try {
    const expectedState = request.cookies.get("aeonvera_whoop_oauth_state")?.value;
    const state = request.nextUrl.searchParams.get("state");
    const code = request.nextUrl.searchParams.get("code");
    const error = request.nextUrl.searchParams.get("error");

    if (error) throw new Error(error);
    if (!code) throw new Error("Missing WHOOP authorization code.");
    if (!expectedState || state !== expectedState) {
      throw new Error("Invalid WHOOP authorization state.");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?mode=signin", request.url));
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });

    if (!canAccess(subscription.plan, subscription.status, "elite_features")) {
      throw new Error("WHOOP wearable sync is included in Elite and Sovereign.");
    }

    const token = await exchangeWearableCode({
      provider: "whoop",
      origin: request.nextUrl.origin,
      code,
    });
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: request.cookies.get(ACTIVE_HEALTH_PROFILE_COOKIE)?.value,
    });

    await saveWearableConnection({
      healthProfileContext,
      supabase: admin,
      userId: user.id,
      provider: "whoop",
      token,
    });

    redirectUrl.searchParams.set("wearableConnected", "whoop");
  } catch (error) {
    redirectUrl.searchParams.set(
      "wearableError",
      error instanceof Error ? error.message : "WHOOP callback failed."
    );
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("aeonvera_whoop_oauth_state");
  return response;
}
