"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import styles from "./professional-invite.module.css";

type Invitation = {
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
      setStatus("ready");
    }

    void loadInvitation();
  }, [inviteToken]);

  async function acceptInvite() {
    setMessage("");
    const response = await fetch(`/api/professional/invitations/${inviteToken}`, {
      credentials: "same-origin",
      method: "POST",
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
              {invitation?.inviteType === "roster_member" ? " to claim a roster profile." : " to join the organization workspace."}
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
