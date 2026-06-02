"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/auth/ensureProfile";
import { isUserAllowed } from "@/lib/auth/permissions";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        if (data.user) {
          await ensureProfile(data.user.id);
        }

        setMessage("Account created successfully!");
        router.replace("/onboarding"); // New users → onboarding
        return;
      }

      // ====================== LOGIN ======================
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Login failed");
        return;
      }

      await ensureProfile(data.user.id);

      // Get fresh profile to decide where to send user
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
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-3xl p-10">
        <h1 className="text-4xl font-light mb-6">
          {isSignUpMode ? "Create Account" : "Welcome Back"}
        </h1>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : isSignUpMode
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        {message && (
          <div className="mt-4 text-sm border border-white/10 p-3 rounded-xl text-white/80">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}