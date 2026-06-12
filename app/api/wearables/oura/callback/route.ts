import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import { exchangeWearableCode, saveWearableConnection } from "@/lib/wearables/oauth";

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/dashboard", request.url);

  try {
    const expectedState = request.cookies.get("aeonvera_oura_oauth_state")?.value;
    const state = request.nextUrl.searchParams.get("state");
    const code = request.nextUrl.searchParams.get("code");
    const error = request.nextUrl.searchParams.get("error");

    if (error) throw new Error(error);
    if (!code) throw new Error("Missing Oura authorization code.");
    if (!expectedState || state !== expectedState) {
      throw new Error("Invalid Oura authorization state.");
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
      throw new Error("Oura wearable sync is included in Elite and Sovereign.");
    }

    const token = await exchangeWearableCode({
      provider: "oura",
      origin: request.nextUrl.origin,
      code,
    });

    await saveWearableConnection({
      supabase: admin,
      userId: user.id,
      provider: "oura",
      token,
    });

    redirectUrl.searchParams.set("wearableConnected", "oura");
  } catch (error) {
    redirectUrl.searchParams.set(
      "wearableError",
      error instanceof Error ? error.message : "Oura callback failed."
    );
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("aeonvera_oura_oauth_state");
  return response;
}
