"use client";

import Link from "next/link";
import {
  Bell,
  CreditCard,
  Database,
  LogOut,
  Mic2,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import Page from "@/components/ui/Page";
import PageContainer from "@/components/ui/PageContainer";
import { supabase } from "@/lib/supabase/client";

const SETTINGS_SECTIONS = [
  {
    icon: CreditCard,
    title: "Membership",
    body: "Change plan, review billing, or open Stripe account management.",
    href: "/pricing",
    action: "Manage plan",
  },
  {
    icon: Mic2,
    title: "Voice",
    body: "Choose how Aeonvera speaks, listens, and confirms actions.",
    href: "/companion",
    action: "Open voice agent",
  },
  {
    icon: Database,
    title: "Data sources",
    body: "Connect Oura, review imports, and keep your health model current.",
    href: "/data-sources",
    action: "Manage sources",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "Tune alerts, reminders, and delivery preferences.",
    href: "/dashboard",
    action: "Review alerts",
  },
  {
    icon: ShieldCheck,
    title: "Privacy and sharing",
    body: "Create or revoke physician shares and care-network access.",
    href: "/physician-export",
    action: "Manage sharing",
  },
];

export default function SettingsPage() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <Page density="compact">
      <PageContainer className="pt-20">
        <section className="mx-auto max-w-5xl">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="micro-label">Account</p>
              <h1 className="mt-4 max-w-3xl text-5xl font-light leading-tight text-white md:text-6xl">
                Your private account.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/46">
                Membership, voice, connected data, privacy, and notifications in one protected place.
              </p>
            </div>
            <div className="hidden rounded-full border border-white/[0.08] bg-white/[0.03] p-3 text-white/42 md:block">
              <UserCircle size={28} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {SETTINGS_SECTIONS.map(({ action, body, href, icon: Icon, title }) => (
              <Link
                key={title}
                href={href}
                className="quiet-lift executive-panel group flex min-h-[12rem] flex-col justify-between rounded-lg p-6 transition hover:border-white/[0.14]"
              >
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xl font-light text-white">{title}</p>
                    <p className="mt-3 text-sm leading-7 text-white/44">{body}</p>
                  </div>
                  <Icon className="shrink-0 royal-text" size={21} />
                </div>
                <p className="mt-7 text-sm text-white/44 transition group-hover:text-white/76">
                  {action}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.025] px-4 text-sm text-white/48 transition hover:border-white/[0.14] hover:text-white/76"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </section>
      </PageContainer>
    </Page>
  );
}
