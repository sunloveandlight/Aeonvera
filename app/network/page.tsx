"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock3, Copy, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState from "@/components/ui/AccessState";
import { supabase } from "@/lib/supabase/client";

type CareRole = "physician" | "coach" | "family";

type CareInvitation = {
  acceptedAt?: string | null;
  accessCode?: string;
  accessCount: number;
  createdAt?: string;
  expiresAt?: string;
  id: string;
  inviteToken: string;
  lastAccessedAt?: string | null;
  memberEmail: string;
  memberName?: string | null;
  permissions: string[];
  requiresAccessCode?: boolean;
  role: CareRole;
  status: "pending" | "active" | "expired" | "revoked";
  url: string;
};

type RoleRecommendation = {
  detail: string;
  priority: "high" | "medium" | "low";
  reason: string;
  role: CareRole;
  title: string;
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
  const [recommendations, setRecommendations] = useState<RoleRecommendation[]>([]);
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
          setRecommendations(data.recommendations || []);
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
      setMessage(
        data.invitation?.accessCode
          ? `Care network invitation created. Access code: ${data.invitation.accessCode}`
          : "Care network invitation created."
      );
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

  async function extendInvitation(id: string, expiresInDays: number) {
    setMessage(null);

    try {
      const response = await fetch("/api/care-network/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "extend", expiresInDays, id }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not extend invitation.");
      }

      setInvitations((current) =>
        current.map((invite) => (invite.id === id ? data.invitation : invite))
      );
      setMessage(`Access extended for ${expiresInDays} days.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not extend invitation.");
    }
  }

  async function copyInvitationMessage(invitation: CareInvitation) {
    const absoluteUrl = `${window.location.origin}${invitation.url}`;
    await navigator.clipboard.writeText(buildInvitationMessage(invitation, absoluteUrl));
    setMessage(
      invitation.accessCode
        ? "Ready to send. The invite and access code were copied as one message."
        : invitation.requiresAccessCode
          ? "Invitation link copied. Use the access code shown when this invite was created."
          : "Invitation link copied."
    );
  }

  async function copyInvitationLink(invitation: CareInvitation) {
    await navigator.clipboard.writeText(`${window.location.origin}${invitation.url}`);
    setMessage("Invitation link copied.");
  }

  async function copyInvitationCode(invitation: CareInvitation) {
    if (!invitation.accessCode) return;
    await navigator.clipboard.writeText(invitation.accessCode);
    setMessage("Access code copied.");
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
          <div className="space-y-6">
            <NetworkIntelligencePanel
              invitations={invitations}
              recommendations={recommendations}
              onSelectRole={setRole}
            />

          <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="executive-panel rounded-lg p-6 md:p-7">
              <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
                <div>
                  <p className="micro-label">Invite Role</p>
                  <h1 className="mt-3 text-4xl font-semibold text-white">
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
                  aria-label="Member email"
                  placeholder="Member email"
                />
                <input
                  value={form.memberName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, memberName: event.target.value }))
                  }
                  className="h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/70 outline-none placeholder:text-white/24"
                  aria-label="Name or label"
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
                          ? "border-[rgba(var(--gold),0.28)] bg-[rgba(var(--gold),0.08)]"
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
                            ? "border-[rgba(var(--gold),0.28)] bg-[rgba(var(--gold),0.08)] royal-text"
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
                <h2 className="mt-3 text-3xl font-semibold text-white">
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
                        <p className="mt-1 text-xs text-white/32">
                          Last opened {formatDateTime(invitation.lastAccessedAt)}
                        </p>
                        <InvitationAccessHint invitation={invitation} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyInvitationMessage(invitation)}
                          disabled={invitation.status === "revoked" || invitation.status === "expired"}
                          className="premium-action inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Copy size={14} /> {invitation.accessCode ? "Copy message" : "Copy link"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyInvitationLink(invitation)}
                          disabled={invitation.status === "revoked" || invitation.status === "expired"}
                          className="premium-action-secondary inline-flex h-9 items-center justify-center rounded-md px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Link
                        </button>
                        {invitation.accessCode ? (
                          <button
                            type="button"
                            onClick={() => void copyInvitationCode(invitation)}
                            disabled={invitation.status === "revoked" || invitation.status === "expired"}
                            className="premium-action-secondary inline-flex h-9 items-center justify-center rounded-md px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Code
                          </button>
                        ) : null}
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
                    {invitation.status !== "revoked" && (
                      <div className="mt-4 border-t border-white/[0.05] pt-3">
                        <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-white/28">
                          Extend access
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[7, 14, 30, 90].map((days) => (
                            <button
                              key={`${invitation.id}-${days}`}
                              type="button"
                              onClick={() => void extendInvitation(invitation.id, days)}
                              className="premium-action-secondary inline-flex h-8 items-center justify-center rounded-md px-3 text-[11px]"
                            >
                              {days} days
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function InvitationAccessHint({ invitation }: { invitation: CareInvitation }) {
  if (invitation.accessCode) {
    return (
      <div className="mt-2 space-y-2">
        <p className="inline-flex rounded-md border border-[rgba(var(--gold),0.2)] bg-[rgba(var(--gold),0.06)] px-2 py-1 text-xs text-[rgba(var(--gold),0.8)]">
          Access code: {invitation.accessCode}
        </p>
        <p className="text-xs leading-5 text-white/34">
          Send the message to this person.
        </p>
      </div>
    );
  }

  if (invitation.requiresAccessCode) {
    return (
      <p className="mt-2 text-xs text-white/34">
        Protected by an access code shown when this invite was created.
      </p>
    );
  }

  return null;
}

function buildInvitationMessage(invitation: CareInvitation, absoluteUrl: string) {
  if (!invitation.accessCode) return absoluteUrl;
  const role = ROLE_COPY[invitation.role].title.toLowerCase();
  return [
    `Aeonvera secure ${role} view`,
    absoluteUrl,
    `Access code: ${invitation.accessCode}`,
    `Expires: ${formatDate(invitation.expiresAt)}`,
  ].join("\n");
}

function NetworkIntelligencePanel({
  invitations,
  onSelectRole,
  recommendations,
}: {
  invitations: CareInvitation[];
  onSelectRole: (role: CareRole) => void;
  recommendations: RoleRecommendation[];
}) {
  const activity = buildActivity(invitations);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="executive-panel rounded-lg p-6 md:p-7">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4">
          <div>
            <p className="micro-label">Network Activity</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Who has seen what.</h2>
          </div>
          <Clock3 className="royal-text" size={22} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <MetricPill label="Active" value={countStatus(invitations, "active")} />
          <MetricPill label="Pending" value={countStatus(invitations, "pending")} />
          <MetricPill label="Expiring" value={countExpiring(invitations)} />
        </div>

        <div className="mt-5 space-y-2">
          {activity.map((item) => (
            <div
              key={item}
              className="rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-sm leading-6 text-white/50"
            >
              {item}
            </div>
          ))}
          {!activity.length && (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-sm leading-6 text-white/45">
              No network activity yet. Aeonvera will show openings, expirations, and pending invites here.
            </div>
          )}
        </div>
      </div>

      <div className="executive-panel rounded-lg p-6 md:p-7">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/[0.06] pb-4">
          <div>
            <p className="micro-label">Recommended Roles</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Invite with intent.</h2>
          </div>
          <Sparkles className="royal-text" size={22} />
        </div>

        <div className="space-y-3">
          {recommendations.map((recommendation) => (
            <button
              key={`${recommendation.role}-${recommendation.title}`}
              type="button"
              onClick={() => onSelectRole(recommendation.role)}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.025] p-4 text-left transition hover:border-[rgba(var(--gold),0.24)] hover:bg-[rgba(var(--gold),0.05)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white/76">{recommendation.title}</p>
                <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/34">
                  {recommendation.role}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/42">
                {recommendation.detail}
              </p>
              <p className="mt-3 text-[11px] leading-5 text-[rgba(var(--gold),0.7)]">
                {recommendation.reason}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-[5.5rem] flex-col justify-between rounded-md border border-white/[0.06] bg-black/20 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">{label}</p>
      <p className="tabular-nums text-2xl font-light leading-none text-white">{value}</p>
    </div>
  );
}

function buildActivity(invitations: CareInvitation[]) {
  return invitations.slice(0, 6).flatMap((invitation) => {
    const name = invitation.memberName || invitation.memberEmail;
    const role = ROLE_COPY[invitation.role].title.toLowerCase();
    const items: string[] = [];

    if (invitation.status === "revoked") {
      items.push(`${name}'s ${role} access has been revoked.`);
      return items;
    }

    if (invitation.status === "expired") {
      items.push(`${name}'s ${role} link has expired.`);
      return items;
    }

    if (invitation.lastAccessedAt) {
      items.push(`${name} opened the ${role} view ${formatRelative(invitation.lastAccessedAt)}.`);
    } else if (invitation.acceptedAt) {
      items.push(`${name} accepted ${role} access ${formatRelative(invitation.acceptedAt)}.`);
    } else {
      items.push(`${name} has not opened the ${role} invite yet.`);
    }

    const days = daysUntil(invitation.expiresAt);
    if (days !== null && days >= 0 && days <= 5) {
      items.push(`${name}'s ${role} access expires in ${days || 1} day${days === 1 ? "" : "s"}.`);
    }

    return items;
  });
}

function countStatus(invitations: CareInvitation[], status: CareInvitation["status"]) {
  return invitations.filter((invitation) => invitation.status === status).length;
}

function countExpiring(invitations: CareInvitation[]) {
  return invitations.filter((invitation) => {
    const days = daysUntil(invitation.expiresAt);
    return invitation.status !== "revoked" && days !== null && days >= 0 && days <= 5;
  }).length;
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

function formatDateTime(value?: string | null) {
  if (!value) return "not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not yet";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function formatRelative(value?: string | null) {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const diffMs = date.getTime() - Date.now();
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffHours, "hour");
  }
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round(diffHours / 24),
    "day"
  );
}

function daysUntil(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
