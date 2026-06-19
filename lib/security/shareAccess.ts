import { createHash, randomBytes, timingSafeEqual } from "crypto";

function shareSalt() {
  const salt = process.env.SHARE_ACCESS_SALT || process.env.OPENAI_SAFETY_SALT;

  if (salt) return salt;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Production share-code hashing requires SHARE_ACCESS_SALT.");
  }

  return process.env.NEXT_PUBLIC_SUPABASE_URL || "aeonvera-local-share-salt";
}

export function createShareAccessCode() {
  // 64-bit code (was 32-bit). This is the sole secret gating PHI share bundles,
  // and the token endpoints are only IP-throttled, so entropy is the real defense.
  return randomBytes(8).toString("hex").toUpperCase();
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
