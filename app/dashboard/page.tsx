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
        .select(
          "display_name, plan, subscription_status"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profileData) {
        router.replace("/onboarding");
        return;
      }

      if (
        !isUserAllowed(
          profileData.plan,
          profileData.subscription_status
        )
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
      <div className="min-h-screen bg-[#050507] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-10 h-10 border border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50 tracking-wide">
            Initializing Aeonvera Intelligence Core
          </p>
        </div>
      </div>
    );
  }

  const initials =
    profile?.display_name?.slice(0, 2).toUpperCase() || "AU";

  return (
    <main className="min-h-screen bg-[#050507] text-white relative overflow-hidden">

      {/* BACKGROUND */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#050507] to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(120,180,255,0.06),transparent_50%)]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-14 relative z-10">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-14">

          <div>
            <h1 className="text-2xl tracking-[0.35em] font-light">
              AEONVERA
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Intelligence Operating System
            </p>
          </div>

          <div className="flex items-center gap-5">

            <div className="text-right">
              <p className="text-white/70 text-sm">
                {profile?.display_name || "User"}
              </p>
              <p className="text-white/40 text-xs uppercase tracking-wide">
                {profile?.plan || "core"}
              </p>
            </div>

            <div className="w-11 h-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
              {initials}
            </div>

          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* DIGITAL TWIN */}
          <div className="md:col-span-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10">

            <p className="text-white/40 text-xs tracking-[0.35em] mb-6">
              DIGITAL TWIN CORE
            </p>

            {report ? (
              <div>
                <div className="flex items-end justify-between flex-wrap gap-6">

                  <div>
                    <p className="text-white/50 text-sm">
                      SYSTEM STATUS
                    </p>
                    <p className="text-3xl font-semibold mt-2">
                      Active Intelligence Model
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-white/40 text-sm">
                      Risk Score
                    </p>
                    <p className="text-4xl font-semibold text-white">
                      {report.risk_score}
                    </p>
                  </div>

                </div>

                <button
                  onClick={() => router.push("/report")}
                  className="mt-8 px-6 py-3 rounded-xl bg-white text-black font-medium hover:scale-[1.02] transition"
                >
                  Open Full Intelligence Report →
                </button>
              </div>
            ) : hasAssessment ? (
              <div>
                <p className="text-white/60 mb-6">
                  Assessment completed. Intelligence model ready for generation.
                </p>

                <button
                  onClick={generateReport}
                  disabled={generatingReport}
                  className="px-8 py-4 rounded-xl bg-white text-black font-medium hover:scale-[1.02] transition disabled:opacity-50"
                >
                  {generatingReport
                    ? "Generating..."
                    : "Generate Intelligence Report"}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-white/60 mb-6">
                  No biological model detected. Run assessment to initialize system.
                </p>

                <button
                  onClick={() => router.push("/assessment")}
                  className="px-8 py-4 rounded-xl bg-white text-black font-medium hover:scale-[1.02] transition"
                >
                  Start Assessment
                </button>
              </div>
            )}

          </div>

          {/* SUBSCRIPTION */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-white/40 text-xs tracking-[0.35em] mb-4">
              SUBSCRIPTION
            </p>

            <p className="text-lg font-medium mb-6">
              {profile?.plan?.toUpperCase() || "CORE"}
            </p>

            <button
              onClick={openBillingPortal}
              disabled={openingPortal}
              className="w-full px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition text-white/70"
            >
              {openingPortal ? "Opening..." : "Manage Plan"}
            </button>
          </div>

          {/* QUICK ACTIONS */}
          <div className="md:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">

            <p className="text-white/40 text-xs tracking-[0.35em] mb-4">
              QUICK ACTIONS
            </p>

            <div className="flex flex-wrap gap-4">

              {!hasAssessment && (
                <button
                  onClick={() => router.push("/assessment")}
                  className="px-5 py-3 rounded-xl bg-white text-black font-medium"
                >
                  Run Assessment
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