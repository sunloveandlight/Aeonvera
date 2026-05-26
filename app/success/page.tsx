"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = "https://aeonvera.com";
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Payment Successful
        </h1>

        <p className="text-zinc-400 mb-2">
          Thank you for your purchase.
        </p>

        <p className="text-zinc-500 text-sm">
          Redirecting back to website...
        </p>

        {sessionId && (
          <p className="text-xs text-zinc-600 mt-4">
            Session ID: {sessionId}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}