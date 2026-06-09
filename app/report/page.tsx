"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { BiologicalAgeResult } from "@/lib/longevity/biologicalAgeEngine";

type ReportData = {
  risk_score: number;
  primary_goal: string;
  risk_profile: {
    sleep_risk: string;
    metabolic_risk: string;
    cardiovascular_risk: string;
    lifestyle_risk: string;
  };
  strengths: string[];
  weaknesses: string[];
  top_priorities: string[];
  "90_day_plan": Array<{
    category: string;
    action: string;
    impact: string;
  }>;
  behavioral_insights: string[];
};

type ProfileData = {
  display_name: string | null;
  biological_age: number | null;
  date_of_birth: string | null;
};

export default function ReportPage() {
  const router = useRouter();

  const [report, setReport] = useState<ReportData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [bioAge, setBioAge] = useState<number | null>(null);
  const [assessment, setAssessment] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        /**
         * FETCH ALL DATA IN PARALLEL
         */
        const [reportRes, profileRes, assessmentRes] = await Promise.all([
          supabase
            .from("longevity_reports")
            .select("report, created_at, risk_score, primary_goal")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),

          supabase
            .from("profiles")
            .select("display_name, biological_age, date_of_birth")
            .eq("user_id", user.id)
            .single(),

          supabase
            .from("longevity_assessments")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
        ]);

        if (reportRes.data) {
          setReport(reportRes.data.report as ReportData);
        }

        if (profileRes.data) {
          setProfile(profileRes.data);
          setBioAge(profileRes.data.biological_age);
        }

        if (assessmentRes.data) {
          setAssessment(assessmentRes.data);
        }

        if (!reportRes.data) {
          setError("No report found. Complete your assessment first.");
        }
      } catch {
        setError("Failed to load intelligence report.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  async function handleRegenerate() {
    try {
      setRegenerating(true);

      await fetch("/api/longevity/biological-age", {
        method: "POST",
        credentials: "include",
      });

      const res = await fetch("/api/longevity/report", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.report?.report) {
        setReport(data.report.report as ReportData);
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="relative mb-8">
          <div className="w-16 h-16 rounded-full border border-white/10" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-t border-[rgba(212,175,55,0.6)] animate-spin" />
        </div>
        <p className="text-white/30 text-xs tracking-[0.4em] uppercase">
          Loading Intelligence Report
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <PageContainer>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md">
            <p className="text-white/20 text-xs uppercase tracking-[0.4em] mb-6">
              No Report Found
            </p>
            <p className="text-white/50 mb-8">{error}</p>
            <Button href="/assessment">Start Assessment</Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const chronologicalAge = assessment?.age ? Number(assessment.age) : null;
  const ageDelta =
    bioAge && chronologicalAge ? bioAge - chronologicalAge : null;

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

  const riskColor =
    report.risk_score <= 35
      ? "text-green-400"
      : report.risk_score <= 65
      ? "text-yellow-400"
      : "text-red-400";

  const riskBarColor =
    report.risk_score <= 35
      ? "bg-green-400"
      : report.risk_score <= 65
      ? "bg-yellow-400"
      : "bg-red-400";

  return (
    <PageContainer>
      <div className="py-16 space-y-6">

        {/* ================= HEADER ================= */}
        <div className="pb-10 border-b border-white/5">
          <p className="text-[10px] tracking-[0.6em] text-white/20 uppercase mb-4">
            Aeonvera Intelligence Report
          </p>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-5xl md:text-6xl font-light tracking-[-0.05em] text-white/90">
                {profile?.display_name
                  ? `${profile.display_name}'s`
                  : "Your"}{" "}
                <span className="text-white/40">Biological Profile</span>
              </h1>
              <p className="mt-4 text-white/30 text-sm">
                Personalized longevity intelligence based on your biological data.
              </p>
            </div>

            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="shrink-0 mt-2 px-5 py-2 rounded-full border border-white/10 text-white/25 hover:text-white/50 hover:border-white/20 transition-all duration-300 text-[10px] uppercase tracking-[0.3em] disabled:opacity-20"
            >
              {regenerating ? "Regenerating..." : "Regenerate"}
            </button>
          </div>
        </div>

        {/* ================= HERO METRICS ================= */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* BIOLOGICAL AGE */}
          <Card title="BIOLOGICAL AGE" glow>
            <div className="pt-2">
              {bioAge ? (
                <>
                  <p className={`text-7xl font-light tracking-[-0.05em] ${bioAgeColor}`}>
                    {bioAge}
                    <span className="text-white/20 text-3xl ml-2">yrs</span>
                  </p>

                  {chronologicalAge && (
                    <p className={`mt-3 text-sm ${bioAgeColor}`}>
                      {ageDelta !== null && ageDelta < 0
                        ? `${Math.abs(ageDelta)} years younger than your chronological age of ${chronologicalAge}`
                        : ageDelta !== null && ageDelta > 0
                        ? `${ageDelta} years older than your chronological age of ${chronologicalAge}`
                        : `Biological age matches chronological age of ${chronologicalAge}`}
                    </p>
                  )}

                  <p className="mt-4 text-white/20 text-xs leading-relaxed">
                    Estimated from lifestyle biomarkers. Updates as your
                    habits improve.
                  </p>
                </>
              ) : (
                <p className="text-white/30">Not yet computed.</p>
              )}
            </div>
          </Card>

          {/* RISK SCORE */}
          <Card title="SYSTEM RISK INDEX">
            <div className="pt-2">
              <p className={`text-7xl font-light tracking-[-0.05em] ${riskColor}`}>
                {report.risk_score}
                <span className="text-white/20 text-3xl ml-2">/ 100</span>
              </p>

              <div className="mt-4 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${riskBarColor}`}
                  style={{ width: `${report.risk_score}%` }}
                />
              </div>

              <p className="mt-3 text-white/30 text-xs leading-relaxed">
                {report.risk_score <= 35
                  ? "Low biological risk. Your system is performing well."
                  : report.risk_score <= 65
                  ? "Moderate biological risk. Targeted improvements recommended."
                  : "Elevated biological risk. Immediate intervention advised."}
              </p>
            </div>
          </Card>

        </div>

        {/* ================= PRIMARY GOAL ================= */}
        <Card title="PRIMARY OBJECTIVE">
          <p className="text-2xl md:text-3xl font-light text-white/80 leading-relaxed">
            {report.primary_goal}
          </p>
        </Card>

        {/* ================= RISK PROFILE ================= */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.5em] text-white/20 mb-4">
            Risk Profile
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(report.risk_profile).map(([key, value]) => (
              <Card key={key}>
                <p className="text-[9px] uppercase tracking-[0.4em] text-white/25 mb-3">
                  {key.replace(/_/g, " ")}
                </p>
                <p
                  className={`text-lg font-light capitalize ${
                    value === "low"
                      ? "text-green-400"
                      : value === "medium"
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {value}
                </p>
              </Card>
            ))}
          </div>
        </div>

        {/* ================= STRENGTHS + WEAKNESSES ================= */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card title="BIOLOGICAL STRENGTHS">
            <div className="space-y-3">
              {report.strengths.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-green-500/[0.07] border border-green-500/10"
                >
                  <span className="text-green-400 mt-0.5 shrink-0">↑</span>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="OPTIMIZATION TARGETS">
            <div className="space-y-3">
              {report.weaknesses.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/[0.07] border border-orange-500/10"
                >
                  <span className="text-orange-400 mt-0.5 shrink-0">↓</span>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ================= TOP PRIORITIES ================= */}
        <Card title="TOP INTERVENTION PRIORITIES">
          <div className="space-y-3">
            {report.top_priorities.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]"
              >
                <span className="text-[rgba(212,175,55,0.5)] text-sm font-light shrink-0 mt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-white/65 text-sm leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ================= 90 DAY PLAN ================= */}
        <Card title="90-DAY OPTIMIZATION PROTOCOL">
          <div className="space-y-3">
            {report["90_day_plan"].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] gap-4"
              >
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[rgba(212,175,55,0.5)] mb-1">
                    {item.category}
                  </p>
                  <p className="text-white/65 text-sm leading-relaxed">
                    {item.action}
                  </p>
                </div>

                <span
                  className={`shrink-0 text-[10px] px-3 py-1 rounded-full border uppercase tracking-[0.2em] ${
                    item.impact === "high"
                      ? "border-green-500/20 text-green-400 bg-green-500/5"
                      : item.impact === "medium"
                      ? "border-yellow-500/20 text-yellow-400 bg-yellow-500/5"
                      : "border-white/10 text-white/30 bg-white/[0.02]"
                  }`}
                >
                  {item.impact}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ================= BEHAVIORAL INSIGHTS ================= */}
        <Card title="BEHAVIORAL INTELLIGENCE">
          <div className="space-y-4">
            {report.behavioral_insights.map((insight, i) => (
              <div
                key={i}
                className="flex items-start gap-4 border-l-2 border-[rgba(212,175,55,0.2)] pl-5 py-1"
              >
                <p className="text-white/55 text-sm leading-relaxed">
                  {insight}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* ================= FOOTER ACTIONS ================= */}
        <div className="flex items-center justify-between pt-6 border-t border-white/5">
          <p className="text-white/20 text-xs">
            Intelligence report generated by Aeonvera AI
          </p>
          <div className="flex gap-4">
            <Button variant="secondary" href="/dashboard">
              Dashboard
            </Button>
            <Button href="/assessment">
              Retake Assessment
            </Button>
          </div>
        </div>

      </div>
    </PageContainer>
  );
}