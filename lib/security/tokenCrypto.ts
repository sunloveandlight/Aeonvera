import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const TOKEN_PREFIX = "av1:";

function tokenEncryptionSecret() {
  const secret = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Production OAuth token encryption requires OAUTH_TOKEN_ENCRYPTION_KEY.");
  }

  return "aeonvera-local-token-encryption-key";
}

function tokenKey() {
  return createHash("sha256").update(tokenEncryptionSecret()).digest();
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${TOKEN_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function decryptToken(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith(TOKEN_PREFIX)) return value;

  const payload = Buffer.from(value.slice(TOKEN_PREFIX.length), "base64url");
  if (payload.length <= 28) throw new Error("Encrypted token payload is invalid.");

  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
