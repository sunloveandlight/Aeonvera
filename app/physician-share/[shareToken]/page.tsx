"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState from "@/components/ui/AccessState";
import ClinicalPacketSummary from "@/components/physician/ClinicalPacketSummary";

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
  includedSections?: string[];
  patient: {
    email?: string | null;
    profile?: {
      display_name?: string | null;
      plan?: string | null;
      biological_age?: number | null;
    } | null;
  };
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

type ShareMeta = {
  expiresAt?: string;
  recipientLabel?: string | null;
};

export default function SharedPhysicianExportPage() {
  const params = useParams<{ shareToken: string }>();
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [share, setShare] = useState<ShareMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [codeRequired, setCodeRequired] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadShare(code = "") {
      setLoading(true);
      setMessage(null);

      try {
        const query = code ? `?code=${encodeURIComponent(code)}` : "";
        const response = await fetch(`/api/physician-share/${params.shareToken}${query}`);
        const data = await response.json();

        if (!response.ok) {
          if (data.codeRequired) {
            setCodeRequired(true);
          }
          throw new Error(data.error || "Could not load this shared export.");
        }

        if (!cancelled) {
          setCodeRequired(false);
          setBundle(data.bundle);
          setShare(data.share || null);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "Could not load this shared export."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (params.shareToken) void loadShare();

    return () => {
      cancelled = true;
    };
  }, [params.shareToken]);

  function submitAccessCode() {
    if (!accessCode.trim()) return;
    void loadShareWithCode({
      code: accessCode,
      setBundle,
      setCodeRequired,
      setLoading,
      setMessage,
      setShare,
      shareToken: params.shareToken,
    });
  }

  return (
    <PageContainer>
      <div className="py-14 print:bg-white print:py-0">
        <div className="mb-8 flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>

        {loading ? (
          <AccessState
            eyebrow="Secure Export"
            title="Opening the clinical summary."
            body="Aeonvera is preparing the shared read-only healthspan export."
            actions={[{ href: "/", label: "Aeonvera", variant: "secondary" }]}
          />
        ) : codeRequired ? (
          <AccessCodePanel
            body={message || "This export requires the access code shared by the Aeonvera member."}
            code={accessCode}
            eyebrow="Secure Export"
            title="Enter the access code."
            onChange={setAccessCode}
            onSubmit={submitAccessCode}
          />
        ) : message ? (
          <AccessState
            eyebrow="Share Unavailable"
            title="This secure export cannot be opened."
            body={message}
            actions={[{ href: "/", label: "Aeonvera", variant: "secondary" }]}
          />
        ) : bundle ? (
          <SharedExportDocument bundle={bundle} share={share} />
        ) : null}
      </div>
    </PageContainer>
  );
}

async function loadShareWithCode({
  code,
  setBundle,
  setCodeRequired,
  setLoading,
  setMessage,
  setShare,
  shareToken,
}: {
  code: string;
  setBundle: (bundle: ExportBundle | null) => void;
  setCodeRequired: (required: boolean) => void;
  setLoading: (loading: boolean) => void;
  setMessage: (message: string | null) => void;
  setShare: (share: ShareMeta | null) => void;
  shareToken: string;
}) {
  setLoading(true);
  setMessage(null);

  try {
    const response = await fetch(
      `/api/physician-share/${shareToken}?code=${encodeURIComponent(code)}`
    );
    const data = await response.json();

    if (!response.ok) {
      if (data.codeRequired) setCodeRequired(true);
      throw new Error(data.error || "Could not load this shared export.");
    }

    setCodeRequired(false);
    setBundle(data.bundle);
    setShare(data.share || null);
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Could not load this shared export."
    );
  } finally {
    setLoading(false);
  }
}

function AccessCodePanel({
  body,
  code,
  eyebrow,
  onChange,
  onSubmit,
  title,
}: {
  body: string;
  code: string;
  eyebrow: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-white/[0.08] bg-white/[0.03] p-8">
      <p className="micro-label">{eyebrow}</p>
      <h1 className="mt-4 text-4xl font-light text-white">{title}</h1>
      <p className="mt-4 text-sm leading-7 text-white/50">{body}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
          }}
          className="h-11 flex-1 rounded-md border border-white/[0.08] bg-black/20 px-3 text-sm uppercase tracking-[0.08em] text-white/70 outline-none placeholder:text-white/24"
          placeholder="Access code"
        />
        <button
          type="button"
          onClick={onSubmit}
          className="premium-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
        >
          Open export
        </button>
      </div>
    </div>
  );
}

function SharedExportDocument({
  bundle,
  share,
}: {
  bundle: ExportBundle;
  share: ShareMeta | null;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-7 print:border-0 print:bg-white print:p-0 print:text-black">
      <div className="mb-8 border-b border-white/[0.08] pb-6 print:border-black/15">
        <p className="micro-label print:text-black/50">Aeonvera Secure Clinical Share</p>
        <h1 className="mt-4 text-4xl font-light text-white print:text-black">
          Read-only healthspan summary
        </h1>
        <div className="mt-5 grid gap-3 text-sm text-white/55 print:text-black/70 sm:grid-cols-3">
          <p>Patient: {bundle.patient.profile?.display_name || "Aeonvera user"}</p>
          <p>Generated: {formatDate(bundle.generatedAt)}</p>
          <p>Expires: {formatDate(share?.expiresAt)}</p>
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

      {bundle.biologicalAgeHistory.length ? (
        <ExportSection title="Biological Age History">
          <DataTable
            rows={bundle.biologicalAgeHistory.slice(0, 8)}
            columns={["created_at", "biological_age", "chronological_age", "age_delta", "score", "category"]}
          />
        </ExportSection>
      ) : null}

      {bundle.labs.length ? (
        <ExportSection title="Clinical Biomarkers">
          <DataTable
            rows={bundle.labs.slice(0, 12)}
            columns={["measured_at", "canonical_key", "value", "unit", "reference_range"]}
          />
        </ExportSection>
      ) : null}

      {bundle.protocols.length ? (
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
      ) : null}

      {bundle.outcomes.length ? (
        <ExportSection title="Intervention Outcomes">
          <DataTable
            rows={bundle.outcomes.slice(0, 10)}
            columns={["created_at", "domain", "action", "outcome", "success", "confidence", "notes"]}
          />
        </ExportSection>
      ) : null}

      {bundle.wearableMetrics?.length ? (
        <ExportSection title="Wearable Signals">
          <DataTable
            rows={bundle.wearableMetrics.slice(0, 10)}
            columns={["recorded_at", "provider", "metric_name", "metric_value"]}
          />
        </ExportSection>
      ) : null}

      {bundle.clinicalInsights?.length ? (
        <ExportSection title="Clinical Intelligence">
          <DataTable
            rows={bundle.clinicalInsights.slice(0, 8)}
            columns={["created_at", "domains", "concern_status", "confidence", "answer_summary"]}
          />
        </ExportSection>
      ) : null}

      <p className="mt-8 text-xs leading-5 text-white/35 print:text-black/45">
        This secure export is an informational longitudinal health summary, not a diagnosis or emergency medical record.
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
    return <p className="text-sm text-white/45 print:text-black/60">No records included.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs text-white/55 print:text-black/70">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-white/[0.08] px-2 py-2 font-medium print:border-black/15">
                {column.replace(/_/g, " ")}
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

function formatCell(value: unknown) {
  if (value == null || value === "") return "--";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.join(" / ");
  if (typeof value === "string") {
    return value.includes("T") ? formatDate(value) : value;
  }
  return JSON.stringify(value);
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
