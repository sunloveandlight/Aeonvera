"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <main className="min-h-screen text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-white/[0.07] bg-white/[0.02] backdrop-blur-xl rounded-3xl p-10">

        <p className="text-[10px] uppercase tracking-[0.5em] text-white/25 mb-4">
          Aeonvera
        </p>

        <h1 className="text-3xl font-light tracking-tight text-white/90 mb-8">
          {isSignUpMode ? "Create Account" : "Welcome Back"}
        </h1>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white/80 placeholder-white/20 focus:outline-none focus:border-[rgba(212,175,55,0.3)] transition-all duration-300 text-sm"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white/80 placeholder-white/20 focus:outline-none focus:border-[rgba(212,175,55,0.3)] transition-all duration-300 text-sm"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl border border-[rgba(212,175,55,0.3)] text-[rgba(212,175,55,0.8)] hover:border-[rgba(212,175,55,0.6)] hover:text-[rgba(212,175,55,1)] transition-all duration-300 text-[11px] uppercase tracking-[0.3em] disabled:opacity-30"
          >
            {loading ? "Processing..." : isSignUpMode ? "Create Account" : "Sign In"}
          </button>
        </form>

        {message && (
          <div className="mt-4 text-xs border border-white/[0.06] p-3 rounded-xl text-white/40 tracking-wide">
            {message}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-white/25 tracking-wide">
          {isSignUpMode ? (
            <p>
              Already have an account?{" "}
              <a href="/login" className="text-white/50 hover:text-white/80 transition-colors duration-300">
                Sign in
              </a>
            </p>
          ) : (
            <p>
              Don't have an account?{" "}
              <a href="/login?mode=signup" className="text-white/50 hover:text-white/80 transition-colors duration-300">
                Create one
              </a>
            </p>
          )}
        </div>

      </div>
    </main>
  );
}