import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccess, type Plan, type SubscriptionStatus } from "@/lib/auth/permissions";
import {
  DEFAULT_PHYSICIAN_EXPORT_SECTIONS,
  normalizeSections,
} from "@/lib/digital-twin/physicianExportBundle";
import {
  createShareAccessCode,
  hashShareAccessCode,
} from "@/lib/security/shareAccess";
import {
  frozenHealthProfileResponse,
  getHealthSubjectFilter,
  getRequestedHealthProfileId,
  healthSubjectInsertFields,
  resolveActiveHealthProfileContext,
  type ActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type ShareLinkRow = {
  access_count?: number;
  created_at?: string;
  expires_at?: string;
  id: string;
  included_sections?: string[];
  last_accessed_at?: string | null;
  health_profile_id?: string | null;
  recipient_email?: string | null;
  recipient_label?: string | null;
  revoked_at?: string | null;
  share_token: string;
};

const SELECT_FIELDS =
  "id,share_token,health_profile_id,recipient_email,recipient_label,included_sections,expires_at,revoked_at,access_count,last_accessed_at,created_at,access_code_hash";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePhysicianExportAccess(request);
    if (auth.response) return auth.response;
    if (!auth.healthProfileContext) throw new Error("Active health profile not found.");
    if (auth.healthProfileContext.isFrozen) return frozenHealthProfileResponse();

    const admin = getSupabaseAdmin();
    const healthSubjectFilter = getHealthSubjectFilter(auth.healthProfileContext);
    const { data, error } = await admin
      .from("physician_share_links")
      .select(SELECT_FIELDS)
      .eq(healthSubjectFilter.column, healthSubjectFilter.value)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      if (isMissingShareTable(error)) {
        return NextResponse.json({
          links: [],
          migrationRequired: true,
          message:
            "Apply supabase/migrations/20260613120000_physician_share_links.sql to enable secure share links.",
        });
      }
      throw error;
    }

    return NextResponse.json({ links: mapLinks(data || []) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load share links.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "physician-share-link-create", 20, 60_000);
    if (limited) return limited;

    const auth = await requirePhysicianExportAccess(request);
    if (auth.response) return auth.response;
    if (!auth.healthProfileContext) throw new Error("Active health profile not found.");

    const body = await request.json().catch(() => ({}));
    const includedSections = normalizeSections(body?.includedSections);
    const expiresInDays = clampDays(body?.expiresInDays);
    const recipientLabel =
      typeof body?.recipientLabel === "string"
        ? body.recipientLabel.trim().slice(0, 80) || null
        : null;
    const recipientEmail = sanitizeEmail(body?.recipientEmail);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const accessCode = createShareAccessCode();

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("physician_share_links")
      .insert({
        ...healthSubjectInsertFields(auth.healthProfileContext),
        user_id: auth.userId,
        access_code_hash: hashShareAccessCode(accessCode),
        recipient_email: recipientEmail || null,
        recipient_label: recipientLabel,
        included_sections: includedSections,
        expires_at: expiresAt.toISOString(),
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      if (isMissingShareTable(error)) {
        return NextResponse.json(
          {
            error:
              "Apply supabase/migrations/20260613120000_physician_share_links.sql in Supabase first.",
            migrationRequired: true,
          },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      link: {
        ...mapLink(data as ShareLinkRow),
        accessCode,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create share link.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "physician-share-link-update", 40, 60_000);
    if (limited) return limited;

    const auth = await requirePhysicianExportAccess(request);
    if (auth.response) return auth.response;
    if (!auth.healthProfileContext) throw new Error("Active health profile not found.");

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";

    if (!isUuid(id)) {
      return NextResponse.json({ error: "Share link not found." }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const healthSubjectFilter = getHealthSubjectFilter(auth.healthProfileContext);
    const { data, error } = await admin
      .from("physician_share_links")
      .update({
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq(healthSubjectFilter.column, healthSubjectFilter.value)
      .select(SELECT_FIELDS)
      .single();

    if (error) throw error;

    return NextResponse.json({ link: mapLink(data as ShareLinkRow) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not revoke share link.";
    console.error(message, error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

async function requirePhysicianExportAccess(request: NextRequest): Promise<{
  response: NextResponse | null;
  healthProfileContext: ActiveHealthProfileContext | null;
  userId: string;
}> {
  const supabaseUser = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    return {
      healthProfileContext: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: "",
    };
  }

  const admin = getSupabaseAdmin();
  const { data: entitlementProfile } = await admin
    .from("profiles")
    .select("plan,subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();
  const entitlement = entitlementProfile as {
    plan?: Plan | null;
    subscription_status?: SubscriptionStatus | null;
  } | null;

  if (
    !canAccess(
      entitlement?.plan || null,
      entitlement?.subscription_status || null,
      "physician_exports"
    )
  ) {
    return {
      healthProfileContext: null,
      response: NextResponse.json(
        {
          error: "Secure physician and coach share links are included in Sovereign.",
          upgrade: {
            minimumPlan: "sovereign",
            message: "Upgrade to Sovereign to unlock secure clinical sharing.",
          },
        },
        { status: 403 }
      ),
      userId: "",
    };
  }

  const healthProfileContext = await resolveActiveHealthProfileContext({
    supabase: admin,
    loginUserId: user.id,
    requestedHealthProfileId: getRequestedHealthProfileId(request),
  });

  return { healthProfileContext, response: null, userId: user.id };
}

function mapLinks(rows: ShareLinkRow[]) {
  return rows.map(mapLink);
}

function mapLink(row: ShareLinkRow) {
  const expired = row.expires_at ? Date.parse(row.expires_at) < Date.now() : false;
  return {
    id: row.id,
    accessCount: row.access_count || 0,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    includedSections: normalizeSections(row.included_sections || DEFAULT_PHYSICIAN_EXPORT_SECTIONS),
    lastAccessedAt: row.last_accessed_at || null,
    recipientEmail: row.recipient_email || null,
    recipientLabel: row.recipient_label || null,
    requiresAccessCode: Boolean((row as ShareLinkRow & { access_code_hash?: string | null }).access_code_hash),
    revokedAt: row.revoked_at || null,
    shareToken: row.share_token,
    status: row.revoked_at ? "revoked" : expired ? "expired" : "active",
    url: `/physician-share/${row.share_token}`,
  };
}

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized.slice(0, 160) : "";
}

function clampDays(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 14;
  return Math.max(1, Math.min(90, Math.round(numeric)));
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
