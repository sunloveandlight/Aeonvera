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
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [hasAssessment, setHasAssessment] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
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

        if (
          !isUserAllowed(profileData.plan, profileData.subscription_status)
        ) {
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
          .single();

        if (existingReport) setReport(existingReport);

        const { data: assessment } = await supabase
          .from("longevity_assessments")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

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

  async function generateReport() {
    try {
      setGeneratingReport(true);

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
    try {
      setOpeningPortal(true);

      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      window.location.href = data.url;
    } catch {
      alert("Failed to open billing portal.");
    } finally {
      setOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">
        <div className="text-white/50 text-sm tracking-[0.25em] uppercase">
          Initializing intelligence system...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050507] text-red-400 flex items-center justify-center">
        {error}
      </div>
    );
  }

  const initials =
    profile?.display_name?.slice(0, 2).toUpperCase() || "AU";

  return (
    <main className="min-h-screen bg-[#050507] text-white relative overflow-hidden">

      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <div className="absolute w-[800px] h-[800px] bg-white/5 blur-[160px] rounded-full top-[-300px] left-[-300px]" />
        <div className="absolute w-[700px] h-[700px] bg-cyan-500/5 blur-[180px] rounded-full bottom-[-300px] right-[-300px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-12">

          <div>
            <h1 className="text-sm tracking-[0.35em] text-white/70">
              AEONVERA
            </h1>
            <p className="text-white/40 text-xs mt-2">
              Longevity Intelligence System
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-white/70 text-sm">
                {profile?.display_name || "User"}
              </p>
              <p className="text-white/40 text-xs uppercase">
                {profile?.plan || "core"}
              </p>
            </div>

            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm">
              {initials}
            </div>
          </div>

        </div>

        {/* MAIN GRID */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* PRIMARY INTELLIGENCE CARD */}
          <div className="md:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">

            <h2 className="text-white/50 text-xs tracking-[0.3em] uppercase mb-6">
              Digital Twin Status
            </h2>

            {report ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">

                <div>
                  <p className="text-white/70 mb-2">
                    Intelligence Report Active
                  </p>
                  <p className="text-3xl font-medium">
                    Risk Score{" "}
                    <span className="text-white/40">
                      {report.risk_score}/100
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => router.push("/report")}
                  className="px-6 py-3 rounded-xl bg-white text-black text-sm font-medium hover:opacity-90 transition"
                >
                  Open Report
                </button>

              </div>
            ) : hasAssessment ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">

                <p className="text-white/60">
                  Assessment complete. Ready to generate intelligence model.
                </p>

                <button
                  onClick={generateReport}
                  disabled={generatingReport}
                  className="px-6 py-3 rounded-xl bg-white text-black text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
                >
                  {generatingReport ? "Processing..." : "Generate Report"}
                </button>

              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">

                <p className="text-white/60">
                  No assessment detected. Initialize your system profile.
                </p>

                <button
                  onClick={() => router.push("/assessment")}
                  className="px-6 py-3 rounded-xl bg-white text-black text-sm font-medium hover:opacity-90 transition"
                >
                  Start Assessment
                </button>

              </div>
            )}

          </div>

          {/* SUBSCRIPTION */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">

            <h3 className="text-white/50 text-xs tracking-[0.3em] uppercase mb-4">
              Subscription
            </h3>

            <p className="text-white/80 mb-6 uppercase text-sm">
              {profile?.plan || "core"}
            </p>

            <button
              onClick={openBillingPortal}
              disabled={openingPortal}
              className="w-full px-4 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition text-sm"
            >
              {openingPortal ? "Opening..." : "Manage Plan"}
            </button>

          </div>

          {/* QUICK ACTIONS */}
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">

            <h3 className="text-white/50 text-xs tracking-[0.3em] uppercase mb-4">
              Quick Actions
            </h3>

            <div className="flex flex-wrap gap-3">

              {!hasAssessment && (
                <button
                  onClick={() => router.push("/assessment")}
                  className="px-5 py-3 rounded-xl bg-white text-black text-sm font-medium"
                >
                  Start Assessment
                </button>
              )}

              <button
                onClick={openBillingPortal}
                className="px-5 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition text-sm"
              >
                Billing
              </button>

              <button
                onClick={() => router.push("/report")}
                className="px-5 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition text-sm"
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