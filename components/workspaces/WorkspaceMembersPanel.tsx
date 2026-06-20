"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";

type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
type ProfileRole = "owner" | "editor" | "viewer";

type WorkspaceSummary = {
  id: string;
  canManage: boolean;
  role: WorkspaceRole;
} | null;

type HealthProfile = {
  id: string;
  displayName: string;
  relationship: string;
  isPrimary: boolean;
};

type Member = {
  id: string;
  displayName: string;
  email: string;
  profileAccess: Array<{
    healthProfileId: string;
    role: ProfileRole;
    status: string;
  }>;
  role: WorkspaceRole;
  status: string;
  userId: string;
};

type WorkspaceMembersPayload = {
  members?: Member[];
  profiles?: HealthProfile[];
  workspace?: WorkspaceSummary;
};

const WORKSPACE_ROLE_OPTIONS: Array<{ label: string; value: WorkspaceRole }> = [
  { label: "Viewer", value: "viewer" },
  { label: "Member", value: "member" },
  { label: "Admin", value: "admin" },
];

const PROFILE_ROLE_OPTIONS: Array<{ label: string; value: ProfileRole }> = [
  { label: "Viewer", value: "viewer" },
  { label: "Editor", value: "editor" },
];

export default function WorkspaceMembersPanel() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [profileRole, setProfileRole] = useState<ProfileRole>("viewer");
  const [profiles, setProfiles] = useState<HealthProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSummary>(null);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("viewer");

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  useEffect(() => {
    void loadMembers();

    function handleProfilesChange() {
      void loadMembers();
    }

    window.addEventListener("aeonvera:health-profiles-change", handleProfilesChange);
    return () => {
      window.removeEventListener("aeonvera:health-profiles-change", handleProfilesChange);
    };
  }, []);

  async function loadMembers() {
    setLoading(true);
    setLoadError("");

    const response = await fetch("/api/workspace-members", { cache: "no-store" });
    if (!response.ok) {
      setLoadError("Could not load workspace access.");
      setLoading(false);
      return;
    }

    const payload = await response.json() as WorkspaceMembersPayload;
    const nextProfiles = Array.isArray(payload.profiles) ? payload.profiles : [];

    setMembers(Array.isArray(payload.members) ? payload.members : []);
    setProfiles(nextProfiles);
    setWorkspace(payload.workspace || null);
    setSelectedProfileIds(nextProfiles.map((profile) => profile.id));
    setLoading(false);
  }

  async function grantAccess() {
    if (!email.trim() || selectedProfileIds.length < 1) return;

    setSaving(true);
    setMessage("");

    const response = await fetch("/api/workspace-members", {
      body: JSON.stringify({
        email,
        healthProfileIds: selectedProfileIds,
        profileRole,
        role: workspaceRole,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error || "Could not grant access.");
      setSaving(false);
      return;
    }

    setEmail("");
    setMessage("Access granted.");
    await loadMembers();
    setSaving(false);
  }

  async function removeAccess(userId: string) {
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/workspace-members", {
      body: JSON.stringify({ status: "removed", userId }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error || "Could not remove access.");
      setSaving(false);
      return;
    }

    setMessage("Access removed.");
    await loadMembers();
    setSaving(false);
  }

  function toggleProfile(profileId: string) {
    setSelectedProfileIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId]
    );
  }

  return (
    <section className="executive-panel rounded-lg p-6 md:p-7">
      <div className="mb-6 flex items-start justify-between gap-5 border-b border-white/[0.06] pb-5">
        <div>
          <p className="micro-label">Workspace</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Access.</h2>
          <p className="mt-3 text-sm leading-7 text-white/46">
            Profiles stay available to every account with active access.
          </p>
        </div>
        <UsersRound className="shrink-0 royal-text" size={23} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-2">
          {loading ? (
            <div className="av-control-card rounded-lg border p-4 text-sm text-white/44">
              Loading workspace access...
            </div>
          ) : loadError ? (
            <div className="rounded-lg border border-rose-300/[0.16] bg-rose-400/[0.05] p-4 text-sm text-rose-100/72">
              {loadError}
            </div>
          ) : members.length < 1 ? (
            <div className="av-control-card rounded-lg border p-4 text-sm text-white/44">
              No additional accounts have access yet.
            </div>
          ) : (
            members.map((member) => {
            const profileNames = member.profileAccess
              .map((access) => profileById.get(access.healthProfileId)?.displayName)
              .filter(Boolean)
              .join(", ");

            return (
              <div
                key={member.id}
                className="av-control-card rounded-lg border p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white">{member.displayName}</p>
                    <p className="av-control-muted mt-1 text-xs">{member.email}</p>
                  </div>
                  <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                    {member.role}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-white/38">
                  {profileNames || "No profiles granted"}
                </p>
                {workspace?.canManage && member.role !== "owner" ? (
                  <button
                    type="button"
                    onClick={() => void removeAccess(member.userId)}
                    disabled={saving}
                    className="mt-4 inline-flex items-center gap-2 rounded-md border border-rose-300/[0.16] bg-rose-400/[0.05] px-3 py-2 text-xs text-rose-100/72 transition hover:border-rose-300/[0.28] hover:bg-rose-400/[0.08] hover:text-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X size={13} />
                    Remove
                  </button>
                ) : null}
              </div>
            );
            })
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="micro-label">Grant</p>
              <ShieldCheck className="text-white/32" size={17} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem_9rem]">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="h-11 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-white/[0.22]"
                aria-label="Member email"
                disabled={!workspace?.canManage}
              />
              <select
                value={workspaceRole}
                onChange={(event) => setWorkspaceRole(event.target.value as WorkspaceRole)}
                className="h-11 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-white/[0.22]"
                aria-label="Workspace role"
                disabled={!workspace?.canManage}
              >
                {WORKSPACE_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={profileRole}
                onChange={(event) => setProfileRole(event.target.value as ProfileRole)}
                className="h-11 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-white/[0.22]"
                aria-label="Profile role"
                disabled={!workspace?.canManage}
              >
                {PROFILE_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {loading ? (
                <div className="av-control-card rounded-lg border p-3 text-sm text-white/40">
                  Loading profiles...
                </div>
              ) : profiles.length < 1 ? (
                <div className="av-control-card rounded-lg border p-3 text-sm text-white/40">
                  Create a profile before granting access.
                </div>
              ) : (
                profiles.map((profile) => {
                const selected = selectedProfileIds.includes(profile.id);
                return (
                  <button
                    key={profile.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleProfile(profile.id)}
                    disabled={!workspace?.canManage}
                    className={`av-control-card flex items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected ? "av-control-card-active" : ""
                    }`}
                  >
                    <span>
                      <span className="block text-white">{profile.displayName}</span>
                      <span className="av-control-muted mt-1 block text-xs capitalize">
                        {profile.relationship}
                        {profile.isPrimary ? " · primary" : ""}
                      </span>
                    </span>
                    {selected ? <Check className="royal-text" size={15} /> : null}
                  </button>
                );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => void grantAccess()}
              disabled={
                saving ||
                !workspace?.canManage ||
                !email.trim() ||
                selectedProfileIds.length < 1
              }
              className="premium-action mt-4 inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus size={15} />
              Grant access
            </button>

            {message ? <p className="mt-3 text-xs text-white/44">{message}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
