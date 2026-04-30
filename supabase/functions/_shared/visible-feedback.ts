const VISIBLE_FAIRNESS_FEEDBACK_PATTERNS = [
  /\[?\s*Initial AI score was inconsistent with feedback\.\s*A fairness adjustment was applied\.\s*\]?/gi,
  /\[?\s*Initial AI score was inconsistent with UK marking bands\.\s*A fairness recalibration was applied and lecturer review is recommended\.\s*\]?/gi,
];

export function sanitizeVisibleAiFeedback(feedback: string | null | undefined) {
  const input = typeof feedback === "string" ? feedback : "";
  if (!input.trim()) return "";

  let sanitized = input;
  for (const pattern of VISIBLE_FAIRNESS_FEEDBACK_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  return sanitized
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
