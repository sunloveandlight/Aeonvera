/**
 * AEONVERA SYSTEM RULES
 * Prevents UI drift across pages
 */

export function enforceSystemClass(name: string) {
  const allowed = [
    "aeonvera-system",
    "aeonvera-content",
    "aeonvera-action",
    "aeonvera-warning",
    "aeonvera-success",
  ];

  return allowed.includes(name);
}