import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeWearableCode, saveWearableConnection } from "@/lib/wearables/oauth";

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

    const token = await exchangeWearableCode({
      provider: "whoop",
      origin: request.nextUrl.origin,
      code,
    });

    await saveWearableConnection({
      supabase: getSupabaseAdmin(),
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
