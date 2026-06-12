import { NextResponse } from "next/server";
import { buildTieredModalityRecommendations } from "@/lib/longevity/advancedModalities";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Plan, SubscriptionStatus } from "@/lib/auth/permissions";

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
    const [profileRes, assessmentRes, biologicalAgeRes, clinicalRes, labRes] =
      await Promise.all([
        admin
          .from("profiles")
          .select("plan,subscription_status")
          .eq("user_id", user.id)
          .maybeSingle(),
        admin
          .from("longevity_assessments")
          .select("age,primary_goal")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("biological_age_history")
          .select("age_delta")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("clinical_insights")
          .select("domains,metadata")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        admin
          .from("lab_biomarkers")
          .select("canonical_key,value,unit")
          .eq("user_id", user.id)
          .order("measured_at", { ascending: false })
          .limit(20),
      ]);

    const profile = profileRes.data as {
      plan?: Plan | null;
      subscription_status?: SubscriptionStatus | null;
    } | null;
    const clinicalRows = (clinicalRes.data || []) as Array<{
      domains?: string[] | null;
      metadata?: { risk_tier?: string } | null;
    }>;

    const result = buildTieredModalityRecommendations({
      context: {
        age: Number((assessmentRes.data as { age?: unknown } | null)?.age) || null,
        biologicalAgeDelta:
          Number((biologicalAgeRes.data as { age_delta?: unknown } | null)?.age_delta) || null,
        primaryGoal:
          ((assessmentRes.data as { primary_goal?: string | null } | null)?.primary_goal) || null,
        riskTier: clinicalRows.find((row) => row.metadata?.risk_tier)?.metadata?.risk_tier || null,
        activeClinicalDomains: Array.from(
          new Set(clinicalRows.flatMap((row) => row.domains || []))
        ),
        latestLabs: (labRes.data || []) as Array<{
          canonical_key?: string | null;
          value?: number | string | null;
          unit?: string | null;
        }>,
      },
      plan: profile?.plan || null,
      status: profile?.subscription_status || null,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load longevity modalities.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
