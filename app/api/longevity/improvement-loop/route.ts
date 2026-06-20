import { NextResponse } from "next/server";
import { canAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildBiologicalAgeImprovementLoop } from "@/lib/longevity/biologicalAgeImprovementLoop";
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
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
    });

    if (!canAccess(subscription.plan, subscription.status, "clinical_intelligence")) {
      return NextResponse.json(
        {
          error: "Biological-age improvement loops are included in Elite and Sovereign.",
          upgrade: {
            currentPlan: subscription.plan,
            minimumPlan: "elite",
            message:
              "Upgrade to Elite to unlock adaptive improvement loops from biological age, labs, and execution behavior.",
          },
        },
        { status: 403 }
      );
    }

    const loop = await buildBiologicalAgeImprovementLoop({
      healthProfileId: healthProfileContext.healthProfileId,
      supabase: admin,
      userId: user.id,
    });

    return NextResponse.json({ loop });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load biological age improvement loop.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
