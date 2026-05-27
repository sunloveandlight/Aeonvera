"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const supabase = getSupabase();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [isSignUp, setIsSignUp] = useState(false);

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
          "Account created successfully. Check your email to confirm your account."
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
      <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-10">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold mb-3">Aeonvera</h1>

          <p className="text-zinc-400 text-lg">
            {isSignUp
              ? "Create your account"
              : "Sign in to your account"}
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
            onClick={() => setIsSignUp(!isSignUp)}
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