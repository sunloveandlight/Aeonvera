"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, ShieldCheck, UsersRound } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState from "@/components/ui/AccessState";
import { supabase } from "@/lib/supabase/client";

type CareRole = "physician" | "coach" | "family";

type CareInvitation = {
  acceptedAt?: string | null;
  accessCount: number;
  createdAt?: string;
  expiresAt?: string;
  id: string;
  inviteToken: string;
  lastAccessedAt?: string | null;
  memberEmail: string;
  memberName?: string | null;
  permissions: string[];
  role: CareRole;
  status: "pending" | "active" | "expired" | "revoked";
  url: string;
};

const ROLE_COPY: Record<CareRole, { title: string; detail: string }> = {
  physician: {
    title: "Physician",
    detail: "Clinical review across biomarkers, biological age, protocols, outcomes, wearables, and insights.",
  },
  coach: {
    title: "Coach",
    detail: "Execution support across protocols, outcomes, wearable trends, and daily behavior signals.",
  },
  family: {
    title: "Family",
    detail: "High-level healthspan context without deep clinical detail.",
  },
};

const PERMISSIONS = [
  ["snapshot", "Snapshot"],
  ["biological_age", "Biological age"],
  ["labs", "Labs"],
  ["protocols", "Protocols"],
  ["outcomes", "Outcomes"],
  ["wearables", "Wearables"],
  ["clinical_insights", "Clinical insights"],
] as const;

const ROLE_DEFAULTS: Record<CareRole, string[]> = {
  physician: PERMISSIONS.map(([key]) => key),
  coach: ["snapshot", "protocols", "outcomes", "wearables"],
  family: ["snapshot", "biological_age", "protocols"],
};

const ROLE_ALLOWED_PERMISSIONS: Record<CareRole, string[]> = ROLE_DEFAULTS;

export default function NetworkPage() {
  const [invitations, setInvitations] = useState<CareInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    memberEmail: "",
    memberName: "",
    role: "physician" as CareRole,
    expiresInDays: 14,
    permissions: ROLE_DEFAULTS.physician,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadNetwork() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setSignedOut(true);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/care-network/invitations", {
          credentials: "include",
        });
        const data = await response.json();

        if (response.status === 403) {
          if (!cancelled) {
            setLocked(true);
            setMessage(data.upgrade?.message || data.error || null);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Could not load care network.");
        }

        if (!cancelled) {
          setInvitations(data.invitations || []);
          if (data.migrationRequired) setMessage(data.message || null);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load care network.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadNetwork();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createInvitation() {
    setCreating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/care-network/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create invitation.");
      }

      setInvitations((current) => [data.invitation, ...current]);
      setForm((current) => ({
        ...current,
        memberEmail: "",
        memberName: "",
      }));
      setMessage("Care network invitation created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create invitation.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeInvitation(id: string) {
    setMessage(null);

    try {
      const response = await fetch("/api/care-network/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not revoke invitation.");
      }

      setInvitations((current) =>
        current.map((invite) => (invite.id === id ? data.invitation : invite))
      );
      setMessage("Invitation revoked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not revoke invitation.");
    }
  }

  async function copyInvitation(invitation: CareInvitation) {
    await navigator.clipboard.writeText(`${window.location.origin}${invitation.url}`);
    setMessage("Invitation link copied.");
  }

  function setRole(role: CareRole) {
    setForm((current) => ({
      ...current,
      role,
      permissions: ROLE_DEFAULTS[role],
    }));
  }

  function togglePermission(permission: string) {
    if (!ROLE_ALLOWED_PERMISSIONS[form.role].includes(permission)) return;

    setForm((current) => {
      const next = current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission];
      return {
        ...current,
        permissions: next.length ? next : current.permissions,
      };
    });
  }

  return (
    <PageContainer>
      <div className="py-14">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/digital-twin"
            className="premium-action-secondary inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Digital Twin
          </Link>
          <Link
            href="/physician-export"
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            Clinical Export
          </Link>
        </div>

        {loading ? (
          <AccessState
            eyebrow="Care Network"
            title="Loading your private network."
            body="Aeonvera is preparing role-based access for physicians, coaches, and family support."
            actions={[{ href: "/digital-twin", label: "Digital Twin", variant: "secondary" }]}
          />
        ) : signedOut ? (
          <AccessState
            eyebrow="Care Network"
            title="Sign in to manage your network."
            body="Care network roles can access sensitive healthspan context, so Aeonvera only manages them inside your secure account."
            actions={[
              { href: "/login?mode=signin", label: "Sign in" },
              { href: "/pricing", label: "Compare tiers", variant: "secondary" },
            ]}
          />
        ) : locked ? (
          <AccessState
            eyebrow="Sovereign Network"
            title="Unlock role-based care access."
            body={
              message ||
              "Sovereign lets you invite physicians, coaches, and family into controlled read-only views."
            }
            actions={[
              { href: "/pricing", label: "Unlock Sovereign" },
              { href: "/plan", label: "Your Plan", variant: "secondary" },
            ]}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
                <div>
                  <p className="micro-label">Invite Role</p>
                  <h1 className="mt-3 text-4xl font-light text-white">
                    Build your longevity network.
                  </h1>
                  <p className="mt-4 text-sm leading-7 text-white/48">
                    Invite the right people into scoped, read-only intelligence views.
                  </p>
                </div>
                <UsersRound className="royal-text" size={25} />
              </div>

              <div className="space-y-3">
                <input
                  value={form.memberEmail}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, memberEmail: event.target.value }))
                  }
                  className="h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/70 outline-none placeholder:text-white/24"
                  placeholder="Member email"
                />
                <input
                  value={form.memberName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, memberName: event.target.value }))
                  }
                  className="h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/70 outline-none placeholder:text-white/24"
                  placeholder="Name or label"
                />

                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(ROLE_COPY) as CareRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRole(role)}
                      className={`rounded-lg border p-3 text-left transition ${
                        form.role === role
                          ? "border-[#dabc73]/28 bg-[#dabc73]/[0.08]"
                          : "border-white/[0.07] bg-white/[0.025]"
                      }`}
                    >
                      <p className="text-sm text-white/76">{ROLE_COPY[role].title}</p>
                      <p className="mt-2 text-[11px] leading-5 text-white/36">
                        {ROLE_COPY[role].detail}
                      </p>
                    </button>
                  ))}
                </div>

                <select
                  value={form.expiresInDays}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expiresInDays: Number(event.target.value),
                    }))
                  }
                  className="h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/70 outline-none"
                >
                  <option value={7}>Expires in 7 days</option>
                  <option value={14}>Expires in 14 days</option>
                  <option value={30}>Expires in 30 days</option>
                  <option value={90}>Expires in 90 days</option>
                </select>

                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.14em] text-white/28">
                    Permissions
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PERMISSIONS.filter(([key]) =>
                      ROLE_ALLOWED_PERMISSIONS[form.role].includes(key)
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePermission(key)}
                        className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                          form.permissions.includes(key)
                            ? "border-[#dabc73]/28 bg-[#dabc73]/[0.08] royal-text"
                            : "border-white/[0.07] bg-black/20 text-white/38 hover:text-white/60"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-white/34">
                    Aeonvera limits each role to the minimum useful information surface. Change the role to change the available scope.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void createInvitation()}
                  disabled={creating}
                  className="premium-action inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck size={16} />
                  {creating ? "Creating invitation" : "Create invitation"}
                </button>
                {message && <p className="text-sm leading-6 text-white/48">{message}</p>}
              </div>
            </div>

            <div className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 border-b border-white/[0.06] pb-5">
                <p className="micro-label">Active Network</p>
                <h2 className="mt-3 text-3xl font-light text-white">
                  Roles, access, and revocation.
                </h2>
              </div>

              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm text-white/76">
                          {invitation.memberName || invitation.memberEmail}
                        </p>
                        <p className="mt-1 text-xs text-white/38">
                          {ROLE_COPY[invitation.role].title} / {invitation.status} / opened {invitation.accessCount} time{invitation.accessCount === 1 ? "" : "s"}
                        </p>
                        <p className="mt-2 text-xs text-white/32">
                          Expires {formatDate(invitation.expiresAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyInvitation(invitation)}
                          disabled={invitation.status === "revoked" || invitation.status === "expired"}
                          className="premium-action-secondary inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Copy size={14} /> Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => void revokeInvitation(invitation.id)}
                          disabled={invitation.status === "revoked"}
                          className="premium-action-secondary inline-flex h-9 items-center justify-center rounded-md px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {invitation.permissions.map((permission) => (
                        <span
                          key={`${invitation.id}-${permission}`}
                          className="rounded-md border border-white/[0.07] bg-black/20 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/36"
                        >
                          {permission.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {!invitations.length && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-5">
                    <p className="text-sm text-white/58">
                      No care network roles yet. Invite a physician, coach, or family member to open the first controlled view.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function formatDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
