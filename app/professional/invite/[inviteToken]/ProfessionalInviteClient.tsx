"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import styles from "./professional-invite.module.css";

type Invitation = {
  consentRoles?: string[];
  dataClasses?: string[];
  email: string;
  expiresAt: string;
  inviteType: "roster_member" | "staff";
  name?: string | null;
  role: string;
  status: string;
};

type Workspace = {
  name: string;
  organizationSubtype?: string | null;
};

type LoadState = "accepted" | "error" | "loading" | "ready" | "unauthorized";

export default function ProfessionalInviteClient({ inviteToken }: { inviteToken: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [selectedDataClasses, setSelectedDataClasses] = useState<string[]>([]);

  useEffect(() => {
    async function loadInvitation() {
      setStatus("loading");
      const response = await fetch(`/api/professional/invitations/${inviteToken}`);
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setStatus("unauthorized");
        setMessage("Sign in with the invited email address to view and accept this invitation.");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        setMessage(data.error || "This invitation could not be opened.");
        return;
      }
      setInvitation(data.invitation || null);
      setWorkspace(data.workspace || null);
      setSelectedDataClasses(data.invitation?.dataClasses || []);
      setStatus("ready");
    }

    void loadInvitation();
  }, [inviteToken]);

  async function acceptInvite() {
    setMessage("");
    const response = await fetch(`/api/professional/invitations/${inviteToken}`, {
      body: JSON.stringify({ consentDataClasses: selectedDataClasses }),
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setStatus("unauthorized");
      setMessage("Sign in with the invited email address to accept this invitation.");
      return;
    }
    if (!response.ok) {
      setMessage(data.error || "This invitation could not be accepted.");
      return;
    }
    setInvitation(data.invitation || invitation);
    setStatus("accepted");
    setMessage("Invitation accepted.");
  }

  const expired = invitation?.status === "expired";
  const closed = invitation?.status === "accepted" || invitation?.status === "revoked" || expired;
  const rosterInvite = invitation?.inviteType === "roster_member";

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.mark} aria-hidden="true">
          {status === "accepted" ? <CheckCircle2 size={22} /> : <ShieldCheck size={22} />}
        </div>
        <p className={styles.kicker}>Aeonvera Professional</p>
        <h1>{workspace?.name || "Professional invitation"}</h1>
        {status === "loading" ? (
          <p className={styles.copy}>Opening secure invitation...</p>
        ) : status === "unauthorized" ? (
          <>
            <p className={styles.copy}>{message}</p>
            <Link className={styles.primaryButton} href="/login">
              Sign in
            </Link>
          </>
        ) : status === "error" ? (
          <p className={styles.copy}>{message}</p>
        ) : (
          <>
            <p className={styles.copy}>
              {invitation?.name || invitation?.email} has been invited as{" "}
              <strong>{titleize(invitation?.role || "member")}</strong>
              {rosterInvite ? " to claim a roster profile." : " to join the organization workspace."}
            </p>
            <div className={styles.details}>
              <div>
                <span>Email</span>
                <strong>{invitation?.email}</strong>
              </div>
              <div>
                <span>Type</span>
                <strong>{titleize(invitation?.inviteType || "staff")}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{titleize(invitation?.status || "pending")}</strong>
              </div>
              <div>
                <span>Expires</span>
                <strong>{invitation?.expiresAt ? formatDate(invitation.expiresAt) : "Soon"}</strong>
              </div>
            </div>
            {rosterInvite && invitation?.dataClasses?.length ? (
              <section className={styles.consentBox} aria-labelledby="professional-consent-scope">
                <div>
                  <p className={styles.kicker}>Consent scope</p>
                  <h2 id="professional-consent-scope">Choose what this organization may access</h2>
                  <p>
                    You can join the roster without granting every requested data class. Selected classes
                    create an in-app consent record that you can revoke later.
                  </p>
                </div>
                <div className={styles.scopeList}>
                  {invitation.dataClasses.map((dataClass) => (
                    <label key={dataClass} className={styles.scopeItem}>
                      <input
                        checked={selectedDataClasses.includes(dataClass)}
                        onChange={() => {
                          setSelectedDataClasses((current) =>
                            current.includes(dataClass)
                              ? current.filter((item) => item !== dataClass)
                              : [...current, dataClass]
                          );
                        }}
                        type="checkbox"
                      />
                      <span>
                        <strong>{DATA_CLASS_LABELS[dataClass] || titleize(dataClass)}</strong>
                        <small>{DATA_CLASS_DETAILS[dataClass] || "Profile information requested by the organization."}</small>
                      </span>
                    </label>
                  ))}
                </div>
                {invitation.consentRoles?.length ? (
                  <p className={styles.roleNote}>
                    Selected consent may be used by: {invitation.consentRoles.map(titleize).join(", ")}.
                  </p>
                ) : null}
              </section>
            ) : null}
            {message ? <div className={styles.notice}>{message}</div> : null}
            {status === "accepted" ? (
              <Link className={styles.primaryButton} href="/dashboard">
                Continue to Aeonvera
              </Link>
            ) : (
              <button className={styles.primaryButton} disabled={closed} onClick={acceptInvite} type="button">
                <LockKeyhole size={16} />
                Accept invitation
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function titleize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

const DATA_CLASS_LABELS: Record<string, string> = {
  administrative: "Administrative details",
  clinical_summary: "Clinical summary",
  documents: "Documents",
  identity: "Identity",
  labs_basic: "Basic labs",
  labs_sensitive: "Sensitive labs",
  mental_health: "Mental health",
  notes: "Staff notes",
  nutrition: "Nutrition",
  performance: "Performance",
  readiness: "Readiness",
};

const DATA_CLASS_DETAILS: Record<string, string> = {
  administrative: "Scheduling, roster, and care operations details.",
  clinical_summary: "A clinician-facing summary of health status and context.",
  documents: "Uploaded records and files connected to this profile.",
  identity: "Name, email, roster identity, and profile relationship.",
  labs_basic: "Common biomarkers and lab trend context.",
  labs_sensitive: "Sensitive biomarkers and deeper clinical lab context.",
  mental_health: "Mental-health notes or related self-reported context.",
  notes: "Organization notes associated with this profile.",
  nutrition: "Nutrition pattern and protocol-support context.",
  performance: "Training, recovery, and performance context.",
  readiness: "Readiness, sleep, recovery, and wearable summaries.",
};
