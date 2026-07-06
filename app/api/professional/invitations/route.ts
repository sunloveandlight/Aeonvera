import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId, jsonError, requireUser } from "@/app/api/professional/_utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import {
  createProfessionalInvitation,
  defaultDataClassesForRole,
  listProfessionalInvitations,
  revokeProfessionalInvitation,
  sanitizeEmail,
  sanitizeProfessionalDataClassList,
  sanitizeStaffRole,
  sanitizeText,
} from "@/lib/professional/workflow";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const workspaceId = getWorkspaceId(request.nextUrl.searchParams.get("workspaceId"));
    const healthProfileId = request.nextUrl.searchParams.get("healthProfileId") || undefined;

    if (!workspaceId) return jsonError("Missing organization workspace.");

    const result = await listProfessionalInvitations({
      healthProfileId,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ invitations: result.invitations });
  } catch (error) {
    console.error("Could not load professional invitations:", error);
    return jsonError("Could not load professional invitations.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "professional-invitation-create", 30, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const workspaceId = getWorkspaceId(body.workspaceId);
    const email = sanitizeEmail(body.email);
    const inviteType = body.inviteType === "roster_member" ? "roster_member" : "staff";
    const healthProfileId = typeof body.healthProfileId === "string" ? body.healthProfileId : null;
    const staffRole = sanitizeStaffRole(body.role);
    const role = inviteType === "roster_member" ? "member" : staffRole;
    const requestedClasses = sanitizeProfessionalDataClassList(body.dataClasses);

    if (!workspaceId) return jsonError("Missing organization workspace.");
    if (!email) return jsonError("Enter a valid invite email.");
    if (!role) return jsonError("Choose a supported staff role.");
    if (inviteType === "roster_member" && !healthProfileId) {
      return jsonError("Choose a roster profile for this invite.");
    }

    const result = await createProfessionalInvitation({
      dataClasses: requestedClasses.length
        ? requestedClasses
        : role === "member"
          ? ["identity"]
          : defaultDataClassesForRole(role),
      email,
      expiresAt: sanitizeDate(body.expiresAt),
      healthProfileId,
      inviteType,
      name: sanitizeText(body.name, 100) || null,
      role,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ invitation: result.invitation }, { status: 201 });
  } catch (error) {
    console.error("Could not create professional invitation:", error);
    return jsonError("Could not create professional invitation.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "professional-invitation-update", 40, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const workspaceId = getWorkspaceId(body.workspaceId);
    const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
    const action = typeof body.action === "string" ? body.action : "";

    if (!workspaceId) return jsonError("Missing organization workspace.");
    if (!invitationId) return jsonError("Missing invitation.");
    if (action !== "revoke") return jsonError("Unsupported invitation action.");

    const result = await revokeProfessionalInvitation({
      invitationId,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
      workspaceId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ invitation: result.invitation });
  } catch (error) {
    console.error("Could not update professional invitation:", error);
    return jsonError("Could not update professional invitation.", 500);
  }
}

function sanitizeDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
