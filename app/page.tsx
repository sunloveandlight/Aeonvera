"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  ChevronRight,
  Menu,
  Moon,
  Shield,
  Sparkles,
  X,
} from "lucide-react";

export default function AeonveraWebsite() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
      });
    }
  };

  const handleWaitlistSubmit = (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setSubmitted(true);

    setTimeout(() => {
      setSubmitted(false);
      setWaitlistOpen(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 40, 0],
            y: [0, -40, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 18,
            ease: "easeInOut",
          }}
          className="absolute left-[-10%] top-[-10%] h-[600px] w-[600px] rounded-full bg-white/10 blur-3xl"
        />

        <motion.div
          animate={{
            x: [0, -60, 0],
            y: [0, 60, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 20,
            ease: "easeInOut",
          }}
          className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-zinc-500/10 blur-3xl"
        />
      </div>

      {/* Navbar */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrollY > 20
            ? "border-b border-white/10 bg-black/70 backdrop-blur-2xl"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            onClick={() => scrollToSection("hero")}
            className="text-2xl font-semibold tracking-tight"
          >
            Aeonvera
          </button>

          <nav className="hidden items-center gap-10 text-sm text-zinc-300 lg:flex">
            <button onClick={() => scrollToSection("platform")}>
              Platform
            </button>

            <button onClick={() => scrollToSection("science")}>
              Science
            </button>

            <button onClick={() => scrollToSection("membership")}>
              Memberships
            </button>

            <button onClick={() => scrollToSection("about")}>
              About
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setWaitlistOpen(true)}
              className="rounded-2xl border border-white/20 bg-white px-5 py-3 text-sm font-medium text-black transition hover:scale-105"
            >
              Join Waitlist
            </button>

            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="lg:hidden"
            >
              {mobileMenu ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="border-t border-white/10 bg-black/95 px-6 py-6 backdrop-blur-2xl lg:hidden">
            <div className="flex flex-col gap-5 text-lg">
              <button onClick={() => scrollToSection("platform")}>
                Platform
              </button>

              <button onClick={() => scrollToSection("science")}>
                Science
              </button>

              <button onClick={() => scrollToSection("membership")}>
                Memberships
              </button>

              <button onClick={() => scrollToSection("about")}>
                About
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Waitlist Modal */}
      {waitlistOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-10"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-semibold">
                  Join Aeonvera
                </h2>

                <p className="mt-2 text-zinc-500">
                  Request early access to the platform.
                </p>
              </div>

              <button onClick={() => setWaitlistOpen(false)}>
                <X />
              </button>
            </div>

            {!submitted ? (
              <form
                onSubmit={handleWaitlistSubmit}
                className="mt-8 space-y-5"
              >
                <input
                  required
                  placeholder="Full Name"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 outline-none"
                />

                <input
                  required
                  type="email"
                  placeholder="Email Address"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 outline-none"
                />

                <textarea
                  placeholder="Longevity Goals"
                  className="h-32 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 outline-none"
                />

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-white px-6 py-4 font-semibold text-black"
                >
                  Request Access
                </button>
              </form>
            ) : (
              <div className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-8 text-center text-emerald-300">
                Your request has been submitted.
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Hero */}
      <section
        id="hero"
        className="relative flex min-h-screen items-center justify-center px-6 pt-40"
      >
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid items-center gap-24 lg:grid-cols-2">
            {/* Left Side */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-zinc-300 backdrop-blur-xl">
                <Sparkles size={16} />
                AI-Native Longevity Intelligence
              </div>

              <h1 className="mt-8 text-6xl font-semibold leading-[0.92] tracking-tight md:text-8xl">
                Extend
                <br />
                Human
                <span className="bg-gradient-to-r from-white via-zinc-300 to-zinc-600 bg-clip-text text-transparent">
                  {" "}
                  Healthspan
                </span>
              </h1>

              <p className="mt-8 max-w-2xl text-xl leading-relaxed text-zinc-400 md:text-2xl">
                Predict biological decline before symptoms emerge and optimize
                human performance with adaptive AI-driven longevity protocols.
              </p>

              <div className="mt-12 flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={() => setWaitlistOpen(true)}
                  className="group flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-5 text-lg font-medium text-black transition duration-300 hover:scale-105"
                >
                  Request Early Access

                  <ChevronRight className="transition group-hover:translate-x-1" />
                </button>

                <button
                  onClick={() => scrollToSection("platform")}
                  className="rounded-2xl border border-white/10 bg-white/5 px-8 py-5 text-lg font-medium text-white backdrop-blur-xl transition hover:bg-white/10"
                >
                  View Platform
                </button>
              </div>
            </motion.div>

            {/* Dashboard */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1 }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-white/20 to-transparent blur-3xl" />

              <div className="relative rounded-[3rem] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                  <div>
                    <div className="text-sm text-zinc-500">
                      Biological Age
                    </div>

                    <div className="mt-2 text-7xl font-semibold">
                      29.4
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-emerald-300">
                    -5.2 Years
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  {[
                    {
                      Icon: Activity,
                      label: "Recovery",
                    },
                    {
                      Icon: Brain,
                      label: "Cognition",
                    },
                    {
                      Icon: Moon,
                      label: "Sleep",
                    },
                    {
                      Icon: Shield,
                      label: "Immunity",
                    },
                  ].map(({ Icon, label }) => (
                    <div
                      key={label}
                      className="rounded-3xl border border-white/10 bg-black/40 p-5"
                    >
                      <Icon className="text-zinc-300" />

                      <div className="mt-4 text-zinc-400">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Platform */}
      <section id="platform" className="px-6 py-32">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-5xl font-semibold md:text-7xl">
            Your AI-Powered Longevity Operating System
          </h2>
        </div>
      </section>

      {/* Science */}
      <section
        id="science"
        className="border-y border-white/10 bg-zinc-950/60 px-6 py-32"
      >
        <div className="mx-auto max-w-7xl">
          <h2 className="text-5xl font-semibold md:text-7xl">
            Predictive Biology Intelligence
          </h2>
        </div>
      </section>

      {/* Membership */}
      <section id="membership" className="px-6 py-32">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="text-5xl font-semibold md:text-7xl">
            Choose Your Longevity Tier
          </h2>

          <div className="mt-20 grid gap-8 lg:grid-cols-3">
            {[
              {
                name: "Core",
                price: "$49/mo",
              },
              {
                name: "Elite",
                price: "$199/mo",
              },
              {
                name: "Sovereign",
                price: "$999/yr",
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className="rounded-[2rem] border border-white/10 bg-white/5 p-10"
              >
                <div className="text-3xl font-semibold">
                  {tier.name}
                </div>

                <div className="mt-4 text-5xl font-bold">
                  {tier.price}
                </div>

                <button
                  onClick={() => setWaitlistOpen(true)}
                  className="mt-10 w-full rounded-2xl bg-white px-6 py-4 font-medium text-black"
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        id="about"
        className="border-t border-white/10 px-6 py-12"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <div className="text-2xl font-semibold tracking-tight">
              Aeonvera
            </div>

            <div className="mt-2 text-zinc-500">
              AI-Powered Longevity Intelligence
            </div>
          </div>

          <div className="flex gap-8 text-zinc-400">
            <button onClick={() => scrollToSection("platform")}>
              Platform
            </button>

            <button onClick={() => scrollToSection("science")}>
              Science
            </button>

            <button onClick={() => scrollToSection("membership")}>
              Memberships
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
