"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div />}>
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
      // -------------------------
      // SIGN UP FLOW
      // -------------------------
      if (isSignUpMode) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          setLoading(false);
          return;
        }

        setMessage("Account created. Redirecting...");

        setTimeout(() => {
          router.replace("/pricing");
        }, 800);

        setLoading(false);
        return;
      }

      // -------------------------
      // LOGIN FLOW
      // -------------------------
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      // 🔥 CRITICAL FIX:
      // Wait for Supabase to actually resolve session via cookie sync
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Login succeeded but session failed to initialize.");
        setLoading(false);
        return;
      }

      setMessage("Login successful. Redirecting...");

      // small delay ensures middleware + cookie sync catches up
      setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 300);
    } catch (err: any) {
      console.error("Login crash:", err);
      setMessage("Unexpected error during login.");
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
              ? "Signing in..."
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