import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess, type Plan, type SubscriptionStatus } from "@/lib/auth/permissions";

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

    const [
      profile,
      assessment,
      latestReport,
      bioAgeHistory,
      labs,
      protocols,
      outcomes,
      healthState,
    ] = await Promise.all([
      safeQuery(() =>
        admin
          .from("profiles")
          .select("display_name, plan, subscription_status, biological_age, created_at")
          .eq("user_id", user.id)
          .maybeSingle()
      ),
      safeQuery(() =>
        admin
          .from("longevity_assessments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
      safeQuery(() =>
        admin
          .from("longevity_reports")
          .select("report, risk_score, primary_goal, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
      safeQuery(() =>
        admin
          .from("biological_age_history")
          .select("biological_age, chronological_age, age_delta, score, accuracy_score, category, source, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12)
      ),
      safeQuery(() =>
        admin
          .from("lab_biomarkers")
          .select("canonical_key, value, unit, reference_range, source, measured_at")
          .eq("user_id", user.id)
          .order("measured_at", { ascending: false })
          .limit(30)
      ),
      safeQuery(() =>
        admin
          .from("optimization_protocols")
          .select("protocol, summary, focus_domains, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5)
      ),
      safeQuery(() =>
        admin
          .from("intervention_outcomes")
          .select("domain,action,success,confidence,outcome,baseline_snapshot,followup_snapshot,notes,measured_at,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20)
      ),
      safeQuery(() =>
        admin
          .from("health_states")
          .select("baseline,risk_scores,insights,updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ),
    ]);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      patient: {
        id: user.id,
        email: user.email || null,
        profile: profile.data || null,
      },
      assessment: assessment.data || null,
      latestReport: latestReport.data || null,
      biologicalAgeHistory: bioAgeHistory.data || [],
      labs: labs.data || [],
      protocols: protocols.data || [],
      outcomes: outcomes.data || [],
      healthState: healthState.data || null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not build physician export.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function safeQuery<T>(query: () => PromiseLike<{ data: T | null; error: unknown }>) {
  const result = await query();

  if (result.error && !isMissingSchemaError(result.error)) {
    throw result.error instanceof Error
      ? result.error
      : new Error(JSON.stringify(result.error));
  }

  return { data: result.error ? null : result.data };
}

function isMissingSchemaError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST204" ||
    candidate.code === "PGRST205" ||
    candidate.message?.includes("schema cache")
  );
}
