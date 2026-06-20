"use client";

import { useEffect, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";

type HealthProfileOption = {
  id: string;
  displayName: string;
  relationship: string;
  isPrimary: boolean;
};

type ProfileSwitcherProps = {
  authenticated: boolean;
  compact?: boolean;
  onChange?: () => void;
};

export default function ProfileSwitcher({
  authenticated,
  compact = false,
  onChange,
}: ProfileSwitcherProps) {
  const [activeProfileId, setActiveProfileId] = useState("");
  const [profiles, setProfiles] = useState<HealthProfileOption[]>([]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    let cancelled = false;

    fetch("/api/health-profiles", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        setProfiles(Array.isArray(payload.profiles) ? payload.profiles : []);
        setActiveProfileId(payload.activeProfileId || "");
      })
      .catch(() => {
        if (!cancelled) {
          setProfiles([]);
          setActiveProfileId("");
        }
      })

    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  async function switchProfile(profileId: string) {
    setActiveProfileId(profileId);
    const response = await fetch("/api/health-profiles/active", {
      body: JSON.stringify({ healthProfileId: profileId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) return;
    onChange?.();
    window.location.reload();
  }

  if (!authenticated || profiles.length <= 1) return null;

  return (
    <label
      className={`relative items-center rounded-md border border-white/[0.08] bg-white/[0.035] text-white/70 transition hover:border-white/[0.16] hover:text-white ${
        compact ? "hidden sm:inline-flex" : "inline-flex"
      } ${
        compact ? "max-w-[8.5rem]" : "max-w-[11.5rem]"
      }`}
    >
      <span className="sr-only">Active health profile</span>
      <UserRound className="pointer-events-none ml-2.5 shrink-0 text-white/44" size={14} />
      <select
        aria-label="Active health profile"
        className="h-9 min-w-0 flex-1 appearance-none truncate bg-transparent py-0 pl-2 pr-7 text-xs font-medium outline-none"
        value={activeProfileId}
        onChange={(event) => void switchProfile(event.target.value)}
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.displayName}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 text-white/38" size={13} />
    </label>
  );
}
