import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ingestWearableMetrics } from "@/lib/wearables/ingestWearableMetrics";
import { fetchWhoopMetrics } from "@/lib/wearables/whoop";
import { getValidWearableAccessToken } from "@/lib/wearables/oauth";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const accessToken =
      body.accessToken ||
      (await getValidWearableAccessToken({
        supabase: admin,
        userId: user.id,
        provider: "whoop",
      })) ||
      process.env.WHOOP_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing WHOOP access token." },
        { status: 400 }
      );
    }

    const { startDate, endDate } = getSyncWindow(body.startDate, body.endDate);
    const metrics = await fetchWhoopMetrics({ accessToken, startDate, endDate });
    const result = await ingestWearableMetrics({
      supabase: admin,
      userId: user.id,
      provider: "whoop",
      metrics,
    });

    await admin
      .from("wearable_connections")
      .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("provider", "whoop");

    return NextResponse.json({
      success: true,
      provider: "whoop",
      startDate,
      endDate,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WHOOP sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getSyncWindow(startDate?: string, endDate?: string) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end);

  if (!startDate) start.setDate(start.getDate() - 14);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
