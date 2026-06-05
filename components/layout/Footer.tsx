import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/60 backdrop-blur-xl mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

          {/* Brand */}
          <div className="tracking-[0.25em] text-sm font-semibold">
            AEONVERA
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-6 text-sm text-white/50">
            <Link href="/pricing" className="hover:text-white transition">
              Pricing
            </Link>
            <Link href="/dashboard" className="hover:text-white transition">
              Dashboard
            </Link>
            <Link href="/assessment" className="hover:text-white transition">
              Assessment
            </Link>
            <Link href="/report" className="hover:text-white transition">
              Report
            </Link>
          </div>

          {/* Legal */}
          <div className="text-xs text-white/30">
            © {new Date().getFullYear()} AEONVERA. All rights reserved.
          </div>

        </div>

      </div>
    </footer>
  );
}