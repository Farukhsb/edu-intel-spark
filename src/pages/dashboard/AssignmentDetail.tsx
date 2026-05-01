import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/date";
import { env } from "@/lib/env";
import {
  buildAIGradingReadyNotification,
  buildGradeReleasedNotification,
  buildIntegrityCheckReadyNotification,
  buildSubmissionReceivedNotification,
  sendWorkflowNotificationEmail,
  type DraftCommunicationMessage,
  queueCommunicationMessage,
} from "@/lib/communications";
import { log } from "@/lib/logger";
import type {
  AIResponse,
  GradeBreakdown,
  Submission,
} from "@/types";
import { evaluateModerationSignals, formatSubmissionStatus } from "@/lib/moderation";
import {
  buildModerationAuditPayload,
  buildModerationCasePayload,
  insertModerationAuditEntry,
  upsertModerationCase,
} from "@/lib/moderationWorkflow";
import {
  canReleaseStatus,
  getApprovalBlockReason,
  getAssessmentSummary,
  getSelectedWorkflowActionState,
  isRegradableWorkflowStatus,
  isGradedWorkflowStatus,
  isStudentGradeVisible,
  resolveFinalGradeValues,
} from "@/lib/assessmentWorkflow";
import { getStudentSubmissionAvailability } from "@/lib/assignmentVisibility";
import { safeParseEdgeAIGradeResponse, safeParseIntegrityBatchResponse } from "@/lib/schemas/aiResponses";
import { type WorkflowRubricCriterion } from "@/types/academic";
import {
  getDemoAssignmentSetById,
} from "@/pages/dashboard/demoAssignments";
import {
  SubmissionListSection,
  WorkflowActionsSection,
} from "@/pages/dashboard/assignment-detail/sections";
import { SubmissionReviewDialog } from "@/pages/dashboard/assignment-detail/review-dialog";
import type {
  AssignmentDetailSubmission,
  Grade,
  GradingMetadata,
  ModerationCase,
  SubmissionStatus,
} from "@/pages/dashboard/assignment-detail/types";
import { useAssignmentDetailData } from "@/pages/dashboard/assignment-detail/useAssignmentDetailData";

const ALLOWED_SUBMISSION_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface GradeSubmissionResult {
  submissionId: string;
  success: boolean;
  score?: number | null;
  feedback?: string | null;
  breakdown?: GradeBreakdown[] | null;
  assignmentType?: string | null;
  gradingConfidence?: number | null;
  gradingMetadata?: GradingMetadata | null;
  requiresLecturerReview?: boolean;
  error?: string | null;
  aiResponse?: AIResponse | null;
}

interface GradeSubmissionInvokeData {
  results?: GradeSubmissionResult[];
}

const formatStatusLabel = (status: string) => formatSubmissionStatus(status);

const normalizeStudentKey = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .trim()
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const buildRecommendedActionLabel = (value?: string) =>
  value ? `Recommended action: ${String(value).replace("-", " ")}` : "Review recommended";

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "AI grading failed");
const PLAGIARISM_CHECK_URL = `${env.VITE_SUPABASE_URL}/functions/v1/check-plagiarism`;

const hasGradableSubmissionFile = (submission: AssignmentDetailSubmission) => {
  const candidate = `${submission.file_name ?? ""} ${submission.file_url ?? ""}`.toLowerCase();
  return Boolean(submission.file_url?.trim()) && (candidate.includes(".pdf") || candidate.includes(".docx") || candidate.includes(".txt"));
};

const AssignmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { role, user, profile, isDemo } = useAuth();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [grading, setGrading] = useState(false);
  const [gradingCount, setGradingCount] = useState(0);
  const [gradingElapsed, setGradingElapsed] = useState(0);
  const gradingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState<AssignmentDetailSubmission | null>(null);
  const [editScore, setEditScore] = useState("");
  const [editFeedback, setEditFeedback] = useState("");
  const [checkingPlagiarism, setCheckingPlagiarism] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const demoAssignmentSet = isDemo && id ? getDemoAssignmentSetById(id) : null;

  const {
    assignment,
    submissions,
    grades,
    integrityReviews,
    moderationCases,
    loading,
    plagiarismFlags,
    plagiarismSummary,
    reloadSubmissions,
    setModerationCases,
    setPlagiarismFlags,
    setPlagiarismSummary,
  } = useAssignmentDetailData({
    id,
    isDemo,
    role,
    userId: user?.id,
    hasUser: Boolean(user),
  });

  const persistWorkflowNotification = async (
    message: DraftCommunicationMessage,
    context: {
      assignmentId: string;
      workflow: "submission" | "ai-grading" | "integrity-check" | "grade-release";
    },
  ) => {
    try {
      const result = await queueCommunicationMessage(message);
      if (!result) {
        log.warn("Workflow notification did not persist", {
          assignmentId: context.assignmentId,
          workflow: context.workflow,
          category: message.category,
          recipientId: message.recipientId ?? null,
        });
      }
    } catch (error) {
      log.error("Workflow notification failed", error, {
        assignmentId: context.assignmentId,
        workflow: context.workflow,
        category: message.category,
        recipientId: message.recipientId ?? null,
      });
    }
  };

  const openSubmissionFile = async (submission: AssignmentDetailSubmission) => {
    try {
      const rawUrl = submission.file_url || "";
      const isDirectUrl = /^https?:\/\//i.test(rawUrl);
      if (isDirectUrl) {
        window.open(rawUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const { data, error } = await supabase.storage
        .from("submissions")
        .createSignedUrl(rawUrl, 60);

      if (error || !data?.signedUrl) {
        throw error ?? new Error("Could not create signed URL");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      log.error("Failed to open submission file", error, {
        submissionId: submission.id,
      });
      toast.error("Could not open the file");
    }
  };

  const uploadFile = async (file: File, userId: string) => {
    if (!assignment) throw new Error("Missing assignment");
    if (!ALLOWED_SUBMISSION_TYPES.includes(file.type)) {
      throw new Error("Unsupported file type");
    }
    const safeFileName = file.name.replace(/[\\/]/g, "_");
    const filePath = `${userId}/${assignment.id}/${Date.now()}_${safeFileName}`;

    setUploadProgress(10);
    const { data, error } = await supabase.storage
      .from("submissions")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
    if (error) throw error;
    setUploadProgress(100);

    return {
      fileUrl: data.path,
      fileName: safeFileName,
      fileType: file.type || "application/octet-stream",
      storagePath: data.path,
    };
  };

  const handleStudentSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDemo) {
      toast.info("Submission upload is disabled in demo mode");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !id || !assignment || !user?.id) {
      e.target.value = "";
      return;
    }

    const hasExisting = submissions.some(
      (s) => s.student_id === user.id || (user.email && s.student_email === user.email)
    );
    if (hasExisting) {
      toast.error("You have already submitted this assignment");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadFile(file, user.id);
      const { data: insertedSubmission, error } = await supabase
        .from("submissions")
        .insert({
          assignment_id: assignment.id,
          student_id: user.id,
          file_url: uploaded.fileUrl,
          file_name: uploaded.fileName,
          file_type: uploaded.fileType,
          uploaded_by: user.id,
          status: "submitted" as const,
          student_name: profile?.full_name ?? null,
          student_email: user.email ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await persistWorkflowNotification(
        buildSubmissionReceivedNotification({
          lecturerId: assignment.lecturer_id,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          studentName: profile?.full_name || user.email || "A student",
        }),
        {
          assignmentId: assignment.id,
          workflow: "submission",
        },
      );
      if (insertedSubmission?.id) {
        void sendWorkflowNotificationEmail({
          category: "submission-received",
          assignmentId: assignment.id,
          submissionId: insertedSubmission.id,
        }).catch(() => {
          log.warn("Submission notification email failed", {
            assignmentId: assignment.id,
            submissionId: insertedSubmission.id,
          });
        });
      }
      toast.success("Submission uploaded successfully");
      await reloadSubmissions();
    } catch (error: unknown) {
      log.error("Student submission upload failed", error, {
        assignmentId: assignment.id,
        studentId: user.id,
      });
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDemo) {
      toast.info("Bulk upload is disabled in demo mode");
      e.target.value = "";
      return;
    }
    const files = e.target.files;
    if (!files || !assignment || !user?.id) return;
    setUploading(true);
    let success = 0;
    let linked = 0;
    let unmatched = 0;

    const { data: studentProfiles, error: studentProfilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("role", "student");

    if (studentProfilesError) {
      log.error("Bulk upload failed to load student profiles", studentProfilesError, {
        assignmentId: assignment.id,
      });
      toast.error("Could not load student profiles for bulk upload");
      setUploading(false);
      e.target.value = "";
      return;
    }

    const profileMatches = new Map(
      ((studentProfiles || []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }>)
        .flatMap((profile) => {
          const keys = new Set<string>();
          const normalizedEmail = normalizeStudentKey(profile.email);
          const normalizedName = normalizeStudentKey(profile.full_name);
          if (normalizedEmail) {
            keys.add(normalizedEmail);
            keys.add(normalizedEmail.split("@")[0]);
          }
          if (normalizedName) keys.add(normalizedName);
          return Array.from(keys).map((key) => [key, profile] as const);
        })
    );

    for (const file of Array.from(files)) {
      try {
        const { fileUrl, fileName, fileType } = await uploadFile(file, user.id);
        const studentName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        const matchedProfile = profileMatches.get(normalizeStudentKey(file.name)) || profileMatches.get(normalizeStudentKey(studentName));
        const { error } = await supabase.from("submissions").insert({
          assignment_id: assignment.id,
          student_name: matchedProfile?.full_name ?? studentName,
          file_url: fileUrl,
          file_name: fileName,
          file_type: fileType,
          uploaded_by: user.id,
          status: "submitted" as const,
          student_id: matchedProfile?.id ?? null,
          student_email: matchedProfile?.email ?? null,
        });
        if (error) throw error;
        success++;
        if (matchedProfile?.id) {
          linked++;
        } else {
          unmatched++;
        }
      } catch (err: unknown) {
        log.error("Bulk upload failed for file", err, {
          assignmentId: assignment.id,
          fileName: file.name,
        });
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    if (success > 0) {
      toast.success(`${success} file(s) uploaded`);
      if (linked > 0 || unmatched > 0) {
        toast.info(`${linked} linked to student accounts, ${unmatched} left unlinked`);
      }
    }
    setUploading(false);
    await reloadSubmissions();
    e.target.value = "";
  };

  const handleAIGrade = async () => {
    if (isDemo) {
      toast.info("AI grading is disabled in demo mode");
      return;
    }
    const toGrade = submissions.filter((s) => selected.has(s.id) && isRegradableWorkflowStatus(s.status));
    if (toGrade.length === 0) {
      toast.error("Select submitted or reviewable files to grade");
      return;
    }
    if (!assignment) return;

    setGrading(true);
    if (role === "lecturer" && user?.id && assignment.lecturer_id !== user.id) {
      toast.error("You can only grade assignments that are assigned to your lecturer account.");
      return;
    }

    const preflightFailures = toGrade.filter((submission) => !hasGradableSubmissionFile(submission));
    const gradableSubmissions = toGrade.filter((submission) => hasGradableSubmissionFile(submission));

    if (preflightFailures.length > 0) {
      toast.error(
        preflightFailures.length === toGrade.length
          ? "Selected submissions are missing a readable PDF, DOCX, or TXT file."
          : `${preflightFailures.length} submission(s) were skipped because the file is missing or unsupported.`,
      );
    }

    if (gradableSubmissions.length === 0) {
      return;
    }

    setGradingCount(gradableSubmissions.length);
    setGradingElapsed(0);
    gradingTimerRef.current = setInterval(() => setGradingElapsed((p) => p + 1), 1000);
    toast.info(`Sending ${gradableSubmissions.length} submission(s) for AI grading...`);

    for (const sub of gradableSubmissions) {
      try {
        await supabase.from("submissions").update({ status: "ai_grading" as const }).eq("id", sub.id);
      } catch {}
    }

    try {
      const { data, error } = await supabase.functions.invoke<GradeSubmissionInvokeData>("grade-submission", {
        body: {
          assignmentId: assignment.id,
          submissions: gradableSubmissions.map((s) => ({ id: s.id })),
        },
      });

      if (error) throw error;
      const results = data?.results || [];
      let successCount = 0;
      let failCount = 0;
      const failureMessages = new Set<string>();

      for (const r of results) {
        const sub = gradableSubmissions.find((s) => s.id === r.submissionId);
        if (!sub) continue;

        if (r.success) {
          const validatedGrade = safeParseEdgeAIGradeResponse(r);
          if (!validatedGrade.success) {
            log.error("Invalid AI grading payload received for AssignmentDetail", undefined, {
              submissionId: sub.id,
            });
            failureMessages.add("Received an invalid grading response. Please try again.");
            try {
              await supabase.from("submissions").update({ status: sub.status }).eq("id", sub.id);
            } catch {}
            failCount++;
            continue;
          }

          try {
            await supabase.from("grades").upsert({
              submission_id: sub.id,
              ai_score: validatedGrade.data.ai_score,
              ai_feedback: validatedGrade.data.ai_feedback,
              ai_breakdown: validatedGrade.data.ai_breakdown,
              assignment_type: r.assignmentType ?? null,
              grading_confidence: validatedGrade.data.grading_confidence ?? null,
              grading_metadata: r.gradingMetadata ?? {},
            }, { onConflict: "submission_id" });
          } catch (gradeErr) {
            log.error("Failed to write grade", gradeErr, {
              submissionId: sub.id,
            });
          }
          try {
            const nextStatus = r.requiresLecturerReview ? ("first_review" as const) : ("ai_graded" as const);
            await supabase.from("submissions").update({ status: nextStatus }).eq("id", sub.id);
          } catch {}
          successCount++;
        } else {
          if (typeof r.error === "string" && r.error.trim()) {
            failureMessages.add(r.error.trim());
          }
          try {
            await supabase.from("submissions").update({ status: sub.status }).eq("id", sub.id);
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
          message.includes("We could not read this document. Please upload a readable PDF, DOCX, or TXT file.")
        );
        const firstFailure = Array.from(failureMessages)[0];
        toast.error(extractionFailure || firstFailure || `${failCount} submission(s) failed to grade`);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      for (const sub of gradableSubmissions) {
        try {
          await supabase.from("submissions").update({ status: sub.status }).eq("id", sub.id);
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

  const handleBulkApprove = async () => {
    if (isDemo) {
      toast.info("Approval is disabled in demo mode");
      return;
    }
    const toApprove = submissions.filter(
      (s) =>
        selected.has(s.id) &&
        ["ai_graded", "first_review", "moderated", "under_review"].includes(s.status)
    );
    if (toApprove.length === 0) {
      toast.error("Select reviewed submissions to approve");
      return;
    }

    let approvedCount = 0;
    for (const sub of toApprove) {
      try {
        const approved = await approveSubmission(sub);
        if (approved) approvedCount++;
      } catch (e) {
        log.warn("Bulk approve failed", {
          submissionId: sub.id,
        });
      }
    }
    if (approvedCount > 0) toast.success(`${approvedCount} submission(s) approved`);
    setSelected(new Set());
    await reloadSubmissions();
  };

  const handleReleaseGrades = async () => {
    if (isDemo) {
      toast.info("Grade release is disabled in demo mode");
      return;
    }
    const toRelease = submissions.filter((s) => selected.has(s.id) && canReleaseStatus(s.status));
    if (toRelease.length === 0) {
      toast.error("Select approved submissions to release");
      return;
    }

    for (const sub of toRelease) {
      try {
        await supabase.from("submissions").update({ status: "released" as const }).eq("id", sub.id);
        await queueGradeReleaseNotification(sub);
      } catch {}
    }
    toast.success(`${toRelease.length} grade(s) released to students`);
    setSelected(new Set());
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
      const batchSize = 3;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Your session has expired. Please sign in again before running an integrity check.");
        return;
      }
      const collectedFlags: PlagiarismFlag[] = [];
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
            submissions: batch.map((s) => ({
              id: s.id,
              student_name: s.student_name || s.student_email || "Anonymous",
              file_name: s.file_name,
              file_url: s.file_url,
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

      const summaryParts = [
        collectedSummaries[0] || "Analysis complete",
        ...Array.from(new Set(collectedWarnings)),
      ];

      if (failedBatches > 0) {
        summaryParts.push(`${failedBatches} batch(es) could not be analysed and were skipped.`);
      }

      setPlagiarismFlags(uniqueFlags);
      setPlagiarismSummary(summaryParts.filter(Boolean).join(" "));

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

      if (uniqueFlags.length === 0) {
        if (collectedWarnings.length > 0 || failedBatches > 0) {
          toast.warning("Integrity analysis completed with limitations");
        } else {
          toast.success("No suspicious similarities found");
        }
      } else {
        toast.warning(`${uniqueFlags.length} potential issue(s) flagged`);
      }
      if (failedBatches > 0) {
        toast.warning(`${failedBatches} plagiarism batch(es) failed and were skipped`);
      } else if (collectedWarnings.length > 0) {
        toast.warning(collectedWarnings[0]);
      }
    } catch (err: unknown) {
      toast.error(err?.message || "Plagiarism check failed");
    }
    setCheckingPlagiarism(false);
  };

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
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
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
      })
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
    submission: Submission;
    grade: Grade;
    status: ModerationCase["status"];
  }) => {
    if (!assignment || !user) return null;

    const moderationResult = evaluateModerationSignals({
      grade,
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
      })
    );

    if (error) {
      throw error;
    }

    setModerationCases((current) => ({ ...current, [submission.id]: data }));
    return data;
  };

  const shouldRequireModeration = (submissionId: string, grade: Grade) =>
    !!assignment &&
    evaluateModerationSignals({
      grade,
      integrityReview: integrityReviews[submissionId] ?? null,
      maxScore: assignment.max_score,
    }).needsModeration;

  const approveSubmission = async (submission: AssignmentDetailSubmission) => {
    if (isDemo) {
      toast.info("Approval is disabled in demo mode");
      return false;
    }
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

  const openReview = (sub: AssignmentDetailSubmission) => {
    setReviewSubmission(sub);
    const grade = grades[sub.id];
    setEditScore(grade?.lecturer_score?.toString() ?? grade?.ai_score?.toString() ?? "");
    setEditFeedback(grade?.lecturer_feedback ?? grade?.ai_feedback ?? "");
    setReviewOpen(true);
  };

  const saveReview = async () => {
    if (isDemo) {
      toast.info("Saving review is disabled in demo mode");
      return;
    }
    if (!reviewSubmission) return;
    const existingGrade = grades[reviewSubmission.id];
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
      toast.error("No AI grade found");
      return;
    }

    try {
      await supabase
        .from("grades")
        .update({
          lecturer_score: Number.isFinite(nextScore) ? nextScore : null,
          lecturer_feedback: nextFeedback,
        })
        .eq("id", existingGrade.id);

      const moderationCheck = evaluateModerationSignals({
        grade,
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

        await supabase.from("moderation_reviews").insert({
          moderation_case_id: moderationCase?.id,
          submission_id: reviewSubmission.id,
          reviewer_id: user!.id,
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
          snapshot: {
            ai_score: existingGrade.ai_score,
            lecturer_score: Number.isFinite(nextScore) ? nextScore : null,
            confidence_score: grade.grading_confidence ?? null,
            trigger_flags: moderationCheck.triggerFlags,
          },
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
          : "First marker review saved."
      );
      await loadSubmissions();
    } catch (e) {
      log.error("Save review failed", e, {
        submissionId: reviewSubmission.id,
      });
      toast.error("Failed to save review");
    }
    setReviewOpen(false);
  };

  const toggleSelect = (subId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredSubmissions.length) setSelected(new Set());
    else setSelected(new Set(filteredSubmissions.map((submission) => submission.id)));
  };

  const queueFeedbackSummary = async (sub: AssignmentDetailSubmission) => {
    if (isDemo) {
      toast.info("Feedback summary export is disabled in demo mode");
      return;
    }
    const grade = grades[sub.id];
    if (!grade) {
      toast.error("No grade available to summarise");
      return;
    }

      const { finalScore: score, finalFeedback } = resolveFinalGradeValues({ grade });
      const feedback = finalFeedback ?? "Feedback will be added in the grading workflow.";

    const result = await queueCommunicationMessage({
      category: "feedback-summary",
      recipientName: sub.student_name || sub.student_email || "Student",
      recipientEmail: sub.student_email,
      recipientId: sub.student_id || undefined,
      subject: `Feedback summary for ${assignment?.title || "your assignment"}`,
      body: `Hello ${sub.student_name || "student"},

Your submission for ${assignment?.title || "this assignment"} has been reviewed.

Score:
${score != null ? `${score}/${assignment?.max_score ?? 100}` : "Pending final score"}

Summary feedback:
${feedback}

Please review the feedback in the platform and let me know if you would like to discuss specific areas for improvement.`,
      relatedAssignmentId: assignment?.id,
      relatedStudentId: sub.student_id || sub.student_email || sub.student_name || undefined,
    });
    if (!result) {
      toast.error("Could not save feedback summary");
      return;
    }
    toast.success("Feedback summary saved");
  };

  const queueGradeReleaseNotification = async (sub: AssignmentDetailSubmission) => {
    if (isDemo) {
      toast.info("Release notes are disabled in demo mode");
      return;
    }
    if (!assignment) {
      toast.error("Could not save release note");
      return;
    }

    const result = await queueCommunicationMessage(
      buildGradeReleasedNotification({
        studentName: sub.student_name || sub.student_email || "Student",
        studentEmail: sub.student_email,
        studentId: sub.student_id || undefined,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
      }),
    );
    if (!result) {
      toast.error("Could not save release note");
      return;
    }
    void sendWorkflowNotificationEmail({
      category: "grade-released",
      assignmentId: assignment.id,
      submissionId: sub.id,
    }).catch(() => {
      log.warn("Grade release notification email failed", {
        assignmentId: assignment.id,
        submissionId: sub.id,
      });
    });
    toast.success("Grade release note saved");
  };

  const summary = useMemo(() => {
      return getAssessmentSummary(submissions);
    }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      const matchesSearch =
        !searchQuery ||
        [submission.student_name, submission.student_email, submission.file_name]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === "all" || submission.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, submissions]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (!assignment) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Assignment not found or access denied</p>
      <Button variant="link" onClick={() => navigate("/dashboard/assignments")}>Back to assignments</Button>
    </div>
  );

  const isLecturer = role === "lecturer";
  const currentUserId = user?.id ?? (isDemo ? profile?.id ?? null : null);
  const currentUserEmail = user?.email ?? (isDemo ? profile?.email ?? null : null);
  const hasExistingSubmission =
    !isLecturer &&
    submissions.some(
      (s) => s.student_id === currentUserId || (currentUserEmail && s.student_email === currentUserEmail)
    );
  const studentSubmissionAvailability = getStudentSubmissionAvailability({
    assignment,
    hasExistingSubmission,
    hasUser: Boolean(currentUserId),
  });
  const selectedStatuses = submissions.filter((s) => selected.has(s.id)).map((s) => s.status);
  const selectedWorkflowState = getSelectedWorkflowActionState(selectedStatuses);

  const exportReviewedReports = () => {
    const reviewedSubmissions = submissions.filter((submission) => {
      const grade = grades[submission.id];
      return grade && (grade.final_score != null || grade.lecturer_score != null || grade.ai_score != null);
    });

    if (reviewedSubmissions.length === 0) {
      toast.error("No reviewed submissions available to export");
      return;
    }

    const rows = [
      ["Student", "Email", "File", "Status", "Score", "Feedback", "Submitted"],
      ...reviewedSubmissions.map((submission) => {
        const grade = grades[submission.id];
        const score = grade?.final_score ?? grade?.lecturer_score ?? grade?.ai_score ?? "";
        const feedback =
          grade?.final_feedback ??
          grade?.lecturer_feedback ??
          grade?.ai_feedback ??
          "";

        return [
          submission.student_name || "Student",
          submission.student_email || "",
          submission.file_name,
          formatStatusLabel(submission.status),
          String(score),
          `"${String(feedback).replace(/"/g, '""')}"`,
          safeFormatDate(submission.submitted_at, "MMM d, yyyy HH:mm"),
        ];
      }),
    ];

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${assignment?.title || "assignment"}-reviewed-reports.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5 shadow-sm">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Demo Mode — synthetic sample data</span>
          </CardContent>
        </Card>
      )}
      {isDemo && demoAssignmentSet && isLecturer && (
        <Card className="border-primary/20 bg-background shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">{demoAssignmentSet.name}</p>
              <p className="text-xs text-muted-foreground">{demoAssignmentSet.reviewerSummary}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {demoAssignmentSet.label}
            </Badge>
          </CardContent>
        </Card>
      )}
      {isDemo && isLecturer && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium">1. Create and scope</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The Assignments page shows the real draft workflow: brief, due date, cohort targeting, and rubric setup before publish.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">2. Review what AI receives</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This synthetic assignment includes the full brief, rubric, sample submissions, and integrity evidence the grader would inspect.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">3. Review expected output</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use the submission list to inspect AI scores, criterion feedback, moderation-ready cases, and a released feedback example.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
        <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => navigate("/dashboard/assignments")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-background/70 text-xs">
                  <Sparkles className="mr-1 h-3 w-3" /> Assignment workflow
                </Badge>
                {assignment.module_code && (
                  <Badge variant="outline" className="text-xs">
                    {assignment.module_code}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold font-display">{assignment.title}</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {assignment.description || "Manage submissions, grading, lecturer review, and release workflow for this assignment."}
              </p>
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Max score: {assignment.max_score}
                </span>
                {assignment.due_date && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> Due {safeFormatDate(assignment.due_date, "MMM d, yyyy")}
                  </span>
                )}
                <span>Status: {formatStatusLabel(assignment.status)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
            {[
              { label: "Submissions", value: summary.submittedCount },
              { label: "Graded", value: summary.gradedCount },
              { label: "Released", value: summary.releasedCount },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border bg-background/70 p-4 text-center shadow-sm">
                <p className="text-2xl font-bold font-display">{item.value}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <WorkflowActionsSection
            isDemo={isDemo}
            isLecturer={isLecturer}
            fileInputRef={fileInputRef}
            bulkInputRef={bulkInputRef}
            handleStudentSubmit={handleStudentSubmit}
            studentSubmissionAvailability={studentSubmissionAvailability}
            uploading={uploading}
            uploadProgress={uploadProgress}
            currentUserId={currentUserId}
            handleBulkUpload={handleBulkUpload}
            handlePlagiarismCheck={handlePlagiarismCheck}
            checkingPlagiarism={checkingPlagiarism}
            submissionsCount={submissions.length}
            handleAIGrade={handleAIGrade}
            selectedWorkflowState={selectedWorkflowState}
            grading={grading}
            selectedSize={selected.size}
            handleReleaseGrades={handleReleaseGrades}
            handleBulkApprove={handleBulkApprove}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            exportReviewedReports={exportReviewedReports}
            gradingElapsed={gradingElapsed}
            gradingCount={gradingCount}
          />

          <SubmissionListSection
            submissions={submissions}
            filteredSubmissions={filteredSubmissions}
            isLecturer={isLecturer}
            selected={selected}
            toggleAll={toggleAll}
            toggleSelect={toggleSelect}
            grades={grades}
            moderationCases={moderationCases}
            assignment={assignment}
            isDemo={isDemo}
            openSubmissionFile={openSubmissionFile}
            openModeration={() => navigate("/dashboard/moderation")}
            openReview={openReview}
            approveSubmission={approveSubmission}
            loadSubmissions={reloadSubmissions}
            queueFeedbackSummary={queueFeedbackSummary}
            queueGradeReleaseNotification={queueGradeReleaseNotification}
          />
        </div>

        <div className="space-y-6">
          {(assignment.rubric?.length ?? 0) > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rubric</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(assignment.rubric ?? []).map((r: WorkflowRubricCriterion, i: number) => (
                  <div key={i} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{r.criterion}</span>
                      <Badge variant="outline">{r.weight} pts</Badge>
                    </div>
                    {r.description && <p className="mt-2 text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {plagiarismFlags.length > 0 && (
            <Card className="border-warning/30 bg-warning/5 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Integrity Flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{plagiarismSummary}</p>
                {plagiarismFlags.map((flag, i) => (
                  <div key={i} className="rounded-xl border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {flag.student_a} ↔ {flag.student_b}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{flag.reason}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Raw overlap {flag.overlap_analysis?.total_overlap || 0}% | Similarity risk {flag.similarity_score}% | Uncited {flag.overlap_analysis?.uncited_overlap || 0}% | Cited {flag.overlap_analysis?.cited_overlap || 0}% | AI {flag.ai_suspicion_score || 0}% | Baseline {flag.baseline_deviation_score || 0}% | Total risk {flag.total_risk_score || 0}%
                        </p>
                      </div>
                      <Badge
                        variant={
                          flag.severity === "high"
                            ? "destructive"
                            : flag.severity === "medium"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {flag.total_risk_score || flag.similarity_score}% risk
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <SubmissionReviewDialog
        assignmentMaxScore={assignment.max_score}
        editFeedback={editFeedback}
        editScore={editScore}
        grade={reviewSubmission ? grades[reviewSubmission.id] ?? null : null}
        isDemo={isDemo}
        onEditFeedbackChange={setEditFeedback}
        onEditScoreChange={setEditScore}
        onOpenChange={setReviewOpen}
        onSave={saveReview}
        open={reviewOpen}
        reviewSubmission={reviewSubmission}
      />
    </div>
  );
};

export default AssignmentDetail;
