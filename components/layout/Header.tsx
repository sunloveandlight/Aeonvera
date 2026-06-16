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
    label: "Overview",
    href: "/about",
    primary: [
      {
        href: "/about",
        label: "Aeonvera Overview",
        description: "Private longevity intelligence, explained simply.",
      },
      {
        href: "/optimization",
        label: "Optimization",
        description: "Turn signals into protocols and daily execution.",
      },
      {
        href: "/assessment",
        label: "Assessment",
        description: "Start with your biological-age baseline.",
      },
    ],
    secondary: [
      { href: "/data-sources", label: "Data Sources" },
      { href: "/report", label: "Reports" },
      { href: "/physician-export", label: "Physician Export" },
    ],
  },
  {
    label: "Assessment",
    href: "/assessment",
    primary: [
      {
        href: "/assessment",
        label: "Start Assessment",
        description: "Create your first biological-age baseline.",
      },
      {
        href: "/login?mode=signup",
        label: "Create Account",
        description: "Save your results in a private workspace.",
      },
      {
        href: "/optimization",
        label: "Optimization Preview",
        description: "See how assessment becomes a protocol.",
      },
    ],
    secondary: [
      { href: "/pricing", label: "Compare Plans" },
      { href: "/about", label: "How It Works" },
    ],
  },
  {
    label: "Twin",
    href: "/digital-twin",
    primary: [
      {
        href: "/digital-twin",
        label: "Digital Twin",
        description: "A living model of your health state.",
      },
      {
        href: "/companion",
        label: "AI Companion",
        description: "Ask, plan, simplify, and move through Aeonvera.",
      },
      {
        href: "/memory",
        label: "Memory",
        description: "Preferences and context that make coaching sharper.",
      },
    ],
    secondary: [
      { href: "/life-os", label: "Life OS" },
      { href: "/plan", label: "Plan" },
      { href: "/dashboard", label: "Today" },
    ],
  },
  {
    label: "Care",
    href: "/network",
    primary: [
      {
        href: "/network",
        label: "Care Network",
        description: "Invite physicians, coaches, and family safely.",
      },
      {
        href: "/physician-export",
        label: "Physician Export",
        description: "Prepare a clinical packet or share link.",
      },
      {
        href: "/report",
        label: "Longevity Report",
        description: "Turn your model into a readable health narrative.",
      },
    ],
    secondary: [
      { href: "/settings", label: "Privacy Controls" },
      { href: "/data-sources", label: "Connected Data" },
      { href: "/companion", label: "Ask Aeonvera" },
    ],
  },
  {
    label: "Data",
    href: "/data-sources",
    primary: [
      {
        href: "/data-sources",
        label: "Connected Data",
        description: "Wearables, labs, Apple Health imports, and recovery.",
      },
      {
        href: "/report",
        label: "Reports",
        description: "Readable summaries for decisions and care teams.",
      },
      {
        href: "/physician-export",
        label: "Clinical Packet",
        description: "Prepare a physician-ready export.",
      },
    ],
    secondary: [
      { href: "/optimization", label: "Optimization" },
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
        label: "Compare Plans",
        description: "Core, Elite, and Sovereign.",
      },
      {
        href: "/login?mode=signup",
        label: "Begin",
        description: "Create your private longevity account.",
      },
      {
        href: "/login?mode=signin",
        label: "Sign In",
        description: "Return to your Aeonvera workspace.",
      },
    ],
    secondary: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
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
        label: "Today Briefing",
        description: "The most important signal and action now.",
      },
      {
        href: "/plan",
        label: "Plan",
        description: "Protocols, reminders, and execution.",
      },
      {
        href: "/companion",
        label: "Ask Aeonvera",
        description: "Voice and text help across the site.",
      },
    ],
    secondary: [
      { href: "/optimization", label: "Optimization" },
      { href: "/assessment", label: "Assessment" },
      { href: "/report", label: "Report" },
    ],
  },
  {
    label: "Plan",
    href: "/plan",
    primary: [
      {
        href: "/plan",
        label: "Protocol Plan",
        description: "Your daily actions and longer-term protocol.",
      },
      {
        href: "/optimization",
        label: "Optimization",
        description: "Generate and refine protocols.",
      },
      {
        href: "/assessment",
        label: "Update Assessment",
        description: "Refresh your baseline and context.",
      },
    ],
    secondary: [
      { href: "/dashboard", label: "Today" },
      { href: "/companion", label: "Ask Aeonvera" },
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
        href: "/data-sources",
        label: "Data Sources",
        description: "Oura, wearables, labs, and imports.",
      },
    ],
    secondary: [
      { href: "/memory", label: "Memory" },
      { href: "/report", label: "Reports" },
      { href: "/settings", label: "Preferences" },
    ],
  },
  {
    label: "Data",
    href: "/data-sources",
    primary: [
      {
        href: "/data-sources",
        label: "Data Sources",
        description: "Connect Oura, Apple Health, labs, and imports.",
      },
      {
        href: "/report",
        label: "Reports",
        description: "Generate and review healthspan summaries.",
      },
      {
        href: "/memory",
        label: "Memory",
        description: "Preferences that make coaching more personal.",
      },
    ],
    secondary: [
      { href: "/settings", label: "Notifications" },
      { href: "/digital-twin", label: "Digital Twin" },
      { href: "/life-os", label: "Life OS" },
    ],
  },
  {
    label: "Care",
    href: "/network",
    primary: [
      {
        href: "/network",
        label: "Care Network",
        description: "Invite and manage access.",
      },
      {
        href: "/physician-export",
        label: "Physician Export",
        description: "Clinical packets and share links.",
      },
      {
        href: "/report",
        label: "Clinical Report",
        description: "Summaries ready for review.",
      },
    ],
    secondary: [
      { href: "/settings", label: "Sharing Settings" },
      { href: "/data-sources", label: "Data Connections" },
    ],
  },
  {
    label: "Membership",
    href: "/pricing",
    primary: [
      {
        href: "/pricing",
        label: "Membership",
        description: "Upgrade, downgrade, or manage billing.",
      },
      {
        href: "/settings",
        label: "Account Settings",
        description: "Voice, notifications, privacy, and profile.",
      },
    ],
    secondary: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
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
          className="group inline-flex items-center gap-2.5 text-[0.69rem] font-medium tracking-[0.18em] text-white/86 transition-colors duration-300 hover:text-white"
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
            className="premium-icon-link hidden size-8 items-center justify-center rounded-md text-white/64 transition hover:text-white/92 sm:inline-flex"
            aria-label="Search or ask Aeonvera"
          >
            <Search size={15} />
          </Link>
          <ThemeToggle className="premium-theme-toggle" />
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="premium-icon-link inline-flex size-9 items-center justify-center rounded-md text-white/70 md:hidden"
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
                <div className="premium-account-menu absolute right-0 top-11 w-64 rounded-xl p-2" role="menu">
                  {AUTH_NAV_GROUPS.flatMap((group) => group.primary.slice(0, 1)).map((item) => (
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
          <div className="mx-auto grid max-w-5xl grid-cols-[1.3fr_1fr] gap-10 px-8 py-8">
            <div>
              <p className="premium-mega-label">Explore {activeGroup.label}</p>
              <div className="mt-4 grid gap-1">
                {activeGroup.primary.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setActiveMenu(null)}
                    className="premium-mega-primary rounded-xl px-3 py-3"
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
        <div className="premium-mobile-menu border-t border-white/[0.08] px-6 py-5 backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-xs font-semibold text-white/42">{group.label}</p>
                <div className="grid gap-1">
                  {[...group.primary, ...group.secondary].slice(0, 5).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-1 py-1.5 text-xl font-semibold tracking-[-0.02em] text-white/86"
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
                className="rounded-lg px-1 py-2 text-left text-xl font-semibold tracking-[-0.02em] text-white/62"
                type="button"
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/login?mode=signin"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-1 py-2 text-xl font-semibold tracking-[-0.02em] text-white/86"
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
