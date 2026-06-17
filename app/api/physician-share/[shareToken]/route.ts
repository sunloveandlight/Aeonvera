import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  buildPhysicianExportBundle,
  normalizeSections,
} from "@/lib/digital-twin/physicianExportBundle";
import { rateLimitRequest } from "@/lib/security/rateLimit";
import { verifyShareAccessCode } from "@/lib/security/shareAccess";

type ShareLinkRow = {
  access_count?: number;
  expires_at?: string;
  included_sections?: string[];
  access_code_hash?: string | null;
  recipient_label?: string | null;
  revoked_at?: string | null;
  share_token: string;
  user_id: string;
};

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/physician-share/[shareToken]">
) {
  try {
    const rateLimited = await rateLimitRequest(request, "physician-share", 60, 60_000);
    if (rateLimited) return rateLimited;

    const { shareToken } = await context.params;

    if (!isUuid(shareToken)) {
      return NextResponse.json({ error: "Share link not found." }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("physician_share_links")
      .select("user_id,share_token,access_code_hash,recipient_label,included_sections,expires_at,revoked_at,access_count")
      .eq("share_token", shareToken)
      .maybeSingle();

    if (error) {
      if (isMissingShareTable(error)) {
        return NextResponse.json(
          { error: "Secure physician sharing is not live yet." },
          { status: 503 }
        );
      }
      throw error;
    }

    const link = data as ShareLinkRow | null;

    if (!link) {
      return NextResponse.json({ error: "Share link not found." }, { status: 404 });
    }

    if (link.revoked_at) {
      return NextResponse.json({ error: "This share link has been revoked." }, { status: 410 });
    }

    if (link.expires_at && Date.parse(link.expires_at) < Date.now()) {
      return NextResponse.json({ error: "This share link has expired." }, { status: 410 });
    }

    if (
      !verifyShareAccessCode(
        request.nextUrl.searchParams.get("code"),
        link.access_code_hash
      )
    ) {
      return NextResponse.json(
        {
          codeRequired: true,
          error: "Enter the access code that was shared with this export.",
        },
        { status: 401 }
      );
    }

    await admin
      .from("physician_share_links")
      .update({
        access_count: (link.access_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("share_token", shareToken);

    const bundle = await buildPhysicianExportBundle({
      email: null,
      sections: normalizeSections(link.included_sections),
      userId: link.user_id,
    });

    return NextResponse.json({
      bundle,
      share: {
        expiresAt: link.expires_at,
        recipientLabel: link.recipient_label,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load physician share.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isMissingShareTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("physician_share_links") ||
    error.message?.includes("schema cache")
  );
}
