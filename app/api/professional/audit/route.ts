import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId, jsonError, requireUser } from "@/app/api/professional/_utils";
import { listProfessionalAuditEvents } from "@/lib/professional/workflow";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const workspaceId = getWorkspaceId(request.nextUrl.searchParams.get("workspaceId"));
    const healthProfileId = request.nextUrl.searchParams.get("healthProfileId") || undefined;

    if (!workspaceId) return jsonError("Missing organization workspace.");

    const result = await listProfessionalAuditEvents({
      healthProfileId,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ auditEvents: result.auditEvents });
  } catch (error) {
    console.error("Could not load professional audit events:", error);
    return jsonError("Could not load professional audit events.", 500);
  }
}
