import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleCalendarAuthorizeUrl } from "@/lib/calendar/google";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?mode=signin", request.url));
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
