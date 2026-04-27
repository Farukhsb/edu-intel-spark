import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CalendarDays,
  CheckCheck,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  FileText,
  Loader2,
  Search,
  Send,
  Shield,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/date";
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
import type { Tables } from "@/integrations/supabase/types";
import type {
  AIResponse,
  Assignment,
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
  isGradedWorkflowStatus,
  isStudentGradeVisible,
  resolveFinalGradeValues,
} from "@/lib/assessmentWorkflow";
import { safeParseEdgeAIGradeResponse, safeParseGradeBreakdown, safeParseIntegrityBatchResponse } from "@/lib/schemas/aiResponses";
import {
  toWorkflowRubric,
  type AcademicGradeBreakdownItem,
  type AcademicIntegrityFlag,
  type WorkflowRubricCriterion,
} from "@/types/academic";

type SubmissionStatus =
  | "submitted"
  | "ai_grading"
  | "ai_graded"
  | "first_review"
  | "moderation_pending"
  | "moderation_in_progress"
  | "moderated"
  | "escalated"
  | "under_review"
  | "approved"
  | "released";

const REGRADABLE_STATUSES: SubmissionStatus[] = [
  "submitted",
  "ai_graded",
  "first_review",
  "moderation_pending",
  "moderation_in_progress",
  "moderated",
  "escalated",
  "under_review",
  "approved",
];

const ALLOWED_SUBMISSION_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type AssignmentDetailSubmission = Submission & {
  id: string;
  assignment_id: string;
  student_name: string | null;
  student_email: string | null;
  file_name: string;
  file_type: string | null;
  file_url: string;
  status: SubmissionStatus;
  submitted_at: string;
  student_id: string | null;
};

interface AssignmentDetailBreakdown extends AcademicGradeBreakdownItem, GradeBreakdown {
  evidence_snippet?: string | null;
  review_required?: boolean | null;
  error_type?: "arithmetic_slip" | "conceptual_flaw" | "none";
}

interface GradingMetadata {
  fairness_notes?: string[];
  math_analysis?: {
    solver_signals?: string[];
  } | null;
  [key: string]: unknown;
}

interface Grade {
  id: string;
  submission_id: string;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: AssignmentDetailBreakdown[] | null;
  assignment_type?: string | null;
  grading_confidence?: number | null;
  grading_metadata?: GradingMetadata | null;
  lecturer_score: number | null;
  lecturer_feedback: string | null;
  final_score: number | null;
  final_feedback: string | null;
}

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

type IntegrityReview = Tables<"academic_integrity_reviews">;
type ModerationCase = Tables<"moderation_cases">;

type AssignmentDetailAssignment = Assignment & {
  id: string;
  title: string;
  description: string | null;
  module_code: string | null;
  max_score: number;
  due_date: string | null;
  status: string;
  lecturer_id: string;
  rubric: WorkflowRubricCriterion[] | null;
};

const toAssignmentDetailBreakdown = (value: unknown): AssignmentDetailBreakdown[] => {
  const parsed = safeParseGradeBreakdown(value);
  return parsed.success ? (parsed.data as AssignmentDetailBreakdown[]) : [];
};

interface PlagiarismFlag extends AcademicIntegrityFlag {}

const statusConfig: Record<
  SubmissionStatus,
  { label: string; variant: NonNullable<BadgeProps["variant"]>; icon: LucideIcon; tone: string }
> = {
  submitted: {
    label: "Submitted",
    variant: "outline",
    icon: Clock,
    tone: "border-border text-muted-foreground",
  },
  ai_grading: {
    label: "AI Grading",
    variant: "secondary",
    icon: Brain,
    tone: "border-primary/20 text-primary",
  },
  ai_graded: {
    label: "AI Graded",
    variant: "default",
    icon: CheckCircle,
    tone: "border-primary/20 text-primary",
  },
  first_review: {
    label: "First Review",
    variant: "secondary",
    icon: Edit,
    tone: "border-warning/30 text-warning",
  },
  moderation_pending: {
    label: "Moderation Pending",
    variant: "secondary",
    icon: Shield,
    tone: "border-warning/30 text-warning",
  },
  moderation_in_progress: {
    label: "Moderation In Progress",
    variant: "secondary",
    icon: Eye,
    tone: "border-warning/30 text-warning",
  },
  moderated: {
    label: "Moderated",
    variant: "default",
    icon: Shield,
    tone: "border-primary/20 text-primary",
  },
  escalated: {
    label: "Escalated",
    variant: "destructive",
    icon: AlertTriangle,
    tone: "border-destructive/30 text-destructive",
  },
  under_review: {
    label: "Under Review",
    variant: "secondary",
    icon: Eye,
    tone: "border-warning/30 text-warning",
  },
  approved: {
    label: "Approved",
    variant: "default",
    icon: CheckCheck,
    tone: "border-success/30 text-success",
  },
  released: {
    label: "Released",
    variant: "default",
    icon: Send,
    tone: "border-success/30 text-success",
  },
};

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

const AssignmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { role, user, profile } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<AssignmentDetailAssignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentDetailSubmission[]>([]);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [integrityReviews, setIntegrityReviews] = useState<Record<string, IntegrityReview>>({});
  const [moderationCases, setModerationCases] = useState<Record<string, ModerationCase>>({});
  const [loading, setLoading] = useState(true);
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
  const [plagiarismFlags, setPlagiarismFlags] = useState<PlagiarismFlag[]>([]);
  const [plagiarismSummary, setPlagiarismSummary] = useState("");
  const [checkingPlagiarism, setCheckingPlagiarism] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id || !user) return;

    const fetchAssignment = async () => {
      setLoading(true);

      let query = supabase
        .from("assignments")
        .select("*")
        .eq("id", id);

      if (role === "lecturer") {
        query = query.eq("lecturer_id", user.id);
      }

      const { data } = await query.maybeSingle();

      if (data) {
        setAssignment({
          id: data.id,
          title: data.title,
          description: data.description,
          module_code: data.module_code,
          max_score: data.max_score,
          due_date: data.due_date,
          status: data.status,
          lecturer_id: data.lecturer_id,
          rubric: toWorkflowRubric(data.rubric),
        });
      } else {
        setAssignment(null);
        setSubmissions([]);
        setGrades({});
      }

      setLoading(false);
    };
    void fetchAssignment();
  }, [id]);

  const loadGrades = async (subs: AssignmentDetailSubmission[]) => {
    if (subs.length === 0) {
      setGrades({});
      return;
    }
    const { data } = await supabase
      .from("grades")
      .select("*")
      .in(
        "submission_id",
        subs.map((s) => s.id)
      );
    if (data) {
      const gradeMap: Record<string, Grade> = {};
      for (const g of data) {
        gradeMap[g.submission_id] = {
          id: g.id,
          submission_id: g.submission_id,
          ai_score: g.ai_score,
          ai_feedback: g.ai_feedback,
          ai_breakdown: toAssignmentDetailBreakdown(g.ai_breakdown),
          assignment_type: g.assignment_type,
          grading_confidence: g.grading_confidence,
          grading_metadata: (g.grading_metadata as GradingMetadata | null) ?? null,
          lecturer_score: g.lecturer_score,
          lecturer_feedback: g.lecturer_feedback,
          final_score: g.final_score,
          final_feedback: g.final_feedback,
        };
      }
      setGrades(gradeMap);
    }
  };

  const loadIntegrityReviews = async (subs: AssignmentDetailSubmission[]) => {
    if (subs.length === 0 || !user) {
      setIntegrityReviews({});
      return;
    }

    const { data } = await supabase
      .from("academic_integrity_reviews")
      .select("*")
      .eq("lecturer_id", user.id)
      .in(
        "submission_id",
        subs.map((submission) => submission.id)
      );

    const reviewMap: Record<string, IntegrityReview> = {};
    for (const review of data || []) {
      reviewMap[review.submission_id] = review;
    }
    setIntegrityReviews(reviewMap);
  };

  const loadModerationCases = async (subs: AssignmentDetailSubmission[]) => {
    if (subs.length === 0) {
      setModerationCases({});
      return;
    }

    const { data } = await supabase
      .from("moderation_cases")
      .select("*")
      .in(
        "submission_id",
        subs.map((submission) => submission.id)
      );

    const caseMap: Record<string, ModerationCase> = {};
    for (const moderationCase of data || []) {
      caseMap[moderationCase.submission_id] = moderationCase;
    }
    setModerationCases(caseMap);
  };

  const loadSubmissions = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", id)
      .order("submitted_at", { ascending: false });
    if (data) {
      const subs: AssignmentDetailSubmission[] = data.map((d) => ({
        id: d.id,
        assignment_id: d.assignment_id,
        student_name: d.student_name,
        student_email: d.student_email,
        file_name: d.file_name,
        file_type: d.file_type,
        file_url: d.file_url,
        status: d.status as SubmissionStatus,
        submitted_at: d.submitted_at,
        student_id: d.student_id,
      }));
      setSubmissions(subs);
      await Promise.all([loadGrades(subs), loadIntegrityReviews(subs), loadModerationCases(subs)]);
    }
  };

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

  useEffect(() => {
    void loadSubmissions();
  }, [id]);

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
      const { error } = await supabase.from("submissions").insert({
        assignment_id: assignment.id,
        student_id: user.id,
        file_url: uploaded.fileUrl,
        file_name: uploaded.fileName,
        file_type: uploaded.fileType,
        uploaded_by: user.id,
        status: "submitted" as const,
        student_name: profile?.full_name ?? null,
        student_email: user.email ?? null,
      });
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
      void sendWorkflowNotificationEmail({
        category: "submission-received",
        assignmentId: assignment.id,
      }).catch(() => {
        log.warn("Submission notification email failed", {
          assignmentId: assignment.id,
        });
      });
      toast.success("Submission uploaded successfully");
      await loadSubmissions();
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
    await loadSubmissions();
    e.target.value = "";
  };

  const handleAIGrade = async () => {
    const toGrade = submissions.filter((s) => selected.has(s.id) && REGRADABLE_STATUSES.includes(s.status));
    if (toGrade.length === 0) {
      toast.error("Select submitted or reviewable files to grade");
      return;
    }
    if (!assignment) return;

    setGrading(true);
    setGradingCount(toGrade.length);
    setGradingElapsed(0);
    gradingTimerRef.current = setInterval(() => setGradingElapsed((p) => p + 1), 1000);
    toast.info(`Sending ${toGrade.length} submission(s) for AI grading...`);

    for (const sub of toGrade) {
      try {
        await supabase.from("submissions").update({ status: "ai_grading" as const }).eq("id", sub.id);
      } catch {}
    }

    try {
      const { data, error } = await supabase.functions.invoke<GradeSubmissionInvokeData>("grade-submission", {
        body: {
          assignmentId: assignment.id,
          submissions: toGrade.map((s) => ({ id: s.id })),
        },
      });

      if (error) throw error;
      const results = data?.results || [];
      let successCount = 0;
      let failCount = 0;
      const failureMessages = new Set<string>();

      for (const r of results) {
        const sub = toGrade.find((s) => s.id === r.submissionId);
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
      for (const sub of toGrade) {
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
    await loadSubmissions();
  };

  const handleBulkApprove = async () => {
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
    await loadSubmissions();
  };

  const handleReleaseGrades = async () => {
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
    await loadSubmissions();
  };

  const handlePlagiarismCheck = async () => {
    if (!assignment) return;
    setCheckingPlagiarism(true);
    try {
      const batchSize = 3;
      const collectedFlags: PlagiarismFlag[] = [];
      const collectedSummaries: string[] = [];
      const collectedWarnings: string[] = [];
      let failedBatches = 0;
      let successfulBatches = 0;

      for (let index = 0; index < submissions.length; index += batchSize) {
        const batch = submissions.slice(index, index + batchSize);
        const { data, error } = await supabase.functions.invoke("check-plagiarism", {
          body: {
            assignmentId: assignment.id,
            submissions: batch.map((s) => ({
              id: s.id,
              student_name: s.student_name || s.student_email || "Anonymous",
              file_name: s.file_name,
              file_url: s.file_url,
            })),
          },
        });

        if (error) {
          failedBatches += 1;
          log.error("Plagiarism batch failed", error, {
            batchStart: index,
            batchSize: batch.length,
          });
          collectedWarnings.push(`A plagiarism analysis batch of ${batch.length} submission(s) failed and was skipped.`);
          continue;
        }

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
      await loadSubmissions();
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
          .some((value) => value!.toLowerCase().includes(searchQuery.toLowerCase()));
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

  if (!assignment)
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Assignment not found</p>
        <Button variant="link" onClick={() => navigate("/dashboard/assignments")}>Back to assignments</Button>
      </div>
    );
  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Loading...</p></div>;
  if (!assignment) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Assignment not found or access denied</p>
      <Button variant="link" onClick={() => navigate("/dashboard/assignments")}>Back to assignments</Button>
    </div>
  );

  const isLecturer = role === "lecturer";
  const currentUserId = user?.id ?? null;
  const currentUserEmail = user?.email ?? null;
  const hasExistingSubmission =
    !isLecturer &&
    submissions.some(
      (s) => s.student_id === currentUserId || (currentUserEmail && s.student_email === currentUserEmail)
    );
  const selectedStatuses = submissions.filter((s) => selected.has(s.id)).map((s) => s.status);
  const hasSubmitted = selectedStatuses.some((s) => REGRADABLE_STATUSES.includes(s));
  const hasGraded = selectedStatuses.some((s) => isGradedWorkflowStatus(s) && !canReleaseStatus(s) && !isStudentGradeVisible(s));
  const hasApproved = selectedStatuses.some((s) => canReleaseStatus(s));

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
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Workflow Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isLecturer ? (
                <>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleStudentSubmit} />
                  <div className="flex flex-col gap-3 rounded-xl border border-dashed p-5">
                    <div>
                      <p className="text-sm font-medium">Submit your work</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Upload your assignment file once. After submission, your work will enter the grading workflow.
                      </p>
                    </div>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || hasExistingSubmission || !currentUserId}
                      className="w-full sm:w-fit"
                    >
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {uploading
                        ? `Uploading... ${uploadProgress}%`
                        : hasExistingSubmission
                        ? "Already Submitted"
                        : "Submit My Work"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    ref={bulkInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.zip,.py,.java,.cpp,.c,.js,.ts,.html,.css"
                    onChange={handleBulkUpload}
                  />
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Button onClick={() => bulkInputRef.current?.click()} disabled={uploading} className="justify-start">
                      <Upload className="mr-2 h-4 w-4" />
                      {uploading ? "Uploading..." : "Upload submissions"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePlagiarismCheck}
                      disabled={checkingPlagiarism || submissions.length < 1}
                      className="justify-start"
                    >
                      {checkingPlagiarism ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                      {checkingPlagiarism ? "Checking..." : submissions.length === 1 ? "AI content check" : "Plagiarism check"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleAIGrade}
                      disabled={!hasSubmitted || grading || selected.size === 0}
                      className="justify-start"
                    >
                      {grading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                      {grading ? "Grading..." : `AI grade / regrade${selected.size > 0 ? ` (${selected.size})` : ""}`}
                    </Button>
                    <Button
                      variant="default"
                      onClick={hasApproved ? handleReleaseGrades : handleBulkApprove}
                      disabled={selected.size === 0 || (!hasApproved && !hasGraded)}
                      className="justify-start"
                    >
                      {hasApproved ? <Send className="mr-2 h-4 w-4" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                      {hasApproved ? `Release${selected.size > 0 ? ` (${selected.size})` : ""}` : `Approve${selected.size > 0 ? ` (${selected.size})` : ""}`}
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search by student, email, or file"
                        className="pl-9"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={(value: "all" | SubmissionStatus) => setStatusFilter(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="ai_grading">AI grading</SelectItem>
                        <SelectItem value="ai_graded">AI graded</SelectItem>
                        <SelectItem value="first_review">First review</SelectItem>
                        <SelectItem value="moderation_pending">Moderation pending</SelectItem>
                        <SelectItem value="moderation_in_progress">Moderation in progress</SelectItem>
                        <SelectItem value="moderated">Moderated</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                        <SelectItem value="under_review">Under review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="released">Released</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={exportReviewedReports}>
                      Export reviewed reports
                    </Button>
                  </div>

                  {(grading || selected.size > 0) && (
                    <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                      {grading ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          <span>
                            {gradingElapsed < 30
                              ? `Processing ${gradingCount} file(s)... ${gradingElapsed}s`
                              : gradingElapsed < 90
                              ? `AI is reading and grading... ${gradingElapsed}s`
                              : `Still working... ${gradingElapsed}s — large files take longer`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <span>
                            {selected.size} submission{selected.size === 1 ? "" : "s"} selected. Choose the next workflow action above.
                          </span>
                          <Badge variant="outline">{selectedStatuses.filter((status) => status === "submitted").length} submitted</Badge>
                          <Badge variant="outline">
                            {
                              selectedStatuses.filter((status) =>
                                ["ai_graded", "first_review", "moderated", "under_review"].includes(status)
                              ).length
                            } ready to approve
                          </Badge>
                          <Badge variant="outline">{selectedStatuses.filter((status) => status === "approved").length} ready to release</Badge>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="text-sm font-medium">No submissions yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Student uploads will appear here once work is submitted to this assignment.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {isLecturer && (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                      <Checkbox
                        checked={selected.size === filteredSubmissions.length && filteredSubmissions.length > 0}
                        onCheckedChange={toggleAll}
                      />
                      <span className="text-xs text-muted-foreground">Select all visible submissions</span>
                    </div>
                  )}

                  {filteredSubmissions.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center">
                      <p className="text-sm font-medium">No submissions match this view</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Adjust the status filter or search query to see more work.
                      </p>
                    </div>
                  ) : filteredSubmissions.map((sub) => {
                    const grade = grades[sub.id];
                    const moderationCase = moderationCases[sub.id];
                    const sc = statusConfig[sub.status];
                    const StatusIcon = sc.icon;
                    const needsAttention = [
                      "submitted",
                      "ai_grading",
                      "ai_graded",
                      "first_review",
                      "moderation_pending",
                      "moderation_in_progress",
                      "escalated",
                      "under_review",
                    ].includes(sub.status);
                    return (
                      <div
                        key={sub.id}
                        data-testid={`submission-card-${sub.id}`}
                        className="rounded-2xl border p-4 shadow-sm transition-colors hover:bg-muted/20"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 gap-3">
                            {isLecturer && (
                              <div className="pt-1">
                                <Checkbox checked={selected.has(sub.id)} onCheckedChange={() => toggleSelect(sub.id)} />
                              </div>
                            )}
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/70">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium truncate">{sub.student_name || sub.student_email || "Student"}</p>
                                {needsAttention && (
                                  <Badge variant="outline" className="border-warning/30 text-warning text-[10px] uppercase tracking-wide">
                                    Needs attention
                                  </Badge>
                                )}
                                {moderationCase && (
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                    Moderation case
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{sub.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Submitted {safeFormatDate(sub.submitted_at, "MMM d, yyyy 'at' HH:mm")}
                              </p>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                  size="sm"
                                  variant="link"
                                  className="h-auto p-0 text-xs"
                                  onClick={() => void openSubmissionFile(sub)}
                                >
                                  Open file
                                </Button>
                                {moderationCase && (
                                  <Button
                                    size="sm"
                                    variant="link"
                                    className="h-auto p-0 text-xs"
                                    onClick={() => navigate("/dashboard/moderation")}
                                  >
                                    Open moderation
                                  </Button>
                                )}
                              </div>

                              {grade?.ai_breakdown && Array.isArray(grade.ai_breakdown) && grade.ai_breakdown.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                          {grade.ai_breakdown.map((b: AssignmentDetailBreakdown, i: number) => (
                            <span key={i} className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                                      {b.criterion}: {b.score}/{b.max_score}
                                      {typeof b.confidence_score === "number" ? ` • c${Math.round(b.confidence_score * 100)}%` : ""}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {!isLecturer && isStudentGradeVisible(sub.status) && grade?.final_feedback && (
                                <p className="pt-1 text-xs text-muted-foreground line-clamp-2">{grade.final_feedback}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-2 lg:items-end">
                            <div className="flex flex-wrap items-center gap-2">
                              {grade?.ai_score != null && (
                                <span className="text-sm font-bold font-display">
                                  {grade.final_score ?? grade.lecturer_score ?? grade.ai_score}/{assignment.max_score}
                                </span>
                              )}
                              {grade?.assignment_type && (
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                  {grade.assignment_type}
                                </Badge>
                              )}
                              <Badge
                                data-testid={`submission-status-${sub.id}`}
                                variant={sc.variant}
                                className={`text-xs ${sc.tone}`}
                              >
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {sc.label}
                              </Badge>
                            </div>

                            {isLecturer && (
                              <div className="flex flex-wrap gap-2 lg:justify-end">
                                {grade?.ai_score != null && (
                                  <Button size="sm" variant="ghost" onClick={() => void queueFeedbackSummary(sub)}>
                                    <Sparkles className="mr-1 h-3 w-3" /> Feedback summary
                                  </Button>
                                )}
                                {grade?.ai_score != null && !canReleaseStatus(sub.status) && !isStudentGradeVisible(sub.status) && (
                                  <Button
                                    data-testid={`submission-review-${sub.id}`}
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openReview(sub)}
                                  >
                                    <Edit className="mr-1 h-3 w-3" /> First review
                                  </Button>
                                )}
                                {grade?.ai_score != null && !canReleaseStatus(sub.status) && !isStudentGradeVisible(sub.status) && (
                                  <Button
                                    data-testid={`submission-approve-${sub.id}`}
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        const approved = await approveSubmission(sub);
                                        if (approved) toast.success("Submission approved");
                                        await loadSubmissions();
                                      } catch (e) {
                                        log.warn("Submission approve failed", {
                                          submissionId: sub.id,
                                        });
                                        toast.error("Could not approve");
                                      }
                                    }}
                                  >
                                    <CheckCheck className="mr-1 h-3 w-3" /> Approve
                                  </Button>
                                )}
                                {canReleaseStatus(sub.status) && (
                                  <Button
                                    data-testid={`submission-release-${sub.id}`}
                                    size="sm"
                                    variant="default"
                                    onClick={async () => {
                                      try {
                                        await supabase
                                          .from("submissions")
                                          .update({ status: "released" as const })
                                          .eq("id", sub.id);
                                          await queueGradeReleaseNotification(sub);
                                        toast.success("Grade released to student");
                                        await loadSubmissions();
                                      } catch (e) {
                                        toast.error("Failed to release grade");
                                      }
                                    }}
                                  >
                                    <Send className="mr-1 h-3 w-3" /> Release
                                  </Button>
                                )}
                                {isStudentGradeVisible(sub.status) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void queueGradeReleaseNotification(sub)}
                                  >
                                    <Send className="mr-1 h-3 w-3" /> Send release note
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {assignment.rubric && Array.isArray(assignment.rubric) && assignment.rubric.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rubric</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignment.rubric.map((r: WorkflowRubricCriterion, i: number) => (
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

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent data-testid="submission-review-dialog" className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Submission</DialogTitle>
            <DialogDescription>
              {reviewSubmission?.student_name || "Student"} — {reviewSubmission?.file_name}
            </DialogDescription>
          </DialogHeader>
          {reviewSubmission && grades[reviewSubmission.id] && (
            <div className="space-y-4 pt-2">
              <Card className="bg-muted/40">
                <CardContent className="space-y-2 p-4">
                  <p className="text-xs font-medium text-muted-foreground">AI Score</p>
                  <p className="text-lg font-bold font-display">
                    {grades[reviewSubmission.id].ai_score}/{assignment.max_score}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {grades[reviewSubmission.id].assignment_type && (
                      <Badge variant="outline">{grades[reviewSubmission.id].assignment_type}</Badge>
                    )}
                    {typeof grades[reviewSubmission.id].grading_confidence === "number" && (
                      <Badge variant={grades[reviewSubmission.id].grading_confidence < 0.7 ? "secondary" : "outline"}>
                        Confidence {Math.round(grades[reviewSubmission.id].grading_confidence * 100)}%
                      </Badge>
                    )}
                    {Boolean(grades[reviewSubmission.id].grading_metadata?.math_analysis?.solver_signals?.length) && (
                      <Badge variant="secondary">Solver review flagged</Badge>
                    )}
                    {Boolean(grades[reviewSubmission.id].grading_metadata?.fairness_notes?.length) && (
                      <Badge variant="secondary">Fairness adjustment noted</Badge>
                    )}
                  </div>
                  {Boolean(grades[reviewSubmission.id].grading_metadata?.fairness_notes?.length) && (
                    <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                      {(grades[reviewSubmission.id].grading_metadata?.fairness_notes ?? []).map((note, index) => (
                        <p key={index} className={index > 0 ? "mt-1" : ""}>
                          {note}
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="pt-1 text-xs font-medium text-muted-foreground">AI Feedback</p>
                  <div className="max-h-56 overflow-y-auto rounded-md bg-background/80 p-3">
                    <p className="whitespace-pre-wrap text-sm">
                      {grades[reviewSubmission.id].ai_feedback || "N/A"}
                    </p>
                  </div>
                  {grades[reviewSubmission.id].ai_breakdown && Array.isArray(grades[reviewSubmission.id].ai_breakdown) && (
                    <div className="space-y-1 pt-2">
                      <p className="text-xs font-medium text-muted-foreground">Breakdown</p>
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md bg-background/80 p-3">
                        {grades[reviewSubmission.id].ai_breakdown?.map((b, i) => (
                          <div key={i} className="space-y-1 rounded-md border bg-background p-2 text-xs">
                            <div className="flex justify-between gap-3">
                              <span>{b.criterion}</span>
                              <span className="font-medium">
                                {b.score}/{b.max_score}
                              </span>
                            </div>
                            {typeof b.confidence_score === "number" && (
                              <p className="text-muted-foreground">
                                Confidence {Math.round(b.confidence_score * 100)}%
                                {b.review_required ? " • lecturer review" : ""}
                              </p>
                            )}
                            {b.evidence_snippet && (
                              <p className="text-muted-foreground">Evidence: {b.evidence_snippet}</p>
                            )}
                            {b.error_type && b.error_type !== "none" && (
                              <p className="text-muted-foreground">Error type: {String(b.error_type).replace("_", " ")}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Score (optional override)</label>
                <Input
                  type="number"
                  value={editScore}
                  onChange={(e) => setEditScore(e.target.value)}
                  placeholder={`Out of ${assignment.max_score}`}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Feedback (optional)</label>
                <Textarea
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  rows={4}
                  placeholder="Add or edit feedback..."
                />
              </div>
              <div className="flex gap-2">
                <Button data-testid="submission-review-save" onClick={saveReview} className="flex-1">Save Review</Button>
                <Button variant="outline" onClick={() => setReviewOpen(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssignmentDetail;
