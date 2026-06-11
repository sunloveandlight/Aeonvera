import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  exchangeGoogleCalendarCode,
  saveGoogleCalendarConnection,
} from "@/lib/calendar/google";

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/companion", request.url);

  try {
    const expectedState = request.cookies.get(
      "aeonvera_google_calendar_oauth_state"
    )?.value;
    const state = request.nextUrl.searchParams.get("state");
    const code = request.nextUrl.searchParams.get("code");
    const error = request.nextUrl.searchParams.get("error");

    if (error) throw new Error(error);
    if (!code) throw new Error("Missing Google Calendar authorization code.");
    if (!expectedState || state !== expectedState) {
      throw new Error("Invalid Google Calendar authorization state.");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?mode=signin", request.url));
    }

    const token = await exchangeGoogleCalendarCode({
      origin: request.nextUrl.origin,
      code,
    });

    await saveGoogleCalendarConnection({
      supabase: getSupabaseAdmin(),
      userId: user.id,
      token,
    });

    redirectUrl.searchParams.set("calendarConnected", "google");
  } catch (error) {
    redirectUrl.searchParams.set(
      "calendarError",
      error instanceof Error ? error.message : "Google Calendar callback failed."
    );
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("aeonvera_google_calendar_oauth_state");
  return response;
}
