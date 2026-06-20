import { NextResponse } from "next/server";
import { canAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadLabTrendsForUser } from "@/lib/labs/loadLabTrendsForUser";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import { resolveActiveHealthProfileContext } from "@/lib/health-profiles/activeHealthProfile";

export async function GET() {
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

    if (!canAccess(subscription.plan, subscription.status, "lab_trends")) {
      return NextResponse.json(
        {
          error: "Lab trend intelligence is included in Elite and Sovereign.",
          trends: [],
          upgrade: {
            currentPlan: subscription.plan,
            minimumPlan: "elite",
            message:
              "Upgrade to Elite to unlock longitudinal lab trends and deeper biomarker interpretation.",
          },
        },
        { status: 403 }
      );
    }

    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
    });

    return NextResponse.json({
      trends: await loadLabTrendsForUser(
        admin,
        user.id,
        healthProfileContext.healthProfileId
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load lab trends.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
