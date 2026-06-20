"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, UserPlus, UsersRound } from "lucide-react";

type HealthProfile = {
  id: string;
  displayName: string;
  relationship: string;
  isPrimary: boolean;
  role: "owner" | "editor" | "viewer";
};

type ProfileLimit = {
  maxHealthProfiles: number;
};

const RELATIONSHIPS = [
  "self",
  "partner",
  "child",
  "parent",
  "family",
  "client",
  "other",
];

export default function ProfileManagementPanel() {
  const [activeProfileId, setActiveProfileId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [relationship, setRelationship] = useState("family");
  const [profiles, setProfiles] = useState<HealthProfile[]>([]);
  const [profileLimit, setProfileLimit] = useState<ProfileLimit>({ maxHealthProfiles: 1 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null,
    [activeProfileId, profiles]
  );

  const remainingProfiles = Math.max(profileLimit.maxHealthProfiles - profiles.length, 0);

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function loadProfiles() {
    const response = await fetch("/api/health-profiles", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setProfiles(Array.isArray(payload.profiles) ? payload.profiles : []);
    setProfileLimit({
      maxHealthProfiles: Number(payload.profileLimit?.maxHealthProfiles) || 1,
    });
    setActiveProfileId(payload.activeProfileId || "");
  }

  async function createProfile() {
    if (!displayName.trim()) return;
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/health-profiles", {
      body: JSON.stringify({ displayName, relationship }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error || "Could not create profile.");
      setSaving(false);
      return;
    }

    setDisplayName("");
    setRelationship("family");
    await loadProfiles();
    if (payload.profile?.id) await switchProfile(payload.profile.id, false);
    setSaving(false);
    setMessage("Profile created.");
  }

  async function switchProfile(profileId: string, reload = true) {
    setActiveProfileId(profileId);
    const response = await fetch("/api/health-profiles/active", {
      body: JSON.stringify({ healthProfileId: profileId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (response.ok && reload) window.location.reload();
  }

  async function saveActiveProfile() {
    if (!activeProfile) return;
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/health-profiles", {
      body: JSON.stringify({
        id: activeProfile.id,
        displayName: activeProfile.displayName,
        relationship: activeProfile.relationship,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error || "Could not save profile.");
      setSaving(false);
      return;
    }

    setMessage("Profile saved.");
    setSaving(false);
  }

  function updateActiveProfile(patch: Partial<HealthProfile>) {
    if (!activeProfile) return;
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === activeProfile.id ? { ...profile, ...patch } : profile
      )
    );
  }

  return (
    <section className="executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex items-start justify-between gap-5 border-b border-white/[0.06] pb-5">
        <div>
          <p className="micro-label">Profiles</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Family health profiles.</h2>
          <p className="mt-3 text-sm leading-7 text-white/46">
            Each profile keeps assessments, reports, protocols, and daily plans separated.
          </p>
          {activeProfile ? (
            <p className="mt-3 text-xs leading-6 text-white/42">
              Active: <span className="text-white/72">{activeProfile.displayName}</span>
              {" · "}
              {profiles.length} of {profileLimit.maxHealthProfiles} profiles used
            </p>
          ) : null}
        </div>
        <UsersRound className="shrink-0 royal-text" size={23} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-2">
          {profiles.map((profile) => {
            const active = profile.id === activeProfileId;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => void switchProfile(profile.id)}
                className={`av-control-card flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition ${
                  active ? "av-control-card-active" : ""
                }`}
              >
                <span>
                  <span className="block text-sm text-white">{profile.displayName}</span>
                  <span className="av-control-muted mt-1 block text-xs capitalize">
                    {profile.relationship}
                    {profile.isPrimary ? " · primary" : ""}
                  </span>
                </span>
                {active ? <Check className="royal-text" size={16} /> : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {activeProfile ? (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
              <p className="micro-label">Selected</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
                <input
                  value={activeProfile.displayName}
                  onChange={(event) => updateActiveProfile({ displayName: event.target.value })}
                  className="h-10 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-white/[0.22]"
                  aria-label="Profile display name"
                />
                <select
                  value={activeProfile.relationship}
                  onChange={(event) => updateActiveProfile({ relationship: event.target.value })}
                  className="h-10 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm capitalize text-white outline-none transition focus:border-white/[0.22]"
                  aria-label="Profile relationship"
                >
                  {RELATIONSHIPS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void saveActiveProfile()}
                  disabled={saving || activeProfile.role === "viewer"}
                  className="premium-action-secondary inline-flex h-10 items-center justify-center px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="micro-label">Add</p>
              <p className="text-xs text-white/34">{remainingProfiles} remaining</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Profile name"
                className="h-10 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-white/[0.22]"
                aria-label="New profile name"
              />
              <select
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
                className="h-10 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm capitalize text-white outline-none transition focus:border-white/[0.22]"
                aria-label="New profile relationship"
              >
                {RELATIONSHIPS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void createProfile()}
                disabled={saving || !displayName.trim() || remainingProfiles < 1}
                className="premium-action-primary inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus size={15} />
                Add
              </button>
            </div>
            {remainingProfiles < 1 ? (
              <p className="mt-3 text-xs text-white/44">
                This workspace has reached its active profile limit.
              </p>
            ) : null}
            {message ? <p className="mt-3 text-xs text-white/44">{message}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
