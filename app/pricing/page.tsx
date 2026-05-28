"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleCheckout(plan: string) {
    try {
      setLoadingPlan(plan);

      const {
        data: { session },
      } = await getSupabase().auth.getSession();

      if (!session) {
        window.location.href = "/login?mode=signin";
        return;
      }

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Something went wrong.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
      alert("Checkout failed.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-20">
          <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase mb-6">
            AEONVERA ACCESS
          </p>

          <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-8">
            Biological Intelligence Infrastructure
          </h1>

          <p className="max-w-3xl mx-auto text-zinc-400 text-lg leading-relaxed">
            Access the AI-native longevity optimization platform designed for
            adaptive health intelligence, biological monitoring, recovery
            systems, and lifespan enhancement.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* CORE */}
          <div className="border border-zinc-800 rounded-3xl p-10 bg-zinc-950">
            <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase mb-6">
              Core
            </p>

            <h2 className="text-5xl font-light mb-4">$49</h2>

            <p className="text-zinc-500 mb-10">Monthly Access</p>

            <ul className="space-y-4 text-zinc-300 mb-12">
              <li>Longevity dashboard access</li>
              <li>Core biomarker systems</li>
              <li>Foundational AI insights</li>
              <li>Recovery optimization</li>
              <li>Sleep intelligence systems</li>
            </ul>

            <button
              onClick={() => handleCheckout("core")}
              disabled={loadingPlan === "core"}
              className="w-full rounded-full bg-white text-black py-4 font-medium hover:bg-zinc-200 transition"
            >
              {loadingPlan === "core"
                ? "Redirecting..."
                : "Begin Core Access"}
            </button>
          </div>

          {/* ELITE */}
          <div className="border border-white rounded-3xl p-10 bg-white text-black relative overflow-hidden">
            <div className="absolute top-4 right-4 text-xs uppercase tracking-[0.3em]">
              Most Popular
            </div>

            <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase mb-6">
              Elite
            </p>

            <h2 className="text-5xl font-light mb-4">$199</h2>

            <p className="text-zinc-600 mb-10">Monthly Access</p>

            <ul className="space-y-4 text-zinc-700 mb-12">
              <li>Everything in Core</li>
              <li>Advanced biological intelligence</li>
              <li>Adaptive optimization systems</li>
              <li>Priority protocol generation</li>
              <li>Cognitive & performance systems</li>
            </ul>

            <button
              onClick={() => handleCheckout("elite")}
              disabled={loadingPlan === "elite"}
              className="w-full rounded-full bg-black text-white py-4 font-medium hover:bg-zinc-800 transition"
            >
              {loadingPlan === "elite"
                ? "Redirecting..."
                : "Unlock Elite"}
            </button>
          </div>

          {/* SOVEREIGN */}
          <div className="border border-zinc-800 rounded-3xl p-10 bg-zinc-950">
            <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase mb-6">
              Sovereign
            </p>

            <h2 className="text-5xl font-light mb-4">$999</h2>

            <p className="text-zinc-500 mb-10">Annual Access</p>

            <ul className="space-y-4 text-zinc-300 mb-12">
              <li>Everything in Elite</li>
              <li>Annual optimization pathway</li>
              <li>Premium intelligence access</li>
              <li>Highest-value subscription tier</li>
              <li>Long-term biological tracking</li>
            </ul>

            <button
              onClick={() => handleCheckout("sovereign")}
              disabled={loadingPlan === "sovereign"}
              className="w-full rounded-full border border-white py-4 font-medium hover:bg-white hover:text-black transition"
            >
              {loadingPlan === "sovereign"
                ? "Redirecting..."
                : "Enter Sovereign"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}