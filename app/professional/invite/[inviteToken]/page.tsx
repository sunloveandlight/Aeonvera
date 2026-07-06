import type { Metadata } from "next";
import ProfessionalInviteClient from "./ProfessionalInviteClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Professional Invitation",
};

export default async function ProfessionalInvitePage(
  props: {
    params: Promise<{ inviteToken: string }>;
  }
) {
  const { inviteToken } = await props.params;
  return <ProfessionalInviteClient inviteToken={inviteToken} />;
}
