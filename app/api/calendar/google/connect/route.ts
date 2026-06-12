import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleCalendarAuthorizeUrl } from "@/lib/calendar/google";
import { canAccess } from "@/lib/auth/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";

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

    if (!canAccess(subscription.plan, subscription.status, "autopilot_calendar")) {
      const url = new URL("/pricing", request.url);
      url.searchParams.set("upgrade", "calendar");
      return NextResponse.redirect(url);
    }

    const state = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const url = buildGoogleCalendarAuthorizeUrl({
      origin: request.nextUrl.origin,
      state,
    });
    const response = NextResponse.redirect(url);

    response.cookies.set("aeonvera_google_calendar_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 10 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    const url = new URL("/companion", request.url);
    url.searchParams.set(
      "calendarError",
      error instanceof Error ? error.message : "Google Calendar connect failed."
    );
    return NextResponse.redirect(url);
  }
}
