import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import { ingestWearableMetrics } from "@/lib/wearables/ingestWearableMetrics";
import { fetchWhoopMetrics } from "@/lib/wearables/whoop";
import { getValidWearableAccessToken } from "@/lib/wearables/oauth";
import { resolveActiveHealthProfileContext } from "@/lib/health-profiles/activeHealthProfile";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: request.cookies.get("aeonvera.activeHealthProfileId")?.value,
    });

    if (!canAccess(subscription.plan, subscription.status, "elite_features")) {
      return NextResponse.json(
        {
          error: "WHOOP wearable sync is included in Elite and Sovereign.",
          upgrade: {
            minimumPlan: "elite",
            message: "Upgrade to Elite to unlock live wearable sync.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const accessToken = await getValidWearableAccessToken({
      supabase: admin,
      userId: user.id,
      provider: "whoop",
    });

    if (!accessToken) {
      return NextResponse.json(
        { error: "Connect WHOOP before syncing wearable data." },
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
      healthProfileContext,
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
