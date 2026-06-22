import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Activity, CreditCard, Database, Gift, ShieldCheck, Sparkles, UsersRound } from "lucide-react";

import Page from "@/components/ui/Page";
import PageContainer from "@/components/ui/PageContainer";
import { getWorkspaceDiagnostics } from "@/lib/ops/diagnostics";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Ops",
};

export default async function OpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const diagnostics = await getWorkspaceDiagnostics({
    supabase: getSupabaseAdmin(),
    userId: user.id,
  });

  if (!diagnostics) {
    redirect("/dashboard");
  }

  const envReady = diagnostics.env.every((item) => item.configured);
  const stripeReady =
    diagnostics.stripe.customerLinked &&
    diagnostics.stripe.subscriptionLinked &&
    diagnostics.stripe.priceLinked;

  return (
    <Page density="compact">
      <PageContainer className="py-14 md:py-16">
        <section className="mx-auto max-w-6xl min-w-0">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="micro-label">Operations</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl">
                Workspace diagnostics.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/46">
                {diagnostics.workspace.name}
              </p>
            </div>
            <div className="hidden rounded-full border border-white/[0.08] bg-white/[0.03] p-3 text-white/42 md:block">
              <Activity size={28} />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <OpsMetric
              icon={ShieldCheck}
              label="Membership"
              value={diagnostics.workspace.planLabel}
              detail={diagnostics.workspace.subscriptionStatus}
              healthy={diagnostics.workspace.subscriptionStatus === "active" || diagnostics.workspace.subscriptionStatus === "trialing"}
            />
            <OpsMetric
              icon={UsersRound}
              label="Profiles"
              value={`${diagnostics.healthProfiles.active} of ${diagnostics.workspace.maxHealthProfiles}`}
              detail={`${diagnostics.healthProfiles.frozen} frozen`}
              healthy={diagnostics.healthProfiles.frozen === 0}
            />
            <OpsMetric
              icon={CreditCard}
              label="Stripe"
              value={stripeReady ? "Linked" : "Partial"}
              detail={`${diagnostics.stripe.recentEventCount} recent events`}
              healthy={stripeReady}
            />
            <OpsMetric
              icon={Database}
              label="Runtime"
              value={envReady ? "Ready" : "Missing env"}
              detail={`${diagnostics.env.filter((item) => item.configured).length} of ${diagnostics.env.length} configured`}
              healthy={envReady}
            />
          </div>

          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <section className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 flex items-start justify-between gap-5 border-b border-white/[0.06] pb-5">
                <div>
                  <p className="micro-label">Concierge</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">
                    Paid onboarding.
                  </h2>
                </div>
                <Sparkles className="shrink-0 royal-text" size={23} />
              </div>
              <div className="space-y-3">
                {diagnostics.revenue.concierge.length > 0 ? (
                  diagnostics.revenue.concierge.map((request) => (
                    <div key={request.id} className="av-control-card rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{request.contactEmail}</p>
                          <p className="av-control-muted mt-1 text-xs">
                            {formatDate(request.createdAt)} / {request.scopeCount} setup tracks
                          </p>
                        </div>
                        <StatusPill tone={isPositiveStatus(request.paymentStatus) ? "ok" : "warn"}>
                          {titleize(request.paymentStatus)}
                        </StatusPill>
                      </div>
                      <p className="av-control-muted mt-3 text-xs capitalize">
                        {titleize(request.status)}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState label="No concierge requests yet." />
                )}
              </div>
            </section>

            <section className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 flex items-start justify-between gap-5 border-b border-white/[0.06] pb-5">
                <div>
                  <p className="micro-label">Referral Credits</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">
                    Partner pipeline.
                  </h2>
                </div>
                <Gift className="shrink-0 royal-text" size={23} />
              </div>
              <div className="space-y-3">
                {diagnostics.revenue.referrals.length > 0 ? (
                  diagnostics.revenue.referrals.map((application) => (
                    <div key={application.id} className="av-control-card rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{application.contactEmail}</p>
                          <p className="av-control-muted mt-1 text-xs capitalize">
                            {titleize(application.partnerType)} / {formatDate(application.createdAt)}
                          </p>
                        </div>
                        <StatusPill tone={isPositiveStatus(application.status) ? "ok" : "warn"}>
                          {titleize(application.status)}
                        </StatusPill>
                      </div>
                      <p className="av-control-muted mt-3 truncate text-xs">
                        {application.referralCode}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState label="No referral applications yet." />
                )}
              </div>
            </section>
          </div>

          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <section className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 flex items-start justify-between gap-5 border-b border-white/[0.06] pb-5">
                <div>
                  <p className="micro-label">Profiles</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">
                    Writable set.
                  </h2>
                </div>
                <UsersRound className="shrink-0 royal-text" size={23} />
              </div>
              <div className="space-y-3">
                {diagnostics.profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={`av-control-card rounded-lg border p-4 ${profile.frozen ? "" : "av-control-card-active"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm">{profile.displayName}</p>
                        <p className="av-control-muted mt-1 text-xs capitalize">
                          {profile.relationship}
                          {profile.isPrimary ? " / primary" : ""}
                        </p>
                      </div>
                      <StatusPill tone={profile.frozen ? "warn" : "ok"}>
                        {profile.frozen ? "Frozen" : "Writable"}
                      </StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 border-b border-white/[0.06] pb-5">
                <p className="micro-label">Plan Limits</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">
                  Final tiers.
                </h2>
              </div>
              <div className="grid gap-3">
                {diagnostics.planLimits.map((limit) => (
                  <div key={limit.plan} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                    <p className="text-sm capitalize text-white/76">{limit.plan}</p>
                    <p className="text-sm royal-text">{limit.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                <p className="micro-label">Stripe</p>
                <div className="mt-4 grid gap-3 text-sm text-white/60">
                  <BooleanRow label="Customer" value={diagnostics.stripe.customerLinked} />
                  <BooleanRow label="Subscription" value={diagnostics.stripe.subscriptionLinked} />
                  <BooleanRow label="Price" value={diagnostics.stripe.priceLinked} />
                  <div className="flex min-w-0 items-center justify-between gap-4">
                    <span>Latest event</span>
                    <span className="max-w-[13rem] truncate text-white/38">
                      {diagnostics.stripe.latestEventId || "None"}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="executive-panel mt-5 rounded-lg p-6 md:p-7">
            <div className="mb-6 border-b border-white/[0.06] pb-5">
              <p className="micro-label">Environment</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                Required runtime.
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {diagnostics.env.map((item) => (
                <div key={item.name} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                  <span className="min-w-0 break-all text-xs text-white/58">{item.name}</span>
                  <StatusPill tone={item.configured ? "ok" : "warn"}>
                    {item.configured ? "Set" : "Missing"}
                  </StatusPill>
                </div>
              ))}
            </div>
          </section>
        </section>
      </PageContainer>
    </Page>
  );
}

function OpsMetric({
  detail,
  healthy,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  healthy: boolean;
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <section className="executive-panel rounded-lg p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="micro-label">{label}</p>
        <Icon className="royal-text" size={18} />
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-white/42">{detail}</p>
        <StatusPill tone={healthy ? "ok" : "warn"}>{healthy ? "OK" : "Watch"}</StatusPill>
      </div>
    </section>
  );
}

function BooleanRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <StatusPill tone={value ? "ok" : "warn"}>{value ? "Linked" : "Missing"}</StatusPill>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4 text-sm text-white/42">
      {label}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function isPositiveStatus(status: string) {
  return ["approved", "completed", "paid", "scheduled"].includes(status);
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "warn";
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${
        tone === "ok"
          ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
          : "border-[rgba(var(--gold),0.24)] bg-[rgba(var(--gold),0.08)] royal-text"
      }`}
    >
      {children}
    </span>
  );
}

function titleize(value: string) {
  return value.replaceAll("_", " ");
}
