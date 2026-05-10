import { useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  buildAIGradingReadyNotification,
  buildIntegrityCheckReadyNotification,
} from "@/lib/communications";
import { safeParseEdgeAIGradeResponse, safeParseIntegrityBatchResponse } from "@/lib/schemas/aiResponses";
import { buildIntegrityClientOutcome } from "@/pages/dashboard/assignment-detail/domain";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";
import { isRegradableWorkflowStatus } from "@/lib/assessmentWorkflow";
import { persistWorkflowNotification } from "@/pages/dashboard/assignment-detail/workflows/submissionActions";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
  SubmissionStatus,
} from "@/pages/dashboard/assignment-detail/types";
import type { AIResponse, GradeBreakdown, Submission } from "@/types";
import type { AcademicIntegrityFlag } from "@/types/academic";

interface GradeSubmissionResult {
  submissionId: string;
  success: boolean;
  score?: number | null;
  feedback?: string | null;
  breakdown?: GradeBreakdown[] | null;
  assignmentType?: string | null;
  gradingConfidence?: number | null;
  gradingMetadata?: Record<string, unknown> | null;
  requiresLecturerReview?: boolean;
  error?: string | null;
  aiResponse?: AIResponse | null;
}

interface GradeSubmissionInvokeData {
  results?: GradeSubmissionResult[];
}

const PLAGIARISM_CHECK_URL = `${env.VITE_SUPABASE_URL}/functions/v1/check-plagiarism`;
const GRADE_SUBMISSION_URL = `${env.VITE_SUPABASE_URL}/functions/v1/grade-submission`;
const MAX_INTEGRITY_REQUEST_SUBMISSIONS = 80;
const INTEGRITY_RUNTIME_WARNING_THRESHOLD = 30;
const GRADABLE_TEXT_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".java",
  ".c",
  ".cpp",
  ".cc",
  ".cs",
  ".go",
  ".php",
  ".rb",
  ".rs",
  ".swift",
  ".kt",
  ".kts",
  ".scala",
  ".sql",
  ".html",
  ".css",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".sh",
  ".md",
] as const;
const GRADABLE_FILE_LABEL = "PDF, DOCX, TXT, or supported code file";
const EXTRACTION_FAILURE_MESSAGE =
  "We could not read this document. Please upload a readable PDF, DOCX, TXT, or supported code file.";

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "AI grading failed");
const asJson = (value: unknown): Json => value as Json;

const hasGradableSubmissionFile = (submission: AssignmentDetailSubmission) => {
  const candidate = `${submission.file_name ?? ""} ${submission.file_url ?? ""}`.toLowerCase();
  return (
    Boolean(submission.file_url?.trim()) &&
    GRADABLE_TEXT_EXTENSIONS.some((extension) => candidate.includes(extension))
  );
};

const isExtractionFailure = (message: string | null | undefined) =>
  typeof message === "string" && message.includes(EXTRACTION_FAILURE_MESSAGE);

type LastGradingRunSummary = {
  attemptedCount: number;
  detail: string;
  extractionFailureCount: number;
  failedCount: number;
  headline: string;
  invalidResultCount: number;
  recoveryActions: string[];
  serviceFailureCount: number;
  skippedCount: number;
  successCount: number;
};

export type SubmissionGradingRecoveryIssue = {
  detail: string;
  headline: string;
  recoveryLabel: string;
  type: "missing_file" | "extraction_failure" | "invalid_result" | "service_failure";
};

const buildLastGradingRunSummary = ({
  attemptedCount,
  extractionFailureCount,
  failedCount,
  invalidResultCount,
  serviceFailureCount,
  skippedCount,
  successCount,
}: Omit<LastGradingRunSummary, "headline" | "detail" | "recoveryActions">): LastGradingRunSummary | null => {
  if (failedCount === 0 && skippedCount === 0) {
    return null;
  }

  const recoveryActions: string[] = [];
  const detailParts: string[] = [];

  if (skippedCount > 0) {
    detailParts.push(
      `${skippedCount} selected submission${skippedCount === 1 ? " was" : "s were"} skipped before grading because no readable ${GRADABLE_FILE_LABEL} was attached.`,
    );
    recoveryActions.push(`Ask the student to upload a readable ${GRADABLE_FILE_LABEL}.`);
  }

  if (extractionFailureCount > 0) {
    detailParts.push(
      `${extractionFailureCount} submission${extractionFailureCount === 1 ? "" : "s"} could not be read by the grading service.`,
    );
    recoveryActions.push("Retry AI grading after confirming the uploaded files open correctly.");
  }

  if (invalidResultCount > 0) {
    detailParts.push(
      `${invalidResultCount} grading result${invalidResultCount === 1 ? " was" : "s were"} incomplete and need manual follow-up.`,
    );
  }

  if (serviceFailureCount > 0) {
    detailParts.push(
      `${serviceFailureCount} submission${serviceFailureCount === 1 ? "" : "s"} failed because the grading service did not complete cleanly.`,
    );
    if (!recoveryActions.includes("Retry AI grading after confirming the uploaded files open correctly.")) {
      recoveryActions.push("Retry AI grading once the service is available again.");
    }
  }

  if (!recoveryActions.includes("Continue with manual review if the retry still fails so release work does not stall.")) {
    recoveryActions.push("Continue with manual review if the retry still fails so release work does not stall.");
  }

  return {
    attemptedCount,
    detail: detailParts.join(" "),
    extractionFailureCount,
    failedCount,
    headline:
      successCount > 0
        ? `${failedCount + skippedCount} of ${attemptedCount + skippedCount} selected submissions still need attention`
        : "Last grading run needs attention before the workflow can move on",
    invalidResultCount,
    recoveryActions,
    serviceFailureCount,
    skippedCount,
    successCount,
  };
};

interface UseAutomatedAssessmentActionsArgs {
  assignment: AssignmentDetailAssignment | null;
  grades: Record<string, Grade>;
  isDemo: boolean;
  reloadSubmissions: () => Promise<void>;
  role: string | null;
  selected: Set<string>;
  setPlagiarismFlags: React.Dispatch<React.SetStateAction<AcademicIntegrityFlag[]>>;
  setPlagiarismSummary: React.Dispatch<React.SetStateAction<string>>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  submissions: AssignmentDetailSubmission[];
  user: { id: string } | null;
}

export const useAutomatedAssessmentActions = ({
  assignment,
  grades,
  isDemo,
  reloadSubmissions,
  role,
  selected,
  setPlagiarismFlags,
  setPlagiarismSummary,
  setSelected,
  submissions,
  user,
}: UseAutomatedAssessmentActionsArgs) => {
  const [checkingPlagiarism, setCheckingPlagiarism] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradingCount, setGradingCount] = useState(0);
  const [gradingElapsed, setGradingElapsed] = useState(0);
  const [lastGradingRunSummary, setLastGradingRunSummary] = useState<LastGradingRunSummary | null>(null);
  const [lastSubmissionRecoveryIssues, setLastSubmissionRecoveryIssues] = useState<
    Record<string, SubmissionGradingRecoveryIssue>
  >({});
  const gradingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAIGrade = async () => {
    if (isDemo) {
      toast.info("AI grading is disabled in demo mode");
      return;
    }
    const toGrade = submissions.filter((submission) => selected.has(submission.id) && isRegradableWorkflowStatus(submission.status));
    if (toGrade.length === 0) {
      toast.error("Select submitted or reviewable files to grade");
      return;
    }
    if (!assignment) return;

    if (role === "lecturer" && user?.id && assignment.lecturer_id !== user.id) {
      toast.error("You can only grade assignments that are assigned to your lecturer account.");
      return;
    }

    const preflightFailures = toGrade.filter((submission) => !hasGradableSubmissionFile(submission));
    const gradableSubmissions = toGrade.filter((submission) => hasGradableSubmissionFile(submission));

    if (preflightFailures.length > 0) {
      toast.error(
        preflightFailures.length === toGrade.length
          ? `Selected submissions are missing a readable ${GRADABLE_FILE_LABEL}.`
          : `${preflightFailures.length} selected submission(s) are missing a readable ${GRADABLE_FILE_LABEL} and were skipped.`,
      );
    }

    if (gradableSubmissions.length === 0) {
      return;
    }

    setLastGradingRunSummary(null);
    setLastSubmissionRecoveryIssues({});
    setGrading(true);
    setGradingCount(gradableSubmissions.length);
    setGradingElapsed(0);
    if (gradingTimerRef.current) clearInterval(gradingTimerRef.current);
    gradingTimerRef.current = setInterval(() => {
      setGradingElapsed((value) => value + 1);
    }, 1000);

    for (const submission of gradableSubmissions) {
      try {
        await supabase.from("submissions").update({ status: "ai_grading" as const }).eq("id", submission.id);
      } catch {}
    }
    await reloadSubmissions();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error("Please sign in again");

      const response = await fetch(GRADE_SUBMISSION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assignmentId: assignment.id,
          submissions: gradableSubmissions.map((submission) => ({
            id: submission.id,
            student_name: submission.student_name || submission.student_email || "Anonymous",
            file_name: submission.file_name,
            file_url: submission.file_url,
          })),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: "AI grading failed" }));
        throw new Error(errorBody?.error || "AI grading failed");
      }

      const responseData = (await response.json()) as GradeSubmissionInvokeData;
      const results = Array.isArray(responseData?.results) ? responseData.results : [];
      if (results.length === 0) {
        throw new Error("No grading results returned");
      }

      const resultMap = new Map(results.map((result) => [result.submissionId, result]));
      const nextRecoveryIssues: Record<string, SubmissionGradingRecoveryIssue> = {};
      let successCount = 0;
      let failCount = 0;
      let extractionFailureCount = 0;
      let invalidResultCount = 0;
      let serviceFailureCount = 0;
      const failureMessages = new Set<string>();

      for (const submission of gradableSubmissions) {
        const result = resultMap.get(submission.id);
        if (!result) {
          try {
            await supabase.from("submissions").update({ status: submission.status }).eq("id", submission.id);
          } catch {}
          failCount++;
          invalidResultCount++;
          failureMessages.add("A grading result was missing for one submission.");
          nextRecoveryIssues[submission.id] = {
            headline: "Incomplete grading result",
            detail: "The grading service returned no usable result for this submission. Retry the batch or continue with manual follow-up.",
            recoveryLabel: "Select for retry",
            type: "invalid_result",
          };
          continue;
        }

        if (result.success) {
          const validatedGrade = safeParseEdgeAIGradeResponse({
            ai_score: result.score,
            ai_feedback: result.feedback,
            ai_breakdown: result.breakdown,
            grading_confidence: result.gradingConfidence ?? null,
            ai_response: result.aiResponse ?? null,
          });

          if (!validatedGrade.success) {
            try {
              await supabase.from("submissions").update({ status: submission.status }).eq("id", submission.id);
            } catch {}
            failCount++;
            invalidResultCount++;
            failureMessages.add("A grading result could not be validated.");
            nextRecoveryIssues[submission.id] = {
              headline: "Incomplete grading result",
              detail: "The grading output could not be validated, so this submission stayed in its previous workflow state.",
              recoveryLabel: "Select for retry",
              type: "invalid_result",
            };
            continue;
          }

          try {
            await supabase.from("grades").upsert({
              submission_id: submission.id,
              ai_score: validatedGrade.data.ai_score,
              ai_feedback: validatedGrade.data.ai_feedback,
              ai_breakdown: validatedGrade.data.ai_breakdown,
              assignment_type: result.assignmentType ?? null,
              grading_confidence: validatedGrade.data.grading_confidence ?? null,
              grading_metadata: asJson(result.gradingMetadata ?? {}),
            }, { onConflict: "submission_id" });
          } catch (gradeError) {
            log.error("Failed to write grade", gradeError, {
              submissionId: submission.id,
            });
          }
          try {
            const nextStatus = result.requiresLecturerReview ? ("first_review" as const) : ("ai_graded" as const);
            await supabase.from("submissions").update({ status: nextStatus }).eq("id", submission.id);
          } catch {}
          successCount++;
        } else {
          if (typeof result.error === "string" && result.error.trim()) {
            failureMessages.add(result.error.trim());
            if (isExtractionFailure(result.error)) {
              extractionFailureCount++;
              nextRecoveryIssues[submission.id] = {
                headline: "Readable file needed",
                detail: "The grading service could not read this document. Check that the file opens correctly and ask for a clearer upload if needed.",
                recoveryLabel: "Needs re-upload",
                type: "extraction_failure",
              };
            } else {
              serviceFailureCount++;
              nextRecoveryIssues[submission.id] = {
                headline: "Retry AI grading",
                detail: result.error.trim(),
                recoveryLabel: "Select for retry",
                type: "service_failure",
              };
            }
          } else {
            serviceFailureCount++;
            nextRecoveryIssues[submission.id] = {
              headline: "Retry AI grading",
              detail: "The grading service did not complete cleanly for this submission.",
              recoveryLabel: "Select for retry",
              type: "service_failure",
            };
          }
          try {
            await supabase.from("submissions").update({ status: submission.status }).eq("id", submission.id);
          } catch {}
          failCount++;
        }
      }

      if (successCount > 0) {
        await persistWorkflowNotification(
          buildAIGradingReadyNotification({
            lecturerId: assignment.lecturer_id,
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
          }),
          {
            assignmentId: assignment.id,
            workflow: "ai-grading",
          },
        );
        toast.success(`${successCount} submission(s) graded successfully`);
      }
      for (const submission of preflightFailures) {
        nextRecoveryIssues[submission.id] = {
          headline: "Readable file needed",
          detail: `No readable ${GRADABLE_FILE_LABEL} was attached, so this submission was skipped before grading.`,
          recoveryLabel: "Needs re-upload",
          type: "missing_file",
        };
      }
      setLastSubmissionRecoveryIssues(nextRecoveryIssues);
      setLastGradingRunSummary(
        buildLastGradingRunSummary({
          attemptedCount: gradableSubmissions.length,
          extractionFailureCount,
          failedCount: failCount,
          invalidResultCount,
          serviceFailureCount,
          skippedCount: preflightFailures.length,
          successCount,
        }),
      );
      if (failCount > 0) {
        const extractionFailure = Array.from(failureMessages).find((message) =>
          isExtractionFailure(message),
        );
        const firstFailure = Array.from(failureMessages)[0];
        toast.error(extractionFailure || firstFailure || `${failCount} submission(s) failed to grade`);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      const nextRecoveryIssues = Object.fromEntries(
        [
          ...preflightFailures.map((submission) => [
            submission.id,
            {
              headline: "Readable file needed",
              detail: `No readable ${GRADABLE_FILE_LABEL} was attached, so this submission was skipped before grading.`,
              recoveryLabel: "Needs re-upload",
              type: "missing_file" as const,
            },
          ]),
          ...gradableSubmissions.map((submission) => [
            submission.id,
            {
              headline: "Retry AI grading",
              detail: "The grading request failed before a usable result was returned. Retry the batch or continue with manual follow-up.",
              recoveryLabel: "Select for retry",
              type: "service_failure" as const,
            },
          ]),
        ],
      );
      setLastSubmissionRecoveryIssues(nextRecoveryIssues);
      setLastGradingRunSummary(
        buildLastGradingRunSummary({
          attemptedCount: gradableSubmissions.length,
          extractionFailureCount: 0,
          failedCount: gradableSubmissions.length,
          invalidResultCount: 0,
          serviceFailureCount: gradableSubmissions.length,
          skippedCount: preflightFailures.length,
          successCount: 0,
        }),
      );
      for (const submission of gradableSubmissions) {
        try {
          await supabase.from("submissions").update({ status: submission.status }).eq("id", submission.id);
        } catch {}
      }
    }

    setGrading(false);
    setSelected(new Set());
    if (gradingTimerRef.current) {
      clearInterval(gradingTimerRef.current);
      gradingTimerRef.current = null;
    }
    await reloadSubmissions();
  };

  const handlePlagiarismCheck = async () => {
    if (isDemo) {
      toast.info("Integrity checks are disabled in demo mode");
      return;
    }
    if (!assignment) return;
    setCheckingPlagiarism(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Your session has expired. Please sign in again before running an integrity check.");
        return;
      }

      if (submissions.length > MAX_INTEGRITY_REQUEST_SUBMISSIONS) {
        toast.warning(
          `This assignment has ${submissions.length} submissions. Integrity scanning will run in limited large-cohort mode and may skip full peerwise comparison.`,
        );
      } else if (submissions.length > INTEGRITY_RUNTIME_WARNING_THRESHOLD) {
        toast.warning(
          `This assignment has ${submissions.length} submissions. Integrity scanning may take longer than usual.`,
        );
      }

      const batchSize = MAX_INTEGRITY_REQUEST_SUBMISSIONS;
      const collectedFlags: AcademicIntegrityFlag[] = [];
      const collectedSummaries: string[] = [];
      const collectedWarnings: string[] = [];
      let failedBatches = 0;
      let successfulBatches = 0;

      for (let index = 0; index < submissions.length; index += batchSize) {
        const batch = submissions.slice(index, index + batchSize);
        const response = await fetch(PLAGIARISM_CHECK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            assignmentId: assignment.id,
            submissions: batch.map((submission) => ({
              id: submission.id,
              student_name: submission.student_name || submission.student_email || "Anonymous",
              file_name: submission.file_name,
              file_url: submission.file_url,
            })),
          }),
        });

        if (!response.ok) {
          failedBatches += 1;
          const errorBody = await response.json().catch(() => ({ error: "Edge Function returned a non-2xx status code" }));
          log.error("Plagiarism batch failed", errorBody, {
            batchStart: index,
            batchSize: batch.length,
          });
          collectedWarnings.push(`A plagiarism analysis batch of ${batch.length} submission(s) failed and was skipped.`);
          continue;
        }

        const data = await response.json();

        const parsed = safeParseIntegrityBatchResponse(data);
        if (!parsed.success) {
          failedBatches += 1;
          log.error("Invalid plagiarism payload received for AssignmentDetail", undefined, {
            batchStart: index,
            batchSize: batch.length,
          });
          collectedWarnings.push(`A plagiarism analysis batch of ${batch.length} submission(s) returned invalid data and was skipped.`);
          continue;
        }

        successfulBatches += 1;
        collectedFlags.push(...parsed.data.flags);

        if (parsed.data.summary.trim()) {
          collectedSummaries.push(parsed.data.summary.trim());
        }

        if (Array.isArray(parsed.data.warnings)) {
          collectedWarnings.push(
            ...parsed.data.warnings.filter((warning) => warning.trim().length > 0),
          );
        }
      }

      const uniqueFlags = collectedFlags.filter((flag, index, array) => {
        return (
          array.findIndex(
            (candidate) =>
              candidate.submission_a_id === flag.submission_a_id &&
              candidate.submission_b_id === flag.submission_b_id &&
              candidate.reason === flag.reason,
          ) === index
        );
      });

      const outcome = buildIntegrityClientOutcome({
        flags: uniqueFlags,
        summaries: collectedSummaries,
        warnings: collectedWarnings,
        failedBatches,
      });

      setPlagiarismFlags(uniqueFlags);
      setPlagiarismSummary(outcome.summary);

      if (successfulBatches > 0) {
        await persistWorkflowNotification(
          buildIntegrityCheckReadyNotification({
            lecturerId: assignment.lecturer_id,
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
          }),
          {
            assignmentId: assignment.id,
            workflow: "integrity-check",
          },
        );
      }

      toast[outcome.toastTone](outcome.toastMessage);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Plagiarism check failed";
      toast.error(message);
    }
    setCheckingPlagiarism(false);
  };

  return {
    checkingPlagiarism,
    grading,
    gradingCount,
    gradingElapsed,
    handleAIGrade,
    handlePlagiarismCheck,
    lastGradingRunSummary,
    lastSubmissionRecoveryIssues,
  };
};
