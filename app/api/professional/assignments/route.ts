import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import { getWorkspaceId, jsonError, requireUser } from "@/app/api/professional/_utils";
import {
  createProfessionalAssignment,
  defaultDataClassesForRole,
  sanitizeProfessionalDataClassList,
  sanitizeStaffRole,
} from "@/lib/professional/workflow";

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "professional-assignment-create", 60, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const workspaceId = getWorkspaceId(body.workspaceId);
    const healthProfileId = typeof body.healthProfileId === "string" ? body.healthProfileId : "";
    const staffUserId = typeof body.staffUserId === "string" ? body.staffUserId : "";
    const role = sanitizeStaffRole(body.role);
    const requestedClasses = sanitizeProfessionalDataClassList(body.dataClasses);

    if (!workspaceId) return jsonError("Missing organization workspace.");
    if (!healthProfileId) return jsonError("Missing roster profile.");
    if (!staffUserId) return jsonError("Missing staff user.");
    if (!role) return jsonError("Choose a supported assignment role.");

    const result = await createProfessionalAssignment({
      dataClasses: requestedClasses.length ? requestedClasses : defaultDataClassesForRole(role),
      expiresAt: sanitizeDate(body.expiresAt),
      healthProfileId,
      role,
      staffUserId,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ assignment: result.assignment }, { status: 201 });
  } catch (error) {
    console.error("Could not create professional assignment:", error);
    return jsonError("Could not create professional assignment.", 500);
  }
}

function sanitizeDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
