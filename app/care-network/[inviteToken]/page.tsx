"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import AccessState from "@/components/ui/AccessState";
import ClinicalShareDocument, {
  type ClinicalShareBundle,
} from "@/components/physician/ClinicalShareDocument";

type ExportBundle = ClinicalShareBundle;

type NetworkInvitation = {
  expiresAt?: string;
  memberEmail?: string;
  memberName?: string | null;
  role: "physician" | "coach" | "family";
};

const ROLE_LABEL = {
  physician: "Physician view",
  coach: "Coach view",
  family: "Family view",
};

export default function CareNetworkPortalPage() {
  const params = useParams<{ inviteToken: string }>();
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [invitation, setInvitation] = useState<NetworkInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [codeRequired, setCodeRequired] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation(code = "") {
      setLoading(true);
      setMessage(null);

      try {
        const query = code ? `?code=${encodeURIComponent(code)}` : "";
        const response = await fetch(`/api/care-network/${params.inviteToken}${query}`);
        const data = await response.json();

        if (!response.ok) {
          if (data.codeRequired) {
            setCodeRequired(true);
          }
          throw new Error(data.error || "Could not open this care network invitation.");
        }

        if (!cancelled) {
          setCodeRequired(false);
          setBundle(data.bundle);
          setInvitation(data.invitation);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not open this care network invitation."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (params.inviteToken) void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [params.inviteToken]);

  function submitAccessCode() {
    if (!accessCode.trim()) return;
    void loadInvitationWithCode({
      code: accessCode,
      inviteToken: params.inviteToken,
      setBundle,
      setCodeRequired,
      setInvitation,
      setLoading,
      setMessage,
    });
  }

  return (
    <PageContainer>
      <div className="py-14 print:bg-white print:py-0">
        <div className="mb-8 flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="premium-action inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium"
          >
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>

        {loading ? (
          <AccessState
            eyebrow="Care Network"
            title="Opening the shared healthspan view."
            body="Aeonvera is preparing the role-based read-only intelligence view."
            actions={[{ href: "/", label: "Aeonvera", variant: "secondary" }]}
          />
        ) : codeRequired ? (
          <AccessCodePanel
            body={message || "This care network view requires the access code shared by the Aeonvera member."}
            code={accessCode}
            eyebrow="Care Network"
            title="Enter the access code."
            onChange={setAccessCode}
            onSubmit={submitAccessCode}
          />
        ) : message ? (
          <AccessState
            eyebrow="Invitation Unavailable"
            title="This care network invitation cannot be opened."
            body={message}
            actions={[{ href: "/", label: "Aeonvera", variant: "secondary" }]}
          />
        ) : bundle && invitation ? (
          <ClinicalShareDocument
            bundle={bundle}
            expiresAt={invitation.expiresAt}
            eyebrow="Aeonvera Care Network"
            footer="This care network view is read-only and informational. It is not a diagnosis, prescription, or emergency medical record."
            role={invitation.role}
            showShield
            title={ROLE_LABEL[invitation.role]}
          />
        ) : null}
      </div>
    </PageContainer>
  );
}

async function loadInvitationWithCode({
  code,
  inviteToken,
  setBundle,
  setCodeRequired,
  setInvitation,
  setLoading,
  setMessage,
}: {
  code: string;
  inviteToken: string;
  setBundle: (bundle: ExportBundle | null) => void;
  setCodeRequired: (required: boolean) => void;
  setInvitation: (invitation: NetworkInvitation | null) => void;
  setLoading: (loading: boolean) => void;
  setMessage: (message: string | null) => void;
}) {
  setLoading(true);
  setMessage(null);

  try {
    const response = await fetch(
      `/api/care-network/${inviteToken}?code=${encodeURIComponent(code)}`
    );
    const data = await response.json();

    if (!response.ok) {
      if (data.codeRequired) setCodeRequired(true);
      throw new Error(data.error || "Could not open this care network invitation.");
    }

    setCodeRequired(false);
    setBundle(data.bundle);
    setInvitation(data.invitation);
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Could not open this care network invitation."
    );
  } finally {
    setLoading(false);
  }
}

function AccessCodePanel({
  body,
  code,
  eyebrow,
  onChange,
  onSubmit,
  title,
}: {
  body: string;
  code: string;
  eyebrow: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-white/[0.08] bg-white/[0.03] p-8">
      <p className="micro-label">{eyebrow}</p>
      <h1 className="mt-4 text-4xl font-light text-white">{title}</h1>
      <p className="mt-4 text-sm leading-7 text-white/50">{body}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
          }}
          className="h-11 flex-1 rounded-md border border-white/[0.08] bg-black/20 px-3 text-sm uppercase tracking-[0.08em] text-white/70 outline-none placeholder:text-white/24"
          placeholder="Access code"
        />
        <button
          type="button"
          onClick={onSubmit}
          className="premium-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
        >
          Open view
        </button>
      </div>
    </div>
  );
}
