"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "core" | "elite" | "sovereign";

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);

  async function handleCheckout(plan: Plan) {
    try {
      setLoadingPlan(plan);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
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
    <div className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-5xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Choose your plan</h1>
        <p className="text-gray-400">
          Upgrade anytime. Elite and Sovereign include the same features.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {/* CORE */}
        <div className="border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold">Core</h2>
          <p className="text-gray-400 mt-2">Basic access</p>

          <div className="mt-6 text-3xl font-bold">$49</div>
          <div className="text-gray-500">/ month</div>

          <ul className="mt-6 space-y-2 text-sm text-gray-300">
            <li>✓ Dashboard access</li>
            <li>✓ Core features</li>
            <li>— Elite features</li>
          </ul>

          <button
            onClick={() => handleCheckout("core")}
            disabled={loadingPlan !== null}
            className="mt-6 w-full bg-white text-black py-2 rounded-xl font-medium"
          >
            {loadingPlan === "core" ? "Processing..." : "Get Core"}
          </button>
        </div>

        {/* ELITE */}
        <div className="border border-gray-800 rounded-2xl p-6 relative">
          <div className="absolute top-3 right-3 text-xs bg-white text-black px-2 py-1 rounded-full">
            Popular
          </div>

          <h2 className="text-xl font-semibold">Elite</h2>
          <p className="text-gray-400 mt-2">Full access</p>

          <div className="mt-6 text-3xl font-bold">$199</div>
          <div className="text-gray-500">/ month</div>

          <ul className="mt-6 space-y-2 text-sm text-gray-300">
            <li>✓ Dashboard access</li>
            <li>✓ Core features</li>
            <li>✓ Elite features</li>
          </ul>

          <button
            onClick={() => handleCheckout("elite")}
            disabled={loadingPlan !== null}
            className="mt-6 w-full bg-white text-black py-2 rounded-xl font-medium"
          >
            {loadingPlan === "elite" ? "Processing..." : "Get Elite"}
          </button>
        </div>

        {/* SOVEREIGN */}
        <div className="border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold">Sovereign</h2>
          <p className="text-gray-400 mt-2">Same as Elite — billed yearly</p>

          <div className="mt-6 text-3xl font-bold">$999</div>
          <div className="text-gray-500">/ year</div>

          <ul className="mt-6 space-y-2 text-sm text-gray-300">
            <li>✓ Dashboard access</li>
            <li>✓ Core features</li>
            <li>✓ Elite features</li>
          </ul>

          <button
            onClick={() => handleCheckout("sovereign")}
            disabled={loadingPlan !== null}
            className="mt-6 w-full bg-white text-black py-2 rounded-xl font-medium"
          >
            {loadingPlan === "sovereign" ? "Processing..." : "Get Sovereign"}
          </button>
        </div>
      </div>

      <div className="text-center mt-10 text-gray-500 text-sm">
        Sovereign = Elite plan with annual billing
      </div>
    </div>
  );
}