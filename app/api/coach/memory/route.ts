import { NextResponse } from "next/server";
import { canAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadOrBuildCoachMemoryProfile } from "@/lib/memory/coachMemoryProfile";
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

    if (!canAccess(subscription.plan, subscription.status, "proactive_coach")) {
      return NextResponse.json(
        {
          memory: null,
          locked: true,
          migrationRequired: false,
          upgrade: {
            currentPlan: subscription.plan,
            minimumPlan: "elite",
            message:
              "Upgrade to Elite to unlock adaptive coach memory and proactive personalization.",
          },
        },
        { status: 403 }
      );
    }

    const memory = await loadOrBuildCoachMemoryProfile(admin, user.id, healthProfileContext);

    return NextResponse.json({
      memory,
      migrationRequired: memory === null,
      message: memory
        ? "Coach memory profile is active."
        : "Apply the coach_memory_profiles migration to persist Phase 8 memory.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load coach memory profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
