"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, UserCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import ThemeToggle from "./ThemeToggle";

type NavLink = {
  href: string;
  label: string;
  description?: string;
};

type NavGroup = {
  label: string;
  href: string;
  primary: NavLink[];
  secondary: NavLink[];
};

const PUBLIC_NAV_GROUPS: NavGroup[] = [
  {
    label: "Platform",
    href: "/about",
    primary: [
      {
        href: "/about",
        label: "How Aeonvera works",
        description: "Private longevity intelligence, explained simply.",
      },
      {
        href: "/companion",
        label: "Assistant",
        description: "Voice and text help across Aeonvera.",
      },
      {
        href: "/digital-twin",
        label: "Digital Twin",
        description: "A living model of your health state.",
      },
    ],
    secondary: [
      { href: "/optimization", label: "Optimization" },
      { href: "/data-sources", label: "Data Sources" },
    ],
  },
  {
    label: "Assess",
    href: "/assessment",
    primary: [
      {
        href: "/assessment",
        label: "Start assessment",
        description: "Begin with your biological-age baseline.",
      },
      {
        href: "/login?mode=signup",
        label: "Create account",
        description: "Save your results in a private workspace.",
      },
    ],
    secondary: [{ href: "/login?mode=signin", label: "Sign in" }],
  },
  {
    label: "Twin",
    href: "/digital-twin",
    primary: [
      {
        href: "/digital-twin",
        label: "Digital Twin",
        description: "Signals, protocols, outcomes, and timeline.",
      },
      {
        href: "/life-os",
        label: "Life OS",
        description: "Priorities, trajectory, and life domains.",
      },
    ],
    secondary: [
      { href: "/memory", label: "Memory" },
      { href: "/report", label: "Report" },
    ],
  },
  {
    label: "Optimize",
    href: "/optimization",
    primary: [
      {
        href: "/optimization",
        label: "Optimization",
        description: "Turn your signals into a daily protocol.",
      },
      {
        href: "/plan",
        label: "Daily plan",
        description: "Make insight executable.",
      },
    ],
    secondary: [
      { href: "/data-sources", label: "Connect data" },
      { href: "/companion", label: "Ask Aeonvera" },
    ],
  },
  {
    label: "Reports",
    href: "/report",
    primary: [
      {
        href: "/report",
        label: "Longevity report",
        description: "Readable summaries for progress and decisions.",
      },
      {
        href: "/physician-export",
        label: "Physician export",
        description: "Clinical packets and share links.",
      },
    ],
    secondary: [
      { href: "/network", label: "Care Network" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
  {
    label: "Pricing",
    href: "/pricing",
    primary: [
      {
        href: "/pricing",
        label: "Compare plans",
        description: "Core, Elite, and Sovereign.",
      },
      {
        href: "/login?mode=signup",
        label: "Begin",
        description: "Create an account and choose your level.",
      },
    ],
    secondary: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
  {
    label: "Privacy",
    href: "/privacy",
    primary: [
      {
        href: "/privacy",
        label: "Privacy",
        description: "How sensitive health data is handled.",
      },
      {
        href: "/terms",
        label: "Terms",
        description: "Membership, account, and platform terms.",
      },
    ],
    secondary: [
      { href: "/login?mode=signin", label: "Sign in" },
      { href: "/login?mode=signup", label: "Create account" },
    ],
  },
];

const AUTH_NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    href: "/dashboard",
    primary: [
      {
        href: "/dashboard",
        label: "Today",
        description: "Your most important signal and next action.",
      },
      {
        href: "/companion",
        label: "Ask Aeonvera",
        description: "Voice and text help across the app.",
      },
      {
        href: "/optimization",
        label: "Optimization",
        description: "Refine the protocol from your latest state.",
      },
    ],
    secondary: [
      { href: "/plan", label: "Plan" },
      { href: "/report", label: "Report" },
    ],
  },
  {
    label: "Twin",
    href: "/digital-twin",
    primary: [
      {
        href: "/digital-twin",
        label: "Digital Twin",
        description: "Signals, protocols, outcomes, and timeline.",
      },
      {
        href: "/life-os",
        label: "Life OS",
        description: "Priorities, trajectory, and life domains.",
      },
      {
        href: "/memory",
        label: "Memory",
        description: "Context that makes coaching sharper.",
      },
    ],
    secondary: [{ href: "/assessment", label: "Assessment" }],
  },
  {
    label: "Plan",
    href: "/plan",
    primary: [
      {
        href: "/plan",
        label: "Plan",
        description: "Protocols, reminders, and next actions.",
      },
      {
        href: "/optimization",
        label: "Optimization",
        description: "Generate or refine your protocol.",
      },
      {
        href: "/companion",
        label: "Simplify with Aeonvera",
        description: "Adjust the plan by voice or text.",
      },
    ],
    secondary: [
      { href: "/dashboard", label: "Today" },
      { href: "/life-os", label: "Life OS" },
    ],
  },
  {
    label: "Data",
    href: "/data-sources",
    primary: [
      {
        href: "/data-sources",
        label: "Data Sources",
        description: "Oura, Apple Health, labs, and imports.",
      },
      {
        href: "/report",
        label: "Reports",
        description: "Readable healthspan summaries.",
      },
      {
        href: "/physician-export",
        label: "Physician Export",
        description: "Prepare a clinical packet or share link.",
      },
    ],
    secondary: [{ href: "/network", label: "Care Network" }],
  },
  {
    label: "Reports",
    href: "/report",
    primary: [
      {
        href: "/report",
        label: "Report",
        description: "Your current healthspan summary.",
      },
      {
        href: "/physician-export",
        label: "Physician Export",
        description: "Clinical packets and share links.",
      },
      {
        href: "/future-self/demo",
        label: "Future Self",
        description: "Scenario views and shareable projections.",
      },
    ],
    secondary: [
      { href: "/digital-twin", label: "Digital Twin" },
      { href: "/data-sources", label: "Data Sources" },
    ],
  },
  {
    label: "Network",
    href: "/network",
    primary: [
      {
        href: "/network",
        label: "Care Network",
        description: "Invite family, clinicians, and support partners.",
      },
      {
        href: "/physician-export",
        label: "Physician Share",
        description: "Create clinical context without exposing the whole account.",
      },
    ],
    secondary: [
      { href: "/settings", label: "Settings" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
  {
    label: "Pricing",
    href: "/pricing",
    primary: [
      {
        href: "/pricing",
        label: "Membership",
        description: "Upgrade, downgrade, or compare plan levels.",
      },
      {
        href: "/settings",
        label: "Account Settings",
        description: "Manage profile, preferences, and billing context.",
      },
    ],
    secondary: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

const ACCOUNT_LINKS: NavLink[] = [
  { href: "/settings", label: "Settings" },
  { href: "/pricing", label: "Membership" },
  { href: "/data-sources", label: "Data Sources" },
  { href: "/report", label: "Report" },
];

export default function Header() {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<{ label: string; pathname: string } | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session);
      setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user);
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accountOpen && !activeMenu) return;

    function handlePointerDown(event: PointerEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
        setActiveMenu(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setActiveMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen, activeMenu]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const navGroups = authenticated ? AUTH_NAV_GROUPS : PUBLIC_NAV_GROUPS;
  const activeMenuLabel = activeMenu?.pathname === pathname ? activeMenu.label : null;
  const activeGroup = navGroups.find((group) => group.label === activeMenuLabel) || null;

  function showMenu(label: string) {
    setActiveMenu({ label, pathname });
  }

  function toggleMenu(label: string) {
    setActiveMenu((current) =>
      current?.label === label && current.pathname === pathname ? null : { label, pathname },
    );
  }

  return (
    <header
      ref={headerRef}
      className="premium-header fixed inset-x-0 top-0 z-50"
      onMouseLeave={() => setActiveMenu(null)}
    >
      <div className="mx-auto flex h-11 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link
          href="/"
          onClick={() => {
            setAccountOpen(false);
            setActiveMenu(null);
            setMobileOpen(false);
          }}
          className="group inline-flex items-center gap-2.5 text-[0.69rem] font-medium tracking-[0.18em] transition-colors duration-300"
          data-premium-brand
        >
          <span className="brand-mark" aria-hidden />
          <span>AEONVERA</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary navigation">
          {navGroups.map((group) => {
            const active = isActive(pathname, group.href);
            const expanded = activeMenuLabel === group.label;

            return (
              <button
                key={group.label}
                type="button"
                onMouseEnter={() => showMenu(group.label)}
                onFocus={() => showMenu(group.label)}
                onClick={() => toggleMenu(group.label)}
                className={`premium-nav-link ${active || expanded ? "premium-nav-link-active" : ""}`}
                aria-expanded={expanded}
                aria-haspopup="true"
              >
                {group.label}
              </button>
            );
          })}
        </nav>

        <div className="flex h-8 items-center gap-2">
          <Link
            href="/companion"
            className="premium-icon-link hidden size-8 items-center justify-center rounded-md transition sm:inline-flex"
            aria-label="Search or ask Aeonvera"
          >
            <Search size={15} />
          </Link>
          <ThemeToggle className="premium-theme-toggle" />
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="premium-icon-link inline-flex size-9 items-center justify-center rounded-md md:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            type="button"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {!authChecked ? (
            <div className="hidden h-8 w-20 rounded-md bg-white/[0.08] sm:block" />
          ) : authenticated ? (
            <div className="relative hidden sm:block" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setAccountOpen((open) => !open);
                  setActiveMenu(null);
                }}
                className={`premium-account-trigger inline-flex size-8 items-center justify-center rounded-md transition ${
                  accountOpen ? "premium-account-trigger-open" : ""
                }`}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
              >
                <UserCircle size={15} />
              </button>
              {accountOpen ? (
                <div className="premium-account-menu absolute right-0 top-11 w-56 rounded-xl p-2" role="menu">
                  {ACCOUNT_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAccountOpen(false)}
                      className="premium-menu-link block rounded-lg px-3 py-2.5"
                      role="menuitem"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      setAccountOpen(false);
                      void handleLogout();
                    }}
                    className="premium-menu-link mt-1 block w-full rounded-lg px-3 py-2.5 text-left"
                    type="button"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Link
                href="/login?mode=signin"
                onClick={() => setActiveMenu(null)}
                className="hidden h-8 items-center text-xs font-medium leading-none text-white/62 transition-colors duration-300 hover:text-white/90 sm:inline-flex"
              >
                Sign In
              </Link>
              <Link
                href="/login?mode=signup"
                onClick={() => setActiveMenu(null)}
                className="premium-nav-action px-4 text-xs font-medium leading-none transition"
              >
                Begin
              </Link>
            </>
          )}
        </div>
      </div>

      {activeGroup ? (
        <div className="premium-mega-menu hidden md:block">
          <div className="mx-auto grid max-w-7xl grid-cols-[1.3fr_1fr] gap-10 px-8 py-8">
            <div>
              <p className="premium-mega-label">Explore {activeGroup.label}</p>
              <div className="mt-4 grid gap-1">
                {activeGroup.primary.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setActiveMenu(null)}
                    className="premium-mega-primary rounded-xl px-3 py-2.5"
                  >
                    <span>{item.label}</span>
                    {item.description ? <small>{item.description}</small> : null}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="premium-mega-label">Go directly to</p>
              <div className="mt-4 grid gap-1">
                {activeGroup.secondary.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setActiveMenu(null)}
                    className="premium-mega-secondary rounded-lg px-3 py-2"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="premium-mobile-menu border-t px-6 py-5 md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="premium-mega-label mb-2">{group.label}</p>
                <div className="grid gap-0.5">
                  {[...group.primary, ...group.secondary].slice(0, 5).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-1 py-1.5 text-lg font-medium tracking-[-0.01em]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {!authChecked ? null : authenticated ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  void handleLogout();
                }}
                className="rounded-lg px-1 py-2 text-left text-lg font-medium tracking-[-0.01em]"
                type="button"
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/login?mode=signin"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-1 py-2 text-lg font-medium tracking-[-0.01em]"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
