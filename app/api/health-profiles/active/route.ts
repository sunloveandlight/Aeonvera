import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_HEALTH_PROFILE_COOKIE } from "@/lib/health-profiles/activeHealthProfile";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const profileId = typeof body.healthProfileId === "string" ? body.healthProfileId : "";

    if (!profileId) {
      const response = NextResponse.json({ activeProfileId: null });
      response.cookies.delete(ACTIVE_HEALTH_PROFILE_COOKIE);
      return response;
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("health_profile_access")
      .select("health_profile_id")
      .eq("user_id", user.id)
      .eq("health_profile_id", profileId)
      .eq("status", "active")
      .maybeSingle<{ health_profile_id: string }>();

    if (error) throw error;

    if (!data?.health_profile_id) {
      return NextResponse.json(
        { error: "You do not have access to that health profile." },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ activeProfileId: profileId });
    response.cookies.set(ACTIVE_HEALTH_PROFILE_COOKIE, profileId, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not switch health profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
