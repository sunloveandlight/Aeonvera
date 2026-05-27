"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function SuccessPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your payment...");

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setMessage("Payment successful! Redirecting...");
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        setMessage("Payment received! Please log in to continue.");
        setTimeout(() => router.push("/login"), 2000);
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Success</h1>
        <p className="text-zinc-400">{message}</p>
      </div>
    </div>
  );
}