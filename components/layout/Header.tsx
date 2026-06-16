"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, UserCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  public?: boolean;
};

export default function Header() {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user);
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  useEffect(() => {
    if (!accountOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen]);

  const primaryNavItems: NavItem[] = authenticated
    ? [
        { href: "/dashboard", label: "Today" },
        { href: "/companion", label: "Ask" },
        { href: "/plan", label: "Plan" },
      ]
    : [
        { href: "/pricing", label: "Pricing", public: true },
        { href: "/optimization", label: "Optimize", public: true },
      ];

  const accountNavItems: NavItem[] = authenticated
    ? [
        { href: "/settings", label: "Settings" },
        { href: "/pricing", label: "Membership", public: true },
        { href: "/digital-twin", label: "Digital Twin" },
        { href: "/life-os", label: "Life OS" },
        { href: "/network", label: "Care Network" },
        { href: "/data-sources", label: "Data Sources" },
        { href: "/report", label: "Report" },
        { href: "/memory", label: "Memory" },
      ]
    : [];

  const mobileNavItems: NavItem[] = authenticated
    ? [
        { href: "/dashboard", label: "Today" },
        { href: "/companion", label: "Ask" },
        { href: "/plan", label: "Plan" },
        { href: "/settings", label: "Settings" },
      ]
    : [
        { href: "/pricing", label: "Pricing", public: true },
        { href: "/optimization", label: "Optimize", public: true },
      ];
  const visibleAccountItems = accountNavItems.filter((item) => item.public || authenticated);

  return (
    <header className="premium-header sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">

        {/* BRAND */}
        <Link
          href="/"
          className="group inline-flex items-center gap-3 text-sm font-medium tracking-[0.2em] text-white/85 transition-colors duration-300 hover:text-white"
        >
          <span className="brand-mark" aria-hidden />
          <span>AEONVERA</span>
        </Link>

        {/* NAV */}
        <nav className="hidden items-center gap-3 md:flex">
          {primaryNavItems
            .filter((item) => item.public || authenticated)
            .map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`premium-nav-link ${active ? "premium-nav-link-active" : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>

        {/* AUTH */}
        <div className="flex h-9 items-center gap-3">
          <button
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 text-white/60 md:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            type="button"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {!authChecked ? (
            <div className="hidden h-9 w-24 rounded-md border border-white/10 bg-white/[0.035] sm:block" />
          ) : authenticated ? (
            <div className="relative hidden sm:block" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium leading-none transition ${
                  accountOpen
                    ? "border-white/[0.16] bg-white/[0.06] text-white/82"
                    : "border-white/[0.08] bg-white/[0.025] text-white/54 hover:border-white/[0.14] hover:text-white/80"
                }`}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <UserCircle size={15} />
                Account
              </button>
              {accountOpen ? (
                <div
                  className="absolute right-0 top-11 w-60 rounded-lg border border-white/[0.08] bg-black/90 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl"
                  role="menu"
                >
                  {visibleAccountItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAccountOpen(false)}
                      className={`block rounded-md px-3 py-2 text-sm transition ${
                        isActive(pathname, item.href)
                          ? "bg-[rgba(var(--gold),0.09)] text-[rgb(var(--gold))]"
                          : "text-white/58 hover:bg-white/[0.05] hover:text-white/86"
                      }`}
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
                    className="mt-1 block w-full rounded-md border-t border-white/[0.06] px-3 py-2 text-left text-sm text-white/42 transition hover:bg-white/[0.05] hover:text-white/72"
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
                className="hidden h-9 items-center text-xs font-medium leading-none text-white/50 transition-colors duration-300 hover:text-white/80 sm:inline-flex"
              >
                Sign In
              </Link>
              <Link
                href="/login?mode=signup"
                className="premium-nav-action px-4 text-xs font-medium leading-none transition"
              >
                Begin
              </Link>
            </>
          )}
        </div>

      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.08] bg-black/90 px-6 py-4 backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-2">
            {mobileNavItems
              .filter((item) => item.public || authenticated)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setMobileOpen(false);
                  }}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
                >
                  {item.label}
                </Link>
              ))}
            {!authChecked ? null : authenticated ? (
              <>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    void handleLogout();
                  }}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white/75"
                  type="button"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login?mode=signin"
                onClick={() => setMobileOpen(false)}
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
