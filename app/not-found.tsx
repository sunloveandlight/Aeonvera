import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[72vh] flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
      <p className="text-eyebrow">404</p>
      <h1 className="mt-5 text-5xl md:text-6xl font-semibold tracking-tight text-white">
        This page drifted off.
      </h1>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-white/60">
        The page you&rsquo;re looking for doesn&rsquo;t exist, or it may have moved.
      </p>
      <Link
        href="/"
        className="premium-action mt-9 inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-medium"
      >
        Back to home
      </Link>
    </main>
  );
}
