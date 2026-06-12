import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/auth/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import { buildAuthorizeUrl } from "@/lib/wearables/oauth";

export async function GET(request: NextRequest) {
  try {
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
      const url = new URL("/pricing", request.url);
      url.searchParams.set("upgrade", "whoop");
      return NextResponse.redirect(url);
    }

    const state = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const url = buildAuthorizeUrl({
      provider: "whoop",
      origin: request.nextUrl.origin,
      state,
    });
    const response = NextResponse.redirect(url);

    response.cookies.set("aeonvera_whoop_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 10 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "WHOOP connect failed.";
    const url = new URL("/dashboard", request.url);
    url.searchParams.set("wearableError", message);
    return NextResponse.redirect(url);
  }
}
