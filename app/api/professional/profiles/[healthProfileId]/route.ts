import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import { jsonError, requireUser } from "@/app/api/professional/_utils";
import { readProfessionalProfile, sanitizeProfessionalDataClassList } from "@/lib/professional/workflow";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ healthProfileId: string }> }
) {
  try {
    const limited = await rateLimitRequest(request, "professional-profile-read", 120, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const { healthProfileId } = await context.params;
    const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
    const dataClasses = sanitizeProfessionalDataClassList(
      request.nextUrl.searchParams.get("dataClasses") || "identity,readiness,performance"
    );

    if (!workspaceId) return jsonError("Missing organization workspace.");
    if (!healthProfileId) return jsonError("Missing roster profile.");
    if (!dataClasses.length) return jsonError("Choose at least one data class.");

    const result = await readProfessionalProfile({
      actorUserId: auth.userId,
      dataClasses,
      healthProfileId,
      route: "/api/professional/profiles/[healthProfileId]",
      supabase: getSupabaseAdmin(),
      workspaceId,
    });

    if (!result.decision.allowedDataClasses.length) {
      return NextResponse.json({ decision: result.decision, profile: null }, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Could not read professional profile:", error);
    return jsonError("Could not read professional profile.", 500);
  }
}
