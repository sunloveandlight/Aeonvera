import { createHash, randomBytes, timingSafeEqual } from "crypto";

const FALLBACK_SALT = "aeonvera-secure-share";

function shareSalt() {
  return (
    process.env.SHARE_ACCESS_SALT ||
    process.env.OPENAI_SAFETY_SALT ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    FALLBACK_SALT
  );
}

export function createShareAccessCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function normalizeShareAccessCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[\s-]/g, "").trim().toUpperCase().slice(0, 32);
}

export function hashShareAccessCode(code: string) {
  return createHash("sha256")
    .update(`${shareSalt()}:${normalizeShareAccessCode(code)}`)
    .digest("hex");
}

export function verifyShareAccessCode(value: unknown, expectedHash?: string | null) {
  if (!expectedHash) return true;

  const code = normalizeShareAccessCode(value);
  if (!code) return false;

  try {
    const expected = Buffer.from(expectedHash, "hex");
    const actual = Buffer.from(hashShareAccessCode(code), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
