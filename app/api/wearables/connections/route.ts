import { NextRequest, NextResponse } from "next/server";
import { canAccess } from "@/lib/auth/permissions";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import { getHealthSubjectFilter } from "@/lib/health-profiles/activeHealthProfile";
import { requireAuthenticatedRouteContext } from "@/lib/auth/routeContext";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteContext(request);
    if (auth.response) return auth.response;

    const subscription = await getUserPlanForUsage({ supabase: auth.admin, userId: auth.userId });

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

    const healthFilter = getHealthSubjectFilter(auth.healthProfileContext);
    const { data, error } = await auth.admin
      .from("wearable_connections")
      .select("provider, status, scope, expires_at, last_synced_at, connected_at")
      .eq("user_id", auth.userId)
      .eq(healthFilter.column, healthFilter.value)
      .order("connected_at", { ascending: false });

    if (error) {
      console.error("Wearable connections load failed:", error);
      return NextResponse.json({ error: "Failed to load wearable connections." }, { status: 500 });
    }

    return NextResponse.json({ connections: data || [] });
  } catch (error) {
    console.error("Wearable connections load failed:", error);
    return NextResponse.json({ error: "Failed to load wearable connections." }, { status: 500 });
  }
}
