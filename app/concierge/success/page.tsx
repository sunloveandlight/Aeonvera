import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, FileText } from "lucide-react";

import Page from "@/components/ui/Page";
import PageContainer from "@/components/ui/PageContainer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ConciergeSuccessRow = {
  contact_email: string | null;
  fulfillment_checklist:
    | Array<{
        key?: string | null;
        label?: string | null;
        status?: string | null;
      }>
    | null;
  fulfillment_stage: string | null;
  paid_at: string | null;
  payment_status: string | null;
  status: string | null;
  stripe_checkout_session_id: string | null;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Concierge Onboarding",
};

export default async function ConciergeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?mode=signin");
  }

  const params = await searchParams;
  const sessionId = Array.isArray(params.session_id)
    ? params.session_id[0]
    : params.session_id;
  const request = sessionId
    ? await getConciergeRequest(sessionId, user.id)
    : null;
  const checklist = normalizeChecklist(request?.fulfillment_checklist || null);
  const paid = request?.payment_status === "paid";

  return (
    <Page density="compact">
      <PageContainer className="py-14 md:py-16">
        <section className="mx-auto max-w-5xl">
          <div className="executive-panel rounded-lg p-6 md:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="micro-label">Sovereign Concierge</p>
                <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl">
                  {paid ? "Your onboarding is underway." : "Concierge request received."}
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/52">
                  {paid
                    ? "Your payment has been recorded. We are reviewing your workspace and preparing the kickoff path."
                    : "We are still waiting for Stripe to confirm payment. This page will update after the webhook lands."}
                </p>
              </div>
              <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-100">
                <CheckCircle2 size={30} />
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <StatusTile
                icon={CalendarCheck}
                label="Stage"
                value={titleize(request?.fulfillment_stage || "kickoff_scheduled")}
              />
              <StatusTile
                icon={ClipboardList}
                label="Payment"
                value={titleize(request?.payment_status || "processing")}
              />
              <StatusTile
                icon={FileText}
                label="Request"
                value={titleize(request?.status || "reviewing")}
              />
            </div>

            <div className="mt-8 rounded-lg border border-white/[0.07] bg-white/[0.025] p-5">
              <p className="micro-label">What happens next</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {checklist.map((item) => (
                  <div key={item.key} className="rounded-lg border border-white/[0.06] bg-black/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-white/78">{item.label}</p>
                      <span className="rounded-full border border-[rgba(var(--gold),0.2)] bg-[rgba(var(--gold),0.07)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] royal-text">
                        {titleize(item.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/plan"
                className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
              >
                View plan status
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/dashboard"
                className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        </section>
      </PageContainer>
    </Page>
  );
}

async function getConciergeRequest(sessionId: string, userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("concierge_onboarding_requests")
    .select(
      "contact_email,fulfillment_checklist,fulfillment_stage,paid_at,payment_status,status,stripe_checkout_session_id"
    )
    .eq("stripe_checkout_session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<ConciergeSuccessRow>();

  if (error) {
    console.error("Could not load concierge success request:", error);
    return null;
  }

  return data;
}

function normalizeChecklist(items: ConciergeSuccessRow["fulfillment_checklist"]) {
  const fallback = [
    { key: "lab_intake", label: "Lab intake", status: "pending" },
    { key: "wearable_setup", label: "Wearable setup", status: "pending" },
    { key: "clinician_export", label: "Clinician export", status: "pending" },
    { key: "first_30_day_protocol", label: "First 30-day protocol", status: "pending" },
  ];

  if (!Array.isArray(items) || items.length === 0) return fallback;

  return items.map((item) => ({
    key: item.key || item.label || "step",
    label: item.label || item.key || "Concierge step",
    status: item.status || "pending",
  }));
}

function StatusTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="micro-label">{label}</p>
        <Icon className="royal-text" size={17} />
      </div>
      <p className="text-sm capitalize text-white/76">{value}</p>
    </div>
  );
}

function titleize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
