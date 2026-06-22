import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendCoachEmail } from "@/lib/notifications/email";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type PartnerType = "physician" | "coach" | "health_creator" | "other";

type ReferralApplicationRow = {
  id: string;
  partner_type: PartnerType;
  referral_code: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const PARTNER_TYPES = new Set<PartnerType>([
  "physician",
  "coach",
  "health_creator",
  "other",
]);

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("referral_partner_applications")
      .select("id, partner_type, referral_code, status, created_at, updated_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      application: data ? serializeReferralApplication(data as ReferralApplicationRow) : null,
    });
  } catch (error) {
    console.error("Could not load referral application:", error);
    return NextResponse.json({ error: "Could not load referral application." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "referral-partner-application", 8, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const workspaceId = await getWorkspaceId(admin, auth.user.id);
    const partnerType = sanitizePartnerType(body.partnerType);
    const contactEmail = sanitizeEmail(body.contactEmail) || auth.user.email || null;

    const { data, error } = await admin
      .from("referral_partner_applications")
      .insert({
        audience_size: sanitizeText(body.audienceSize, 80),
        contact_email: contactEmail,
        organization_name: sanitizeText(body.organizationName, 160),
        partner_type: partnerType,
        proposed_channel: sanitizeText(body.proposedChannel, 240),
        user_id: auth.user.id,
        workspace_id: workspaceId,
      })
      .select("id, partner_type, referral_code, status, created_at, updated_at")
      .single();

    if (error) throw error;
    const application = data as ReferralApplicationRow;

    await sendOpsAlert({
      subject: "New referral partner application",
      text: [
        "A referral partner application was submitted.",
        `Application: ${application.id}`,
        `User: ${auth.user.id}`,
        `Email: ${contactEmail || "unknown"}`,
        `Workspace: ${workspaceId || "none"}`,
        `Partner type: ${application.partner_type}`,
        `Referral code: ${application.referral_code}`,
      ].join("\n"),
    });

    return NextResponse.json({
      application: serializeReferralApplication(application),
    });
  } catch (error) {
    console.error("Could not create referral application:", error);
    return NextResponse.json({ error: "Could not create referral application." }, { status: 500 });
  }
}

async function sendOpsAlert({
  subject,
  text,
}: {
  subject: string;
  text: string;
}) {
  const to = process.env.OPS_ALERT_EMAIL || "info@aeonvera.com";
  const result = await sendCoachEmail({
    html: `<pre style="font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    subject,
    text,
    to,
  });

  if (result.status !== "sent") {
    console.warn("Ops alert email skipped:", result.error);
  }
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
    };
  }

  return { response: null, user };
}

async function getWorkspaceId(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return typeof data?.workspace_id === "string" ? data.workspace_id : null;
}

function sanitizePartnerType(value: unknown): PartnerType {
  return typeof value === "string" && PARTNER_TYPES.has(value as PartnerType)
    ? (value as PartnerType)
    : "health_creator";
}

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function serializeReferralApplication(row: ReferralApplicationRow) {
  return {
    createdAt: row.created_at,
    id: row.id,
    partnerType: row.partner_type,
    referralCode: row.referral_code,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
