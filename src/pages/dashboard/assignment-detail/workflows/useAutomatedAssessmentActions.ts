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

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "AI grading failed");

const hasGradableSubmissionFile = (submission: AssignmentDetailSubmission) => {
  const candidate = `${submission.file_name ?? ""} ${submission.file_url ?? ""}`.toLowerCase();
  return (
    Boolean(submission.file_url?.trim()) &&
    GRADABLE_TEXT_EXTENSIONS.some((extension) => candidate.includes(extension))
  );
};

interface UseAutomatedAssessmentActionsArgs {
  assignment: AssignmentDetailAssignment | null;
  grades: Record<string, Grade>;
  isDemo: boolean;
  reloadSubmissions: () => Promise<void>;
  role: string | null;
  selected: Set<string>;
  setPlagiarismFlags: React.Dispatch<React.SetStateAction<AcademicIntegrityFlag[]>>;
  setPlagiarismSummary: React.Dispatch<React.SetStateAction<string | null>>;
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
      let successCount = 0;
      let failCount = 0;
      const failureMessages = new Set<string>();

      for (const submission of gradableSubmissions) {
        const result = resultMap.get(submission.id);
        if (!result) {
          try {
            await supabase.from("submissions").update({ status: submission.status }).eq("id", submission.id);
          } catch {}
          failCount++;
          failureMessages.add("A grading result was missing for one submission.");
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
            failureMessages.add("A grading result could not be validated.");
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
              grading_metadata: result.gradingMetadata ?? {},
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
      if (failCount > 0) {
        const extractionFailure = Array.from(failureMessages).find((message) =>
          message.includes("We could not read this document. Please upload a readable PDF, DOCX, TXT, or supported code file."),
        );
        const firstFailure = Array.from(failureMessages)[0];
        toast.error(extractionFailure || firstFailure || `${failCount} submission(s) failed to grade`);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
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
  };
};
