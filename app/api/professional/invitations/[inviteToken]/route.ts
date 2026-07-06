import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/app/api/professional/_utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  acceptProfessionalInvitation,
  readProfessionalInvitationByToken,
} from "@/lib/professional/workflow";
import { rateLimitRequest } from "@/lib/security/rateLimit";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ inviteToken: string }> }
) {
  try {
    const { inviteToken } = await context.params;
    if (!isUuid(inviteToken)) return jsonError("Invalid invitation token.", 400);

    const result = await readProfessionalInvitationByToken({
      inviteToken,
      supabase: getSupabaseAdmin(),
    });

    if (result.error) return jsonError(result.error, 404);
    return NextResponse.json({
      invitation: result.invitation,
      workspace: result.workspace,
    });
  } catch (error) {
    console.error("Could not load professional invitation:", error);
    return jsonError("Could not load professional invitation.", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ inviteToken: string }> }
) {
  try {
    const limited = await rateLimitRequest(request, "professional-invitation-accept", 20, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const { inviteToken } = await context.params;
    if (!isUuid(inviteToken)) return jsonError("Invalid invitation token.", 400);

    const result = await acceptProfessionalInvitation({
      inviteToken,
      supabase: getSupabaseAdmin(),
      userEmail: auth.userEmail,
      userId: auth.userId,
    });

    if (result.error) return jsonError(result.error, 403);
    return NextResponse.json({ invitation: result.invitation });
  } catch (error) {
    console.error("Could not accept professional invitation:", error);
    return jsonError("Could not accept professional invitation.", 500);
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
