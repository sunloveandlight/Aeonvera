import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess, type Plan, type SubscriptionStatus } from "@/lib/auth/permissions";
import { buildPhysicianExportBundle } from "@/lib/digital-twin/physicianExportBundle";

export async function GET() {
  try {
    const supabaseUser = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: entitlementProfile } = await admin
      .from("profiles")
      .select("plan,subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();
    const entitlement = entitlementProfile as {
      plan?: Plan | null;
      subscription_status?: SubscriptionStatus | null;
    } | null;

    if (
      !canAccess(
        entitlement?.plan || null,
        entitlement?.subscription_status || null,
        "physician_exports"
      )
    ) {
      return NextResponse.json(
        {
          error: "Physician-ready exports are included in Sovereign.",
          upgrade: {
            minimumPlan: "sovereign",
            message: "Upgrade to Sovereign to unlock clinical export workflows.",
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      await buildPhysicianExportBundle({
        email: user.email || null,
        userId: user.id,
      })
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not build physician export.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
