"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isUserAllowed } from "@/lib/auth/permissions";

type Profile = {
  display_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  date_of_birth: string | null;
  primary_goal: string | null;
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

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "display_name, plan, subscription_status, date_of_birth, primary_goal"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError || !profileData) {
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
      alert("Intelligence Report generated successfully.");
    } catch (err) {
      console.error(err);
      alert("Error generating report");
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
    } catch (err) {
      alert("Failed to open billing portal.");
    } finally {
      setOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05060a] text-white">
        <div className="animate-pulse text-white/60">
          Booting Aeonvera Intelligence Core...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05060a] text-red-400">
        {error}
      </div>
    );
  }

  const initials =
    profile?.display_name?.slice(0, 2).toUpperCase() || "AU";

  return (
    <main className="min-h-screen bg-[#05060a] text-white relative overflow-hidden">
      {/* Glow Background */}
      <div className="absolute inset-0">
        <div className="absolute w-[700px] h-[700px] bg-cyan-500/10 blur-[140px] rounded-full top-[-250px] left-[-250px]" />
        <div className="absolute w-[600px] h-[600px] bg-purple-500/10 blur-[140px] rounded-full bottom-[-250px] right-[-250px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-14">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              AEONVERA
            </h1>
            <p className="text-white/50 text-sm">
              Longevity Intelligence Operating System
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white/70 text-sm">
                {profile?.display_name || "User"}
              </p>
              <p className="text-white/40 text-xs">
                {profile?.plan?.toUpperCase() || "CORE"}
              </p>
            </div>

            <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl">
              {initials}
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* DIGITAL TWIN CARD */}
          <div className="md:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
            <h2 className="text-white/50 text-sm mb-4">
              YOUR DIGITAL TWIN
            </h2>

            {report ? (
              <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-green-400 text-lg mb-2">
                  Intelligence Report Active
                </p>

                <p className="text-white/70">
                  Risk Score:{" "}
                  <span className="font-semibold">
                    {report.risk_score}/100
                  </span>
                </p>

                <button
                  onClick={() => router.push("/report")}
                  className="mt-5 px-6 py-3 bg-white text-black rounded-xl font-medium hover:opacity-90 transition"
                >
                  Open Full Report →
                </button>
              </div>
            ) : hasAssessment ? (
              <div>
                <p className="text-yellow-400 mb-4">
                  Assessment complete — ready for AI analysis
                </p>

                <button
                  onClick={generateReport}
                  disabled={generatingReport}
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {generatingReport
                    ? "Generating Intelligence Report..."
                    : "Generate Longevity Report"}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-white/60 mb-4">
                  Activate your Digital Twin by completing assessment
                </p>

                <button
                  onClick={() => router.push("/assessment")}
                  className="px-8 py-4 rounded-xl bg-white text-black font-medium hover:opacity-90 transition"
                >
                  Start Assessment
                </button>
              </div>
            )}
          </div>

          {/* SUBSCRIPTION CARD */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
            <h3 className="text-white/50 text-sm mb-3">
              SUBSCRIPTION
            </h3>

            <p className="text-white/80 mb-4">
              {profile?.plan?.toUpperCase() || "CORE"}
            </p>

            <button
              onClick={openBillingPortal}
              disabled={openingPortal}
              className="w-full px-4 py-3 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition"
            >
              {openingPortal ? "Opening..." : "Manage Plan"}
            </button>
          </div>

          {/* QUICK ACTIONS */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl md:col-span-2">
            <h3 className="text-white/50 text-sm mb-4">
              QUICK ACTIONS
            </h3>

            <div className="flex gap-4 flex-wrap">
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
                className="px-5 py-3 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition"
              >
                Billing
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}