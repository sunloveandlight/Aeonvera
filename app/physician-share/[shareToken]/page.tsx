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

type ShareMeta = {
  expiresAt?: string;
  recipientLabel?: string | null;
};

export default function SharedPhysicianExportPage() {
  const params = useParams<{ shareToken: string }>();
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [share, setShare] = useState<ShareMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [codeRequired, setCodeRequired] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadShare(code = "") {
      setLoading(true);
      setMessage(null);

      try {
        const query = code ? `?code=${encodeURIComponent(code)}` : "";
        const response = await fetch(`/api/physician-share/${params.shareToken}${query}`);
        const data = await response.json();

        if (!response.ok) {
          if (data.codeRequired) {
            setCodeRequired(true);
          }
          throw new Error(data.error || "Could not load this shared export.");
        }

        if (!cancelled) {
          setCodeRequired(false);
          setBundle(data.bundle);
          setShare(data.share || null);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "Could not load this shared export."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (params.shareToken) void loadShare();

    return () => {
      cancelled = true;
    };
  }, [params.shareToken]);

  function submitAccessCode() {
    if (!accessCode.trim()) return;
    void loadShareWithCode({
      code: accessCode,
      setBundle,
      setCodeRequired,
      setLoading,
      setMessage,
      setShare,
      shareToken: params.shareToken,
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
            eyebrow="Secure Export"
            title="Opening the clinical summary."
            body="Aeonvera is preparing the shared read-only healthspan export."
            actions={[{ href: "/", label: "Aeonvera", variant: "secondary" }]}
          />
        ) : codeRequired ? (
          <AccessCodePanel
            body={message || "This export requires the access code shared by the Aeonvera member."}
            code={accessCode}
            eyebrow="Secure Export"
            title="Enter the access code."
            onChange={setAccessCode}
            onSubmit={submitAccessCode}
          />
        ) : message ? (
          <AccessState
            eyebrow="Share Unavailable"
            title="This secure export cannot be opened."
            body={message}
            actions={[{ href: "/", label: "Aeonvera", variant: "secondary" }]}
          />
        ) : bundle ? (
          <ClinicalShareDocument
            bundle={bundle}
            expiresAt={share?.expiresAt}
            eyebrow="Aeonvera Secure Clinical Share"
            footer="This secure export is an informational longitudinal health summary, not a diagnosis or emergency medical record."
            title="Read-only healthspan summary"
          />
        ) : null}
      </div>
    </PageContainer>
  );
}

async function loadShareWithCode({
  code,
  setBundle,
  setCodeRequired,
  setLoading,
  setMessage,
  setShare,
  shareToken,
}: {
  code: string;
  setBundle: (bundle: ExportBundle | null) => void;
  setCodeRequired: (required: boolean) => void;
  setLoading: (loading: boolean) => void;
  setMessage: (message: string | null) => void;
  setShare: (share: ShareMeta | null) => void;
  shareToken: string;
}) {
  setLoading(true);
  setMessage(null);

  try {
    const response = await fetch(
      `/api/physician-share/${shareToken}?code=${encodeURIComponent(code)}`
    );
    const data = await response.json();

    if (!response.ok) {
      if (data.codeRequired) setCodeRequired(true);
      throw new Error(data.error || "Could not load this shared export.");
    }

    setCodeRequired(false);
    setBundle(data.bundle);
    setShare(data.share || null);
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Could not load this shared export."
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
          Open export
        </button>
      </div>
    </div>
  );
}
