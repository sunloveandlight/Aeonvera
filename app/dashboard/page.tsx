// app/dashboard/page.tsx
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
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("display_name, plan, subscription_status, date_of_birth, primary_goal")
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

        // Check for existing report
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

        // Check if assessment exists
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
        setError("Something went wrong. Please try again.");
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
      alert("Longevity Report generated successfully!");
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
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-pulse text-white/60">
          Initializing Aeonvera Intelligence System...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-red-400">
        {error}
      </div>
    );
  }

  const initials = profile?.display_name?.slice(0, 2).toUpperCase() || "AU";

  return (
    <main className="min-h-screen bg-black text-white p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.15),transparent_60%)]" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-light tracking-wide">AEONVERA</h1>
          <p className="text-white/50 text-sm">Longevity Intelligence System</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white/70 text-sm">{profile?.display_name || "User"}</p>
            <p className="text-white/40 text-xs">{profile?.plan?.toUpperCase() || "CORE"}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            {initials}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {/* Digital Twin / Report Status */}
        <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl md:col-span-2">
          <h2 className="text-sm text-white/50 mb-4">YOUR DIGITAL TWIN</h2>

          {report ? (
            <div className="bg-green-950/30 border border-green-500/30 rounded-xl p-6">
              <p className="text-green-400 text-xl mb-2">✅ Intelligence Report Ready</p>
              <p className="text-white/70">Risk Score: <span className="font-bold">{report.risk_score}/100</span></p>
              <button
                onClick={() => alert("Full report view coming soon...")}
                className="mt-4 px-6 py-2 bg-white text-black rounded-lg"
              >
                View Full Report
              </button>
            </div>
          ) : hasAssessment ? (
            <div>
              <p className="text-yellow-400 mb-4">Assessment Complete — Ready for Analysis</p>
              <button
                onClick={generateReport}
                disabled={generatingReport}
                className="px-8 py-4 bg-white text-black rounded-2xl font-medium hover:bg-white/90 transition disabled:opacity-50"
              >
                {generatingReport ? "Generating Intelligence Report..." : "Generate Longevity Report"}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-yellow-400 mb-4">Complete your assessment to activate your Digital Twin</p>
              <button
                onClick={() => router.push("/assessment")}
                className="px-8 py-4 bg-white text-black rounded-2xl font-medium hover:bg-white/90 transition"
              >
                Start Longevity Assessment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="relative z-10 mt-10 flex gap-4">
        {!hasAssessment && (
          <button
            onClick={() => router.push("/assessment")}
            className="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition"
          >
            Start Assessment
          </button>
        )}

        <button
          onClick={openBillingPortal}
          disabled={openingPortal}
          className="px-6 py-3 rounded-xl border border-white/20 text-white/80 hover:bg-white/5 transition"
        >
          {openingPortal ? "Opening..." : "Manage Subscription"}
        </button>
      </div>
    </main>
  );
}