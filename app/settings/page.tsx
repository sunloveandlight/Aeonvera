"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CreditCard,
  Database,
  Eye,
  LogOut,
  Mic2,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import Page from "@/components/ui/Page";
import PageContainer from "@/components/ui/PageContainer";
import { supabase } from "@/lib/supabase/client";
import { VOICE_OPTIONS, type VoiceId } from "@/components/layout/commandOrb/config";

type ToggleKey = "dailyBrief" | "coachAlerts" | "shareAccess";

const DEFAULT_TOGGLES: Record<ToggleKey, boolean> = {
  coachAlerts: true,
  dailyBrief: true,
  shareAccess: true,
};

const SETTINGS_LINKS = [
  {
    icon: CreditCard,
    title: "Membership",
    body: "Change plan, invoices, payment method, and cancellation live in the secure billing flow.",
    href: "/pricing",
    action: "Manage plan",
  },
  {
    icon: Database,
    title: "Connected data",
    body: "Oura, Whoop, Apple Health, labs, calendar, and source freshness.",
    href: "/data-sources",
    action: "Open sources",
  },
  {
    icon: ShieldCheck,
    title: "Clinical sharing",
    body: "Physician packet, secure share links, access codes, and revocation.",
    href: "/physician-export",
    action: "Manage sharing",
  },
];

export default function SettingsPage() {
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>("marin");
  const [toggles, setToggles] = useState(DEFAULT_TOGGLES);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const savedVoice = window.localStorage.getItem("aeonvera.voice");
      if (isVoiceId(savedVoice)) setSelectedVoice(savedVoice);

      const savedToggles = window.localStorage.getItem("aeonvera.settings.toggles");
      if (!savedToggles) return;

      try {
        const parsed = JSON.parse(savedToggles) as Partial<Record<ToggleKey, boolean>>;
        setToggles((current) => ({ ...current, ...parsed }));
      } catch {
        // Settings fall back to the calm defaults above.
      }
    });
  }, []);

  const selectedVoiceOption = useMemo(
    () => VOICE_OPTIONS.find((voice) => voice.id === selectedVoice) || VOICE_OPTIONS[0],
    [selectedVoice]
  );

  function changeVoice(voice: VoiceId) {
    setSelectedVoice(voice);
    window.localStorage.setItem("aeonvera.voice", voice);
  }

  function toggleSetting(key: ToggleKey) {
    setToggles((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem("aeonvera.settings.toggles", JSON.stringify(next));
      return next;
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <Page density="compact">
      <PageContainer className="pt-20">
        <section className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="micro-label">Account</p>
              <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight text-white md:text-6xl">
                Your private account.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/46">
                Voice, notifications, data, sharing, and membership controls in one protected place.
              </p>
            </div>
            <div className="hidden rounded-full border border-white/[0.08] bg-white/[0.03] p-3 text-white/42 md:block">
              <UserCircle size={28} />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
            <section className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 flex items-start justify-between gap-5 border-b border-white/[0.06] pb-5">
                <div>
                  <p className="micro-label">Voice</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">
                    {selectedVoiceOption.label}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-white/46">
                    {selectedVoiceOption.tone}. The Orb uses this voice for realtime sessions where supported.
                  </p>
                </div>
                <Mic2 className="shrink-0 royal-text" size={23} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {VOICE_OPTIONS.map((voice) => {
                  const selected = voice.id === selectedVoice;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => changeVoice(voice.id)}
                      className={`rounded-lg border p-4 text-left transition ${
                        selected
                          ? "border-[rgba(var(--gold),0.32)] bg-[rgba(var(--gold),0.08)]"
                          : "border-white/[0.07] bg-white/[0.025] hover:border-white/[0.14]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-white/78">{voice.label}</p>
                        {selected ? <Check size={16} className="royal-text" /> : null}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/38">{voice.tone}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
                <p className="text-sm text-white/70">Microphone permission</p>
                <p className="mt-2 text-xs leading-6 text-white/40">
                  Browsers control microphone access. Allow Aeonvera once for this site, then your browser should remember it unless permissions are cleared.
                </p>
              </div>
            </section>

            <section className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 flex items-start justify-between gap-5 border-b border-white/[0.06] pb-5">
                <div>
                  <p className="micro-label">Preferences</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">
                    Quiet by default.
                  </h2>
                </div>
                <SlidersHorizontal className="shrink-0 royal-text" size={23} />
              </div>

              <div className="space-y-3">
                <SettingsToggle
                  active={toggles.dailyBrief}
                  body="Morning brief and today’s highest-leverage plan."
                  icon={Bell}
                  label="Daily brief"
                  onClick={() => toggleSetting("dailyBrief")}
                />
                <SettingsToggle
                  active={toggles.coachAlerts}
                  body="Important coach alerts when your health state changes."
                  icon={Eye}
                  label="Health intelligence alerts"
                  onClick={() => toggleSetting("coachAlerts")}
                />
                <SettingsToggle
                  active={toggles.shareAccess}
                  body="Notify you when physician or care-network access is used."
                  icon={ShieldCheck}
                  label="Share access receipts"
                  onClick={() => toggleSetting("shareAccess")}
                />
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {SETTINGS_LINKS.map(({ action, body, href, icon: Icon, title }) => (
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

          <div className="mt-5 flex justify-end">
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

function SettingsToggle({
  active,
  body,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  body: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-white/[0.07] bg-white/[0.025] p-4 text-left transition hover:border-white/[0.14]"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0 royal-text" size={17} />
        <div>
          <p className="text-sm text-white/72">{label}</p>
          <p className="mt-1 text-xs leading-5 text-white/36">{body}</p>
        </div>
      </div>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
          active
            ? "border-[rgba(var(--gold),0.34)] bg-[rgba(var(--gold),0.18)]"
            : "border-white/[0.1] bg-white/[0.035]"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-1 size-4 rounded-full bg-white/80 transition ${
            active ? "left-5" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function isVoiceId(value: unknown): value is VoiceId {
  return typeof value === "string" && VOICE_OPTIONS.some((voice) => voice.id === value);
}
