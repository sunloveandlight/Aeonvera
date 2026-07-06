import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userEmail: null,
      userId: null,
    };
  }

  return { response: null, userEmail: user.email || null, userId: user.id };
}

export function getWorkspaceId(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : "";
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
