import { NextRequest, NextResponse } from "next/server";
import { runProactiveClinicalFollowUps } from "@/lib/clinical/proactiveClinicalFollowUps";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;
    const result = await runProactiveClinicalFollowUps({
      supabase: getSupabaseAdmin(),
      userId: user.id,
      force,
    });

    return NextResponse.json({
      ok: result.status === "sent",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Clinical follow-up could not run.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const {
    data: { user: bearerUser },
  } = await getSupabaseAdmin().auth.getUser(token);

  return bearerUser;
}
