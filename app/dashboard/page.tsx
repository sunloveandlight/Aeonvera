"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";

import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { BiologicalAgeResult } from "@/lib/longevity/biologicalAgeEngine";

type Profile = {
  display_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  biological_age: number | null;
  date_of_birth: string | null;
};

type Report = {
  id: string;
  risk_score: number;
  primary_goal: string;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [hasAssessment, setHasAssessment] = useState(false);

  const [bioAgeResult, setBioAgeResult] =
    useState<BiologicalAgeResult | null>(null);
  const [bioAgeLoading, setBioAgeLoading] = useState(false);
  const [bioAgeError, setBioAgeError] = useState<string | null>(null);

  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return router.replace("/login");

        const { data: profileData } = await supabase
          .from("profiles")
          .select(
            "display_name, plan, subscription_status, biological_age, date_of_birth"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profileData) return router.replace("/onboarding");

        if (
          !isUserAllowed(profileData.plan, profileData.subscription_status)
        ) {
          return router.replace("/pricing");
        }

        setProfile(profileData);

        const { data: existingReport } = await supabase
          .from("longevity_reports")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existingReport) setReport(existingReport);

        const { data: assessment } = await supabase
          .from("longevity_assessments")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        setHasAssessment(!!assessment);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("System failure. Please retry.");
        setLoading(false);
      }
    };

    run();
  }, [router]);

  /**
   * COMPUTE BIOLOGICAL AGE
   */
  async function handleComputeBioAge() {
    try {
      setBioAgeLoading(true);
      setBioAgeError(null);

      const res = await fetch("/api/longevity/biological-age", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setBioAgeError(data.error || "Failed to compute biological age.");
        return;
      }

      setBioAgeResult(data.result);

      // update profile biological age locally
      setProfile((prev) =>
        prev
          ? { ...prev, biological_age: data.result.biologicalAge }
          : prev
      );
    } catch (err) {
      setBioAgeError("Failed to compute biological age.");
    } finally {
      setBioAgeLoading(false);
    }
  }

  /**
   * GENERATE FULL REPORT
   */
  async function handleGenerateReport() {
    try {
      setReportGenerating(true);
      setReportError(null);

      const res = await fetch("/api/longevity/report", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setReportError(data.error || "Failed to generate report.");
        return;
      }

      setReport(data.report);
      router.push("/report");
    } catch (err) {
      setReportError("Failed to generate report.");
    } finally {
      setReportGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-white/40 text-xs tracking-[0.4em] uppercase">
        INITIALIZING COMMAND SYSTEM
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  /**
   * BIOLOGICAL AGE DISPLAY
   * Uses saved value from profile, or freshly computed result
   */
  const displayBioAge =
    bioAgeResult?.biologicalAge ?? profile?.biological_age ?? null;

  const chronologicalAge = bioAgeResult?.chronologicalAge ?? null;

  const ageDelta = bioAgeResult?.ageDelta ?? null;

  const bioAgeColor =
    ageDelta === null
      ? "text-white/80"
      : ageDelta <= -3
      ? "text-green-400"
      : ageDelta <= 0
      ? "text-emerald-400"
      : ageDelta <= 4
      ? "text-yellow-400"
      : "text-red-400";

  const categoryLabel = bioAgeResult?.category
    ? {
        excellent: "EXCELLENT",
        good: "GOOD",
        average: "AVERAGE",
        poor: "NEEDS ATTENTION",
      }[bioAgeResult.category]
    : null;

  return (
    <PageContainer>

      {/* ================= HEADER ================= */}
      <div className="py-14 border-b border-white/5 mb-10">
        <p className="text-[10px] tracking-[0.5em] uppercase text-white/25">
          AEONVERA COMMAND CENTER
        </p>

        <h1 className="text-5xl md:text-6xl font-light tracking-[-0.05em] mt-4 text-white/90">
          {profile?.display_name
            ? `Welcome, ${profile.display_name}`
            : "Intelligence Overview"}
        </h1>

        <p className="mt-4 text-white/40 max-w-2xl leading-relaxed">
          Your biological system state, reports, and active optimization
          pathways.
        </p>
      </div>

      {/* ================= BIOLOGICAL AGE HERO ================= */}
      <Card title="BIOLOGICAL AGE" glow className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">

          {/* LEFT — SCORE */}
          <div>
            {displayBioAge ? (
              <>
                <p className="text-white/30 text-sm mb-2">
                  Estimated Biological Age
                </p>

                <div className="flex items-end gap-6">
                  <p className={`text-7xl font-light tracking-[-0.05em] ${bioAgeColor}`}>
                    {displayBioAge}
                    <span className="text-white/25 text-3xl ml-1">yrs</span>
                  </p>

                  {chronologicalAge && (
                    <div className="mb-2">
                      <p className="text-white/25 text-xs uppercase tracking-[0.3em] mb-1">
                        Chronological
                      </p>
                      <p className="text-white/50 text-2xl font-light">
                        {chronologicalAge}
                        <span className="text-white/25 text-base ml-1">yrs</span>
                      </p>
                    </div>
                  )}
                </div>

                {ageDelta !== null && (
                  <p className={`mt-3 text-sm ${bioAgeColor}`}>
                    {ageDelta < 0
                      ? `${Math.abs(ageDelta)} years younger than your age`
                      : ageDelta > 0
                      ? `${ageDelta} years older than your age`
                      : "Biological age matches chronological age"}
                  </p>
                )}

                {categoryLabel && (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.4em] text-white/25">
                    {categoryLabel}
                  </p>
                )}

                {/* FACTOR BREAKDOWN */}
                {bioAgeResult?.factors && (
                  <div className="mt-6 space-y-2">
                    {bioAgeResult.factors.slice(0, 4).map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-white/40">{f.domain}</span>
                        <span
                          className={
                            f.status === "positive"
                              ? "text-green-400"
                              : f.status === "negative"
                              ? "text-red-400"
                              : "text-white/30"
                          }
                        >
                          {f.impact > 0 ? "+" : ""}
                          {f.impact} yrs
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div>
                <p className="text-white/30 text-sm mb-2">
                  Biological Age
                </p>
                <p className="text-white/20 text-lg font-light">
                  Not yet computed
                </p>
                <p className="text-white/20 text-xs mt-2">
                  Complete your assessment and compute your biological age.
                </p>
              </div>
            )}
          </div>

          {/* RIGHT — ACTIONS */}
          <div className="flex flex-col gap-3 shrink-0">
            {hasAssessment ? (
              <button
                onClick={handleComputeBioAge}
                disabled={bioAgeLoading}
                className="px-6 py-3 rounded-full border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.6)] hover:text-[rgba(212,175,55,1)] transition-all duration-300 text-[11px] uppercase tracking-[0.3em] disabled:opacity-30 whitespace-nowrap"
              >
                {bioAgeLoading
                  ? "Computing..."
                  : displayBioAge
                  ? "Recompute"
                  : "Compute Biological Age"}
              </button>
            ) : (
              <Button href="/assessment">
                Start Assessment
              </Button>
            )}

            {bioAgeError && (
              <p className="text-red-400 text-xs">{bioAgeError}</p>
            )}
          </div>

        </div>

        {/* SUMMARY */}
        {bioAgeResult?.summary && (
          <div className="mt-8 pt-6 border-t border-white/5">
            <p className="text-white/40 text-sm leading-relaxed">
              {bioAgeResult.summary}
            </p>
          </div>
        )}
      </Card>

      {/* ================= SYSTEM STATUS ================= */}
      <div className="grid md:grid-cols-3 gap-6 mb-10">

        <Card title="SYSTEM STATUS">
          <div className="space-y-2">
            <p className="text-white/70 text-sm">
              {profile?.display_name || "User"}
            </p>
            <p className="text-white/30 text-xs uppercase tracking-[0.3em]">
              {profile?.plan || "CORE ACCESS"}
            </p>
          </div>
        </Card>

        <Card title="SUBSCRIPTION">
          <p className="text-white/60 text-sm capitalize">
            {profile?.subscription_status || "active"}
          </p>
        </Card>

        <Card title="ASSESSMENT STATE">
          <p className="text-white/60 text-sm">
            {hasAssessment ? "COMPLETED" : "NOT INITIALIZED"}
          </p>
        </Card>

      </div>

      {/* ================= INTELLIGENCE REPORT ================= */}
      <Card title="LONGEVITY INTELLIGENCE REPORT" glow className="mb-10">
        {report ? (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/40 text-sm mb-2">
                Risk Model Score
              </p>
              <p className="text-5xl font-light text-white/80 tracking-[-0.04em]">
                {report.risk_score}
                <span className="text-white/30 text-2xl"> / 100</span>
              </p>
              <p className="text-white/25 text-xs mt-2 uppercase tracking-[0.3em]">
                {report.primary_goal}
              </p>
            </div>

            <div className="flex flex-col gap-3 items-end">
              <Button href="/report">Open Report</Button>
              <button
                onClick={handleGenerateReport}
                disabled={reportGenerating}
                className="text-[10px] uppercase tracking-[0.3em] text-white/25 hover:text-white/50 transition-colors duration-300 disabled:opacity-30"
              >
                {reportGenerating ? "Generating..." : "Regenerate"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 mb-1">
                No intelligence report generated yet.
              </p>
              <p className="text-white/20 text-xs">
                {hasAssessment
                  ? "Your assessment is ready. Generate your first report."
                  : "Complete your assessment to unlock report generation."}
              </p>
            </div>

            {hasAssessment ? (
              <button
                onClick={handleGenerateReport}
                disabled={reportGenerating}
                className="px-6 py-3 rounded-full border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.6)] hover:text-[rgba(212,175,55,1)] transition-all duration-300 text-[11px] uppercase tracking-[0.3em] disabled:opacity-30 whitespace-nowrap"
              >
                {reportGenerating ? "Generating..." : "Generate Report"}
              </button>
            ) : (
              <Button href="/assessment">
                Start Assessment
              </Button>
            )}
          </div>
        )}

        {reportError && (
          <p className="text-red-400 text-xs mt-4">{reportError}</p>
        )}
      </Card>

      {/* ================= ACTION PANEL ================= */}
      <div className="grid md:grid-cols-3 gap-6">

        <Card title="ACTIONS">
          <div className="space-y-3">
            {!hasAssessment && (
              <Button href="/assessment">Start Assessment</Button>
            )}
            <Button variant="secondary" href="/report">
              View Report
            </Button>
          </div>
        </Card>

        <Card title="SYSTEM CONTROL">
          <Button variant="secondary" href="/pricing">
            Manage Plan
          </Button>
        </Card>

        <Card title="INTELLIGENCE STATE">
          <p className="text-white/40 text-sm">
            Continuously evolving biological model.
          </p>
        </Card>

      </div>

    </PageContainer>
  );
}