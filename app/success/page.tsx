"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your payment...");

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setMessage("Payment successful! Redirecting to dashboard...");
          setTimeout(() => router.push("/dashboard"), 2000);
        } else {
          setMessage("Payment received! Please log in.");
          setTimeout(() => router.push("/login"), 2000);
        }
      } catch (err) {
        setMessage("Something went wrong. Please log in.");
        setTimeout(() => router.push("/login"), 2000);
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Success</h1>
        <p className="text-zinc-400">{message}</p>
      </div>
    </div>
  );
}