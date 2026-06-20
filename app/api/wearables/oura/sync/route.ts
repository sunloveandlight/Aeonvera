import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import { ingestWearableMetrics } from "@/lib/wearables/ingestWearableMetrics";
import { fetchOuraMetrics } from "@/lib/wearables/oura";
import { getValidWearableAccessToken } from "@/lib/wearables/oauth";
import {
  frozenHealthProfileResponse,
  getRequestedHealthProfileId,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "oura-sync", 10, 60_000);
    if (limited) return limited;

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    if (healthProfileContext.isFrozen) return frozenHealthProfileResponse();

    if (!canAccess(subscription.plan, subscription.status, "elite_features")) {
      return NextResponse.json(
        {
          error: "Oura wearable sync is included in Elite and Sovereign.",
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
      provider: "oura",
    });

    if (!accessToken) {
      return NextResponse.json(
        { error: "Connect Oura before syncing wearable data." },
        { status: 400 }
      );
    }

    const { startDate, endDate } = getSyncWindow(body.startDate, body.endDate);
    const metrics = await fetchOuraMetrics({ accessToken, startDate, endDate });
    const result = await ingestWearableMetrics({
      supabase: admin,
      userId: user.id,
      provider: "oura",
      metrics,
      healthProfileContext,
    });

    await admin
      .from("wearable_connections")
      .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("provider", "oura");

    return NextResponse.json({
      success: true,
      provider: "oura",
      startDate,
      endDate,
      ...result,
    });
  } catch (error) {
    console.error("Oura sync failed:", error);
    return NextResponse.json({ error: "Oura sync failed." }, { status: 500 });
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

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const {
    data: { user: bearerUser },
  } = await admin.auth.getUser(token);

  return bearerUser;
}
