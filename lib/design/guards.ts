const forbiddenPatterns = [
  {
    name: "raw rgba usage",
    pattern: /rgba\(/g,
    message: "Use colors from /lib/design/tokens.ts instead of raw rgba().",
  },
  {
    name: "opacity decimals",
    pattern: /opacity-\[(0\.\d+)\]/g,
    message: "Use tokenized opacity via design system instead of arbitrary opacity.",
  },
  {
    name: "negative spacing abuse",
    pattern: /-(m|p)-\d+/g,
    message: "Avoid arbitrary negative spacing. Use Section/Page system instead.",
  },
];

export function runDesignGuard(code: string) {
  const issues: string[] = [];

  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(code)) {
      issues.push(rule.message);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}