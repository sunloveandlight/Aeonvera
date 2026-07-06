"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  LockKeyhole,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import styles from "./professional-dashboard.module.css";

const dataClasses = [
  "identity",
  "administrative",
  "readiness",
  "performance",
  "nutrition",
  "clinical_summary",
  "labs_basic",
  "labs_sensitive",
  "mental_health",
  "documents",
  "notes",
] as const;

const consentDefaults = ["identity", "readiness", "performance"] as const;
const staffRoles = ["clinician", "trainer", "coach", "front_desk", "auditor", "read_only"] as const;

type Organization = {
  createdAt?: string | null;
  id: string;
  name: string;
  organizationSubtype: string | null;
  role: string;
};

type RosterProfile = {
  createdAt?: string | null;
  displayName: string;
  id: string;
  relationship: string;
  status: string;
  workspaceId: string;
};

type StaffMember = {
  createdAt?: string | null;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  userId: string;
  workspaceId: string;
};

type Consent = {
  allowedRoles: string[];
  createdAt?: string | null;
  dataClasses: string[];
  expiresAt?: string | null;
  healthProfileId: string;
  id: string;
  purpose: string;
  revokedAt?: string | null;
  subjectEmail?: string | null;
};

type Assignment = {
  dataClasses: string[];
  healthProfileId: string;
  id: string;
  role: string;
  staffUserId: string;
};

type ProfilePreview = {
  decision?: {
    accessDecision: "allowed" | "denied" | "redacted";
    allowedDataClasses: string[];
    redactedDataClasses: string[];
    reason?: string;
  };
  profile?: {
    id: string;
    sections: Record<string, unknown>;
  } | null;
};

type LoadState = "idle" | "loading" | "ready" | "unauthorized" | "error";

export default function ProfessionalDashboardClient() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [roster, setRoster] = useState<RosterProfile[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profilePreview, setProfilePreview] = useState<ProfilePreview | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadOrganizations();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    void loadWorkspace(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !selectedProfileId) return;
    void loadProfilePreview(workspaceId, selectedProfileId);
  }, [workspaceId, selectedProfileId]);

  const selectedOrg = organizations.find((org) => org.id === workspaceId) || null;
  const selectedProfile = roster.find((profile) => profile.id === selectedProfileId) || roster[0] || null;
  const activeProfilePreview =
    profilePreview?.profile?.id === selectedProfile?.id ? profilePreview : null;
  const profileConsents = consents.filter((consent) => consent.healthProfileId === selectedProfile?.id);
  const profileAssignments = assignments.filter((assignment) => assignment.healthProfileId === selectedProfile?.id);
  const visibleRoster = roster.filter((profile) =>
    `${profile.displayName} ${profile.relationship}`.toLowerCase().includes(search.toLowerCase())
  );

  const metrics = useMemo(
    () => [
      { label: "Roster", value: roster.length, detail: "active profiles", icon: UsersRound },
      { label: "Staff", value: staff.length, detail: "workspace members", icon: UserPlus },
      { label: "Consents", value: consents.filter((item) => !item.revokedAt).length, detail: "active scopes", icon: ClipboardCheck },
      { label: "Assignments", value: assignments.length, detail: "profile gates", icon: ShieldCheck },
    ],
    [assignments.length, consents, roster.length, staff.length]
  );

  async function loadOrganizations() {
    setStatus("loading");
    const result = await apiGet<{ organizations: Organization[] }>("/api/professional/organizations");
    if (!result.ok) {
      setStatus(result.status === 401 ? "unauthorized" : "error");
      setNotice(result.message);
      return;
    }
    setOrganizations(result.data.organizations || []);
    setWorkspaceId(result.data.organizations?.[0]?.id || "");
    setStatus("ready");
  }

  async function loadWorkspace(nextWorkspaceId: string) {
    setStatus("loading");
    const query = `workspaceId=${encodeURIComponent(nextWorkspaceId)}`;
    const [rosterResult, staffResult, consentResult, assignmentResult] = await Promise.all([
      apiGet<{ profiles: RosterProfile[] }>(`/api/professional/roster?${query}`),
      apiGet<{ staff: StaffMember[] }>(`/api/professional/staff?${query}`),
      apiGet<{ consents: Consent[] }>(`/api/professional/consents?${query}`),
      apiGet<{ assignments: Assignment[] }>(`/api/professional/assignments?${query}`),
    ]);

    const failed = [rosterResult, staffResult, consentResult, assignmentResult].find((result) => !result.ok);
    if (failed) {
      setStatus(failed.status === 401 ? "unauthorized" : "error");
      setNotice(failed.message);
      return;
    }

    if (rosterResult.ok) {
      setRoster(rosterResult.data.profiles || []);
      setSelectedProfileId((current) =>
        rosterResult.data.profiles?.some((profile) => profile.id === current)
          ? current
          : rosterResult.data.profiles?.[0]?.id || ""
      );
    }
    if (staffResult.ok) setStaff(staffResult.data.staff || []);
    if (consentResult.ok) setConsents(consentResult.data.consents || []);
    if (assignmentResult.ok) setAssignments(assignmentResult.data.assignments || []);
    setStatus("ready");
  }

  async function loadProfilePreview(nextWorkspaceId: string, healthProfileId: string) {
    const params = new URLSearchParams({
      dataClasses: dataClasses.join(","),
      workspaceId: nextWorkspaceId,
    });
    const result = await apiGet<ProfilePreview>(
      `/api/professional/profiles/${healthProfileId}?${params.toString()}`
    );
    setProfilePreview(result.ok ? result.data : null);
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit("organization", "/api/professional/organizations", {
      name: form.get("name"),
      organizationSubtype: form.get("organizationSubtype"),
    });
    event.currentTarget.reset();
    await loadOrganizations();
  }

  async function createRoster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit("roster", "/api/professional/roster", {
      displayName: form.get("displayName"),
      relationship: form.get("relationship"),
      workspaceId,
    });
    event.currentTarget.reset();
    await loadWorkspace(workspaceId);
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit("staff", "/api/professional/staff", {
      email: form.get("email"),
      role: form.get("role"),
      workspaceId,
    });
    event.currentTarget.reset();
    await loadWorkspace(workspaceId);
  }

  async function captureConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit("consent", "/api/professional/consents", {
      allowedRoles: form.getAll("allowedRoles"),
      captureMethod: form.get("captureMethod"),
      dataClasses: form.getAll("dataClasses"),
      healthProfileId: selectedProfile?.id,
      legalBasis: form.get("legalBasis"),
      purpose: form.get("purpose"),
      subjectEmail: form.get("subjectEmail"),
      workspaceId,
    });
    event.currentTarget.reset();
    await loadWorkspace(workspaceId);
  }

  async function assignStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit("assignment", "/api/professional/assignments", {
      dataClasses: form.getAll("dataClasses"),
      healthProfileId: selectedProfile?.id,
      role: form.get("role"),
      staffUserId: form.get("staffUserId"),
      workspaceId,
    });
    event.currentTarget.reset();
    await loadWorkspace(workspaceId);
  }

  async function submit(
    action: string,
    url: string,
    payload: Record<string, FormDataEntryValue | FormDataEntryValue[] | null | string | undefined>
  ) {
    setSubmitting(action);
    setNotice("");
    const result = await apiPost(url, payload);
    setSubmitting("");
    setNotice(result.ok ? `${titleize(action)} saved.` : result.message);
  }

  if (status === "unauthorized") {
    return (
      <main className={styles.page}>
        <section className={styles.authPanel}>
          <Building2 size={28} />
          <h1>Aeonvera Professional</h1>
          <p>Sign in to manage clinic and team rosters, staff assignments, and consent-scoped access.</p>
          <Link className={styles.primaryButton} href="/login">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar} aria-label="Professional navigation">
        <div className={styles.brandBlock}>
          <div className={styles.brandMark} aria-hidden="true">
            <span />
          </div>
          <div>
            <p>Aeonvera</p>
            <span>Professional</span>
          </div>
        </div>
        {[
          ["Dashboard", Activity],
          ["Roster", UsersRound],
          ["Staff", UserPlus],
          ["Consents", FileCheck2],
          ["Audit", ShieldCheck],
        ].map(([label, Icon], index) => (
          <button key={label as string} className={`${styles.navItem} ${index === 0 ? styles.navActive : ""}`} type="button">
            <Icon size={17} />
            <span>{label as string}</span>
          </button>
        ))}
        <div className={styles.sidebarFooter}>
          <ShieldCheck size={16} />
          <div>
            <strong>Consent enforced</strong>
            <span>Scoped, revocable, audited</span>
          </div>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.kicker}>Organization command center</p>
            <h1>{selectedOrg?.name || "Aeonvera Professional"}</h1>
          </div>
          <div className={styles.topbarActions}>
            <div className={styles.systemPulse}>
              <span />
              Live workspace
            </div>
            <select
              aria-label="Organization"
              className={styles.orgSelect}
              onChange={(event) => setWorkspaceId(event.target.value)}
              value={workspaceId}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className={styles.systemBar} aria-label="Professional access status">
          <div>
            <span>Organization</span>
            <strong>{selectedOrg ? titleize(selectedOrg.organizationSubtype || "clinic") : "Not configured"}</strong>
          </div>
          <div>
            <span>Access model</span>
            <strong>Consent + assignment</strong>
          </div>
          <div>
            <span>Current view</span>
            <strong>{activeProfilePreview?.decision?.accessDecision === "redacted" ? "Partially redacted" : "Scoped preview"}</strong>
          </div>
        </section>

        {notice ? <div className={styles.notice}>{notice}</div> : null}
        {status === "error" ? <div className={styles.notice}>{notice || "Could not load Professional data."}</div> : null}

        {!organizations.length && status !== "loading" ? (
          <section className={styles.emptyOrg}>
            <div>
              <h2>Create your first Professional organization</h2>
              <p>Use this for a clinic, sports team, performance group, or concierge practice.</p>
            </div>
            <OrganizationForm onSubmit={createOrganization} submitting={submitting === "organization"} />
          </section>
        ) : (
          <>
            <section className={styles.metricsGrid}>
              {metrics.map((metric) => (
                <div className={styles.metric} key={metric.label}>
                  <metric.icon size={18} />
                  <p>{metric.label}</p>
                  <strong>{status === "loading" ? "..." : metric.value}</strong>
                  <span>{metric.detail}</span>
                </div>
              ))}
            </section>

            <section className={styles.mainGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.kicker}>Roster</p>
                    <h2>Members and clients</h2>
                  </div>
                  <label className={styles.searchBox}>
                    <Search size={15} />
                    <input
                      aria-label="Search roster"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search roster"
                      value={search}
                    />
                  </label>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Relationship</th>
                        <th>Status</th>
                        <th>Consents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRoster.map((profile) => (
                        <tr
                          className={profile.id === selectedProfile?.id ? styles.selectedRow : ""}
                          key={profile.id}
                          onClick={() => setSelectedProfileId(profile.id)}
                        >
                          <td>{profile.displayName}</td>
                          <td>{titleize(profile.relationship)}</td>
                          <td><StatusPill label={titleize(profile.status)} tone="ok" /></td>
                          <td>{consents.filter((item) => item.healthProfileId === profile.id && !item.revokedAt).length}</td>
                        </tr>
                      ))}
                      {!visibleRoster.length ? (
                        <tr>
                          <td colSpan={4}>No roster profiles yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className={styles.detailPanel}>
                <div className={styles.detailHero}>
                  <div className={styles.detailIdentity}>
                    <span>{selectedProfile?.displayName?.slice(0, 1) || "A"}</span>
                    <div>
                      <p className={styles.kicker}>Selected profile</p>
                      <h2>{selectedProfile?.displayName || "No profile selected"}</h2>
                      <small>{selectedProfile ? titleize(selectedProfile.relationship) : "Create a roster member to begin."}</small>
                    </div>
                  </div>
                  <div className={styles.accessBadge}>
                    <LockKeyhole size={14} />
                    <span>
                      {activeProfilePreview?.decision?.accessDecision === "redacted"
                        ? "Redacted"
                        : "Scoped"}
                    </span>
                  </div>
                  <div className={styles.profileStats}>
                    <div>
                      <span>Consent</span>
                      <strong>{profileConsents.length}</strong>
                    </div>
                    <div>
                      <span>Staff</span>
                      <strong>{profileAssignments.length}</strong>
                    </div>
                    <div>
                      <span>Visible</span>
                      <strong>{activeProfilePreview?.decision?.allowedDataClasses?.length || 0}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.scopeGrid}>
                  {dataClasses.slice(0, 9).map((item) => {
                    const allowed = activeProfilePreview?.decision?.allowedDataClasses?.includes(item);
                    const redacted = activeProfilePreview?.decision?.redactedDataClasses?.includes(item);
                    return (
                      <div className={`${styles.scopeChip} ${allowed ? styles.scopeAllowed : ""}`} key={item}>
                        {allowed ? <CheckCircle2 size={14} /> : redacted ? <LockKeyhole size={14} /> : <ShieldCheck size={14} />}
                        <span>{labelDataClass(item)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.detailSplit}>
                  <SummaryList
                    empty="No consent captured."
                    items={profileConsents.map((consent) => ({
                      label: consent.purpose,
                      value: consent.dataClasses.map(labelDataClass).join(", "),
                    }))}
                    title="Consent scopes"
                  />
                  <SummaryList
                    empty="No staff assigned."
                    items={profileAssignments.map((assignment) => ({
                      label: titleize(assignment.role),
                      value: assignment.dataClasses.map(labelDataClass).join(", "),
                    }))}
                    title="Assignments"
                  />
                </div>
              </aside>
            </section>

            <section className={styles.formsGrid}>
              <WorkflowPanel icon={UsersRound} title="Create roster profile">
                <form className={styles.form} onSubmit={createRoster}>
                  <input name="displayName" placeholder="Maya Thompson" required />
                  <select name="relationship" defaultValue="client">
                    <option value="client">Client</option>
                    <option value="child">Child</option>
                    <option value="family">Family</option>
                    <option value="other">Other</option>
                  </select>
                  <button disabled={!workspaceId || submitting === "roster"} type="submit">Create profile</button>
                </form>
              </WorkflowPanel>

              <WorkflowPanel icon={UserPlus} title="Add staff">
                <form className={styles.form} onSubmit={addStaff}>
                  <input name="email" placeholder="coach@clinic.com" type="email" required />
                  <select name="role" defaultValue="coach">
                    {staffRoles.map((role) => <option key={role} value={role}>{titleize(role)}</option>)}
                  </select>
                  <button disabled={!workspaceId || submitting === "staff"} type="submit">Add staff</button>
                </form>
              </WorkflowPanel>

              <WorkflowPanel icon={FileCheck2} title="Capture consent">
                <form className={styles.form} onSubmit={captureConsent}>
                  <input name="subjectEmail" placeholder="member@email.com" type="email" />
                  <select name="purpose" defaultValue="performance_support">
                    <option value="clinical_care">Clinical care</option>
                    <option value="performance_support">Performance support</option>
                    <option value="team_operations">Team operations</option>
                    <option value="research">Research</option>
                    <option value="other">Other</option>
                  </select>
                  <select name="captureMethod" defaultValue="uploaded_form">
                    <option value="in_app">In app</option>
                    <option value="uploaded_form">Uploaded form</option>
                    <option value="esignature">E-signature</option>
                    <option value="imported_contract">Imported contract</option>
                    <option value="guardian">Guardian</option>
                  </select>
                  <select name="legalBasis" defaultValue="patient_consent">
                    <option value="patient_consent">Patient consent</option>
                    <option value="guardian_consent">Guardian consent</option>
                    <option value="treatment">Treatment</option>
                    <option value="contract">Contract</option>
                    <option value="other">Other</option>
                  </select>
                  <CheckboxGroup defaults={["coach", "trainer"]} name="allowedRoles" options={staffRoles} />
                  <CheckboxGroup defaults={[...consentDefaults]} name="dataClasses" options={dataClasses} />
                  <button disabled={!selectedProfile || submitting === "consent"} type="submit">Save consent</button>
                </form>
              </WorkflowPanel>

              <WorkflowPanel icon={ShieldCheck} title="Assign staff">
                <form className={styles.form} onSubmit={assignStaff}>
                  <select name="staffUserId" required>
                    <option value="">Choose staff</option>
                    {staff.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name || member.email || member.userId}
                      </option>
                    ))}
                  </select>
                  <select name="role" defaultValue="coach">
                    {staffRoles.map((role) => <option key={role} value={role}>{titleize(role)}</option>)}
                  </select>
                  <CheckboxGroup defaults={[...consentDefaults]} name="dataClasses" options={dataClasses} />
                  <button disabled={!selectedProfile || !staff.length || submitting === "assignment"} type="submit">Assign staff</button>
                </form>
              </WorkflowPanel>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function OrganizationForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
}) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <input name="name" placeholder="Northstar Performance Clinic" required />
      <select name="organizationSubtype" defaultValue="clinic">
        <option value="clinic">Clinic</option>
        <option value="sports_team">Sports team</option>
        <option value="performance_group">Performance group</option>
        <option value="concierge_practice">Concierge practice</option>
      </select>
      <button disabled={submitting} type="submit">Create organization</button>
    </form>
  );
}

function WorkflowPanel({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof UsersRound;
  title: string;
}) {
  return (
    <section className={styles.workflowPanel}>
      <div className={styles.workflowHeader}>
        <Icon size={18} />
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function CheckboxGroup({
  defaults,
  name,
  options,
}: {
  defaults: readonly string[];
  name: string;
  options: readonly string[];
}) {
  return (
    <div className={styles.checkboxGrid}>
      {options.map((option) => (
        <label key={`${name}-${option}`}>
          <input defaultChecked={defaults.includes(option)} name={name} type="checkbox" value={option} />
          <span>{labelDataClass(option)}</span>
        </label>
      ))}
    </div>
  );
}

function SummaryList({
  empty,
  items,
  title,
}: {
  empty: string;
  items: Array<{ label: string; value: string }>;
  title: string;
}) {
  return (
    <div className={styles.summaryList}>
      <h3>{title}</h3>
      {items.length ? items.slice(0, 4).map((item) => (
        <div key={`${item.label}-${item.value}`}>
          <strong>{titleize(item.label)}</strong>
          <span>{item.value || "No scoped data classes"}</span>
        </div>
      )) : <p>{empty}</p>}
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" }) {
  return <span className={`${styles.statusPill} ${tone === "ok" ? styles.statusOk : styles.statusWarn}`}>{label}</span>;
}

async function apiGet<T>(url: string): Promise<{ data: T; ok: true } | { message: string; ok: false; status: number }> {
  const response = await fetch(url, { credentials: "same-origin" });
  return parseApiResponse<T>(response);
}

async function apiPost<T = unknown>(
  url: string,
  payload: Record<string, FormDataEntryValue | FormDataEntryValue[] | null | string | undefined>
): Promise<{ data: T; ok: true } | { message: string; ok: false; status: number }> {
  const response = await fetch(url, {
    body: JSON.stringify(payload),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseApiResponse<T>(response);
}

async function parseApiResponse<T>(
  response: Response
): Promise<{ data: T; ok: true } | { message: string; ok: false; status: number }> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      message: typeof data.error === "string" ? data.error : "Request failed.",
      ok: false,
      status: response.status,
    };
  }
  return { data: data as T, ok: true };
}

function titleize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelDataClass(value: string) {
  const labels: Record<string, string> = {
    clinical_summary: "Clinical summary",
    labs_basic: "Basic labs",
    labs_sensitive: "Sensitive labs",
    mental_health: "Mental health",
  };
  return labels[value] || titleize(value);
}
