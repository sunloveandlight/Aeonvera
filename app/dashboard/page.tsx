"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";

import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Profile = {
  display_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  biological_age: number | null;
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
  const [assessmentAge, setAssessmentAge] = useState<number | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

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
            "display_name, plan, subscription_status, biological_age"
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

        const [reportRes, assessmentRes] = await Promise.all([
          supabase
            .from("longevity_reports")
            .select("id, risk_score, primary_goal, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("longevity_assessments")
            .select("id, age")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (reportRes.data) setReport(reportRes.data);
        if (assessmentRes.data) {
          setHasAssessment(true);
          setAssessmentAge(Number(assessmentRes.data.age) || null);

          /**
           * AUTO-COMPUTE biological age if missing
           */
          if (!profileData.biological_age) {
            fetch("/api/longevity/biological-age", {
              method: "POST",
              credentials: "include",
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.result?.biologicalAge) {
                  setProfile((prev) =>
                    prev
                      ? {
                          ...prev,
                          biological_age: d.result.biologicalAge,
                        }
                      : prev
                  );
                }
              })
              .catch(console.error);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("System failure. Please retry.");
        setLoading(false);
      }
    };

    run();
  }, [router]);

  async function handleGenerateReport() {
    try {
      setGeneratingReport(true);

      await fetch("/api/longevity/biological-age", {
        method: "POST",
        credentials: "include",
      });

      const res = await fetch("/api/longevity/report", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        router.push("/report");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReport(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-0 rounded-full border-t border-[rgba(212,175,55,0.5)] animate-spin" />
          </div>
          <p className="text-white/20 text-xs tracking-[0.4em] uppercase">
            Initializing
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-red-400 text-sm">
        {error}
      </div>
    );
  }

  const bioAge = profile?.biological_age ?? null;
  const ageDelta =
    bioAge && assessmentAge ? bioAge - assessmentAge : null;

  const bioAgeColor =
    ageDelta === null
      ? "text-white/70"
      : ageDelta <= -3
      ? "text-green-400"
      : ageDelta <= 0
      ? "text-emerald-400"
      : ageDelta <= 4
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <PageContainer>

      {/* ================= HEADER ================= */}
      <div className="py-14 border-b border-white/5 mb-10">
        <p className="text-[10px] tracking-[0.5em] uppercase text-white/20">
          AEONVERA COMMAND CENTER
        </p>

        <h1 className="text-5xl md:text-6xl font-light tracking-[-0.05em] mt-4 text-white/90">
          {profile?.display_name
            ? `Welcome back, ${profile.display_name}.`
            : "Intelligence Overview"}
        </h1>

        <p className="mt-4 text-white/30 max-w-2xl leading-relaxed">
          Your biological operating system. Continuously learning. Always
          optimizing.
        </p>
      </div>

      {/* ================= HERO ROW ================= */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">

        {/* BIOLOGICAL AGE */}
        <Card title="BIOLOGICAL AGE" glow>
          {bioAge ? (
            <div>
              <p className={`text-6xl font-light tracking-[-0.05em] mt-1 ${bioAgeColor}`}>
                {bioAge}
                <span className="text-white/20 text-2xl ml-2">yrs</span>
              </p>

              {ageDelta !== null && (
                <p className={`mt-2 text-sm ${bioAgeColor}`}>
                  {ageDelta < 0
                    ? `${Math.abs(ageDelta)} years younger than chronological age`
                    : ageDelta > 0
                    ? `${ageDelta} years older than chronological age`
                    : "Matches chronological age"}
                </p>
              )}

              <button
                onClick={() => router.push("/report")}
                className="mt-4 text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-white/50 transition-colors duration-300"
              >
                View full analysis →
              </button>
            </div>
          ) : hasAssessment ? (
            <div>
              <p className="text-white/30 text-sm mb-4">
                Computing your biological age...
              </p>
              <div className="w-6 h-6 rounded-full border-t border-[rgba(212,175,55,0.5)] animate-spin" />
            </div>
          ) : (
            <div>
              <p className="text-white/25 text-sm mb-4">
                Complete your assessment to compute your biological age.
              </p>
              <Button href="/assessment">Start Assessment</Button>
            </div>
          )}
        </Card>

        {/* RISK SCORE */}
        <Card title="SYSTEM RISK INDEX">
          {report ? (
            <div>
              <p
                className={`text-6xl font-light tracking-[-0.05em] mt-1 ${
                  report.risk_score <= 35
                    ? "text-green-400"
                    : report.risk_score <= 65
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {report.risk_score}
                <span className="text-white/20 text-2xl ml-2">/ 100</span>
              </p>

              <div className="mt-3 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    report.risk_score <= 35
                      ? "bg-green-400"
                      : report.risk_score <= 65
                      ? "bg-yellow-400"
                      : "bg-red-400"
                  }`}
                  style={{ width: `${report.risk_score}%` }}
                />
              </div>

              <button
                onClick={() => router.push("/report")}
                className="mt-4 text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-white/50 transition-colors duration-300"
              >
                Open intelligence report →
              </button>
            </div>
          ) : (
            <div>
              <p className="text-white/25 text-sm mb-4">
                {hasAssessment
                  ? "Generate your first intelligence report."
                  : "Complete assessment to unlock risk analysis."}
              </p>
              {hasAssessment ? (
                <button
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="px-5 py-2 rounded-full border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.7)] hover:border-[rgba(212,175,55,0.6)] hover:text-[rgba(212,175,55,1)] transition-all duration-300 text-[10px] uppercase tracking-[0.3em] disabled:opacity-30"
                >
                  {generatingReport ? "Generating..." : "Generate Report"}
                </button>
              ) : (
                <Button href="/assessment">Start Assessment</Button>
              )}
            </div>
          )}
        </Card>

      </div>

      {/* ================= STATUS ROW ================= */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">

        <Card title="IDENTITY">
          <p className="text-white/70 text-sm">
            {profile?.display_name || "User"}
          </p>
          <p className="text-white/25 text-xs uppercase tracking-[0.3em] mt-1">
            {profile?.plan || "core"} access
          </p>
        </Card>

        <Card title="SUBSCRIPTION">
          <p className="text-white/60 text-sm capitalize">
            {profile?.subscription_status || "active"}
          </p>
          <button
            onClick={() => router.push("/pricing")}
            className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-white/40 transition-colors duration-300"
          >
            Manage plan →
          </button>
        </Card>

        <Card title="ASSESSMENT">
          <p className="text-white/60 text-sm">
            {hasAssessment ? "Completed" : "Not initialized"}
          </p>
          <button
            onClick={() => router.push("/assessment")}
            className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/20 hover:text-white/40 transition-colors duration-300"
          >
            {hasAssessment ? "Retake →" : "Start →"}
          </button>
        </Card>

      </div>

      {/* ================= INTELLIGENCE ACTIONS ================= */}
      {hasAssessment && (
        <Card title="INTELLIGENCE ACTIONS" glow className="mb-8">
          <div className="flex flex-wrap gap-4">
            <Button href="/report">
              View Full Report
            </Button>
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="px-6 py-3 rounded-full border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all duration-300 text-[11px] uppercase tracking-[0.3em] disabled:opacity-30"
            >
              {generatingReport ? "Generating..." : "Regenerate Intelligence"}
            </button>
            <Button variant="secondary" href="/assessment">
              Retake Assessment
            </Button>
          </div>
        </Card>
      )}

    </PageContainer>
  );
}