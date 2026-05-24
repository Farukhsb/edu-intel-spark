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

export type IntegrityDisplayMetric = {
  label: string;
  value: string;
};

const ACTION_RANK: Record<NonNullable<PlagiarismFlag["recommended_action"]>, number> = {
  clear: 0,
  review: 1,
  investigate: 2,
};

const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const normalizePairKey = (flag: PlagiarismFlag) =>
  [flag.submission_a_id || "", flag.submission_b_id || ""].sort().join("::");

const dedupeText = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim() || "").filter(Boolean)));

const buildIntegrityReason = (flag: PlagiarismFlag) => {
  const similarity = flag.similarity_score || 0;
  const ai = flag.ai_suspicion_score || 0;
  const baseline = flag.baseline_deviation_score || 0;
  const uncited = flag.overlap_analysis?.uncited_overlap || 0;
  const cited = flag.overlap_analysis?.cited_overlap || 0;

  if (ai >= 45 && similarity >= 45) {
    return uncited >= 25
      ? "Combined AI-writing signals and substantive uncited overlap warrant lecturer review."
      : "Combined AI-writing signals and similarity indicators warrant lecturer review.";
  }

  if (ai >= 45) {
    return "AI-writing indicators are the primary concern and should be reviewed by a lecturer.";
  }

  if (baseline >= 45 && similarity < 25) {
    return "The submission departs materially from the student's prior writing profile and should be reviewed.";
  }

  if (similarity >= 45) {
    if (uncited >= 25) {
      return "Substantive uncited overlap was detected within this assignment cohort and should be reviewed.";
    }

    if (cited >= uncited && cited >= 10) {
      return "Most of the detected overlap appears in cited material, but the similarity level still warrants lecturer review.";
    }

    return "Similarity in language or structure within this assignment cohort warrants lecturer review.";
  }

  if ((flag.total_risk_score || 0) >= 25) {
    return "One or more integrity signals crossed the monitoring threshold and should be checked.";
  }

  return "Signals were recorded, but they remain below the current review threshold.";
};

export function buildIntegrityDisplayFlags(flags: PlagiarismFlag[]) {
  const grouped = new Map<string, PlagiarismFlag>();

  for (const flag of flags) {
    const key = normalizePairKey(flag);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...flag,
        reason: buildIntegrityReason(flag),
      });
      continue;
    }

    const merged: PlagiarismFlag = {
      ...existing,
      similarity_score: Math.max(existing.similarity_score || 0, flag.similarity_score || 0),
      ai_suspicion_score: Math.max(existing.ai_suspicion_score || 0, flag.ai_suspicion_score || 0),
      baseline_deviation_score: Math.max(existing.baseline_deviation_score || 0, flag.baseline_deviation_score || 0),
      total_risk_score: Math.max(existing.total_risk_score || 0, flag.total_risk_score || 0),
      matched_excerpt: existing.matched_excerpt || flag.matched_excerpt,
      evidence_summary: dedupeText([existing.evidence_summary, flag.evidence_summary]).join("\n\n") || undefined,
      recommended_action:
        ACTION_RANK[flag.recommended_action || "clear"] > ACTION_RANK[existing.recommended_action || "clear"]
          ? flag.recommended_action
          : existing.recommended_action,
      severity:
        (SEVERITY_RANK[flag.severity] || 0) > (SEVERITY_RANK[existing.severity] || 0)
          ? flag.severity
          : existing.severity,
      integrity_type:
        existing.integrity_type === flag.integrity_type
          ? existing.integrity_type
          : "mixed",
      overlap_analysis: {
        total_overlap: Math.max(existing.overlap_analysis?.total_overlap || 0, flag.overlap_analysis?.total_overlap || 0),
        cited_overlap: Math.max(existing.overlap_analysis?.cited_overlap || 0, flag.overlap_analysis?.cited_overlap || 0),
        uncited_overlap: Math.max(existing.overlap_analysis?.uncited_overlap || 0, flag.overlap_analysis?.uncited_overlap || 0),
        internal_peer_overlap: Math.max(
          existing.overlap_analysis?.internal_peer_overlap || 0,
          flag.overlap_analysis?.internal_peer_overlap || 0,
        ),
        external_source_overlap: Math.max(
          existing.overlap_analysis?.external_source_overlap || 0,
          flag.overlap_analysis?.external_source_overlap || 0,
        ),
      },
    };

    merged.reason = buildIntegrityReason(merged);
    grouped.set(key, merged);
  }

  return Array.from(grouped.values()).sort(
    (left, right) =>
      (right.total_risk_score || 0) - (left.total_risk_score || 0) ||
      (right.similarity_score || 0) - (left.similarity_score || 0) ||
      (right.ai_suspicion_score || 0) - (left.ai_suspicion_score || 0),
  );
}

export function buildIntegrityDisplaySummary(flags: PlagiarismFlag[], summary: string) {
  const normalizedSummary = normalizeMessage(summary);
  if (flags.length === 0) return normalizedSummary;

  return flags.length === 1
    ? "One submission pair was flagged because one or more integrity signals crossed the current review thresholds."
    : `${flags.length} submission pair(s) were flagged because one or more integrity signals crossed the current review thresholds.`;
}

export function buildIntegrityDisplayMetrics(flag: PlagiarismFlag): IntegrityDisplayMetric[] {
  const metrics: IntegrityDisplayMetric[] = [];

  metrics.push({
    label: "Overall risk",
    value: `${flag.total_risk_score || flag.similarity_score || 0}%`,
  });

  if ((flag.similarity_score || 0) > 0) {
    metrics.push({
      label: "Similarity",
      value: `${flag.similarity_score || 0}%`,
    });
  }

  if ((flag.overlap_analysis?.uncited_overlap || 0) > 0) {
    metrics.push({
      label: "Uncited overlap",
      value: `${flag.overlap_analysis?.uncited_overlap || 0}%`,
    });
  } else if ((flag.overlap_analysis?.cited_overlap || 0) > 0) {
    metrics.push({
      label: "Cited overlap",
      value: `${flag.overlap_analysis?.cited_overlap || 0}%`,
    });
  }

  if ((flag.ai_suspicion_score || 0) > 0) {
    metrics.push({
      label: "AI-writing signal",
      value: `${flag.ai_suspicion_score || 0}%`,
    });
  }

  if ((flag.baseline_deviation_score || 0) > 0) {
    metrics.push({
      label: "Writing profile shift",
      value: `${flag.baseline_deviation_score || 0}%`,
    });
  }

  return metrics;
}

export function buildIntegritySeverityLabel(flag: PlagiarismFlag) {
  if (flag.recommended_action === "investigate" || flag.severity === "high") return "High priority";
  if (flag.recommended_action === "review" || flag.severity === "medium") return "Needs review";
  return "Monitor";
}

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
