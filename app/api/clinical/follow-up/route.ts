import { NextRequest, NextResponse } from "next/server";
import { recordClinicalFollowUpAnswer } from "@/lib/clinical/clinicalFollowUpResponses";
import { runProactiveClinicalFollowUps } from "@/lib/clinical/proactiveClinicalFollowUps";
import { canAccess } from "@/lib/auth/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserPlanForUsage } from "@/lib/usage/tierUsage";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const subscription = await getUserPlanForUsage({ supabase: admin, userId: user.id });

    if (!canAccess(subscription.plan, subscription.status, "clinical_intelligence")) {
      return NextResponse.json(
        {
          error: "Clinical follow-up intelligence is included in Elite and Sovereign.",
          upgrade: {
            currentPlan: subscription.plan,
            minimumPlan: "elite",
            message:
              "Upgrade to Elite to unlock clinical memory, follow-up questions, and deeper biomarker reasoning.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
    const clinicalInsightId =
      typeof body?.clinicalInsightId === "string" ? body.clinicalInsightId.trim() : "";

    if (answer && clinicalInsightId) {
      const result = await recordClinicalFollowUpAnswer({
        answer,
        clinicalInsightId,
        source: body?.source === "voice_agent" ? "voice_agent" : "agent_chat",
        supabase: admin,
        userId: user.id,
      });

      return NextResponse.json({
        ok: Boolean(result),
        result,
      });
    }

    const force = body?.force === true;
    const result = await runProactiveClinicalFollowUps({
      supabase: admin,
      userId: user.id,
      force,
    });

    return NextResponse.json({
      ok: result.status === "sent",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Clinical follow-up could not run.";
    return NextResponse.json({ error: message }, { status: 500 });
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
