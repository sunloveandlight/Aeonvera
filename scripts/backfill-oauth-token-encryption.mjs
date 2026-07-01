import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const TOKEN_PREFIX = "av1:";
const TABLES = ["wearable_connections", "calendar_connections"];
const TOKEN_COLUMNS = ["access_token", "refresh_token"];

function loadEnvFile() {
  const index = process.argv.indexOf("--dotenv");
  const envPath = process.env.AEONVERA_ENV_FILE;
  if (index === -1 && !envPath) return;

  const path = envPath || process.argv[index + 1];
  if (!path) throw new Error("Missing value for --dotenv.");

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;

    const key = trimmed.slice(0, equals);
    let value = trimmed.slice(equals + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ||= value;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function keyFor(secret) {
  return createHash("sha256").update(secret).digest();
}

function encryptToken(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${TOKEN_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

function decryptEncryptedToken(value, secret) {
  const payload = Buffer.from(value.slice(TOKEN_PREFIX.length), "base64url");
  if (payload.length <= 28) throw new Error("Encrypted token payload is invalid.");

  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyFor(secret), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function candidateSecrets() {
  return [
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY,
    process.env.SHARE_ACCESS_SALT,
    process.env.CRON_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter(Boolean);
}

function normalizeToken(value, targetSecret, secrets) {
  if (!value) return { value, changed: false, source: "empty" };

  if (!value.startsWith(TOKEN_PREFIX)) {
    return {
      value: encryptToken(value, targetSecret),
      changed: true,
      source: "plaintext",
    };
  }

  for (const secret of secrets) {
    try {
      const decrypted = decryptEncryptedToken(value, secret);
      const encrypted = encryptToken(decrypted, targetSecret);
      return {
        value: encrypted,
        changed: encrypted !== value,
        source: secret === targetSecret ? "current-key" : "legacy-key",
      };
    } catch {
      // Try the next historical secret.
    }
  }

  throw new Error("Could not decrypt an existing encrypted token with any known secret.");
}

async function main() {
  loadEnvFile();

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const targetSecret = requiredEnv("OAUTH_TOKEN_ENCRYPTION_KEY");
  const secrets = candidateSecrets();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary = {};

  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${TOKEN_COLUMNS.join(", ")}`);

    if (error) throw new Error(`${table}: ${error.message}`);

    summary[table] = {
      scanned: data.length,
      updatedRows: 0,
      plaintextTokens: 0,
      legacyKeyTokens: 0,
      currentKeyTokens: 0,
      emptyTokens: 0,
    };

    for (const row of data) {
      const update = {};

      for (const column of TOKEN_COLUMNS) {
        const normalized = normalizeToken(row[column], targetSecret, secrets);
        if (normalized.source === "plaintext") summary[table].plaintextTokens += 1;
        if (normalized.source === "legacy-key") summary[table].legacyKeyTokens += 1;
        if (normalized.source === "current-key") summary[table].currentKeyTokens += 1;
        if (normalized.source === "empty") summary[table].emptyTokens += 1;
        if (normalized.changed) update[column] = normalized.value;
      }

      if (Object.keys(update).length === 0) continue;

      update.updated_at = new Date().toISOString();
      const { error: updateError } = await supabase.from(table).update(update).eq("id", row.id);
      if (updateError) throw new Error(`${table} ${row.id}: ${updateError.message}`);
      summary[table].updatedRows += 1;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
