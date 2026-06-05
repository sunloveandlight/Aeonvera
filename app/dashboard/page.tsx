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
          .single();

        if (existingReport) {
          setReport(existingReport);
        }

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

      if (!res.ok) {
        throw new Error(data.error);
      }

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
          Initializing Intelligence System...
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
    <main className="min-h-screen bg-[#050507] text-white overflow-hidden relative">
      {/* BACKGROUND */}
      <div className="fixed inset-0 -z-10 bg-[#050507]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.02))]" />

        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/5 blur-[140px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-cyan-500/5 blur-[160px]" />
        </div>
      </div>

      {/* HEADER */}
      <header className="border-b border-white/10 backdrop-blur-xl bg-black/20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-sm tracking-[0.35em] font-medium">
              AEONVERA
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-white/70">
                {profile?.display_name || "User"}
              </p>

              <p className="text-xs uppercase text-white/40">
                {profile?.plan || "core"}
              </p>
            </div>

            <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-sm">
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.4em] text-white/40 uppercase mb-8">
            LONGEVITY INTELLIGENCE
          </p>

          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
            Dashboard
          </h1>

          <p className="mt-6 text-white/60 text-lg max-w-2xl">
            Your biological intelligence layer, assessment status,
            reports, and subscription management.
          </p>

          {/* PRIMARY CARD */}
          <div className="mt-14 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
            <p className="text-xs tracking-[0.35em] uppercase text-white/40 mb-6">
              DIGITAL TWIN STATUS
            </p>

            {report ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                <div>
                  <p className="text-white/60 mb-2">
                    Intelligence Report Active
                  </p>

                  <h2 className="text-4xl font-semibold">
                    {report.risk_score}
                    <span className="text-white/40"> / 100</span>
                  </h2>
                </div>

                <button
                  onClick={() => router.push("/report")}
                  className="px-8 py-3 rounded-xl bg-white text-black font-medium hover:opacity-90 transition"
                >
                  Open Report
                </button>
              </div>
            ) : hasAssessment ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                <p className="text-white/60">
                  Assessment completed. Generate your AI longevity report.
                </p>

                <button
                  onClick={generateReport}
                  disabled={generatingReport}
                  className="px-8 py-3 rounded-xl bg-white text-black font-medium disabled:opacity-50"
                >
                  {generatingReport
                    ? "Processing..."
                    : "Generate Report"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                <p className="text-white/60">
                  No assessment detected. Begin your intelligence profile.
                </p>

                <button
                  onClick={() => router.push("/assessment")}
                  className="px-8 py-3 rounded-xl bg-white text-black font-medium"
                >
                  Start Assessment
                </button>
              </div>
            )}
          </div>

          {/* GRID */}
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
              <p className="text-xs tracking-[0.35em] uppercase text-white/40 mb-6">
                SUBSCRIPTION
              </p>

              <h3 className="text-2xl font-medium uppercase mb-6">
                {profile?.plan || "core"}
              </h3>

              <button
                onClick={openBillingPortal}
                disabled={openingPortal}
                className="w-full px-8 py-3 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition"
              >
                {openingPortal
                  ? "Opening..."
                  : "Manage Plan"}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
              <p className="text-xs tracking-[0.35em] uppercase text-white/40 mb-6">
                QUICK ACTIONS
              </p>

              <div className="flex flex-wrap gap-3">
                {!hasAssessment && (
                  <button
                    onClick={() =>
                      router.push("/assessment")
                    }
                    className="px-8 py-3 rounded-xl bg-white text-black font-medium"
                  >
                    Start Assessment
                  </button>
                )}

                <button
                  onClick={openBillingPortal}
                  className="px-8 py-3 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition"
                >
                  Billing
                </button>

                <button
                  onClick={() => router.push("/report")}
                  className="px-8 py-3 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition"
                >
                  View Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}