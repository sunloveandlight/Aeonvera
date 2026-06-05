// app/report/page.tsx
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
        const { data: { user } } = await supabase.auth.getUser();

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
      } catch (err) {
        setError("Failed to load report");
      } finally {
        setLoading(false);
      }
    };

    fetchLatestReport();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4" />
          <p>Decoding your longevity blueprint...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-6">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 bg-white text-black rounded-xl"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const riskColor = report.risk_score <= 35 ? "text-green-400" : 
                    report.risk_score <= 65 ? "text-yellow-400" : "text-red-400";

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-8 text-white/60 hover:text-white flex items-center gap-2"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-5xl font-light mb-2">Your Longevity Blueprint</h1>
        <p className="text-white/50 mb-10">AI-Generated Intelligence Report</p>

        {/* Risk Score */}
        <div className="bg-zinc-950 border border-white/10 rounded-3xl p-10 mb-10 text-center">
          <p className="text-sm text-white/50 mb-2">OVERALL RISK SCORE</p>
          <div className={`text-8xl font-light ${riskColor}`}>
            {report.risk_score}
          </div>
          <p className="text-xl mt-2">/ 100</p>
        </div>

        {/* Primary Goal */}
        <div className="mb-10">
          <h2 className="text-sm uppercase tracking-widest text-white/50 mb-3">PRIMARY GOAL</h2>
          <p className="text-3xl font-light">{report.primary_goal}</p>
        </div>

        {/* Risk Profile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {Object.entries(report.risk_profile).map(([key, value]) => (
            <div key={key} className="bg-zinc-950 border border-white/10 rounded-2xl p-6">
              <p className="text-white/50 text-sm capitalize mb-2">
                {key.replace("_", " ")}
              </p>
              <p className={`text-3xl font-medium capitalize ${
                value === "low" ? "text-green-400" : 
                value === "medium" ? "text-yellow-400" : "text-red-400"
              }`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div>
            <h3 className="text-lg mb-4 text-green-400">STRENGTHS</h3>
            <ul className="space-y-3">
              {report.strengths.map((item, i) => (
                <li key={i} className="bg-green-950/30 border border-green-500/20 rounded-xl p-4">
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg mb-4 text-orange-400">WEAKNESSES</h3>
            <ul className="space-y-3">
              {report.weaknesses.map((item, i) => (
                <li key={i} className="bg-orange-950/30 border border-orange-500/20 rounded-xl p-4">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Top Priorities */}
        <div className="mb-12">
          <h3 className="text-lg mb-6">TOP PRIORITIES</h3>
          <div className="space-y-4">
            {report.top_priorities.map((priority, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                {i + 1}. {priority}
              </div>
            ))}
          </div>
        </div>

        {/* 90 Day Plan */}
        <div className="mb-12">
          <h3 className="text-lg mb-6">90-DAY OPTIMIZATION PLAN</h3>
          <div className="space-y-6">
            {report["90_day_plan"].map((item, i) => (
              <div key={i} className="border border-white/10 bg-zinc-950 rounded-2xl p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{item.category}</p>
                    <p className="mt-2 text-white/80">{item.action}</p>
                  </div>
                  <span className={`px-4 py-1 rounded-full text-sm ${
                    item.impact === "high" ? "bg-green-500/20 text-green-400" : 
                    item.impact === "medium" ? "bg-yellow-500/20 text-yellow-400" : 
                    "bg-white/10 text-white/70"
                  }`}>
                    {item.impact} impact
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Behavioral Insights */}
        <div>
          <h3 className="text-lg mb-6">BEHAVIORAL INSIGHTS</h3>
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8 space-y-6">
            {report.behavioral_insights.map((insight, i) => (
              <p key={i} className="text-lg leading-relaxed border-l-4 border-white/30 pl-6">
                {insight}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center text-white/40 text-sm">
          Generated by Aeonvera • {new Date().toLocaleDateString()}
        </div>
      </div>
    </main>
  );
}