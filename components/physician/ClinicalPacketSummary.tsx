import type { ReactNode } from "react";

type ClinicalPacket = {
  activeProtocol?: {
    detail: string;
    domains: string[];
    status?: string | null;
    title: string;
  } | null;
  executiveSummary: string;
  recentChanges: Array<{
    detail: string;
    label: string;
    tone: "positive" | "caution" | "neutral";
  }>;
  reviewPriorities: string[];
  riskFlags: Array<{
    detail: string;
    label: string;
    severity: "high" | "medium" | "watch";
  }>;
};

export default function ClinicalPacketSummary({
  packet,
  role = "physician",
}: {
  packet?: ClinicalPacket | null;
  role?: "physician" | "coach" | "family";
}) {
  if (!packet) return null;

  const roleCopy = ROLE_COPY[role];
  const visibleRiskFlags = role === "family"
    ? packet.riskFlags.slice(0, 2)
    : packet.riskFlags;
  const visiblePriorities = role === "family"
    ? packet.reviewPriorities.slice(0, 3)
    : packet.reviewPriorities;

  return (
    <section className="mb-8 break-inside-avoid">
      <div className="rounded-lg border border-[rgba(var(--gold),0.18)] bg-[rgba(var(--gold),0.045)] p-5 print:border-black/15 print:bg-white">
        <div className="mb-5 border-b border-white/[0.07] pb-4 print:border-black/15">
          <p className="micro-label print:text-black/50">Clinical Packet</p>
          <h2 className="mt-3 text-2xl font-light text-white print:text-black">
            {roleCopy.title}
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/62 print:text-black/70">
            {roleCopy.prefix} {packet.executiveSummary}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <ClinicalPacketBlock title="Risk flags">
              {visibleRiskFlags.length ? (
                visibleRiskFlags.map((flag) => (
                  <div
                    key={`${flag.label}-${flag.detail}`}
                    className="rounded-lg border border-white/[0.06] bg-black/20 p-3 print:border-black/10 print:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-white/76 print:text-black">{flag.label}</p>
                      <span className={severityClassName(flag.severity)}>
                        {flag.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/42 print:text-black/65">
                      {flag.detail}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-white/42 print:text-black/60">
                  No elevated risk flags were included in this packet.
                </p>
              )}
            </ClinicalPacketBlock>

            <ClinicalPacketBlock title="Recent changes">
              {packet.recentChanges.length ? (
                packet.recentChanges.map((change) => (
                  <div
                    key={`${change.label}-${change.detail}`}
                    className="rounded-lg border border-white/[0.06] bg-black/20 p-3 print:border-black/10 print:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-white/76 print:text-black">{change.label}</p>
                      <span className={toneClassName(change.tone)}>{change.tone}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/42 print:text-black/65">
                      {change.detail}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-white/42 print:text-black/60">
                  No recent directional change is available yet.
                </p>
              )}
            </ClinicalPacketBlock>
          </div>

          <div className="space-y-4">
            <ClinicalPacketBlock title="Review priorities">
              <div className="space-y-2">
                {visiblePriorities.map((priority, index) => (
                  <div
                    key={`${priority}-${index}`}
                    className="rounded-lg border border-white/[0.06] bg-black/20 p-3 print:border-black/10 print:bg-white"
                  >
                    <p className="text-xs leading-5 text-white/52 print:text-black/68">
                      {priority}
                    </p>
                  </div>
                ))}
              </div>
            </ClinicalPacketBlock>

            {packet.activeProtocol && (
              <ClinicalPacketBlock title="Active protocol">
                <div className="rounded-lg border border-white/[0.06] bg-black/20 p-4 print:border-black/10 print:bg-white">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-white/78 print:text-black">
                        {packet.activeProtocol.title}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-white/42 print:text-black/65">
                        {packet.activeProtocol.detail}
                      </p>
                    </div>
                    {packet.activeProtocol.status && (
                      <span className="av-eyebrow rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-white/38 print:border-black/15 print:text-black/55">
                        {packet.activeProtocol.status}
                      </span>
                    )}
                  </div>
                  {packet.activeProtocol.domains.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {packet.activeProtocol.domains.map((domain) => (
                        <span
                          key={domain}
                          className="av-eyebrow rounded-md border border-[rgba(var(--gold),0.2)] bg-[rgba(var(--gold),0.06)] px-2 py-1 royal-text print:border-black/15 print:text-black/60"
                        >
                          {domain}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </ClinicalPacketBlock>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const ROLE_COPY = {
  physician: {
    title: "Executive clinical review summary",
    prefix: "Designed for clinician review.",
  },
  coach: {
    title: "Execution support summary",
    prefix: "Designed for coaching and behavior support.",
  },
  family: {
    title: "Family healthspan summary",
    prefix: "Designed as a high-level support view.",
  },
};

function ClinicalPacketBlock({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div>
      <p className="av-eyebrow mb-3 text-white/32 print:text-black/45">
        {title}
      </p>
      {children}
    </div>
  );
}

function severityClassName(severity: ClinicalPacket["riskFlags"][number]["severity"]) {
  const base = "av-eyebrow rounded-md px-2 py-1";

  if (severity === "high") return `${base} bg-rose-400/[0.1] text-rose-200/78 print:bg-black/5 print:text-black/70`;
  if (severity === "medium") return `${base} bg-[rgba(var(--gold),0.08)] royal-text print:bg-black/5 print:text-black/70`;
  return `${base} bg-white/[0.04] text-white/40 print:bg-black/5 print:text-black/55`;
}

function toneClassName(tone: ClinicalPacket["recentChanges"][number]["tone"]) {
  const base = "av-eyebrow rounded-md px-2 py-1";

  if (tone === "positive") return `${base} bg-[rgba(var(--gold),0.08)] royal-text print:bg-black/5 print:text-black/70`;
  if (tone === "caution") return `${base} bg-rose-400/[0.1] text-rose-200/78 print:bg-black/5 print:text-black/70`;
  return `${base} bg-white/[0.04] text-white/40 print:bg-black/5 print:text-black/55`;
}
