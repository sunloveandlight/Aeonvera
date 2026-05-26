"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Missing Supabase env vars");
    }

    return createClient(url, key);
  }

  async function handleSignup() {
    setLoading(true);

    try {
      const supabase = await getSupabase();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: data.user.email,
        });
      }

      router.push("/dashboard");
    } catch (err: any) {
      alert(err.message);
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-4 p-6 bg-white rounded-xl shadow">
        <h1 className="text-3xl font-bold">Create Account</h1>

        <input
          className="w-full border p-2 rounded"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="w-full bg-black text-white p-2 rounded disabled:opacity-50"
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </div>
    </main>
  );
}