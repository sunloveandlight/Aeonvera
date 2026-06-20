import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    from?: string;
    subject?: string;
    bounce?: {
      message?: string;
      subType?: string;
      type?: string;
    };
  };
};

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing RESEND_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") || "",
    "svix-timestamp": request.headers.get("svix-timestamp") || "",
    "svix-signature": request.headers.get("svix-signature") || "",
  };

  let event: ResendWebhookEvent;

  try {
    event = new Webhook(webhookSecret).verify(
      payload,
      headers
    ) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  const emailId = event.data?.email_id;

  if (!emailId) {
    return NextResponse.json({ received: true, ignored: "missing_email_id" });
  }

  const admin = getSupabaseAdmin();
  const nextStatus = mapResendStatus(event.type);
  const errorMessage = buildErrorMessage(event);
  const { data: existing } = await admin
    .from("notification_deliveries")
    .select("id, payload")
    .eq("provider", "resend")
    .eq("provider_message_id", emailId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({
      received: true,
      ignored: "delivery_not_found",
      email_id: emailId,
      type: event.type,
    });
  }

  const currentPayload =
    existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? existing.payload
      : {};
  const resendEvents = Array.isArray(
    (currentPayload as Record<string, unknown>).resend_events
  )
    ? ((currentPayload as Record<string, unknown>).resend_events as unknown[])
    : [];

  const { error } = await admin
    .from("notification_deliveries")
    .update({
      status: nextStatus,
      error: errorMessage,
      sent_at: nextStatus === "sent" ? event.created_at || new Date().toISOString() : null,
      payload: {
        ...currentPayload,
        resend_events: [
          ...resendEvents,
          {
            type: event.type,
            created_at: event.created_at,
            svix_id: headers["svix-id"],
          },
        ],
      },
    })
    .eq("id", existing.id);

  if (error) {
    console.error("[Resend Webhook] Delivery update failed:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({
    received: true,
    email_id: emailId,
    type: event.type,
    status: nextStatus,
  });
}

function mapResendStatus(type?: string): "sent" | "failed" | "pending" {
  switch (type) {
    case "email.sent":
    case "email.delivered":
    case "email.opened":
    case "email.clicked":
      return "sent";
    case "email.delivery_delayed":
    case "email.scheduled":
      return "pending";
    case "email.bounced":
    case "email.complained":
    case "email.failed":
    case "email.suppressed":
      return "failed";
    default:
      return "sent";
  }
}

function buildErrorMessage(event: ResendWebhookEvent) {
  if (
    event.type !== "email.bounced" &&
    event.type !== "email.complained" &&
    event.type !== "email.failed" &&
    event.type !== "email.suppressed"
  ) {
    return null;
  }

  return (
    event.data?.bounce?.message ||
    event.data?.bounce?.subType ||
    event.type ||
    "Resend reported email failure"
  );
}
