import { type IntegrityDecision, type IntegrityEvidenceItem, type IntegrityHistoryEntry, parseStoredReviewPayload } from "@/lib/integrityReviews";

export interface AcademicIntegrityOverviewStat {
  label: string;
  value: string;
}

export interface AcademicIntegrityReadiness {
  postureLabel: string;
  likelyChallenge: string;
  bestNextAction: string;
}

export interface FlaggedIntegrityCase {
  submissionId: string;
  assignmentId: string;
  student: string;
  assignment: string;
  status: string;
  submittedAt: string;
  riskLevel: "high" | "medium" | "low";
  analysisLimited: boolean;
  limitations: string[];
  totalScore: number;
  aiWritingScore: number;
  similarityScore: number;
  overlapBreakdown: {
    totalOverlap: number;
    citedOverlap: number;
    uncitedOverlap: number;
    internalPeerOverlap: number;
    externalSourceOverlap: number;
  };
  baselineDeviationScore: number;
  evidence: {
    aiWriting: IntegrityEvidenceItem[];
    similarity: IntegrityEvidenceItem[];
    uncitedMatches: IntegrityEvidenceItem[];
    citedMatches: IntegrityEvidenceItem[];
    peerMatches: IntegrityEvidenceItem[];
    externalMatches: IntegrityEvidenceItem[];
    baselineDeviation: IntegrityEvidenceItem[];
  };
  flags: string[];
  decision: IntegrityDecision;
  history: IntegrityHistoryEntry[];
}

interface StoredIntegrityReviewLike {
  submission_id: string;
  decision: string;
  lecturer_note: string | null;
  updated_at: string;
}

interface SubmissionLike {
  id: string;
  assignment_id: string;
  student_name: string | null;
  student_email: string | null;
  status: string;
  submitted_at: string;
}

interface AssignmentLike {
  id: string;
  title: string;
}

const isEvidenceItem = (value: unknown): value is IntegrityEvidenceItem =>
  !!value &&
  typeof value === "object" &&
  "label" in value &&
  "value" in value &&
  "score" in value;

const ensureEvidenceList = (value: unknown): IntegrityEvidenceItem[] =>
  Array.isArray(value) ? value.filter(isEvidenceItem) : [];

const ensureStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

export const normalizeIntegrityDecision = (value: unknown): IntegrityDecision =>
  value === "clear" || value === "investigate" || value === "misconduct-concern" || value === "pending"
    ? value
    : "pending";

export const getIntegrityReviewType = (
  item: Pick<FlaggedIntegrityCase, "aiWritingScore" | "similarityScore" | "baselineDeviationScore">
) => {
  if (item.aiWritingScore > 0 && item.similarityScore > 0) return "mixed";
  if (item.aiWritingScore > 0) return "ai-writing-suspicion";
  if (item.baselineDeviationScore > 0 && item.similarityScore === 0) return "baseline-deviation";
  return "similarity-plagiarism-suspicion";
};

export const buildIntegrityCases = ({
  reviews,
  submissions,
  assignments,
}: {
  reviews: StoredIntegrityReviewLike[];
  submissions: SubmissionLike[];
  assignments: AssignmentLike[];
}) => {
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.id, assignment.title]));
  const submissionMap = new Map(submissions.map((submission) => [submission.id, submission]));

  return reviews
    .map((review) => {
      const submission = submissionMap.get(review.submission_id);
      if (!submission) return null;

      const payload = parseStoredReviewPayload(review);
      const snapshot = payload.integritySnapshot;

      if (!snapshot && payload.history.length === 0 && review.decision === "pending") {
        return null;
      }

      return {
        submissionId: submission.id,
        assignmentId: submission.assignment_id,
        student: submission.student_name || submission.student_email || "Student",
        assignment: assignmentMap.get(submission.assignment_id) || "Unknown assignment",
        status: submission.status,
        submittedAt: submission.submitted_at,
        riskLevel:
          snapshot?.riskLevel === "high" || snapshot?.riskLevel === "medium" || snapshot?.riskLevel === "low"
            ? snapshot.riskLevel
            : "low",
        analysisLimited: Boolean(snapshot?.analysisLimited),
        limitations: ensureStringList(snapshot?.limitations),
        totalScore: typeof snapshot?.totalScore === "number" ? snapshot.totalScore : 0,
        aiWritingScore: snapshot?.aiWritingScore || 0,
        similarityScore: snapshot?.similarityScore || 0,
        overlapBreakdown: snapshot?.overlapBreakdown || {
          totalOverlap: snapshot?.similarityScore || 0,
          citedOverlap: 0,
          uncitedOverlap: snapshot?.similarityScore || 0,
          internalPeerOverlap: snapshot?.similarityScore || 0,
          externalSourceOverlap: 0,
        },
        baselineDeviationScore: snapshot?.baselineDeviationScore || 0,
        evidence: {
          aiWriting: ensureEvidenceList(snapshot?.evidence?.aiWriting),
          similarity: ensureEvidenceList(snapshot?.evidence?.similarity),
          uncitedMatches: ensureEvidenceList(snapshot?.evidence?.uncitedMatches),
          citedMatches: ensureEvidenceList(snapshot?.evidence?.citedMatches),
          peerMatches: ensureEvidenceList(snapshot?.evidence?.peerMatches),
          externalMatches: ensureEvidenceList(snapshot?.evidence?.externalMatches),
          baselineDeviation: ensureEvidenceList(snapshot?.evidence?.baselineDeviation),
        },
        flags: ensureStringList(snapshot?.flags),
        decision: normalizeIntegrityDecision(review.decision),
        history: payload.history,
      } satisfies FlaggedIntegrityCase;
    })
    .filter((item): item is FlaggedIntegrityCase => item !== null)
    .sort((left, right) => right.totalScore - left.totalScore);
};

export const buildIntegrityOverview = ({
  submissionsScanned,
  cases,
}: {
  submissionsScanned: number;
  cases: FlaggedIntegrityCase[];
}): AcademicIntegrityOverviewStat[] => {
  const openInvestigations = cases.filter(
    (item) => item.decision === "investigate" || item.decision === "misconduct-concern"
  ).length;
  const cleared = cases.filter((item) => item.decision === "clear").length;

  return [
    { label: "Submissions Scanned", value: submissionsScanned.toString() },
    { label: "Flagged for Review", value: cases.length.toString() },
    { label: "Open Investigations", value: openInvestigations.toString() },
    { label: "Cleared", value: cleared.toString() },
  ];
};

export const buildIntegrityTotals = (cases: FlaggedIntegrityCase[]) => ({
  aiWriting: cases.filter((item) => item.aiWritingScore >= 40).length,
  similarity: cases.filter((item) => item.similarityScore >= 40).length,
  baselineDeviation: cases.filter((item) => item.baselineDeviationScore >= 40).length,
  pending: cases.filter((item) => item.decision === "pending").length,
});

export const buildIntegrityDrafts = (cases: FlaggedIntegrityCase[]) => ({
  decisionDrafts: Object.fromEntries(cases.map((item) => [item.submissionId, item.decision])),
  noteDrafts: Object.fromEntries(
    cases.map((item) => [
      item.submissionId,
      item.history[0]?.note === "No note recorded." ? "" : item.history[0]?.note || "",
    ])
  ),
});

export const getAcademicIntegrityReadiness = ({
  cases,
  totals,
}: {
  cases: FlaggedIntegrityCase[];
  totals: ReturnType<typeof buildIntegrityTotals>;
}): AcademicIntegrityReadiness => {
  const highestRiskCase = [...cases].sort((left, right) => right.totalScore - left.totalScore)[0];
  const activeInvestigations = cases.filter(
    (item) => item.decision === "investigate" || item.decision === "misconduct-concern"
  ).length;
  const pendingLimitedCases = cases.filter(
    (item) => item.decision === "pending" && item.analysisLimited
  ).length;

  return {
    postureLabel:
      activeInvestigations > 0
        ? "Escalated review position"
        : totals.pending > 0 || pendingLimitedCases > 0
          ? "Pending review position"
          : "Stable integrity position",
    likelyChallenge:
      highestRiskCase?.assignment ||
      (pendingLimitedCases > 0
        ? "Analysis-limited integrity evidence still pending"
        : "No integrity pressure point yet"),
    bestNextAction:
      activeInvestigations > 0
        ? "Complete active investigations and record lecturer decisions"
        : totals.pending > 0
          ? "Review pending flagged cases and save lecturer decisions"
          : "Maintain integrity monitoring and communicate expectations before the next submission",
  };
};
