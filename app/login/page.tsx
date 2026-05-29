"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const isSignUpMode = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  // Global auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔄 Auth event:", event, session ? "HAS SESSION" : "NO SESSION");

      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        console.log("✅ Redirecting to dashboard");
        router.replace("/dashboard");
        router.refresh();   // Forces server to re-check middleware
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isSignUpMode) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
      setMessage("Account created. Redirecting to pricing...");
      setTimeout(() => router.replace("/pricing"), 1000);
      return;
    }

    // === LOGIN ===
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setMessage("Login successful → Redirecting...");
      router.replace("/dashboard");
      router.refresh();
    } else {
      setMessage("Login done but no session returned.");
    }

    setLoading(false);
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
            {loading ? "Signing in..." : isSignUpMode ? "Create Account" : "Sign In"}
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