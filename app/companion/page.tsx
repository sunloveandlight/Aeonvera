"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, Brain, CalendarClock, Dna, MessageCircle, Sparkles } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import NotificationPreferencesPanel from "@/components/dashboard/NotificationPreferencesPanel";
import { supabase } from "@/lib/supabase/client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

type TwinPayload = {
  intelligence?: {
    summary: string;
    modelState: string;
    confidence: number;
    nextMove: {
      title: string;
      detail: string;
      href: string;
    };
  };
  counts?: Record<string, number>;
};

type Protocol = {
  id: string;
  summary?: string | null;
  focus_domains?: string[] | null;
  status?: string | null;
  created_at?: string;
};

type CoachMessage = {
  id: string;
  title: string;
  message: string;
  created_at?: string;
};

export default function CompanionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [twin, setTwin] = useState<TwinPayload | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState({
    standalone: false,
    serviceWorker: false,
    push: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCompanion() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?mode=signin");
        return;
      }

      try {
        const [twinResponse, protocolResponse, coachResponse] = await Promise.all([
          fetch("/api/digital-twin/timeline", { credentials: "include" }),
          fetch("/api/optimization/protocols", { credentials: "include" }),
          fetch("/api/notifications/deliveries", { credentials: "include" }),
        ]);
        const [twinData, protocolData, coachData] = await Promise.all([
          twinResponse.json(),
          protocolResponse.json(),
          coachResponse.json(),
        ]);

        if (!twinResponse.ok) throw new Error(twinData.error || "Companion could not load.");

        if (!cancelled) {
          setTwin(twinData);
          setProtocols(protocolData.protocols || []);
          setCoachMessages(coachData.notifications || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Companion could not load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCompanion();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as StandaloneNavigator).standalone === true;
    setInstallState({
      standalone,
      serviceWorker: "serviceWorker" in navigator,
      push: "PushManager" in window,
    });

    function handleInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setInstallState((current) => ({ ...current, standalone: true }));
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const protocol = protocols[0];
  const protocolFocus = useMemo(
    () => protocol?.focus_domains?.slice(0, 3).join(" / ") || "Optimization",
    [protocol]
  );

  async function installCompanion() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  }

  return (
    <PageContainer>
      <div className="py-14">
        <div className="mb-9 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="micro-label mb-5">Mobile Companion</p>
            <h1 className="max-w-4xl text-5xl font-light leading-[1.04] text-white md:text-6xl">
              Today&apos;s healthspan operating view.
            </h1>
          </div>
          <Link
            href="/digital-twin"
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            Digital Twin <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Loading companion</p>
          </div>
        ) : message ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Unavailable</p>
            <p className="mt-4 text-sm leading-7 text-white/50">{message}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <Link
                href={twin?.intelligence?.nextMove.href || "/optimization"}
                className="quiet-lift executive-panel block rounded-lg p-6 transition hover:border-white/[0.14] md:p-7"
              >
                <div className="mb-6 flex items-center justify-between gap-3">
                  <p className="micro-label">Today</p>
                  <Sparkles size={18} className="royal-text" />
                </div>
                <h2 className="text-3xl font-light leading-tight text-white">
                  {twin?.intelligence?.nextMove.title || "Run your next protocol"}
                </h2>
                <p className="mt-5 text-sm leading-7 text-white/48">
                  {twin?.intelligence?.nextMove.detail ||
                    "Aeonvera is ready to turn the next recommendation into a tracked action."}
                </p>
              </Link>

              <div className="executive-panel rounded-lg p-6 md:p-7">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <p className="micro-label">Twin Status</p>
                  <Dna size={18} className="royal-text" />
                </div>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-light leading-none text-white">
                    {twin?.intelligence?.confidence || 0}
                  </p>
                  <p className="mb-1 text-xs uppercase tracking-[0.14em] text-white/28">
                    confidence
                  </p>
                </div>
                <p className="mt-5 text-sm leading-7 text-white/48">
                  {twin?.intelligence?.summary ||
                    "Your model is assembling from assessments, labs, protocols, coach signals, and wearable data."}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <InstallCompanionCard
                installState={installState}
                canPrompt={Boolean(installPrompt)}
                onInstall={() => void installCompanion()}
              />
              <CompanionCard
                icon={CalendarClock}
                label="Active Protocol"
                title={protocolFocus}
                detail={protocol?.summary || "Generate a protocol to activate daily execution."}
                href="/optimization"
              />
              <CompanionCard
                icon={MessageCircle}
                label="Coach Inbox"
                title={coachMessages[0]?.title || "No coach message yet"}
                detail={coachMessages[0]?.message || "Daily coach messages will appear here as the system learns."}
                href="/dashboard"
              />
            </div>

            <NotificationPreferencesPanel />
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function InstallCompanionCard({
  installState,
  canPrompt,
  onInstall,
}: {
  installState: {
    standalone: boolean;
    serviceWorker: boolean;
    push: boolean;
  };
  canPrompt: boolean;
  onInstall: () => void;
}) {
  const title = installState.standalone
    ? "Installed"
    : canPrompt
    ? "Install Aeonvera"
    : "Add to Home Screen";
  const detail = installState.standalone
    ? "Aeonvera is running like an app on this device."
    : canPrompt
    ? "Install the companion so coach messages and protocols live one tap away."
    : "On iPhone or iPad, use Share, then Add to Home Screen. On Android, use the browser install option.";

  return (
    <div className="executive-panel rounded-lg p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="micro-label">App Mode</p>
        <Bell size={17} className="royal-text" />
      </div>
      <h3 className="text-2xl font-light leading-tight text-white/86">{title}</h3>
      <p className="mt-4 text-sm leading-7 text-white/42">{detail}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          ["Install", installState.standalone || canPrompt],
          ["Push", installState.push],
          ["Worker", installState.serviceWorker],
        ].map(([label, active]) => (
          <span
            key={String(label)}
            className={`rounded-md px-2.5 py-1 text-[8px] uppercase tracking-[0.14em] ${
              active
                ? "bg-white/[0.035] royal-text"
                : "bg-white/[0.02] text-white/26"
            }`}
          >
            {String(label)}
          </span>
        ))}
      </div>
      {canPrompt && !installState.standalone && (
        <button
          type="button"
          onClick={onInstall}
          className="premium-action mt-5 inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-[10px] uppercase tracking-[0.14em]"
        >
          Install companion
        </button>
      )}
    </div>
  );
}

function CompanionCard({
  icon: Icon,
  label,
  title,
  detail,
  href,
}: {
  icon: typeof Bell;
  label: string;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="quiet-lift executive-panel block rounded-lg p-5 transition hover:border-white/[0.14]"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="micro-label">{label}</p>
        <Icon size={17} className="royal-text" />
      </div>
      <h3 className="text-2xl font-light leading-tight text-white/86">{title}</h3>
      <p className="mt-4 line-clamp-4 text-sm leading-7 text-white/42">{detail}</p>
    </Link>
  );
}

function totalSignals(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
}
