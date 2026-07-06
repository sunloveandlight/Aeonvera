import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import { getWorkspaceId, jsonError, requireUser } from "@/app/api/professional/_utils";
import {
  addProfessionalStaff,
  listProfessionalStaff,
  sanitizeEmail,
  sanitizeStaffRole,
} from "@/lib/professional/workflow";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const workspaceId = getWorkspaceId(request.nextUrl.searchParams.get("workspaceId"));
    if (!workspaceId) return jsonError("Missing organization workspace.");

    const result = await listProfessionalStaff({
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ staff: result.staff });
  } catch (error) {
    console.error("Could not load professional staff:", error);
    return jsonError("Could not load professional staff.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "professional-staff-add", 30, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const workspaceId = getWorkspaceId(body.workspaceId);
    const email = sanitizeEmail(body.email);
    const role = sanitizeStaffRole(body.role);

    if (!workspaceId) return jsonError("Missing organization workspace.");
    if (!email) return jsonError("Enter a valid staff email.");
    if (!role) return jsonError("Choose a supported staff role.");

    const result = await addProfessionalStaff({
      email,
      role,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ member: result.member }, { status: 201 });
  } catch (error) {
    console.error("Could not add professional staff:", error);
    return jsonError("Could not add professional staff.", 500);
  }
}
