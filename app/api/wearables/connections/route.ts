import { NextResponse } from "next/server";
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

    if (!canAccess(subscription.plan, subscription.status, "elite_features")) {
      return NextResponse.json({
        connections: [],
        locked: true,
        upgrade: {
          minimumPlan: "elite",
          message: "Oura and WHOOP wearable sync are included in Elite and Sovereign.",
        },
      });
    }

    const { data, error } = await admin
      .from("wearable_connections")
      .select("provider, status, scope, expires_at, last_synced_at, connected_at")
      .eq("user_id", user.id)
      .order("connected_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ connections: data || [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load wearable connections.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
