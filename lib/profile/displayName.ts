export function cleanDisplayName(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (/^(you|user|aeonvera user)$/i.test(normalized)) return "";
  return normalized;
}

export function displayNameFromEmail(email: unknown) {
  if (typeof email !== "string") return "";
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return "";
  const words = localPart
    .replace(/[._+-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function resolveDisplayName(...values: unknown[]) {
  for (const value of values) {
    const cleaned = cleanDisplayName(value);
    if (cleaned) return cleaned;
  }
  return "";
}

export function possessiveName(name: string) {
  if (!name) return "Your";
  return `${name}${name.endsWith("s") ? "'" : "'s"}`;
}
