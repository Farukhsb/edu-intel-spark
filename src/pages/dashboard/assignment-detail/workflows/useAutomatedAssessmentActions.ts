import { useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  buildAIGradingReadyNotification,
  buildIntegrityCheckReadyNotification,
} from "@/lib/communications";
import { safeParseEdgeAIGradeResponse, safeParseIntegrityBatchResponse } from "@/lib/schemas/aiResponses";
import { buildIntegrityClientOutcome } from "@/pages/dashboard/assignment-detail/domain";
import { log } from "@/lib/logger";
import { getEnv } from "@/lib/env";
import { isRegradableWorkflowStatus } from "@/lib/assessmentWorkflow";
import { persistWorkflowNotification } from "@/pages/dashboard/assignment-detail/workflows/submissionActions";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
} from "@/pages/dashboard/assignment-detail/types";
import type { Submission } from "@/types";
import type { AcademicIntegrityFlag } from "@/types/academic";
import {
  buildExtractionFailureRecoveryIssue,
  buildInvalidResultRecoveryIssue,
  buildLastGradingRunSummary,
  buildMissingFileRecoveryIssue,
  buildMissingResultRecoveryIssue,
  buildServiceFailureRecoveryIssue,
  getErrorMessage,
  GRADABLE_FILE_LABEL,
  hasGradableSubmissionFile,
  INTEGRITY_RUNTIME_WARNING_THRESHOLD,
  isExtractionFailure,
  isRetryableRecoveryType,
  LARGE_COHORT_INTEGRITY_WARNING_THRESHOLD,
  LEGACY_INTEGRITY_REQUEST_COMPAT_LIMIT,
  persistGradedSubmissionResult,
  type GradeSubmissionInvokeData,
  type LastGradingRunSummary,
  type SubmissionGradingRecoveryIssue,
} from "./automatedAssessmentShared";

export type { SubmissionGradingRecoveryIssue } from "./automatedAssessmentShared";
export { persistGradedSubmissionResult } from "./automatedAssessmentShared";

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

  const runAIGrade = async (selectedSubmissionIds: Set<string>) => {
    if (isDemo) {
      toast.info("AI grading is disabled in demo mode");
      return;
    }
    const toGrade = submissions.filter(
      (submission) => selectedSubmissionIds.has(submission.id) && isRegradableWorkflowStatus(submission.status),
    );
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
      const env = getEnv();

      const gradeSubmissionUrl = `${env.VITE_SUPABASE_URL}/functions/v1/grade-submission`;
      const response = await fetch(gradeSubmissionUrl, {
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
          nextRecoveryIssues[submission.id] = buildMissingResultRecoveryIssue();
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
            nextRecoveryIssues[submission.id] = buildInvalidResultRecoveryIssue();
            continue;
          }

          try {
            await persistGradedSubmissionResult({
              gradingResult: result,
              submissionId: submission.id,
              validatedGrade: {
                ai_score: validatedGrade.data.ai_score,
                ai_feedback: validatedGrade.data.ai_feedback,
                ai_breakdown: validatedGrade.data.ai_breakdown,
                grading_confidence: validatedGrade.data.grading_confidence ?? null,
              },
            });
            successCount++;
          } catch (persistenceError) {
            log.error("Failed to persist graded submission", persistenceError, {
              submissionId: submission.id,
            });
            try {
              await supabase.from("submissions").update({ status: submission.status }).eq("id", submission.id);
            } catch {}
            failCount++;
            serviceFailureCount++;
            failureMessages.add("The grading result was returned, but it could not be saved.");
            nextRecoveryIssues[submission.id] = buildServiceFailureRecoveryIssue(
              "The grading service returned an answer, but the grade could not be saved cleanly. Retry the submission or continue with manual follow-up.",
            );
          }
        } else {
          if (typeof result.error === "string" && result.error.trim()) {
            failureMessages.add(result.error.trim());
            if (isExtractionFailure(result.error)) {
              extractionFailureCount++;
              nextRecoveryIssues[submission.id] = buildExtractionFailureRecoveryIssue();
            } else {
              serviceFailureCount++;
              nextRecoveryIssues[submission.id] = buildServiceFailureRecoveryIssue(result.error.trim());
            }
          } else {
            serviceFailureCount++;
            nextRecoveryIssues[submission.id] = buildServiceFailureRecoveryIssue();
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
        nextRecoveryIssues[submission.id] = buildMissingFileRecoveryIssue();
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
          ...preflightFailures.map((submission) => [submission.id, buildMissingFileRecoveryIssue()]),
          ...gradableSubmissions.map((submission) => [
            submission.id,
            buildServiceFailureRecoveryIssue(
              "The grading request failed before a usable result was returned. Retry the batch or continue with manual follow-up.",
            ),
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
      const env = getEnv();

      if (submissions.length > LARGE_COHORT_INTEGRITY_WARNING_THRESHOLD) {
        toast.warning(
          `This assignment has ${submissions.length} submissions. Integrity scanning will run in limited large-cohort mode and may skip full peerwise comparison.`,
        );
      } else if (submissions.length > INTEGRITY_RUNTIME_WARNING_THRESHOLD) {
        toast.warning(
          `This assignment has ${submissions.length} submissions. Integrity scanning may take longer than usual.`,
        );
      }

      const plagiarismCheckUrl = `${env.VITE_SUPABASE_URL}/functions/v1/check-plagiarism`;
      const response = await fetch(plagiarismCheckUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assignmentId: assignment.id,
          ...(submissions.length <= LEGACY_INTEGRITY_REQUEST_COMPAT_LIMIT
            ? { submissionIds: submissions.map((submission) => submission.id) }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: "Edge Function returned a non-2xx status code" }));
        log.error("Plagiarism check failed", errorBody, {
          assignmentId: assignment.id,
          submissionCount: submissions.length,
        });
        throw new Error(errorBody.error || "Plagiarism check failed");
      }

      const data = await response.json();
      const parsed = safeParseIntegrityBatchResponse(data);

      if (!parsed.success) {
        log.error("Invalid plagiarism payload received for AssignmentDetail", undefined, {
          assignmentId: assignment.id,
          submissionCount: submissions.length,
        });
        throw new Error("Plagiarism check returned invalid data.");
      }

      const uniqueFlags = parsed.data.flags.filter((flag, index, array) => {
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
        summaries: parsed.data.summary.trim() ? [parsed.data.summary.trim()] : [],
        warnings: Array.isArray(parsed.data.warnings)
          ? parsed.data.warnings.filter((warning) => warning.trim().length > 0)
          : [],
        failedBatches: 0,
      });

      setPlagiarismFlags(uniqueFlags);
      setPlagiarismSummary(outcome.summary);

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

      toast[outcome.toastTone](outcome.toastMessage);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Plagiarism check failed";
      toast.error(message);
    }
    setCheckingPlagiarism(false);
  };

  const handleAIGrade = async () => runAIGrade(selected);

  const retryFailedOnly = async () => {
    const retryableSubmissionIds = new Set(
      Object.entries(lastSubmissionRecoveryIssues)
        .filter(([, issue]) => isRetryableRecoveryType(issue.type))
        .map(([submissionId]) => submissionId),
    );

    if (retryableSubmissionIds.size === 0) {
      toast.info("No failed grading cases are ready for retry.");
      return;
    }

    await runAIGrade(retryableSubmissionIds);
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
    retryFailedOnly,
  };
};
