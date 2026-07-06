import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import { getWorkspaceId, jsonError, requireUser } from "@/app/api/professional/_utils";
import { createRosterProfile, listRosterProfiles, sanitizeText } from "@/lib/professional/workflow";

const RELATIONSHIPS = new Set(["client", "other", "self", "child", "family"]);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const workspaceId = getWorkspaceId(request.nextUrl.searchParams.get("workspaceId"));
    if (!workspaceId) return jsonError("Missing organization workspace.");

    const result = await listRosterProfiles({
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ profiles: result.profiles });
  } catch (error) {
    console.error("Could not load professional roster:", error);
    return jsonError("Could not load professional roster.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "professional-roster-create", 40, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const workspaceId = getWorkspaceId(body.workspaceId);
    const displayName = sanitizeText(body.displayName, 100);
    const relationship =
      typeof body.relationship === "string" && RELATIONSHIPS.has(body.relationship)
        ? body.relationship
        : "client";

    if (!workspaceId) return jsonError("Missing organization workspace.");
    if (!displayName) return jsonError("Roster profile name is required.");

    const result = await createRosterProfile({
      displayName,
      relationship,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);

    return NextResponse.json({
      profile: {
        displayName: result.profile?.display_name,
        id: result.profile?.id,
        relationship: result.profile?.relationship,
        status: result.profile?.status,
        workspaceId: result.profile?.workspace_id,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Could not create professional roster profile:", error);
    return jsonError("Could not create professional roster profile.", 500);
  }
}
