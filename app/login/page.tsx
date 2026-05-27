"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = getSupabase();

  const mode = searchParams.get("mode");

  const [isSignUp, setIsSignUp] = useState(mode === "signup");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIsSignUp(mode === "signup");
  }, [mode]);

  async function handleAuth() {
    if (!email || !password) {
      setMessage("Please enter email and password");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage(
          "Account created successfully. Please check your email."
        );

        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error(err);
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />

      <div className="relative z-10 w-full max-w-md bg-zinc-950/90 border border-white/10 rounded-[2rem] p-10 backdrop-blur-xl">
        <div className="mb-10 text-center">
          <p className="uppercase tracking-[0.3em] text-zinc-500 text-sm mb-4">
            AEONVERA
          </p>

          <h1 className="text-5xl font-bold mb-4">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>

          <p className="text-zinc-400 text-lg">
            {isSignUp
              ? "Begin your longevity intelligence profile."
              : "Sign in to access the platform."}
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 outline-none focus:border-white/30"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 outline-none focus:border-white/30"
          />

          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-white text-black rounded-2xl py-4 font-semibold hover:bg-zinc-200 transition disabled:opacity-60"
          >
            {loading
              ? "Loading..."
              : isSignUp
              ? "Create Account"
              : "Sign In"}
          </button>

          <button
            onClick={() => {
              router.push(
                isSignUp
                  ? "/login?mode=signin"
                  : "/login?mode=signup"
              );
            }}
            className="w-full text-zinc-400 hover:text-white transition text-sm pt-2"
          >
            {isSignUp
              ? "Already have an account? Sign In"
              : "Need an account? Create one"}
          </button>

          {message && (
            <div className="pt-4 text-center text-sm text-zinc-400">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}