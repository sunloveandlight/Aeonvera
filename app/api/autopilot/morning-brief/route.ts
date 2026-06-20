import { NextRequest, NextResponse } from "next/server";
import { runMorningAutopilotBrief } from "@/lib/autopilot/morningAutopilot";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import {
  frozenHealthProfileResponse,
  getRequestedHealthProfileId,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "autopilot-morning-brief", 20, 60_000);
    if (limited) return limited;

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase, userId: user.id });
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase,
      loginUserId: user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    if (healthProfileContext.isFrozen) return frozenHealthProfileResponse();

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
      healthProfileContext,
    });

    return NextResponse.json({
      success: result.status === "prepared",
      result,
    });
  } catch (error) {
    console.error("Morning Autopilot failed:", error);
    return NextResponse.json({ error: "Could not run Morning Autopilot." }, { status: 500 });
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
