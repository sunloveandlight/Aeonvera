"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";

type Profile = {
  display_name: string | null;
  plan: string | null;
  subscription_status: string | null;
};

type Report = {
  id: string;
  risk_score: number;
  primary_goal: string;
  report: any;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [hasAssessment, setHasAssessment] = useState(false);

  const [generatingReport, setGeneratingReport] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, plan, subscription_status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profileData) {
        router.replace("/onboarding");
        return;
      }

      if (!isUserAllowed(profileData.plan, profileData.subscription_status)) {
        router.replace("/pricing");
        return;
      }

      setProfile(profileData);

      const { data: existingReport } = await supabase
        .from("longevity_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingReport) setReport(existingReport);

      const { data: assessment } = await supabase
        .from("longevity_assessments")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      setHasAssessment(!!assessment);

      setLoading(false);
    };

    run();
  }, [router]);

  async function generateReport() {
    setGeneratingReport(true);

    try {
      const res = await fetch("/api/longevity/report", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to generate report");
        return;
      }

      setReport(data.report);
    } finally {
      setGeneratingReport(false);
    }
  }

  async function openBillingPortal() {
    setOpeningPortal(true);

    try {
      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) throw new Error();

      window.location.href = data.url;
    } catch {
      alert("Failed to open billing portal.");
    } finally {
      setOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-white/60 animate-pulse">
          Initializing Aeonvera systems...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden relative">

      {/* BACKGROUND (MATCH HOMEPAGE) */}
      <div className="fixed inset-0 -z-10 bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.03))]" />

        <div className="absolute inset-0 opacity-[0.2]">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-r from-white/10 via-yellow-200/10 to-transparent blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-r from-white/10 via-cyan-200/10 to-transparent blur-[140px]" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-14 relative z-10">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-14">

          <div className="tracking-[0.35em] text-sm text-white/70">
            AEONVERA
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-white/80 text-sm">
                {profile?.display_name || "User"}
              </p>
              <p className="text-white/40 text-xs uppercase tracking-wider">
                {profile?.plan || "core"}
              </p>
            </div>

            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm">
              {profile?.display_name?.slice(0, 2).toUpperCase() || "AU"}
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid md:grid-cols-3 gap-8">

          {/* DIGITAL TWIN */}
          <div className="md:col-span-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10">

            <p className="text-white/40 text-xs tracking-[0.4em] mb-6">
              DIGITAL TWIN
            </p>

            {report ? (
              <div>
                <p className="text-2xl font-medium mb-4">
                  Intelligence Model Active
                </p>

                <p className="text-white/60 mb-6">
                  Risk Score: {report.risk_score}/100
                </p>

                <button
                  onClick={() => router.push("/report")}
                  className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:opacity-90 transition"
                >
                  Open Full Report →
                </button>
              </div>
            ) : hasAssessment ? (
              <div>
                <p className="text-white/60 mb-6">
                  Assessment complete. Generate your intelligence model.
                </p>

                <button
                  onClick={generateReport}
                  disabled={generatingReport}
                  className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {generatingReport ? "Generating..." : "Generate Report"}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-white/60 mb-6">
                  Complete your assessment to activate your system.
                </p>

                <button
                  onClick={() => router.push("/assessment")}
                  className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:opacity-90 transition"
                >
                  Start Assessment
                </button>
              </div>
            )}
          </div>

          {/* SUBSCRIPTION */}
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">

            <p className="text-white/40 text-xs tracking-[0.4em] mb-4">
              SUBSCRIPTION
            </p>

            <p className="text-white/80 mb-6">
              {profile?.plan?.toUpperCase() || "CORE"}
            </p>

            <button
              onClick={openBillingPortal}
              disabled={openingPortal}
              className="w-full px-4 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition"
            >
              {openingPortal ? "Opening..." : "Manage Plan"}
            </button>
          </div>

          {/* QUICK ACTIONS */}
          <div className="md:col-span-2 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">

            <p className="text-white/40 text-xs tracking-[0.4em] mb-4">
              QUICK ACTIONS
            </p>

            <div className="flex flex-wrap gap-4">

              {!hasAssessment && (
                <button
                  onClick={() => router.push("/assessment")}
                  className="px-5 py-3 rounded-xl bg-white text-black font-medium"
                >
                  Start Assessment
                </button>
              )}

              <button
                onClick={openBillingPortal}
                className="px-5 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition"
              >
                Billing
              </button>

              <button
                onClick={() => router.push("/report")}
                className="px-5 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition"
              >
                View Report
              </button>

            </div>

          </div>

        </div>
      </div>
    </main>
  );
}