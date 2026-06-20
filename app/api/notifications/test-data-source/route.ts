import { NextRequest, NextResponse } from "next/server";
import { runProactiveDataSourceFollowUps } from "@/lib/data/proactiveDataSourceFollowUps";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireServerFeatureAccess } from "@/lib/auth/serverFeatureAccess";
import {
  frozenHealthProfileResponse,
  getRequestedHealthProfileId,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const mobileUser = user || (await getBearerUser(request));

    if (!mobileUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const entitlement = await requireServerFeatureAccess({
      feature: "proactive_coach",
      lockedMessage: "Upgrade to Elite to send proactive data-source coach messages.",
      supabase: admin,
      userId: mobileUser.id,
    });
    if (!entitlement.allowed) return entitlement.response;
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: mobileUser.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    if (healthProfileContext.isFrozen) return frozenHealthProfileResponse();

    const result = await runProactiveDataSourceFollowUps({
      force: true,
      supabase: admin,
      userId: mobileUser.id,
      healthProfileContext,
    });

    return NextResponse.json({
      success: result.status === "sent",
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send data source follow-up.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getBearerUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) return null;

  const admin = getSupabaseAdmin();
  const {
    data: { user },
  } = await admin.auth.getUser(token);

  return user;
}
