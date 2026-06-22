import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getRequestedHealthProfileId,
  resolveActiveHealthProfileContext,
} from "@/lib/health-profiles/activeHealthProfile";
import { sendCoachEmail } from "@/lib/notifications/email";
import { rateLimitRequest } from "@/lib/security/rateLimit";

type ConciergeRequestRow = {
  fulfillment_checklist?: ConciergeChecklistItem[] | null;
  fulfillment_stage?: string | null;
  id: string;
  status: string;
  package_tier: string;
  requested_scope: string[];
  payment_status?: string | null;
  created_at: string;
  updated_at: string;
};

type ConciergeChecklistItem = {
  key: string;
  label: string;
  status: string;
};

const DEFAULT_SCOPE = [
  "lab_intake",
  "wearable_setup",
  "clinician_export",
  "first_30_day_protocol",
];

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("concierge_onboarding_requests")
      .select("id, status, package_tier, requested_scope, payment_status, fulfillment_stage, fulfillment_checklist, created_at, updated_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      request: data ? serializeConciergeRequest(data as ConciergeRequestRow) : null,
    });
  } catch (error) {
    console.error("Could not load concierge request:", error);
    return NextResponse.json({ error: "Could not load concierge request." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimitRequest(request, "concierge-onboarding-request", 8, 60_000);
    if (limited) return limited;

    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const healthProfileContext = await resolveActiveHealthProfileContext({
      supabase: admin,
      loginUserId: auth.user.id,
      requestedHealthProfileId: getRequestedHealthProfileId(request),
    });
    const workspaceId = await getWorkspaceId(admin, auth.user.id);
    const contactEmail = sanitizeEmail(body.contactEmail) || auth.user.email || null;
    const requestedScope = sanitizeScope(body.requestedScope);

    const { data, error } = await admin
      .from("concierge_onboarding_requests")
      .insert({
        contact_email: contactEmail,
        health_profile_id: healthProfileContext.healthProfileId,
        notes: sanitizeNotes(body.notes),
        requested_scope: requestedScope.length ? requestedScope : DEFAULT_SCOPE,
        source: "plan_page",
        user_id: auth.user.id,
        workspace_id: workspaceId,
      })
      .select("id, status, package_tier, requested_scope, payment_status, fulfillment_stage, fulfillment_checklist, created_at, updated_at")
      .single();

    if (error) throw error;
    const conciergeRequest = data as ConciergeRequestRow;
    const checkoutUrl = await createConciergeCheckout({
      admin,
      contactEmail,
      requestId: conciergeRequest.id,
      userEmail: auth.user.email || contactEmail || undefined,
      userId: auth.user.id,
    });

    await sendOpsAlert({
      subject: "New Sovereign concierge request",
      text: [
        "A Sovereign concierge onboarding request was created.",
        `Request: ${conciergeRequest.id}`,
        `User: ${auth.user.id}`,
        `Email: ${contactEmail || "unknown"}`,
        `Workspace: ${workspaceId || "none"}`,
        `Health profile: ${healthProfileContext.healthProfileId || "none"}`,
        `Payment: ${checkoutUrl ? "checkout_started" : "not_started"}`,
      ].join("\n"),
    });

    return NextResponse.json({
      checkoutUrl,
      request: serializeConciergeRequest(conciergeRequest),
    });
  } catch (error) {
    console.error("Could not create concierge request:", error);
    return NextResponse.json({ error: "Could not create concierge request." }, { status: 500 });
  }
}

async function createConciergeCheckout({
  admin,
  contactEmail,
  requestId,
  userEmail,
  userId,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  contactEmail: string | null;
  requestId: string;
  userEmail?: string;
  userId: string;
}) {
  const priceId = process.env.STRIPE_SOVEREIGN_CONCIERGE_PRICE_ID;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!priceId || !secretKey || !siteUrl) return null;

  const stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });
  const customerId = await getOrCreateStripeCustomer({
    admin,
    email: userEmail || contactEmail || undefined,
    userId,
    stripe,
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      concierge_request_id: requestId,
      kind: "sovereign_concierge",
      user_id: userId,
    },
    mode: "payment",
    success_url: `${siteUrl}/concierge/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/plan?concierge=cancelled`,
  });

  await admin
    .from("concierge_onboarding_requests")
    .update({
      payment_status: "checkout_started",
      stripe_checkout_session_id: session.id,
    })
    .eq("id", requestId)
    .eq("user_id", userId);

  return session.url;
}

async function getOrCreateStripeCustomer({
  admin,
  email,
  stripe,
  userId,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  email?: string;
  stripe: Stripe;
  userId: string;
}) {
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });

  await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("user_id", userId);

  return customer.id;
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

function sanitizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function sanitizeNotes(value: unknown) {
  if (typeof value !== "string") return null;
  const notes = value.trim();
  return notes ? notes.slice(0, 1000) : null;
}

function sanitizeScope(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => DEFAULT_SCOPE.includes(item));
}

function serializeConciergeRequest(row: ConciergeRequestRow) {
  return {
    createdAt: row.created_at,
    fulfillmentChecklist: row.fulfillment_checklist || [],
    fulfillmentStage: row.fulfillment_stage || "intake_pending",
    id: row.id,
    packageTier: row.package_tier,
    paymentStatus: row.payment_status || "not_started",
    requestedScope: row.requested_scope,
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
