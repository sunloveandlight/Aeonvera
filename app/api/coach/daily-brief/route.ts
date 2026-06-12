import { NextResponse } from "next/server";
import { buildDailyIntelligenceBrief } from "@/lib/coach/dailyIntelligenceBrief";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";

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

    if (!canAccess(subscription.plan, subscription.status, "proactive_coach")) {
      return NextResponse.json(
        {
          error: "Daily intelligence briefs are included in Elite and Sovereign.",
          upgrade: {
            minimumPlan: "elite",
            message: "Upgrade to Elite to unlock proactive daily intelligence.",
          },
        },
        { status: 403 }
      );
    }

    const brief = await buildDailyIntelligenceBrief(admin, user.id);

    return NextResponse.json({ brief });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not build daily intelligence brief.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
