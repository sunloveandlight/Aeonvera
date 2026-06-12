import { NextRequest, NextResponse } from "next/server";
import { runMorningAutopilotBrief } from "@/lib/autopilot/morningAutopilot";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase, userId: user.id });

    if (!canAccess(subscription.plan, subscription.status, "autopilot_calendar")) {
      return NextResponse.json(
        {
          error: "Morning Autopilot is included in Elite and Sovereign.",
          upgrade: {
            minimumPlan: "elite",
            message: "Upgrade to Elite to unlock proactive daily planning.",
          },
        },
        { status: 403 }
      );
    }

    const result = await runMorningAutopilotBrief({
      supabase,
      userId: user.id,
    });

    return NextResponse.json({
      success: result.status === "prepared",
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not run Morning Autopilot.";
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

  const admin = getSupabaseAdmin();
  const {
    data: { user: bearerUser },
  } = await admin.auth.getUser(token);

  return bearerUser;
}
