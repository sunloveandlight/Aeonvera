import { NextRequest, NextResponse } from "next/server";
import { PLAN_USAGE_LIMITS, type UsageMeter } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getUsageSnapshot,
  getUserPlanForUsage,
  serializeUsage,
} from "@/lib/usage/tierUsage";

const METERS = Object.keys(PLAN_USAGE_LIMITS.core) as UsageMeter[];

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });
    const usage = await Promise.all(
      METERS.map((meter) =>
        getUsageSnapshot({
          meter,
          plan: subscription.plan,
          status: subscription.status,
          supabase: admin,
          userId: user.id,
        })
      )
    );

    return NextResponse.json({
      plan: subscription.plan,
      subscriptionStatus: subscription.status,
      usage: usage.map(serializeUsage),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load usage limits.";
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
