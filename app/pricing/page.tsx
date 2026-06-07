"use client";

import { useState } from "react";
import PageContainer from "@/components/ui/PageContainer";

type Plan = "core" | "elite" | "sovereign";

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] =
    useState<Plan | null>(null);

  async function handleCheckout(plan: Plan) {
    try {
      setLoadingPlan(plan);

      const res = await fetch(
        "/api/stripe/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ plan }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Checkout failed"
        );
      }

      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("Failed to start checkout.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      <section className="pt-32 pb-24">
        <PageContainer>

          <div className="max-w-4xl mx-auto text-center">

            <p className="text-xs uppercase tracking-[0.5em] text-white/40 mb-8">
              Membership
            </p>

            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[0.95]">
              Choose Your
              <br />
              Longevity Layer
            </h1>

            <p className="mt-8 text-xl text-white/60 max-w-3xl mx-auto">
              From foundational tracking to a fully
              personalized longevity intelligence
              system.
            </p>

          </div>

        </PageContainer>
      </section>

      <section className="pb-32">
        <PageContainer>

          <div className="grid lg:grid-cols-3 gap-8">

            {/* CORE */}
            <div className="rounded-[32px] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">

              <div className="mb-8">
                <h2 className="text-2xl font-semibold">
                  Core
                </h2>
                <p className="mt-3 text-white/50">
                  Foundational longevity tracking.
                </p>
              </div>

              <div className="mb-8">
                <div className="text-5xl font-semibold">
                  $49
                </div>
                <div className="text-white/40 mt-2">
                  per month
                </div>
              </div>

              <ul className="space-y-4 text-white/70 mb-10">
                <li>✓ Dashboard Access</li>
                <li>✓ Health Profile</li>
                <li>✓ Basic Assessments</li>
                <li>✓ Longevity Tracking</li>
                <li>✓ AI Report Generation</li>
              </ul>

              <button
                onClick={() => handleCheckout("core")}
                disabled={loadingPlan !== null}
                className="w-full h-12 rounded-xl bg-white text-black font-medium transition hover:bg-zinc-200"
              >
                {loadingPlan === "core" ? "Processing..." : "Get Core"}
              </button>

            </div>

            {/* ELITE */}
            <div className="rounded-[32px] border border-white/20 bg-white/[0.05] backdrop-blur-xl p-8 relative">

              <div className="absolute top-6 right-6 text-xs px-3 py-1 rounded-full bg-white text-black font-medium">
                Recommended
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold">
                  Elite
                </h2>
                <p className="mt-3 text-white/50">
                  Full AI-powered optimization.
                </p>
              </div>

              <div className="mb-8">
                <div className="text-5xl font-semibold">
                  $199
                </div>
                <div className="text-white/40 mt-2">
                  per month
                </div>
              </div>

              <ul className="space-y-4 text-white/70 mb-10">
                <li>✓ Everything in Core</li>
                <li>✓ Advanced AI Reports</li>
                <li>✓ Biological Age Tracking</li>
                <li>✓ Risk Intelligence Engine</li>
                <li>✓ Optimization Protocols</li>
                <li>✓ Priority Feature Access</li>
              </ul>

              <button
                onClick={() => handleCheckout("elite")}
                disabled={loadingPlan !== null}
                className="w-full h-12 rounded-xl bg-white text-black font-medium transition hover:bg-zinc-200"
              >
                {loadingPlan === "elite" ? "Processing..." : "Get Elite"}
              </button>

            </div>

            {/* SOVEREIGN */}
            <div className="rounded-[32px] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8">

              <div className="mb-8">
                <h2 className="text-2xl font-semibold">
                  Sovereign
                </h2>
                <p className="mt-3 text-white/50">
                  Private longevity intelligence.
                </p>
              </div>

              <div className="mb-8">
                <div className="text-5xl font-semibold">
                  $999
                </div>
                <div className="text-white/40 mt-2">
                  per month
                </div>
              </div>

              <ul className="space-y-4 text-white/70 mb-10">
                <li>✓ Everything in Elite</li>
                <li>✓ Unlimited AI Analysis</li>
                <li>✓ Digital Twin Modeling</li>
                <li>✓ Executive Health Dashboard</li>
                <li>✓ Concierge Data Integration</li>
                <li>✓ Priority Support</li>
                <li>✓ Future Genomics Layer</li>
                <li>✓ Future Family Accounts</li>
              </ul>

              <button
                onClick={() => handleCheckout("sovereign")}
                disabled={loadingPlan !== null}
                className="w-full h-12 rounded-xl bg-white text-black font-medium transition hover:bg-zinc-200"
              >
                {loadingPlan === "sovereign" ? "Processing..." : "Get Sovereign"}
              </button>

            </div>

          </div>

        </PageContainer>
      </section>
    </div>
  );
}