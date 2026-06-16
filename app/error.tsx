"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[72vh] flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
      <p className="text-eyebrow">Something went wrong</p>
      <h1 className="mt-5 text-5xl md:text-6xl font-semibold tracking-tight text-white">
        We hit a snag.
      </h1>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-white/60">
        An unexpected error occurred. You can try again, or head back home.
      </p>
      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="premium-action inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-medium"
        >
          Try again
        </button>
        <Link
          href="/"
          className="premium-action-secondary inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-medium"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
