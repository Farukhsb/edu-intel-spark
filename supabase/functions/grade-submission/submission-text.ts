function normalizeFingerprintText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitNameTokens(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

export function blindSubmissionText({
  text,
  studentName,
  studentEmail,
  fileName,
}: {
  text: string;
  studentName?: string | null;
  studentEmail?: string | null;
  fileName?: string | null;
}) {
  let blinded = text;
  const exactRedactions = new Set<string>();

  for (const candidate of [studentName, studentEmail, fileName]) {
    if (candidate && candidate.trim()) {
      exactRedactions.add(candidate.trim());
    }
  }

  for (const token of splitNameTokens(studentName)) exactRedactions.add(token);
  for (const token of splitNameTokens(studentEmail)) exactRedactions.add(token);
  for (const token of splitNameTokens(fileName)) exactRedactions.add(token);

  for (const token of Array.from(exactRedactions).sort((a, b) => b.length - a.length)) {
    const pattern = new RegExp(escapeRegex(token), "gi");
    blinded = blinded.replace(pattern, "[REDACTED]");
  }

  const identityLinePatterns = [
    /^\s*(name|student name|candidate name|student|learner|submitted by)\s*:\s*.+$/gim,
    /^\s*(email|student email|candidate email)\s*:\s*.+$/gim,
    /^\s*(student id|candidate id|matric(?:ulation)? no|registration no|reg no)\s*:\s*.+$/gim,
  ];

  for (const pattern of identityLinePatterns) {
    blinded = blinded.replace(pattern, "[REDACTED IDENTITY LINE]");
  }

  return blinded
    .replace(/\[REDACTED\](\s+\[REDACTED\])+/g, "[REDACTED]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function computeContentFingerprint(assignmentId: string, text: string) {
  const normalized = normalizeFingerprintText(text);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${assignmentId}:${(hash >>> 0).toString(16)}:${normalized.length}`;
}
