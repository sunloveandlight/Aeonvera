"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";

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
          setError("No report found. Generate one from dashboard.");
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
      <div className="min-h-[60vh] flex items-center justify-center text-white/40 text-sm tracking-[0.3em] uppercase">
        Decoding longevity system...
      </div>
    );
  }

  if (error || !report) {
    return (
      <PageContainer>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="max-w-md text-center">
            <p className="text-red-400 mb-6">{error}</p>

            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 rounded-xl bg-white text-black font-medium"
            >
              Return to Dashboard
            </button>
          </Card>
        </div>
      </PageContainer>
    );
  }

  const riskColor =
    report.risk_score <= 35
      ? "text-green-400"
      : report.risk_score <= 65
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <PageContainer>
      <div className="py-16 space-y-8">

        <div>
          <p className="text-xs tracking-[0.4em] text-white/40 uppercase mb-4">
            Biological Intelligence Report
          </p>

          <h1 className="text-5xl font-semibold tracking-tight">
            Longevity Analysis
          </h1>
        </div>

        <Card label="System Risk Index">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">

            <div>
              <p className="text-white/50 text-sm">Overall Biological Risk</p>
              <p className={`text-6xl font-semibold mt-2 ${riskColor}`}>
                {report.risk_score}
                <span className="text-white/40 text-2xl"> / 100</span>
              </p>
            </div>

            <div className="w-full md:w-1/2">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={
                    report.risk_score <= 35
                      ? "bg-green-400"
                      : report.risk_score <= 65
                      ? "bg-yellow-400"
                      : "bg-red-400"
                  }
                  style={{ width: `${report.risk_score}%` }}
                />
              </div>
            </div>

          </div>
        </Card>

        <Card label="Primary Objective">
          <p className="text-2xl md:text-3xl font-light">
            {report.primary_goal}
          </p>
        </Card>

        <div className="grid md:grid-cols-4 gap-6">
          {Object.entries(report.risk_profile).map(([key, value]) => (
            <Card key={key} label={key.replace("_", " ")}>
              <p
                className={
                  value === "low"
                    ? "text-green-400"
                    : value === "medium"
                    ? "text-yellow-400"
                    : "text-red-400"
                }
              >
                {value}
              </p>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card label="Strengths">
            <div className="space-y-3">
              {report.strengths.map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-green-500/10">
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card label="Weaknesses">
            <div className="space-y-3">
              {report.weaknesses.map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-orange-500/10">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card label="Top Priorities">
          <div className="space-y-3">
            {report.top_priorities.map((p, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/5">
                {i + 1}. {p}
              </div>
            ))}
          </div>
        </Card>

        <Card label="90-Day Plan">
          <div className="space-y-4">
            {report["90_day_plan"].map((item, i) => (
              <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-white/5">
                <div>
                  <p className="font-medium">{item.category}</p>
                  <p className="text-white/60 text-sm">{item.action}</p>
                </div>

                <span className="text-xs px-3 py-1 rounded-full bg-white/10">
                  {item.impact}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card label="Behavioral Insights">
          <div className="space-y-4">
            {report.behavioral_insights.map((insight, i) => (
              <p key={i} className="text-white/70 border-l border-white/20 pl-4">
                {insight}
              </p>
            ))}
          </div>
        </Card>

      </div>
    </PageContainer>
  );
}