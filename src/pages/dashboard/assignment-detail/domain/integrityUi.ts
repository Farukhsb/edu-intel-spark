import type { PlagiarismFlag } from "@/pages/dashboard/assignment-detail/types";

type IntegrityToastTone = "success" | "warning";
type IntegrityCardTone = "clear" | "limited" | "flagged";

const LIMITATION_MARKERS = [
  "limit",
  "skipped",
  "failed",
  "could not",
  "warning",
  "degraded",
  "longer than usual",
  "partial",
];

const normalizeMessage = (value: string) => value.trim();

const dedupeMessages = (values: string[]) =>
  Array.from(
    new Set(values.map(normalizeMessage).filter((value) => value.length > 0)),
  );

const summaryIndicatesLimitations = (summary: string) => {
  const normalizedSummary = summary.toLowerCase();
  return LIMITATION_MARKERS.some((marker) => normalizedSummary.includes(marker));
};

export type IntegrityClientOutcome = {
  summary: string;
  toastMessage: string;
  toastTone: IntegrityToastTone;
};

export type IntegrityCardPresentation = {
  badgeLabel: string;
  cardTone: IntegrityCardTone;
  shouldShowCard: boolean;
};

export function buildIntegrityClientOutcome({
  flags,
  summaries,
  warnings,
  failedBatches,
}: {
  flags: PlagiarismFlag[];
  summaries: string[];
  warnings: string[];
  failedBatches: number;
}): IntegrityClientOutcome {
  const primarySummary = dedupeMessages(summaries)[0] ?? "";
  const uniqueWarnings = dedupeMessages(warnings);
  const summaryParts: string[] = [];

  if (uniqueWarnings.length > 0) {
    summaryParts.push(...uniqueWarnings);
  }

  if (primarySummary && !summaryParts.includes(primarySummary)) {
    summaryParts.push(primarySummary);
  }

  if (failedBatches > 0) {
    summaryParts.push(`${failedBatches} batch(es) could not be analysed and were skipped.`);
  }

  const summary =
    summaryParts.join(" ") ||
    primarySummary ||
    (flags.length > 0 ? "Integrity analysis completed." : "No suspicious similarities found.");
  const hasLimitations =
    uniqueWarnings.length > 0 || failedBatches > 0 || summaryIndicatesLimitations(summary);

  if (flags.length > 0) {
    return {
      summary,
      toastTone: "warning",
      toastMessage: hasLimitations
        ? `${flags.length} potential issue(s) flagged. Analysis completed with limitations.`
        : `${flags.length} potential issue(s) flagged`,
    };
  }

  if (hasLimitations) {
    return {
      summary,
      toastTone: "warning",
      toastMessage: uniqueWarnings[0] ?? "Integrity analysis completed with limitations.",
    };
  }

  return {
    summary,
    toastTone: "success",
    toastMessage: "No suspicious similarities found",
  };
}

export function deriveIntegrityCardPresentation({
  flags,
  summary,
}: {
  flags: PlagiarismFlag[];
  summary: string;
}): IntegrityCardPresentation {
  const normalizedSummary = normalizeMessage(summary);
  const hasLimitations = normalizedSummary.length > 0 && summaryIndicatesLimitations(normalizedSummary);

  if (flags.length > 0) {
    return {
      badgeLabel: `${flags.length} flag(s)`,
      cardTone: "flagged",
      shouldShowCard: true,
    };
  }

  if (hasLimitations) {
    return {
      badgeLabel: "Limited coverage",
      cardTone: "limited",
      shouldShowCard: true,
    };
  }

  return {
    badgeLabel: normalizedSummary ? "Clear" : "",
    cardTone: "clear",
    shouldShowCard: normalizedSummary.length > 0,
  };
}
