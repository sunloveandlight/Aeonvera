"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Link2, Printer, ShieldCheck, UsersRound } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState from "@/components/ui/AccessState";
import ClinicalPacketSummary from "@/components/physician/ClinicalPacketSummary";
import { supabase } from "@/lib/supabase/client";

type ExportBundle = {
  clinicalPacket?: {
    activeProtocol?: {
      detail: string;
      domains: string[];
      status?: string | null;
      title: string;
    } | null;
    executiveSummary: string;
    recentChanges: Array<{
      detail: string;
      label: string;
      tone: "positive" | "caution" | "neutral";
    }>;
    reviewPriorities: string[];
    riskFlags: Array<{
      detail: string;
      label: string;
      severity: "high" | "medium" | "watch";
    }>;
  };
  generatedAt: string;
  patient: {
    id?: string;
    email?: string | null;
    profile?: {
      display_name?: string | null;
      plan?: string | null;
      biological_age?: number | null;
    } | null;
  };
  assessment?: Record<string, unknown> | null;
  latestReport?: {
    risk_score?: number | null;
    primary_goal?: string | null;
    created_at?: string;
    report?: {
      top_priorities?: string[];
      strengths?: string[];
      weaknesses?: string[];
    } | null;
  } | null;
  biologicalAgeHistory: Array<Record<string, unknown>>;
  labs: Array<Record<string, unknown>>;
  protocols: Array<{
    summary?: string | null;
    focus_domains?: string[] | null;
    status?: string | null;
    created_at?: string;
  }>;
  outcomes: Array<Record<string, unknown>>;
  wearableMetrics?: Array<Record<string, unknown>>;
  clinicalInsights?: Array<Record<string, unknown>>;
  healthState?: {
    insights?: string[];
    risk_scores?: Record<string, number>;
    updated_at?: string;
  } | null;
};

type ShareLink = {
  accessCode?: string;
  accessCount: number;
  createdAt?: string;
  expiresAt?: string;
  id: string;
  includedSections: string[];
  lastAccessedAt?: string | null;
  recipientEmail?: string | null;
  recipientLabel?: string | null;
  requiresAccessCode?: boolean;
  revokedAt?: string | null;
  shareToken: string;
  status: "active" | "expired" | "revoked";
  url: string;
};

const SHARE_SECTIONS = [
  ["snapshot", "Snapshot"],
  ["biological_age", "Biological age"],
  ["labs", "Labs"],
  ["protocols", "Protocols"],
  ["outcomes", "Outcomes"],
  ["wearables", "Wearables"],
  ["clinical_insights", "Clinical insights"],
] as const;

export default function PhysicianExportPage() {
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [locked, setLocked] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [creatingShare, setCreatingShare] = useState(false);
  const [recipientLabel, setRecipientLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [includedSections, setIncludedSections] = useState<string[]>(
    SHARE_SECTIONS.map(([key]) => key)
  );

  useEffect(() => {
    let cancelled = false;

    async function loadExport() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setSignedOut(true);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/digital-twin/export", {
          credentials: "include",
        });
        const data = await response.json();

        if (response.status === 403) {
          if (!cancelled) {
            setLocked(true);
            setMessage(data.upgrade?.message || data.error || null);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Could not load export.");
        }

        if (!cancelled) setBundle(data);

        const shareResponse = await fetch("/api/physician-share-links", {
          credentials: "include",
        });
        const shareData = await shareResponse.json();
        if (shareResponse.ok && !cancelled) {
          setShareLinks(shareData.links || []);
          if (shareData.migrationRequired) {
            setShareMessage(shareData.message || null);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load export.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadExport();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createShareLink() {
    setCreatingShare(true);
    setShareMessage(null);

    try {
      const response = await fetch("/api/physician-share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expiresInDays,
          includedSections,
          recipientLabel,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create share link.");
      }

      setShareLinks((current) => [data.link, ...current]);
      setRecipientLabel("");
      setShareMessage(
        data.link?.accessCode
          ? `Secure share link created. Access code: ${data.link.accessCode}`
          : "Secure share link created."
      );
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Could not create share link.");
    } finally {
      setCreatingShare(false);
    }
  }

  async function revokeShareLink(id: string) {
    setShareMessage(null);

    try {
      const response = await fetch("/api/physician-share-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not revoke share link.");
      }

      setShareLinks((current) =>
        current.map((link) => (link.id === id ? data.link : link))
      );
      setShareMessage("Share link revoked.");
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Could not revoke share link.");
    }
  }

  async function copyShareMessage(link: ShareLink) {
    const absoluteUrl = `${window.location.origin}${link.url}`;
    await navigator.clipboard.writeText(buildClinicalShareMessage(link, absoluteUrl));
    setShareMessage(
      link.accessCode
        ? "Ready to send. The link and access code were copied as one message."
        : link.requiresAccessCode
          ? "Secure link copied. Use the access code shown when this link was created."
          : "Secure share link copied."
    );
  }

  async function copyShareUrl(link: ShareLink) {
    await navigator.clipboard.writeText(`${window.location.origin}${link.url}`);
    setShareMessage("Secure link copied.");
  }

  async function copyShareCode(link: ShareLink) {
    if (!link.accessCode) return;
    await navigator.clipboard.writeText(link.accessCode);
    setShareMessage("Access code copied.");
  }

  function toggleSection(section: string) {
    setIncludedSections((current) => {
      if (current.includes(section)) {
        const next = current.filter((item) => item !== section);
        return next.length ? next : current;
      }
      return [...current, section];
    });
  }

  return (
    <PageContainer>
      <div className="py-14 print:bg-white print:py-0">
        <div className="mb-8 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/digital-twin"
            className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Digital Twin
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/network"
              className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
            >
              <UsersRound size={16} /> Care Network
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
            >
              <Printer size={16} /> Print / Save PDF
            </button>
          </div>
        </div>

        {loading ? (
          <AccessState
            eyebrow="Physician Export"
            title="Preparing your longitudinal summary."
            body="Aeonvera is assembling the records your clinician can review: biomarkers, reports, protocols, outcomes, and model history."
            actions={[{ href: "/digital-twin", label: "Digital Twin", variant: "secondary" }]}
          />
        ) : signedOut ? (
          <AccessState
            eyebrow="Physician Export"
            title="Sign in to generate your private export."
            body="Medical-grade summaries contain sensitive health data and are only available inside your secure account."
            actions={[
              { href: "/login?mode=signin", label: "Sign in" },
              { href: "/pricing", label: "Compare tiers", variant: "secondary" },
            ]}
          />
        ) : locked ? (
          <AccessState
            eyebrow="Sovereign Intelligence"
            title="Unlock physician-ready exports."
            body={
              message ||
              "Sovereign includes a clinician-facing summary across biological age, biomarkers, protocols, outcomes, and longitudinal health signals."
            }
            points={[
              "Printable clinical summary",
              "Biomarker and intervention history",
              "Digital Twin context for care teams",
            ]}
            actions={[
              { href: "/pricing", label: "Unlock Sovereign" },
              { href: "/plan", label: "Your Plan", variant: "secondary" },
            ]}
          />
        ) : message ? (
          <div className="executive-panel rounded-lg p-8">
            <p className="micro-label">Unavailable</p>
            <p className="mt-4 text-sm leading-7 text-white/50">{message}</p>
          </div>
        ) : bundle ? (
          <>
            <ShareLinkManager
              creatingShare={creatingShare}
              expiresInDays={expiresInDays}
              includedSections={includedSections}
              links={shareLinks}
              message={shareMessage}
              recipientLabel={recipientLabel}
              onCopyCode={copyShareCode}
              onCopyLink={copyShareUrl}
              onCopyMessage={copyShareMessage}
              onCreate={() => void createShareLink()}
              onExpiresChange={setExpiresInDays}
              onRecipientChange={setRecipientLabel}
              onRevoke={(id) => void revokeShareLink(id)}
              onToggleSection={toggleSection}
            />
            <ExportDocument bundle={bundle} />
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}

function ShareLinkManager({
  creatingShare,
  expiresInDays,
  includedSections,
  links,
  message,
  recipientLabel,
  onCopyCode,
  onCopyLink,
  onCopyMessage,
  onCreate,
  onExpiresChange,
  onRecipientChange,
  onRevoke,
  onToggleSection,
}: {
  creatingShare: boolean;
  expiresInDays: number;
  includedSections: string[];
  links: ShareLink[];
  message: string | null;
  recipientLabel: string;
  onCopyCode: (link: ShareLink) => Promise<void>;
  onCopyLink: (link: ShareLink) => Promise<void>;
  onCopyMessage: (link: ShareLink) => Promise<void>;
  onCreate: () => void;
  onExpiresChange: (value: number) => void;
  onRecipientChange: (value: string) => void;
  onRevoke: (id: string) => void;
  onToggleSection: (section: string) => void;
}) {
  return (
    <div className="mb-8 rounded-lg border border-[rgba(var(--gold),0.18)] bg-[rgba(var(--gold),0.045)] p-6 print:hidden">
      <div className="mb-5 flex flex-col gap-3 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="micro-label">Secure Clinical Sharing</p>
          <h2 className="mt-3 text-3xl font-light text-white">
            Share a controlled read-only export.
          </h2>
        </div>
        <ShieldCheck className="royal-text" size={24} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <input
            value={recipientLabel}
            onChange={(event) => onRecipientChange(event.target.value)}
            className="h-11 w-full rounded-md border border-white/[0.08] bg-black/20 px-3 text-sm text-white/70 outline-none placeholder:text-white/24"
            aria-label="Recipient label"
            placeholder="Recipient label, e.g. Dr. Smith or Coach"
          />
          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-[0.14em] text-white/28">
              Link expires
            </label>
            <select
              value={expiresInDays}
              onChange={(event) => onExpiresChange(Number(event.target.value))}
              className="h-11 w-full rounded-md border border-white/[0.08] bg-black/20 px-3 text-sm text-white/70 outline-none"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <button
            type="button"
            onClick={onCreate}
            disabled={creatingShare}
            className="premium-action inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Link2 size={16} /> {creatingShare ? "Creating link" : "Create secure link"}
          </button>
          {message && <p className="text-sm leading-6 text-white/48">{message}</p>}
        </div>

        <div>
          <p className="mb-3 text-[10px] uppercase tracking-[0.14em] text-white/28">
            Included sections
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SHARE_SECTIONS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onToggleSection(key)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                  includedSections.includes(key)
                    ? "border-[rgba(var(--gold),0.28)] bg-[rgba(var(--gold),0.08)] royal-text"
                    : "border-white/[0.07] bg-black/20 text-white/38 hover:text-white/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {links.map((link) => (
          <div
            key={link.id}
            className="rounded-lg border border-white/[0.06] bg-black/20 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-white/72">
                  {link.recipientLabel || "Secure export link"}
                </p>
                <p className="mt-1 text-xs text-white/36">
                  {link.status} / expires {formatDate(link.expiresAt)} / opened {link.accessCount} time{link.accessCount === 1 ? "" : "s"}
                </p>
                <ShareAccessHint link={link} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onCopyMessage(link)}
                  disabled={link.status !== "active"}
                  className="premium-action inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Copy size={14} /> {link.accessCode ? "Copy message" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => void onCopyLink(link)}
                  disabled={link.status !== "active"}
                  className="premium-action-secondary inline-flex h-9 items-center justify-center rounded-md px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Link
                </button>
                {link.accessCode ? (
                  <button
                    type="button"
                    onClick={() => void onCopyCode(link)}
                    disabled={link.status !== "active"}
                    className="premium-action-secondary inline-flex h-9 items-center justify-center rounded-md px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Code
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onRevoke(link.id)}
                  disabled={link.status === "revoked"}
                  className="premium-action-secondary inline-flex h-9 items-center justify-center rounded-md px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Revoke
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShareAccessHint({ link }: { link: ShareLink }) {
  if (link.accessCode) {
    return (
      <div className="mt-2 space-y-2">
        <p className="inline-flex rounded-md border border-[rgba(var(--gold),0.2)] bg-[rgba(var(--gold),0.06)] px-2 py-1 text-xs text-[rgba(var(--gold),0.8)]">
          Access code: {link.accessCode}
        </p>
        <p className="text-xs leading-5 text-white/34">
          Send the message to your clinician.
        </p>
      </div>
    );
  }

  if (link.requiresAccessCode) {
    return (
      <p className="mt-2 text-xs text-white/34">
        Protected by an access code shown when this link was created.
      </p>
    );
  }

  return null;
}

function buildClinicalShareMessage(link: ShareLink, absoluteUrl: string) {
  if (!link.accessCode) return absoluteUrl;
  const recipient = link.recipientLabel ? ` for ${link.recipientLabel}` : "";
  return [
    `Aeonvera secure clinical export${recipient}`,
    absoluteUrl,
    `Access code: ${link.accessCode}`,
    `Expires: ${formatDate(link.expiresAt)}`,
  ].join("\n");
}

function ExportDocument({ bundle }: { bundle: ExportBundle }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-7 print:border-0 print:bg-white print:p-0 print:text-black">
      <div className="mb-8 border-b border-white/[0.08] pb-6 print:border-black/15">
        <p className="micro-label print:text-black/50">Aeonvera Physician Export</p>
        <h1 className="mt-4 text-4xl font-light text-white print:text-black">
          Longitudinal healthspan summary
        </h1>
        <div className="mt-5 grid gap-3 text-sm text-white/55 print:text-black/70 sm:grid-cols-3">
          <p>Patient: {bundle.patient.profile?.display_name || bundle.patient.email || "Aeonvera user"}</p>
          <p>Generated: {formatDate(bundle.generatedAt)}</p>
          <p>Plan: {bundle.patient.profile?.plan || "Not specified"}</p>
        </div>
      </div>

      <ClinicalPacketSummary packet={bundle.clinicalPacket} />

      <ExportSection title="Current Snapshot">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Biological age" value={bundle.patient.profile?.biological_age ?? "--"} />
          <Metric label="Risk score" value={bundle.latestReport?.risk_score ?? "--"} />
          <Metric label="Primary goal" value={bundle.latestReport?.primary_goal || "--"} />
        </div>
        {bundle.healthState?.insights?.length ? (
          <p className="mt-4 text-sm leading-7 text-white/55 print:text-black/70">
            {bundle.healthState.insights[0]}
          </p>
        ) : null}
      </ExportSection>

      <ExportSection title="Biological Age History">
        <DataTable
          rows={bundle.biologicalAgeHistory.slice(0, 8)}
          columns={["created_at", "biological_age", "chronological_age", "age_delta", "score", "category"]}
        />
      </ExportSection>

      <ExportSection title="Clinical Biomarkers">
        <DataTable
          rows={bundle.labs.slice(0, 12)}
          columns={["measured_at", "canonical_key", "value", "unit", "reference_range"]}
        />
      </ExportSection>

      <ExportSection title="Optimization Protocols">
        <div className="space-y-3">
          {bundle.protocols.slice(0, 4).map((protocol, index) => (
            <div key={`${protocol.created_at}-${index}`} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4 print:border-black/10 print:bg-white">
              <p className="text-sm font-medium text-white/80 print:text-black">
                {protocol.focus_domains?.slice(0, 3).join(" / ") || `Protocol ${index + 1}`}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/45 print:text-black/65">
                {protocol.summary || "Protocol saved."}
              </p>
            </div>
          ))}
        </div>
      </ExportSection>

      <ExportSection title="Intervention Outcomes">
        <DataTable
          rows={bundle.outcomes.slice(0, 10)}
          columns={["created_at", "domain", "action", "outcome", "success", "confidence", "notes"]}
        />
      </ExportSection>

      <ExportSection title="Wearable Signals">
        <DataTable
          rows={(bundle.wearableMetrics || []).slice(0, 10)}
          columns={["recorded_at", "provider", "metric_name", "metric_value"]}
        />
      </ExportSection>

      <ExportSection title="Clinical Intelligence">
        <DataTable
          rows={(bundle.clinicalInsights || []).slice(0, 8)}
          columns={["created_at", "domains", "concern_status", "confidence", "answer_summary"]}
        />
      </ExportSection>

      <p className="mt-8 text-xs leading-5 text-white/35 print:text-black/45">
        This export is an informational longitudinal health summary, not a diagnosis or emergency medical record.
      </p>
    </div>
  );
}

function ExportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 break-inside-avoid">
      <h2 className="mb-4 text-xl font-light text-white print:text-black">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-4 print:border-black/10 print:bg-white">
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/25 print:text-black/45">
        {label}
      </p>
      <p className="mt-2 text-xl font-light text-white print:text-black">{String(value)}</p>
    </div>
  );
}

function DataTable({
  rows,
  columns,
}: {
  rows: Array<Record<string, unknown>>;
  columns: string[];
}) {
  if (!rows.length) {
    return <p className="text-sm text-white/45 print:text-black/60">No records yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs text-white/55 print:text-black/70">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-white/[0.08] px-2 py-2 font-medium print:border-black/15">
                {columnLabel(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column} className="border-b border-white/[0.05] px-2 py-2 align-top print:border-black/10">
                  {formatCell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COLUMN_LABELS: Record<string, string> = {
  created_at: "Date",
  biological_age: "Biological age",
  chronological_age: "Chronological age",
  age_delta: "Age delta",
  canonical_key: "Marker",
  reference_range: "Reference range",
  metric_name: "Metric",
  metric_value: "Value",
  concern_status: "Status",
  answer_summary: "Summary",
};

function columnLabel(column: string) {
  if (COLUMN_LABELS[column]) return COLUMN_LABELS[column];
  return column
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCell(value: unknown) {
  if (value == null || value === "") return "--";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    return value.includes("T") ? formatDate(value) : value;
  }
  return "—";
}

function formatDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
