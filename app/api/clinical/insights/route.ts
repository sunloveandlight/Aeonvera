import { NextRequest, NextResponse } from "next/server";
import { canAccess } from "@/lib/auth/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";
import {
  getHealthSubjectFilter,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: user.id,
      requestedHealthProfileId: request.cookies.get("aeonvera.activeHealthProfileId")?.value,
    });
    const healthFilter = getHealthSubjectFilter(healthProfileContext);

    if (!canAccess(subscription.plan, subscription.status, "clinical_intelligence")) {
      return NextResponse.json(
        {
          insights: [],
          locked: true,
          migrationRequired: false,
          upgrade: {
            currentPlan: subscription.plan,
            minimumPlan: "elite",
            message:
              "Upgrade to Elite to unlock clinical memory, follow-up questions, and biomarker reasoning history.",
          },
        },
        { status: 403 }
      );
    }

    const { data, error } = await admin
      .from("clinical_insights")
      .select(
        "id,source_question,answer_summary,domains,concern_status,confidence,signal_map,range_flags,follow_up_questions,recommended_actions,metadata,created_at,updated_at"
      )
      .eq(healthFilter.column, healthFilter.value)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({
          insights: [],
          migrationRequired: true,
          message: "Apply the clinical_insights migration to persist clinical memory.",
        });
      }

      throw new Error(error.message || "Clinical memory could not load.");
    }

    return NextResponse.json({
      insights: data || [],
      migrationRequired: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Clinical memory could not load.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const {
    data: { user: bearerUser },
  } = await getSupabaseAdmin().auth.getUser(token);

  return bearerUser;
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("schema cache") ||
    error.message?.includes("clinical_insights")
  );
}
