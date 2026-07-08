import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import { jsonError, requireUser } from "@/app/api/professional/_utils";
import {
  createProfessionalOrganization,
  listProfessionalOrganizations,
  sanitizeOrganizationSubtype,
  sanitizeText,
} from "@/lib/professional/workflow";

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const organizations = await listProfessionalOrganizations({
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("Could not load professional organizations:", error);
    return jsonError("Could not load professional organizations.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "professional-organization-create", 10, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const name = sanitizeText(body.name, 100);
    const subtype = sanitizeOrganizationSubtype(body.organizationSubtype || body.subtype);

    if (!name) return jsonError("Organization name is required.");
    if (!subtype) return jsonError("Choose a supported organization type.");

    const workspace = await createProfessionalOrganization({
      name,
      subtype,
      supabase: getSupabaseAdmin(),
      userId: auth.userId,
    });

    return NextResponse.json({
      organization: {
        id: workspace.id,
        name: workspace.name,
        organizationSubtype: workspace.organization_subtype,
        role: "owner",
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Could not create professional organization:", error);
    return jsonError("Could not create professional organization.", 500);
  }
}
