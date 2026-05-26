"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState("Verifying payment...");

  useEffect(() => {
    if (sessionId) {
      // Optional: Verify session on server later
      setTimeout(() => {
        setStatus("Payment successful! Welcome to Aeonvera.");
        setTimeout(() => router.push("/"), 2500);
      }, 1500);
    }
  }, [sessionId, router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl mb-6">🎉</h1>
        <h2 className="text-4xl font-semibold mb-4">Thank You!</h2>
        <p className="text-xl text-zinc-400">{status}</p>
      </div>
    </div>
  );
}