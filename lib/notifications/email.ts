type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type EmailResult =
  | { status: "sent"; provider: "resend"; providerMessageId?: string }
  | { status: "skipped"; provider: "resend"; error: string };

export async function sendCoachEmail({
  to,
  subject,
  text,
  html,
}: SendEmailParams): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Aeonvera <coach@aeonvera.app>";

  if (!apiKey) {
    return {
      status: "skipped",
      provider: "resend",
      error: "Missing RESEND_API_KEY",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      status: "skipped",
      provider: "resend",
      error: data?.message || "Resend email failed",
    };
  }

  return {
    status: "sent",
    provider: "resend",
    providerMessageId: typeof data?.id === "string" ? data.id : undefined,
  };
}
