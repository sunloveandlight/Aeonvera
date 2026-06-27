"use client";

import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import ClinicalPacketSummary from "@/components/physician/ClinicalPacketSummary";

type ClinicalPacketRole = "physician" | "coach" | "family";

export type ClinicalShareBundle = {
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
  } | null;
};

export type ClinicalShareDocumentProps = {
  bundle: ClinicalShareBundle;
  expiresAt?: string;
  footer: string;
  role?: ClinicalPacketRole;
  title: string;
  eyebrow: string;
  showShield?: boolean;
};

export default function ClinicalShareDocument({
  bundle,
  expiresAt,
  eyebrow,
  footer,
  role,
  showShield = false,
  title,
}: ClinicalShareDocumentProps) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-7 print:border-0 print:bg-white print:p-0 print:text-black">
      <div className="mb-8 border-b border-white/[0.08] pb-6 print:border-black/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="micro-label print:text-black/50">{eyebrow}</p>
            <h1 className="mt-4 text-4xl font-light text-white print:text-black">
              {title}
            </h1>
          </div>
          {showShield ? <ShieldCheck className="royal-text print:text-black" size={24} /> : null}
        </div>
        <div className="mt-5 grid gap-3 text-sm text-white/55 print:text-black/70 sm:grid-cols-3">
          <p>Patient: {bundle.patient.profile?.display_name || "Aeonvera user"}</p>
          <p>Generated: {formatDate(bundle.generatedAt)}</p>
          <p>Expires: {formatDate(expiresAt)}</p>
        </div>
      </div>

      <ClinicalPacketSummary packet={bundle.clinicalPacket} role={role} />

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
        {footer}
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
      <p className="av-eyebrow text-white/25 print:text-black/45">{label}</p>
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
