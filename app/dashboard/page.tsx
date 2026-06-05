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
        if (!user) { router.replace("/login"); return; }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, plan, subscription_status, date_of_birth, primary_goal")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profileData) { router.replace("/onboarding"); return; }
        if (!isUserAllowed(profileData.plan, profileData.subscription_status)) {
          router.replace("/pricing"); return;
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
      } catch (err) {
        setError("System initialization failed");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router]);

  async function generateReport() {
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/longevity/report", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.report);
    } catch (err: any) {
      alert(err.message || "Generation failed");
    } finally {
      setGeneratingReport(false);
    }
  }

  async function openBillingPortal() {
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok) window.location.href = data.url;
    } catch {
      alert("Portal access failed");
    } finally {
      setOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-6" />
          <p className="text-cyan-400 tracking-[4px] text-sm">AEONVERA CORE ONLINE</p>
        </div>
      </div>
    );
  }

  const initials = profile?.display_name?.slice(0, 2).toUpperCase() || "AU";

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Futuristic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(at_50%_30%,rgba(34,211,238,0.15),transparent_70%)]" />
      <div className="absolute inset-0 bg-grid opacity-10" />

      <div className="relative z-10 p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-16">
          <div>
            <h1 className="text-5xl font-light tracking-[-2px] bg-gradient-to-r from-white via-cyan-300 to-purple-400 bg-clip-text text-transparent">
              AEONVERA
            </h1>
            <p className="text-cyan-400/70 text-sm tracking-[3px] mt-1">LONGEVITY INTELLIGENCE OS</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-lg">{profile?.display_name}</p>
              <p className="text-xs text-cyan-400">{profile?.plan?.toUpperCase()} • ACTIVE</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-xl font-bold border border-white/20">
              {initials}
            </div>
          </div>
        </div>

        {/* Main Status Card */}
        <div className="bg-zinc-950/70 backdrop-blur-3xl border border-white/10 rounded-3xl p-12 mb-12">
          <div className="text-center mb-10">
            <p className="uppercase tracking-[4px] text-cyan-400 text-sm mb-3">DIGITAL TWIN STATUS</p>
            <h2 className="text-6xl font-light">NEURAL CORE</h2>
          </div>

          {report ? (
            <div className="text-center">
              <div className="inline-block px-8 py-4 bg-green-500/10 border border-green-400/30 rounded-2xl mb-8">
                <p className="text-green-400 text-xl">INTELLIGENCE REPORT SYNCHRONIZED</p>
              </div>
              <button
                onClick={() => router.push("/report")}
                className="px-12 py-5 bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-medium rounded-2xl text-lg hover:scale-105 transition-transform"
              >
                ACCESS FULL BLUEPRINT →
              </button>
            </div>
          ) : hasAssessment ? (
            <div className="text-center">
              <button
                onClick={generateReport}
                disabled={generatingReport}
                className="px-12 py-5 bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-medium rounded-2xl text-lg hover:scale-105 transition-transform disabled:opacity-70"
              >
                {generatingReport ? "ANALYZING BIOLOGY..." : "GENERATE LONGEVITY REPORT"}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={() => router.push("/assessment")}
                className="px-12 py-5 bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-medium rounded-2xl text-lg hover:scale-105 transition-transform"
              >
                INITIALIZE ASSESSMENT
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-6">
          <button
            onClick={() => router.push("/assessment")}
            className="flex-1 py-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl text-lg transition-all hover:border-cyan-400/50"
          >
            NEW ASSESSMENT
          </button>
          <button
            onClick={openBillingPortal}
            disabled={openingPortal}
            className="flex-1 py-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl text-lg transition-all hover:border-purple-400/50"
          >
            {openingPortal ? "CONNECTING..." : "MANAGE SUBSCRIPTION"}
          </button>
        </div>
      </div>
    </main>
  );
}