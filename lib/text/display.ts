export function sentenceDisplay(value?: string | null, fallback = "Not yet") {
  const text = value?.trim();
  if (!text) return fallback;

  const normalized = text.replace(/\s+/g, " ");
  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}
