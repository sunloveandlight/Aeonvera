import { NextResponse } from "next/server";
import { canAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
          preferences: [],
          locked: true,
          upgrade: {
            currentPlan: subscription.plan,
            minimumPlan: "elite",
            message: "Upgrade to Elite to unlock persistent agent preferences.",
          },
        },
        { status: 403 }
      );
    }

    const { data, error } = await admin
      .from("agent_preferences")
      .select("id,category,preference_key,preference_value,source,confidence,metadata,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(80);

    if (error) {
      if (isMissingAgentPreferencesTable(error)) {
        return NextResponse.json({
          preferences: [],
          migrationRequired: true,
          message:
            "Apply supabase/migrations/20260612130000_agent_preferences.sql to persist agent preferences.",
        });
      }

      throw error;
    }

    return NextResponse.json({
      preferences: data || [],
      migrationRequired: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load agent preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isMissingAgentPreferencesTable(error: { message?: string; code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("agent_preferences") ||
    error.message?.includes("schema cache")
  );
}
