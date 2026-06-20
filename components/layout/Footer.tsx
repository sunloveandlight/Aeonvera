"use client";

import Link from "next/link";

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { href: "/about", label: "How it works" },
      { href: "/demo", label: "Demo profile" },
      { href: "/pricing", label: "Pricing" },
      { href: "/optimization", label: "Optimization" },
      { href: "/life-autopilot", label: "Life Autopilot" },
    ],
  },
  {
    title: "Workspace",
    links: [
      { href: "/assessment", label: "Assessment" },
      { href: "/data-sources", label: "Data sources" },
      { href: "/digital-twin", label: "Digital Twin" },
      { href: "/companion", label: "Ask Aeonvera" },
    ],
  },
  {
    title: "Care",
    links: [
      { href: "/physician-export", label: "Physician export" },
      { href: "/network", label: "Care network" },
      { href: "/report", label: "Longevity report" },
      { href: "/plan", label: "Daily plan" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/login?mode=signin", label: "Sign in" },
      { href: "/login?mode=signup", label: "Create account" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="premium-footer mt-16">
      <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_2.2fr]">
          <div>
            <Link
              href="/"
              className="premium-footer-brand inline-flex items-center gap-2.5"
              aria-label="Aeonvera home"
            >
              <span className="brand-mark" aria-hidden />
              <span>AEONVERA</span>
            </Link>
            <p className="premium-footer-copy mt-4 max-w-sm text-sm leading-6">
              Private longevity intelligence for labs, wearables, biological age,
              protocols, and clinician-ready sharing.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-4" aria-label="Footer navigation">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="premium-footer-label">{group.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="premium-footer-link">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="premium-footer-bottom mt-10 flex flex-col gap-3 pt-6 md:flex-row md:items-start md:justify-between">
          <p>
            © {new Date().getFullYear()} AEONVERA. All rights reserved.
          </p>

          <p className="max-w-2xl md:text-right">
            Aeonvera provides health intelligence and decision support. It is
            not emergency care, diagnosis, or a replacement for your clinician.
          </p>
        </div>
      </div>
    </footer>
  );
}
