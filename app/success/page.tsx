"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 4000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">

        <p className="text-zinc-500 uppercase tracking-[0.3em] mb-6">
          AEONVERA
        </p>

        <h1 className="text-5xl font-light mb-6">
          Subscription Activated
        </h1>

        <p className="text-zinc-400">
          Synchronizing subscription systems...
        </p>

      </div>
    </main>
  );
}