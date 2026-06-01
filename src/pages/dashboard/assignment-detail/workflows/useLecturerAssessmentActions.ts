import { useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  buildGradeReleasedNotification,
  queueCommunicationMessage,
} from "@/lib/communications";
import {
  canReleaseStatus,
  getApprovalBlockReason,
  resolveFinalGradeValues,
} from "@/lib/assessmentWorkflow";
import { executeGradeRelease, summarizeGradeReleaseBatch } from "@/lib/gradeReleaseWorkflow";
import { log } from "@/lib/logger";
import { evaluateModerationSignals } from "@/lib/moderation";
import {
  buildModerationAuditPayload,
  type GradeRow,
  buildModerationCasePayload,
  insertModerationAuditEntry,
  upsertModerationCase,
} from "@/lib/moderationWorkflow";
import type {
  AssignmentDetailAssignment,
  AssignmentDetailSubmission,
  Grade,
  IntegrityReview,
  ModerationCase,
  SubmissionStatus,
} from "@/pages/dashboard/assignment-detail/types";

interface LecturerAssessmentUser {
  id: string;
}

interface UseLecturerAssessmentActionsArgs {
  assignment: AssignmentDetailAssignment | null;
  grades: Record<string, Grade>;
  integrityReviews: Record<string, IntegrityReview>;
  moderationCases: Record<string, ModerationCase>;
  reloadSubmissions: () => Promise<void>;
  selected: Set<string>;
  setModerationCases: Dispatch<SetStateAction<Record<string, ModerationCase>>>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  submissions: AssignmentDetailSubmission[];
  user: LecturerAssessmentUser | null;
}

const asJson = (value: unknown): Json => value as Json;
const toGradeRow = (grade: Grade): GradeRow => ({
  id: grade.id,
  submission_id: grade.submission_id,
  ai_score: grade.ai_score,
  ai_feedback: grade.ai_feedback,
  ai_breakdown: asJson(grade.ai_breakdown),
  assignment_type: grade.assignment_type ?? null,
  grading_confidence: grade.grading_confidence ?? null,
  grading_metadata: asJson(grade.grading_metadata ?? {}),
  lecturer_score: grade.lecturer_score,
  lecturer_feedback: grade.lecturer_feedback,
  final_score: grade.final_score,
  final_feedback: grade.final_feedback,
  created_at: "",
  reviewed_at: null,
  reviewed_by: null,
});

export const useLecturerAssessmentActions = ({
  assignment,
  grades,
  integrityReviews,
  moderationCases,
  reloadSubmissions,
  selected,
  setModerationCases,
  setSelected,
  submissions,
  user,
}: UseLecturerAssessmentActionsArgs) => {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState<AssignmentDetailSubmission | null>(null);
  const [reviewGradeOverride, setReviewGradeOverride] = useState<Grade | null>(null);
  const [editScore, setEditScore] = useState("");
  const [editFeedback, setEditFeedback] = useState("");

  const logModerationAuditEvent = async ({
    submissionId,
    gradeId,
    moderationCaseId,
    eventType,
    actorRole,
    previousValues,
    newValues,
    reason,
  }: {
    submissionId: string;
    gradeId?: string | null;
    moderationCaseId?: string | null;
    eventType: string;
    actorRole: string;
    previousValues?: Json;
    newValues?: Json;
    reason?: string;
  }) => {
    if (!user) return;

    const { error } = await insertModerationAuditEntry(
      supabase,
      buildModerationAuditPayload({
        submissionId,
        gradeId: gradeId ?? null,
        moderationCaseId: moderationCaseId ?? null,
        changedBy: user.id,
        eventType,
        actorRole,
        previousValues,
        newValues,
        reason: reason ?? null,
      }),
    );

    if (error) {
      log.warn("Failed to write grade audit log", {
        submissionId,
        moderationCaseId,
      });
    }
  };

  const ensureModerationCase = async ({
    submission,
    grade,
    status,
  }: {
    submission: AssignmentDetailSubmission;
    grade: Grade;
    status: ModerationCase["status"];
  }) => {
    if (!assignment || !user) return null;

    const moderationResult = evaluateModerationSignals({
      grade: toGradeRow(grade),
      integrityReview: integrityReviews[submission.id] ?? null,
      maxScore: assignment.max_score,
    });

    const existingCase = moderationCases[submission.id];
    const { data, error } = await upsertModerationCase(
      supabase,
      buildModerationCasePayload({
        submissionId: submission.id,
        assignmentId: assignment.id,
        gradeId: grade.id,
        lecturerId: assignment.lecturer_id,
        firstMarkerId: user.id,
        status,
        aiScoreSnapshot: grade.ai_score,
        firstMarkerScore: grade.lecturer_score,
        triggerFlags: moderationResult.triggerFlags,
        triggerSummary: moderationResult.triggerSummary || null,
        confidenceScore: moderationResult.confidenceScore,
        integrityRiskScore: moderationResult.integrityRiskScore,
        existingCase,
      }),
    );

    if (error) {
      throw error;
    }

    if (data) {
      setModerationCases((current) => ({ ...current, [submission.id]: data }));
    }
    return data;
  };

  const shouldRequireModeration = (submissionId: string, grade: Grade) =>
    !!assignment &&
    evaluateModerationSignals({
      grade: toGradeRow(grade),
      integrityReview: integrityReviews[submissionId] ?? null,
      maxScore: assignment.max_score,
    }).needsModeration;

  const approveSubmission = async (submission: AssignmentDetailSubmission) => {
    if (!assignment || !user) return false;

    const grade = grades[submission.id];
    if (!grade) {
      toast.error("No grade found to approve");
      return false;
    }

    const moderationCase = moderationCases[submission.id];
    const needsModeration = shouldRequireModeration(submission.id, grade);
    const approvalBlockReason = getApprovalBlockReason({
      status: submission.status,
      needsModeration,
    });

    if (approvalBlockReason === "moderation_in_progress") {
      toast.error("This submission is in the moderation workflow and cannot be approved yet.");
      return false;
    }

    if (approvalBlockReason === "moderation_required") {
      const createdCase = await ensureModerationCase({
        submission,
        grade,
        status: "moderation_pending",
      });
      await supabase.from("submissions").update({ status: "moderation_pending" as const }).eq("id", submission.id);
      await logModerationAuditEvent({
        submissionId: submission.id,
        gradeId: grade.id,
        moderationCaseId: createdCase?.id ?? null,
        eventType: "moderation_required",
        actorRole: "lecturer",
        previousValues: { status: submission.status },
        newValues: { status: "moderation_pending", trigger_flags: createdCase?.trigger_flags ?? [] },
        reason: "Approval blocked until moderation is completed.",
      });
      toast.warning("Moderation is required before approval.");
      await reloadSubmissions();
      return false;
    }

    const { finalScore, finalFeedback } = resolveFinalGradeValues({
      grade,
      moderationCase,
    });

    await supabase
      .from("grades")
      .update({
        final_score: finalScore,
        final_feedback: finalFeedback,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", grade.id);

    await supabase.from("submissions").update({ status: "approved" as const }).eq("id", submission.id);

    if (moderationCase) {
      await supabase
        .from("moderation_cases")
        .update({ approved_at: new Date().toISOString() })
        .eq("id", moderationCase.id);
    }

    await logModerationAuditEvent({
      submissionId: submission.id,
      gradeId: grade.id,
      moderationCaseId: moderationCase?.id ?? null,
      eventType: "grade_approved",
      actorRole: "lecturer",
      previousValues: { status: submission.status, final_score: grade.final_score },
      newValues: { status: "approved", final_score: finalScore },
      reason: moderationCase ? "Approved after moderation." : "Approved after first review.",
    });
    return true;
  };

  const handleBulkApprove = async () => {
    const toApprove = submissions.filter(
      (submission) =>
        selected.has(submission.id) &&
        ["ai_graded", "first_review", "moderated", "under_review"].includes(submission.status),
    );
    if (toApprove.length === 0) {
      toast.error("Select reviewed submissions to approve");
      return;
    }

    let approvedCount = 0;
    for (const submission of toApprove) {
      try {
        const approved = await approveSubmission(submission);
        if (approved) approvedCount++;
      } catch {
        log.warn("Bulk approve failed", {
          submissionId: submission.id,
        });
      }
    }
    if (approvedCount > 0) toast.success(`${approvedCount} submission(s) approved`);
    setSelected(new Set());
    await reloadSubmissions();
  };

  const queueFeedbackSummary = async (submission: AssignmentDetailSubmission) => {
    const grade = grades[submission.id];
    if (!grade) {
      toast.error("No grade available to summarise");
      return;
    }

    const { finalScore: score, finalFeedback } = resolveFinalGradeValues({ grade });
    const feedback = finalFeedback ?? "Feedback will be added in the grading workflow.";

    const result = await queueCommunicationMessage({
      category: "feedback-summary",
      recipientName: submission.student_name || submission.student_email || "Student",
      recipientEmail: submission.student_email,
      recipientId: submission.student_id || undefined,
      subject: `Feedback summary for ${assignment?.title || "your assignment"}`,
      body: `Hello ${submission.student_name || "student"},

Your submission for ${assignment?.title || "this assignment"} has been reviewed.

Score:
${score != null ? `${score}/${assignment?.max_score ?? 100}` : "Pending final score"}

Summary feedback:
${feedback}

Please review the feedback in the platform and let me know if you would like to discuss specific areas for improvement.`,
      relatedAssignmentId: assignment?.id,
      relatedStudentId:
        submission.student_id || submission.student_email || submission.student_name || undefined,
    });
    if (!result) {
      toast.error("Could not save feedback summary");
      return;
    }
    toast.success("Feedback summary saved");
  };

  const queueGradeReleaseNotification = async (submission: AssignmentDetailSubmission) => {
    if (!assignment) {
      toast.error("Could not save release note");
      return;
    }

    const result = await queueCommunicationMessage(
      buildGradeReleasedNotification({
        studentName: submission.student_name || submission.student_email || "Student",
        studentEmail: submission.student_email,
        studentId: submission.student_id || undefined,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
      }),
    );
    if (!result) {
      toast.error("Could not save release note");
      return;
    }
    toast.success("Grade release note saved");
  };

  const releaseSubmission = async (submission: AssignmentDetailSubmission) => {
    if (!assignment) {
      return { result: null, releaseSummary: null };
    }

    const grade = grades[submission.id];
    const moderationCase = moderationCases[submission.id];
    const { finalScore } = grade
      ? resolveFinalGradeValues({ grade, moderationCase })
      : { finalScore: null };

    const result = await executeGradeRelease({
      submissionId: submission.id,
      markReleased: async () => {
        const { error } = await supabase
          .from("submissions")
          .update({ status: "released" as const })
          .eq("id", submission.id);

        if (error) throw error;
      },
      logAudit: async () => {
        if (!user) return false;

        const { error } = await insertModerationAuditEntry(
          supabase,
          buildModerationAuditPayload({
            submissionId: submission.id,
            gradeId: grade?.id ?? null,
            moderationCaseId: moderationCase?.id ?? null,
            changedBy: user.id,
            eventType: "grade_released",
            actorRole: "lecturer",
            previousValues: { status: submission.status, final_score: grade?.final_score ?? null },
            newValues: { status: "released", final_score: finalScore },
            reason: "Released to student after final approval.",
          }),
        );

        if (error) {
          log.warn("Failed to write grade release audit log", {
            submissionId: submission.id,
            moderationCaseId: moderationCase?.id ?? null,
          });
          return false;
        }

        return true;
      },
      queueNotification: async () => {
        const savedNotification = await queueCommunicationMessage(
          buildGradeReleasedNotification({
            studentName: submission.student_name || submission.student_email || "Student",
            studentEmail: submission.student_email,
            studentId: submission.student_id || undefined,
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
          }),
        );

        return Boolean(savedNotification);
      },
      sendEmail: async () => true,
    });

    return {
      result,
      releaseSummary: summarizeGradeReleaseBatch([result]),
    };
  };

  const handleReleaseGrades = async () => {
    const toRelease = submissions.filter(
      (submission) => selected.has(submission.id) && canReleaseStatus(submission.status),
    );
    if (toRelease.length === 0) {
      toast.error("Select approved submissions to release");
      return;
    }

    const results: Array<Awaited<ReturnType<typeof executeGradeRelease>>> = [];
    for (const submission of toRelease) {
      const released = await releaseSubmission(submission);
      if (released.result) {
        results.push(released.result);
      }
    }

    const summary = summarizeGradeReleaseBatch(results);

    if (summary.releasedCount === 0) {
      toast.error("No grades were released");
      return;
    }

    const warnings = [
      summary.updateFailureCount > 0
        ? `${summary.updateFailureCount} release update${summary.updateFailureCount === 1 ? "" : "s"} failed`
        : null,
      summary.auditFailureCount > 0
        ? `${summary.auditFailureCount} audit entr${summary.auditFailureCount === 1 ? "y" : "ies"} failed`
        : null,
      summary.notificationFailureCount > 0
        ? `${summary.notificationFailureCount} in-app release notice${summary.notificationFailureCount === 1 ? "" : "s"} failed`
        : null,
      summary.emailFailureCount > 0
        ? `${summary.emailFailureCount} email notification${summary.emailFailureCount === 1 ? "" : "s"} failed`
        : null,
    ].filter(Boolean);

    if (warnings.length > 0) {
      toast.warning(`${summary.releasedCount} grade(s) released. ${warnings.join("; ")}.`);
    } else {
      toast.success(`${summary.releasedCount} grade(s) released to students`);
    }

    setSelected(new Set());
    await reloadSubmissions();
  };

  const handleSingleRelease = async (submission: AssignmentDetailSubmission) => {
    if (!assignment) {
      toast.error("Failed to release grade");
      return;
    }

    const released = await releaseSubmission(submission);
    if (!released.result?.released || !released.releaseSummary) {
      toast.error("Failed to release grade");
      return;
    }

    const warnings: string[] = [];

    if (released.releaseSummary.auditFailureCount > 0) {
      warnings.push("audit log was not saved");
    }
    if (released.releaseSummary.notificationFailureCount > 0) {
      warnings.push("release note was not saved");
    }
    if (released.releaseSummary.emailFailureCount > 0) {
      warnings.push("release email was not queued");
    }

    if (warnings.length > 0) {
      toast.warning(`Grade released to student. ${warnings.join("; ")}.`);
      return;
    }

    toast.success("Grade released to student");
  };

  const openReview = (submission: AssignmentDetailSubmission, gradeOverride?: Grade | null) => {
    setReviewSubmission(submission);
    const grade = gradeOverride ?? grades[submission.id] ?? null;
    setReviewGradeOverride(gradeOverride ?? null);
    setEditScore(grade?.lecturer_score?.toString() ?? grade?.ai_score?.toString() ?? "");
    setEditFeedback(grade?.lecturer_feedback ?? grade?.ai_feedback ?? "");
    setReviewOpen(true);
  };

  const startManualReview = async (
    submission: AssignmentDetailSubmission,
    options?: { openReview?: boolean; skipReload?: boolean },
  ) => {
    const shouldOpenReview = options?.openReview ?? true;
    const shouldSkipReload = options?.skipReload ?? false;
    if (!user) return false;

    try {
      let grade = grades[submission.id] ?? null;

      if (!grade) {
        const { data, error } = await supabase
          .from("grades")
          .insert({
            submission_id: submission.id,
            ai_score: null,
            ai_feedback: null,
            ai_breakdown: asJson([]),
            assignment_type: "manual_review",
            grading_confidence: null,
            grading_metadata: asJson({
              manual_review_started_at: new Date().toISOString(),
              manual_review_started_by: user.id,
            }),
            lecturer_score: null,
            lecturer_feedback: null,
            final_score: null,
            final_feedback: null,
          })
          .select("*")
          .single();

        if (error || !data) {
          throw error ?? new Error("Manual review draft could not be created");
        }

        grade = data as Grade;
      }

      if (submission.status === "submitted" || submission.status === "ai_grading") {
        await supabase.from("submissions").update({ status: "under_review" as const }).eq("id", submission.id);
        await logModerationAuditEvent({
          submissionId: submission.id,
          gradeId: grade.id,
          eventType: "manual_review_started",
          actorRole: "lecturer",
          previousValues: { status: submission.status },
          newValues: { status: "under_review" },
          reason: "Lecturer bypassed AI grading and entered manual review.",
        });
      }

      if (!shouldSkipReload) {
        await reloadSubmissions();
      }

      if (shouldOpenReview) {
        openReview(
          submission.status === "submitted" || submission.status === "ai_grading"
            ? { ...submission, status: "under_review" }
            : submission,
          grade,
        );
      }
      return true;
    } catch (error) {
      log.error("Manual review start failed", error, {
        submissionId: submission.id,
      });
      toast.error("Could not start manual review");
      return false;
    }
  };

  const startManualReviewForSubmissions = async (submissionsToReview: AssignmentDetailSubmission[]) => {
    if (submissionsToReview.length === 0) {
      toast.info("No failed submissions are ready for manual review.");
      return;
    }

    let startedCount = 0;
    for (const submission of submissionsToReview) {
      const started = await startManualReview(submission, { openReview: false, skipReload: true });
      if (started) {
        startedCount++;
      }
    }

    await reloadSubmissions();

    if (startedCount > 0) {
      setSelected(new Set(submissionsToReview.map((submission) => submission.id)));
      toast.success(
        `${startedCount} submission${startedCount === 1 ? "" : "s"} moved into manual review.`,
      );
    }
  };

  const saveReview = async () => {
    if (!reviewSubmission || !user) return;
    const existingGrade = reviewGradeOverride ?? grades[reviewSubmission.id] ?? null;
    const previousSubmission = submissions.find((submission) => submission.id === reviewSubmission.id);
    const nextScore = editScore === "" ? null : Number(editScore);
    const nextFeedback = editFeedback || null;

    const grade = existingGrade
      ? {
          ...existingGrade,
          lecturer_score: Number.isFinite(nextScore) ? nextScore : null,
          lecturer_feedback: nextFeedback,
        }
      : null;

    if (!grade) {
      toast.error("No grade record found");
      return;
    }

    try {
      if (existingGrade?.id) {
        await supabase
          .from("grades")
          .update({
            lecturer_score: Number.isFinite(nextScore) ? nextScore : null,
            lecturer_feedback: nextFeedback,
          })
          .eq("id", existingGrade.id);
      }

      const moderationCheck = evaluateModerationSignals({
        grade: toGradeRow(grade),
        integrityReview: integrityReviews[reviewSubmission.id] ?? null,
        maxScore: assignment?.max_score ?? 100,
      });

      let nextStatus: SubmissionStatus = "first_review";
      let moderationCaseId: string | null = null;
      if (moderationCheck.needsModeration) {
        const moderationCase = await ensureModerationCase({
          submission: reviewSubmission,
          grade,
          status: "moderation_pending",
        });
        moderationCaseId = moderationCase?.id ?? null;

        if (!moderationCase?.id) {
          throw new Error("Moderation case could not be created");
        }

        await supabase.from("moderation_reviews").insert({
          moderation_case_id: moderationCase.id,
          submission_id: reviewSubmission.id,
          reviewer_id: user.id,
          reviewer_role: "first_marker",
          action:
            existingGrade.ai_score != null &&
            Number.isFinite(nextScore) &&
            existingGrade.ai_score === nextScore
              ? "agree"
              : "adjust",
          proposed_score: Number.isFinite(nextScore) ? nextScore : null,
          proposed_feedback: nextFeedback,
          notes: nextFeedback,
          snapshot: asJson({
            ai_score: existingGrade.ai_score,
            lecturer_score: Number.isFinite(nextScore) ? nextScore : null,
            confidence_score: grade.grading_confidence ?? null,
            trigger_flags: moderationCheck.triggerFlags,
          }),
        });
        nextStatus = "moderation_pending";
      }

      await supabase.from("submissions").update({ status: nextStatus }).eq("id", reviewSubmission.id);
      await logModerationAuditEvent({
        submissionId: reviewSubmission.id,
        gradeId: existingGrade.id,
        moderationCaseId,
        eventType: "first_review_saved",
        actorRole: "first_marker",
        previousValues: {
          lecturer_score: existingGrade.lecturer_score,
          lecturer_feedback: existingGrade.lecturer_feedback,
          status: previousSubmission?.status ?? null,
        },
        newValues: {
          lecturer_score: Number.isFinite(nextScore) ? nextScore : null,
          lecturer_feedback: nextFeedback,
          status: nextStatus,
          trigger_flags: moderationCheck.triggerFlags,
        },
        reason: moderationCheck.needsModeration
          ? "First marker review routed into moderation."
          : "First marker review saved.",
      });

      toast.success(
        moderationCheck.needsModeration
          ? "First marker review saved and sent to moderation."
          : "First marker review saved.",
      );
      await reloadSubmissions();
    } catch (error) {
      log.error("Save review failed", error, {
        submissionId: reviewSubmission.id,
      });
      toast.error("Failed to save review");
    }
    setReviewOpen(false);
    setReviewGradeOverride(null);
  };

  return {
    approveSubmission,
    editFeedback,
    editScore,
    handleBulkApprove,
    handleReleaseGrades,
    handleSingleRelease,
    openReview,
    queueFeedbackSummary,
    queueGradeReleaseNotification,
    reviewOpen,
    reviewGradeOverride,
    reviewSubmission,
    saveReview,
    setEditFeedback,
    setEditScore,
    setReviewOpen,
    startManualReview,
    startManualReviewForSubmissions,
  };
};
