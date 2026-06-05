"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestReport = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("longevity_reports")
          .select("report, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          setError("No report found. Please generate one from the dashboard.");
          setLoading(false);
          return;
        }

        setReport(data.report);
      } catch {
        setError("Failed to load report");
      } finally {
        setLoading(false);
      }
    };

    fetchLatestReport();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05060a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-cyan-400 rounded-full mx-auto mb-4" />
          <p className="text-white/60">Decoding your longevity blueprint...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#05060a] text-white flex items-center justify-center px-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl text-center max-w-md">
          <p className="text-red-400 mb-6">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:opacity-90 transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const riskColor =
    report.risk_score <= 35
      ? "text-green-400"
      : report.risk_score <= 65
      ? "text-yellow-400"
      : "text-red-400";

  const glow =
    report.risk_score <= 35
      ? "bg-green-500/10"
      : report.risk_score <= 65
      ? "bg-yellow-500/10"
      : "bg-red-500/10";

  return (
    <main className="min-h-screen bg-[#05060a] text-white relative overflow-hidden">
      {/* background glow system (MATCH DASHBOARD STYLE) */}
      <div className="absolute inset-0">
        <div className={`absolute w-[700px] h-[700px] ${glow} blur-[140px] rounded-full top-[-250px] left-[-250px]`} />
        <div className="absolute w-[600px] h-[600px] bg-purple-500/10 blur-[140px] rounded-full bottom-[-250px] right-[-250px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-14">
        {/* HEADER */}
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            Biological Intelligence Report
          </h1>
          <p className="text-white/50 mt-2">
            AI-generated systemic longevity analysis
          </p>
        </div>

        {/* RISK SCORE CARD */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <p className="text-white/50 text-sm">OVERALL RISK SCORE</p>
              <p className={`text-6xl font-semibold mt-2 ${riskColor}`}>
                {report.risk_score}
              </p>
              <p className="text-white/40">/ 100</p>
            </div>

            <div className="w-full md:w-1/2">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    report.risk_score <= 35
                      ? "bg-gradient-to-r from-green-400 to-emerald-500"
                      : report.risk_score <= 65
                      ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                      : "bg-gradient-to-r from-red-400 to-red-600"
                  }`}
                  style={{ width: `${report.risk_score}%` }}
                />
              </div>
              <p className="text-white/40 text-xs mt-2">
                System-wide biological stress index
              </p>
            </div>
          </div>
        </div>

        {/* PRIMARY GOAL (MATCH DASHBOARD CARD STYLE) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl mb-10">
          <h2 className="text-white/50 text-sm mb-2">
            PRIMARY OBJECTIVE
          </h2>
          <p className="text-2xl md:text-3xl font-light">
            {report.primary_goal}
          </p>
        </div>

        {/* RISK PROFILE */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {Object.entries(report.risk_profile).map(([key, value]) => (
            <div
              key={key}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl"
            >
              <p className="text-white/40 text-sm capitalize mb-2">
                {key.replace("_", " ")}
              </p>
              <p
                className={`text-xl font-medium capitalize ${
                  value === "low"
                    ? "text-green-400"
                    : value === "medium"
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* STRENGTHS / WEAKNESSES (MATCH DASHBOARD CARD STYLE) */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
            <h3 className="text-green-400 mb-4">STRENGTHS</h3>
            <div className="space-y-3">
              {report.strengths.map((item, i) => (
                <div
                  key={i}
                  className="bg-green-500/10 border border-green-500/20 rounded-xl p-4"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
            <h3 className="text-orange-400 mb-4">WEAKNESSES</h3>
            <div className="space-y-3">
              {report.weaknesses.map((item, i) => (
                <div
                  key={i}
                  className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TOP PRIORITIES */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl mb-12">
          <h3 className="text-white/50 mb-6">TOP PRIORITIES</h3>
          <div className="space-y-4">
            {report.top_priorities.map((p, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-4"
              >
                {i + 1}. {p}
              </div>
            ))}
          </div>
        </div>

        {/* 90 DAY PLAN */}
        <div className="mb-12">
          <h3 className="text-white/50 mb-6">90-DAY PLAN</h3>

          <div className="space-y-6">
            {report["90_day_plan"].map((item, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl"
              >
                <div className="flex justify-between gap-6">
                  <div>
                    <p className="font-medium">{item.category}</p>
                    <p className="text-white/70 mt-2">{item.action}</p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs ${
                      item.impact === "high"
                        ? "bg-green-500/20 text-green-400"
                        : item.impact === "medium"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-white/10 text-white/60"
                    }`}
                  >
                    {item.impact}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* INSIGHTS */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <h3 className="text-white/50 mb-6">BEHAVIORAL INSIGHTS</h3>

          <div className="space-y-6">
            {report.behavioral_insights.map((insight, i) => (
              <p
                key={i}
                className="border-l-2 border-cyan-400/40 pl-4 text-white/80"
              >
                {insight}
              </p>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-16 text-center text-white/30 text-xs">
          Aeonvera Intelligence System • Generated in real-time
        </div>
      </div>
    </main>
  );
}