import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  buildPhysicianExportBundle,
} from "@/lib/digital-twin/physicianExportBundle";
import {
  permissionsForCareRole,
  sanitizeCareRole,
  type CareNetworkRole,
} from "@/lib/care-network/rolePermissions";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import { verifyShareAccessCode } from "@/lib/security/shareAccess";

type NetworkMembershipRow = {
  access_count?: number;
  access_code_hash?: string | null;
  accepted_at?: string | null;
  expires_at?: string;
  invite_token: string;
  member_email?: string;
  member_name?: string | null;
  owner_user_id: string;
  permissions?: string[];
  revoked_at?: string | null;
  role?: CareNetworkRole;
  status?: string;
};

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/care-network/[inviteToken]">
) {
  try {
    const rateLimited = await rateLimitRequest(request, "care-network", 60, 60_000);
    if (rateLimited) return rateLimited;

    const { inviteToken } = await context.params;

    if (!isUuid(inviteToken)) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("care_network_memberships")
      .select("owner_user_id,invite_token,access_code_hash,member_email,member_name,role,status,permissions,expires_at,accepted_at,revoked_at,access_count")
      .eq("invite_token", inviteToken)
      .maybeSingle();

    if (error) {
      if (isMissingNetworkTable(error)) {
        return NextResponse.json(
          { error: "Care network invitations are not live yet." },
          { status: 503 }
        );
      }
      throw error;
    }

    const invite = data as NetworkMembershipRow | null;

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invite.revoked_at || invite.status === "revoked") {
      return NextResponse.json({ error: "This invitation has been revoked." }, { status: 410 });
    }

    if (invite.expires_at && Date.parse(invite.expires_at) < Date.now()) {
      await admin
        .from("care_network_memberships")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("invite_token", inviteToken);
      return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
    }

    if (
      !verifyShareAccessCode(
        request.nextUrl.searchParams.get("code"),
        invite.access_code_hash
      )
    ) {
      return NextResponse.json(
        {
          codeRequired: true,
          error: "Enter the access code that was shared with this invitation.",
        },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();
    await admin
      .from("care_network_memberships")
      .update({
        accepted_at: invite.accepted_at || now,
        access_count: (invite.access_count || 0) + 1,
        last_accessed_at: now,
        status: "active",
        updated_at: now,
      })
      .eq("invite_token", inviteToken);

    const role = sanitizeCareRole(invite.role);
    const bundle = await buildPhysicianExportBundle({
      email: null,
      sections: permissionsForCareRole({
        requested: invite.permissions,
        role,
      }),
      userId: invite.owner_user_id,
    });

    return NextResponse.json({
      bundle,
      invitation: {
        expiresAt: invite.expires_at,
        memberEmail: invite.member_email,
        memberName: invite.member_name,
        role,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not open care network invitation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isMissingNetworkTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("care_network_memberships") ||
    error.message?.includes("schema cache")
  );
}
