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

  useEffect(() => {
    const fetchReport = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data } = await supabase
        .from("longevity_reports")
        .select("report")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) setReport(data.report);
      setLoading(false);
    };

    fetchReport();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 tracking-[6px]">DECODING BIOLOGICAL SIGNATURE...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        No report found.
      </div>
    );
  }

  const riskColor = report.risk_score <= 40 ? "text-cyan-400" : report.risk_score <= 70 ? "text-yellow-400" : "text-red-400";

  return (
    <main className="min-h-screen bg-black text-white p-8 relative">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-10 text-cyan-400 hover:text-cyan-300 flex items-center gap-2"
        >
          ← RETURN TO CORE
        </button>

        <h1 className="text-6xl font-light tracking-tight mb-2 bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">
          LONGEVITY BLUEPRINT
        </h1>
        <p className="text-cyan-400/60 tracking-widest">AEONVERA NEURAL ANALYSIS v1.0</p>

        {/* Risk Score */}
        <div className="my-16 text-center">
          <div className="text-sm tracking-[4px] text-white/50 mb-4">OVERALL BIOLOGICAL RISK</div>
          <div className={`text-[180px] font-light leading-none ${riskColor}`}>
            {report.risk_score}
          </div>
          <p className="text-2xl -mt-6 text-white/60">/ 100</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Strengths */}
          <div className="bg-zinc-950/80 border border-cyan-400/20 rounded-3xl p-10">
            <h3 className="text-cyan-400 text-xl mb-6 tracking-widest">STRENGTHS</h3>
            <ul className="space-y-6">
              {report.strengths.map((s, i) => (
                <li key={i} className="text-lg pl-6 border-l-2 border-cyan-400/50">• {s}</li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div className="bg-zinc-950/80 border border-purple-400/20 rounded-3xl p-10">
            <h3 className="text-purple-400 text-xl mb-6 tracking-widest">OPTIMIZATION VECTORS</h3>
            <ul className="space-y-6">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="text-lg pl-6 border-l-2 border-purple-400/50">• {w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 90 Day Plan */}
        <div className="mt-12 bg-zinc-950/70 border border-white/10 rounded-3xl p-10">
          <h3 className="text-2xl mb-8">90-DAY OPTIMIZATION PROTOCOL</h3>
          <div className="space-y-8">
            {report["90_day_plan"].map((item, i) => (
              <div key={i} className="flex gap-6 items-start border-l-4 border-cyan-400 pl-6">
                <div className="flex-1">
                  <p className="font-medium text-lg">{item.category}</p>
                  <p className="text-white/70 mt-1">{item.action}</p>
                </div>
                <span className="px-6 py-2 bg-white/10 rounded-full text-sm whitespace-nowrap">
                  {item.impact.toUpperCase()} IMPACT
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}