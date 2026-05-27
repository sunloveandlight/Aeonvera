"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { getSupabase } from "@/lib/supabase/client";
import Link from "next/link";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

const PRICE_IDS = {
  core: "price_1Tb5DiFBEwY7LhhKvtS1uodp",
  elite: "price_1Tb5EdFBEwY7LhhK5LOkIrQ6",
  sovereign: "price_1Tb5FNFBEwY7LhhKHvo82JKF",
};

export default function AeonveraWebsite() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goals, setGoals] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      setSubmitted(true);

      setTimeout(() => {
        setSubmitted(false);
        setWaitlistOpen(false);
        setName("");
        setEmail("");
        setGoals("");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (priceId: string) => {
    setStripeLoading(true);

    try {
      const supabase = getSupabase();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("No checkout URL received");
    } catch (err: any) {
      console.error(err);
      alert("Checkout error: " + err.message);
    } finally {
      setStripeLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">

      {/* BACKGROUND EFFECTS */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -40, 0] }}
          transition={{ repeat: Infinity, duration: 18 }}
          className="absolute left-[-10%] top-[-10%] h-[600px] w-[600px] rounded-full bg-white/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -60, 0], y: [0, 60, 0] }}
          transition={{ repeat: Infinity, duration: 20 }}
          className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-zinc-500/10 blur-3xl"
        />
      </div>

      {/* HEADER */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrollY > 20
            ? "border-b border-white/10 bg-black/70 backdrop-blur-2xl"
            : ""
        }`}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-5">

          <button
            onClick={() => scrollToSection("hero")}
            className="text-2xl font-semibold"
          >
            Aeonvera
          </button>

          {/* NAV */}
          <nav className="hidden gap-10 text-sm text-zinc-300 lg:flex">
            <button onClick={() => scrollToSection("platform")}>Platform</button>
            <button onClick={() => scrollToSection("science")}>Science</button>
            <button onClick={() => scrollToSection("membership")}>Memberships</button>
            <button onClick={() => scrollToSection("about")}>About</button>
          </nav>

          {/* RIGHT SIDE (FIXED STRUCTURE) */}
          <div className="flex items-center gap-4">

            <div className="flex items-center gap-3">

              <Link href="/login">
                <button className="rounded-xl border border-white/20 px-4 py-2 text-sm">
                  Login
                </button>
              </Link>

              <Link href="/signup">
                <button className="rounded-xl bg-white px-4 py-2 text-sm text-black font-medium">
                  Sign up
                </button>
              </Link>

              <button
                onClick={() => setWaitlistOpen(true)}
                className="rounded-2xl bg-white px-5 py-3 text-sm text-black font-medium"
              >
                Join Waitlist
              </button>

            </div>

            <button
              className="lg:hidden"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X size={24} /> : <Menu size={24} />}
            </button>

          </div>
        </div>
      </header>

      {/* MEMBERSHIP SECTION */}
      <section id="membership" className="px-6 py-32">
        <div className="mx-auto max-w-6xl text-center">

          <h2 className="text-5xl font-semibold mb-4">
            Choose Your Path
          </h2>

          <p className="text-zinc-400 mb-12">
            Begin your transformation today
          </p>

          <div className="grid gap-6 md:grid-cols-3">

            {[
              { name: "Core", price: "$49/mo", id: PRICE_IDS.core },
              { name: "Elite", price: "$199/mo", id: PRICE_IDS.elite },
              { name: "Sovereign", price: "$999/yr", id: PRICE_IDS.sovereign },
            ].map((plan) => (
              <div
                key={plan.name}
                className="rounded-3xl bg-white/5 p-8 border border-white/10 hover:border-white/30 transition-all"
              >
                <h3 className="text-2xl font-semibold">{plan.name}</h3>
                <p className="text-4xl font-bold mt-4 mb-8">{plan.price}</p>

                <button
                  disabled={stripeLoading}
                  onClick={() => handleCheckout(plan.id)}
                  className="w-full rounded-2xl bg-white py-4 text-black font-semibold hover:bg-zinc-200 transition disabled:opacity-70"
                >
                  {stripeLoading ? "Processing..." : "Subscribe Now"}
                </button>

              </div>
            ))}

          </div>

        </div>
      </section>

    </div>
  );
}