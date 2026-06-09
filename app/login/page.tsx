"use client";

import { FormEvent, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/auth/ensureProfile";
import { isUserAllowed } from "@/lib/auth/permissions";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08070a]" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode");
  const isSignUpMode = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUpMode) {
        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
          setMessage(error.message);
          return;
        }

        if (data.user) {
          await ensureProfile(data.user.id);
        }

        setMessage("Account created successfully!");
        router.replace("/onboarding");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Login failed");
        return;
      }

      await ensureProfile(data.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, plan, subscription_status")
        .eq("user_id", data.user.id)
        .maybeSingle();

      setMessage("Login successful. Redirecting...");

      if (!profile?.onboarding_completed) {
        router.replace("/onboarding");
      } else if (isUserAllowed(profile.plan, profile.subscription_status)) {
        router.replace("/dashboard");
      } else {
        router.replace("/pricing");
      }
    } catch (err) {
      console.error(err);
      setMessage("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16 text-white">
      <div className="premium-surface grid w-full max-w-5xl rounded-lg md:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden border-r border-white/10 bg-black/20 p-8 md:block">
          <div className="flex size-11 items-center justify-center rounded-md bg-[rgb(236,220,184)] text-black">
            <LockKeyhole size={20} />
          </div>
          <h1 className="mt-10 text-4xl font-semibold tracking-normal text-white">
            {isSignUpMode ? "Create your private health workspace." : "Welcome back to Aeonvera."}
          </h1>
          <p className="mt-5 text-sm leading-7 text-white/52">
            Access your biological age model, assessment history, and generated longevity reports.
          </p>
          <div className="mt-10 rounded-md border border-[rgba(236,220,184,0.14)] bg-[rgba(236,220,184,0.035)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-sm font-medium text-[rgba(236,220,184,0.72)]">Protected workspace</p>
            <p className="mt-1 text-sm text-white/50">
              Authentication is handled through Supabase with account-specific profile routing.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10">

        <p className="mb-4 text-xs uppercase tracking-normal text-[rgba(236,220,184,0.72)]">
          Aeonvera
        </p>

        <h2 className="mb-8 text-3xl font-semibold tracking-normal text-white">
          {isSignUpMode ? "Create Account" : "Welcome Back"}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-sm text-white/85 placeholder-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition focus:border-[rgba(212,175,55,0.38)] focus:outline-none"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-sm text-white/85 placeholder-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition focus:border-[rgba(212,175,55,0.38)] focus:outline-none"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="premium-button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition hover:brightness-95 disabled:opacity-45"
          >
            {loading ? "Processing..." : isSignUpMode ? "Create Account" : "Sign In"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {message && (
          <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-sm text-white/55">
            {message}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-white/45">
          {isSignUpMode ? (
            <p>
              Already have an account?{" "}
              <Link href="/login" className="text-white/75 transition-colors duration-300 hover:text-white">
                Sign in
              </Link>
            </p>
          ) : (
            <p>
              Don&apos;t have an account?{" "}
              <Link href="/login?mode=signup" className="text-white/75 transition-colors duration-300 hover:text-white">
                Create one
              </Link>
            </p>
          )}
        </div>

        </div>
      </div>
    </main>
  );
}
