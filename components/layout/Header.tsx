"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, UserCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import ProfileSwitcher from "@/components/health-profiles/ProfileSwitcher";
import ThemeToggle from "./ThemeToggle";

type NavLink = {
  href: string;
  label: string;
  description?: string;
};

type NavGroup = {
  label: string;
  href: string;
  items: NavLink[];
};

// Every route lives in exactly one menu — no overlap.
const PUBLIC_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    href: "/about",
    items: [
      { href: "/about", label: "How Aeonvera works", description: "Private longevity intelligence, explained simply." },
      { href: "/demo", label: "Demo profile", description: "Preview Aeonvera with sample health signals." },
      { href: "/login?mode=signup", label: "Create account", description: "Start private health profiles." },
      { href: "/login?mode=signin", label: "Sign in", description: "Return to your Aeonvera account." },
    ],
  },
  {
    label: "Assess",
    href: "/assessment",
    items: [
      { href: "/assessment", label: "Start assessment", description: "Begin with your biological-age baseline." },
      { href: "/data-sources", label: "Connect your data", description: "Oura, Apple Health, labs, and imports." },
    ],
  },
  {
    label: "Twin",
    href: "/digital-twin",
    items: [
      { href: "/digital-twin", label: "Digital Twin", description: "A living model of your health state." },
      { href: "/life-os", label: "Life OS", description: "Priorities, trajectory, and life domains." },
      { href: "/memory", label: "Memory", description: "Context that makes coaching sharper." },
    ],
  },
  {
    label: "Optimize",
    href: "/optimization",
    items: [
      { href: "/optimization", label: "Optimization", description: "Turn your signals into a daily protocol." },
      { href: "/plan", label: "Daily plan", description: "Make insight executable." },
      { href: "/life-autopilot", label: "Life Autopilot", description: "Behavior reminders, quiet hours, and schedule permissions." },
      { href: "/companion", label: "Ask Aeonvera", description: "Voice and text help across the app." },
    ],
  },
  {
    label: "Reports",
    href: "/report",
    items: [
      { href: "/report", label: "Longevity report", description: "A readable summary of your healthspan." },
      { href: "/physician-export", label: "Physician export", description: "Clinical packets and secure share links." },
      { href: "/network", label: "Care network", description: "Invite physicians, coaches, and family." },
    ],
  },
  {
    label: "Pricing",
    href: "/pricing",
    items: [{ href: "/pricing", label: "Compare plans", description: "Core, Elite, and Sovereign." }],
  },
  {
    label: "Privacy",
    href: "/privacy",
    items: [
      { href: "/privacy", label: "Privacy", description: "How your sensitive health data is handled." },
      { href: "/terms", label: "Terms", description: "Membership, account, and platform terms." },
    ],
  },
];

const AUTH_NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    href: "/dashboard",
    items: [
      { href: "/dashboard", label: "Today", description: "Your most important signal and next action." },
      { href: "/companion", label: "Ask Aeonvera", description: "Voice and text help across the app." },
    ],
  },
  {
    label: "Optimize",
    href: "/optimization",
    items: [
      { href: "/optimization", label: "Optimization", description: "Generate and refine your protocol." },
      { href: "/plan", label: "Daily plan", description: "Protocols, reminders, and execution." },
      { href: "/life-autopilot", label: "Life Autopilot", description: "Coach intensity, reminders, and schedule permissions." },
      { href: "/assessment", label: "Assessment", description: "Refresh your baseline and context." },
    ],
  },
  {
    label: "Twin",
    href: "/digital-twin",
    items: [
      { href: "/digital-twin", label: "Digital Twin", description: "Signals, protocols, outcomes, and timeline." },
      { href: "/life-os", label: "Life OS", description: "Priorities, trajectory, and life domains." },
      { href: "/memory", label: "Memory", description: "Context that makes coaching sharper." },
    ],
  },
  {
    label: "Data",
    href: "/data-sources",
    items: [
      { href: "/data-sources", label: "Data Sources", description: "Oura, Apple Health, labs, and imports." },
      { href: "/report", label: "Reports", description: "Readable healthspan summaries." },
      { href: "/physician-export", label: "Physician Export", description: "Prepare a clinical packet or share link." },
    ],
  },
  {
    label: "Care",
    href: "/network",
    items: [{ href: "/network", label: "Care Network", description: "Invite and manage who can see your health." }],
  },
];

const ACCOUNT_LINKS: NavLink[] = [
  { href: "/settings", label: "Settings" },
  { href: "/pricing", label: "Membership" },
];

export default function Header() {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<{ label: string; pathname: string } | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const accountCloseTimerRef = useRef<number | null>(null);

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

    return () => {
      subscription.unsubscribe();
      clearAccountCloseTimer();
    };
  }, []);

  function clearAccountCloseTimer() {
    if (accountCloseTimerRef.current) {
      window.clearTimeout(accountCloseTimerRef.current);
      accountCloseTimerRef.current = null;
    }
  }

  function scheduleAccountClose() {
    clearAccountCloseTimer();
    accountCloseTimerRef.current = window.setTimeout(() => {
      setAccountOpen(false);
      accountCloseTimerRef.current = null;
    }, 280);
  }

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

  function openMenu(label: string) {
    setAccountOpen(false);
    setActiveMenu({ label, pathname });
  }

  return (
    <header
      ref={headerRef}
      className="premium-header fixed inset-x-0 top-0 z-50"
      onMouseLeave={() => setActiveMenu(null)}
    >
      <div className="mx-auto grid h-11 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-5 lg:px-8">
        <Link
          href="/"
          onClick={() => {
            setAccountOpen(false);
            setActiveMenu(null);
            setMobileOpen(false);
          }}
          className="group inline-flex min-h-11 justify-self-start items-center gap-2.5 text-[0.69rem] font-medium tracking-[0.18em] transition-colors duration-300"
          data-premium-brand
        >
          <span className="brand-mark" aria-hidden />
          <span>AEONVERA</span>
        </Link>

        <nav className="hidden items-center gap-0.5 justify-self-center md:flex" aria-label="Primary navigation">
          {navGroups.map((group) => {
            const active = isActive(pathname, group.href);
            const expanded = activeMenuLabel === group.label;

            return (
              <Link
                key={group.label}
                href={group.href}
                onMouseEnter={() => openMenu(group.label)}
                onFocus={() => openMenu(group.label)}
                onClick={() => setActiveMenu(null)}
                className={`premium-nav-link ${active || expanded ? "premium-nav-link-active" : ""}`}
                aria-expanded={expanded}
                aria-haspopup="true"
              >
                {group.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex min-h-11 items-center justify-end gap-1.5 justify-self-end">
          <Link
            href="/companion"
            onClick={() => {
              setAccountOpen(false);
              setActiveMenu(null);
            }}
            className="premium-icon-link hidden min-h-11 min-w-11 items-center justify-center rounded-md transition sm:inline-flex"
            aria-label="Search or ask Aeonvera"
          >
            <Search size={15} />
          </Link>
          <ThemeToggle className="premium-theme-toggle" />
          <ProfileSwitcher authenticated={authenticated} compact />
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="premium-icon-link inline-flex min-h-11 min-w-11 items-center justify-center rounded-md md:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            type="button"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {!authChecked ? (
            <div className="hidden h-8 w-20 rounded-md bg-white/[0.08] sm:block" />
          ) : authenticated ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  clearAccountCloseTimer();
                  setAccountOpen((open) => !open);
                  setActiveMenu(null);
                }}
                onMouseEnter={clearAccountCloseTimer}
                onMouseLeave={() => {
                  if (accountOpen) scheduleAccountClose();
                }}
                className={`premium-account-trigger inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition ${
                  accountOpen ? "premium-account-trigger-open" : ""
                }`}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
              >
                <UserCircle size={15} />
              </button>
              {accountOpen ? (
                <div
                  className="premium-account-menu absolute right-0 top-11 w-56 rounded-xl p-2"
                  role="menu"
                  onMouseEnter={clearAccountCloseTimer}
                  onMouseLeave={scheduleAccountClose}
                >
                  {ACCOUNT_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setAccountOpen(false);
                        setActiveMenu(null);
                      }}
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
                className="hidden min-h-11 items-center text-xs font-medium leading-none text-white/62 transition-colors duration-300 hover:text-white/90 sm:inline-flex"
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
          <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8">
            <p className="premium-mega-label">{activeGroup.label}</p>
            <div className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {activeGroup.items.map((item) => (
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
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="premium-mobile-menu border-t px-6 py-5 md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="premium-mega-label mb-2">{group.label}</p>
                <div className="grid gap-0.5">
                  {group.items.map((item) => (
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
              <div>
                <div className="mb-4">
                  <ProfileSwitcher authenticated={authenticated} />
                </div>
                <p className="premium-mega-label mb-2">Account</p>
                <div className="grid gap-0.5">
                  {ACCOUNT_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-1 py-1.5 text-lg font-medium tracking-[-0.01em]"
                    >
                      {item.label}
                    </Link>
                  ))}
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
                </div>
              </div>
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
