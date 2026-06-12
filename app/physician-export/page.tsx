"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState from "@/components/ui/AccessState";
import { supabase } from "@/lib/supabase/client";

type ExportBundle = {
  generatedAt: string;
  patient: {
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
  healthState?: {
    insights?: string[];
    risk_scores?: Record<string, number>;
    updated_at?: string;
  } | null;
};

export default function PhysicianExportPage() {
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [locked, setLocked] = useState(false);

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

            <p className="mt-8 text-xs leading-5 text-white/35 print:text-black/45">
              This export is an informational longitudinal health summary, not a diagnosis or emergency medical record.
            </p>
          </div>
        ) : null}
      </div>
    </PageContainer>
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
