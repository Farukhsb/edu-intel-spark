import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Send,
  Shield,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/date";

type SubmissionStatus =
  | "submitted"
  | "ai_grading"
  | "ai_graded"
  | "under_review"
  | "approved"
  | "released";

interface Submission {
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
}

interface Grade {
  id: string;
  submission_id: string;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_breakdown: any[] | null;
  lecturer_score: number | null;
  lecturer_feedback: string | null;
  final_score: number | null;
  final_feedback: string | null;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  module_code: string | null;
  max_score: number;
  due_date: string | null;
  status: string;
  lecturer_id: string;
  rubric: any[] | null;
}

interface PlagiarismFlag {
  student_a: string;
  student_b: string;
  similarity_score: number;
  reason: string;
  severity: string;
}

const statusConfig: Record<
  SubmissionStatus,
  { label: string; variant: string; icon: any; tone: string }
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

const formatStatusLabel = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const AssignmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { role, user, profile } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [grading, setGrading] = useState(false);
  const [gradingCount, setGradingCount] = useState(0);
  const [gradingElapsed, setGradingElapsed] = useState(0);
  const gradingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState<Submission | null>(null);
  const [editScore, setEditScore] = useState("");
  const [editFeedback, setEditFeedback] = useState("");
  const [plagiarismFlags, setPlagiarismFlags] = useState<PlagiarismFlag[]>([]);
  const [plagiarismSummary, setPlagiarismSummary] = useState("");
  const [checkingPlagiarism, setCheckingPlagiarism] = useState(false);
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
          rubric: data.rubric as any[] | null,
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



  const loadGrades = async (subs: Submission[]) => {
    if (subs.length === 0) {
      setGrades({});
      return;
    }

    const { data } = await supabase
      .from("grades")
      .select("*")
      .in("submission_id", subs.map((s) => s.id));

    if (data) {
      const gradeMap: Record<string, Grade> = {};
      for (const g of data) {
        gradeMap[g.submission_id] = {
          id: g.id,
          submission_id: g.submission_id,
          ai_score: g.ai_score,
          ai_feedback: g.ai_feedback,
          ai_breakdown: g.ai_breakdown as any[],
          lecturer_score: g.lecturer_score,
          lecturer_feedback: g.lecturer_feedback,
          final_score: g.final_score,
          final_feedback: g.final_feedback,
        };
      }
      setGrades(gradeMap);
    }
  };

  const loadSubmissions = async () => {
    if (!assignment) return;

    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", assignment.id)
      .order("submitted_at", { ascending: false });

    if (data) {
      const subs: Submission[] = data.map((d) => ({
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
      await loadGrades(subs);
    } else {
      setSubmissions([]);
      setGrades({});
    }
  };

  useEffect(() => {
    if (!assignment) return;
    void loadSubmissions();
  }, [assignment?.id]);

  const uploadFile = async (file: File, userId: string) => {
    if (!assignment) throw new Error("Missing assignment");
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
    return { fileUrl: data.path, fileName: safeFileName, fileType: file.type || "application/octet-stream", storagePath: data.path };
  };

  const handleStudentSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !assignment || !user?.id) {
      e.target.value = "";
      return;
    }
    if (!file || !assignment || !user?.id) { e.target.value = ""; return; }

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
      toast.success("Submission uploaded successfully");
      await loadSubmissions();
    } catch (error: any) {
      console.error("[Submission] Failed:", error);
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

    for (const file of Array.from(files)) {
      try {
        const { fileUrl, fileName, fileType } = await uploadFile(file, user.id);
        const studentName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        const { error } = await supabase.from("submissions").insert({
          assignment_id: assignment.id,
          student_name: studentName,
          file_url: fileUrl,
          file_name: fileName,
          file_type: fileType,
          uploaded_by: user.id,
          status: "submitted" as const,
          student_id: null,
          student_email: null,
        });
        if (error) throw error;
        success++;
      } catch (err: any) {
        console.error(`[BulkUpload] Failed for ${file.name}:`, err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    toast.success(`${success} file(s) uploaded`);
    setUploading(false);
    await loadSubmissions();
    e.target.value = "";
  };

  const handleAIGrade = async () => {
    const toGrade = submissions.filter((s) => selected.has(s.id) && s.status === "submitted");
    if (toGrade.length === 0) {
      toast.error("Select submitted files to grade");
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
      const { data, error } = await supabase.functions.invoke("grade-submission", {
        body: {
          assignmentId: assignment.id,
          submissions: toGrade.map((s) => ({ id: s.id })),
        },
      });

      if (error) throw error;
      const results = data?.results || [];
      let successCount = 0;
      let failCount = 0;

      for (const r of results) {
        const sub = toGrade.find((s) => s.id === r.submissionId);
        if (!sub) continue;

        if (r.success) {
          try {
            await supabase.from("grades").insert({
              submission_id: sub.id,
              ai_score: r.score,
              ai_feedback: r.feedback,
              ai_breakdown: r.breakdown || [],
            });
          } catch (gradeErr) {
            console.error("Failed to write grade:", gradeErr);
          }
          try {
            await supabase.from("submissions").update({ status: "ai_graded" as const }).eq("id", sub.id);
          } catch {}
          successCount++;
        } else {
          try {
            await supabase.from("submissions").update({ status: "submitted" as const }).eq("id", sub.id);
          } catch {}
          failCount++;
        }
      }

      if (successCount > 0) toast.success(`${successCount} submission(s) graded successfully`);
      if (failCount > 0) toast.error(`${failCount} submission(s) failed to grade`);
    } catch (err: any) {
      toast.error(err?.message || "AI grading failed");
      for (const sub of toGrade) {
        try {
          await supabase.from("submissions").update({ status: "submitted" as const }).eq("id", sub.id);
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
      (s) => selected.has(s.id) && (s.status === "ai_graded" || s.status === "under_review")
    );
    if (toApprove.length === 0) {
      toast.error("Select AI-graded submissions to approve");
      return;
    }

    for (const sub of toApprove) {
      const grade = grades[sub.id];
      if (grade) {
        try {
          await supabase
            .from("grades")
            .update({
              final_score: grade.lecturer_score ?? grade.ai_score,
              final_feedback: grade.lecturer_feedback ?? grade.ai_feedback,
              reviewed_by: user!.id,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", grade.id);
        } catch (e) {
          console.warn("Grade update failed:", e);
        }
      }
      try {
        await supabase.from("submissions").update({ status: "approved" as const }).eq("id", sub.id);
      } catch {}
    }
    toast.success(`${toApprove.length} submission(s) approved`);
    setSelected(new Set());
    await loadSubmissions();
  };

  const handleReleaseGrades = async () => {
    const toRelease = submissions.filter((s) => selected.has(s.id) && s.status === "approved");
    if (toRelease.length === 0) {
      toast.error("Select approved submissions to release");
      return;
    }

    for (const sub of toRelease) {
      try {
        await supabase.from("submissions").update({ status: "released" as const }).eq("id", sub.id);
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
      const { data, error } = await supabase.functions.invoke("check-plagiarism", {
        body: {
          submissions: submissions.map((s) => ({
            id: s.id,
            student_name: s.student_name || s.student_email || "Anonymous",
            file_name: s.file_name,
            file_url: s.file_url,
          })),
        },
      });
      if (error) throw error;
      setPlagiarismFlags(data?.flags || []);
      setPlagiarismSummary(data?.summary || "Analysis complete");
      if (data?.flags?.length === 0) toast.success("No suspicious similarities found");
      else toast.warning(`${data.flags.length} potential issue(s) flagged`);
    } catch (err: any) {
      toast.error(err?.message || "Plagiarism check failed");
    }
    setCheckingPlagiarism(false);
  };

  const openReview = (sub: Submission) => {
    setReviewSubmission(sub);
    const grade = grades[sub.id];
    setEditScore(grade?.lecturer_score?.toString() ?? grade?.ai_score?.toString() ?? "");
    setEditFeedback(grade?.lecturer_feedback ?? grade?.ai_feedback ?? "");
    setReviewOpen(true);
  };

  const saveReview = async () => {
    if (!reviewSubmission) return;
    const grade = grades[reviewSubmission.id];
    if (!grade) {
      toast.error("No AI grade found");
      return;
    }

    try {
      await supabase
        .from("grades")
        .update({
          lecturer_score: Number(editScore) || null,
          lecturer_feedback: editFeedback || null,
        })
        .eq("id", grade.id);
      await supabase
        .from("submissions")
        .update({ status: "under_review" as const })
        .eq("id", reviewSubmission.id);
      toast.success("Review saved");
      await loadSubmissions();
    } catch (e) {
      console.error("Save review failed:", e);
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
    if (selected.size === submissions.length) setSelected(new Set());
    else setSelected(new Set(submissions.map((s) => s.id)));
  };

  const summary = useMemo(() => {
    const graded = submissions.filter((s) => ["ai_graded", "under_review", "approved", "released"].includes(s.status));
    const released = submissions.filter((s) => s.status === "released");
    return {
      submittedCount: submissions.length,
      gradedCount: graded.length,
      releasedCount: released.length,
    };
  }, [submissions]);

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
  const hasSubmitted = selectedStatuses.some((s) => s === "submitted");
  const hasGraded = selectedStatuses.some((s) => s === "ai_graded" || s === "under_review");
  const hasApproved = selectedStatuses.some((s) => s === "approved");

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
                    <CalendarDays className="h-3.5 w-3.5" /> Due {format(new Date(assignment.due_date), "MMM d, yyyy")}
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
                      {grading ? "Grading..." : `AI grade${selected.size > 0 ? ` (${selected.size})` : ""}`}
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
                        <span>
                          {selected.size} submission{selected.size === 1 ? "" : "s"} selected. Choose the next workflow action above.
                        </span>
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
                        checked={selected.size === submissions.length && submissions.length > 0}
                        onCheckedChange={toggleAll}
                      />
                      <span className="text-xs text-muted-foreground">Select all submissions</span>
                    </div>
                  )}

                  {submissions.map((sub) => {
                    const grade = grades[sub.id];
                    const sc = statusConfig[sub.status];
                    const StatusIcon = sc.icon;
                    const needsAttention = ["submitted", "ai_grading", "ai_graded", "under_review"].includes(sub.status);
                    return (
                      <div
                        key={sub.id}
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
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{sub.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Submitted {format(new Date(sub.submitted_at), "MMM d, yyyy 'at' HH:mm")}
                              </p>

                              {grade?.ai_breakdown && Array.isArray(grade.ai_breakdown) && grade.ai_breakdown.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {grade.ai_breakdown.map((b: any, i: number) => (
                                    <span key={i} className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                                      {b.criterion}: {b.score}/{b.max_score}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {!isLecturer && sub.status === "released" && grade?.final_feedback && (
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
                              <Badge variant={sc.variant as any} className={`text-xs ${sc.tone}`}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {sc.label}
                              </Badge>
                            </div>

                            {isLecturer && (
                              <div className="flex flex-wrap gap-2 lg:justify-end">
                                {grade?.ai_score != null && sub.status !== "approved" && sub.status !== "released" && (
                                  <Button size="sm" variant="ghost" onClick={() => openReview(sub)}>
                                    <Edit className="mr-1 h-3 w-3" /> Review
                                  </Button>
                                )}
                                {grade?.ai_score != null && sub.status !== "approved" && sub.status !== "released" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      const g = grades[sub.id];
                                      if (g) {
                                        try {
                                          await supabase
                                            .from("grades")
                                            .update({
                                              final_score: g.lecturer_score ?? g.ai_score,
                                              final_feedback: g.lecturer_feedback ?? g.ai_feedback,
                                              reviewed_by: user!.id,
                                              reviewed_at: new Date().toISOString(),
                                            })
                                            .eq("id", g.id);
                                          await supabase
                                            .from("submissions")
                                            .update({ status: "approved" as const })
                                            .eq("id", sub.id);
                                          toast.success("Submission approved");
                                          await loadSubmissions();
                                        } catch (e) {
                                          console.warn("Approve failed:", e);
                                          toast.error("Could not approve");
                                        }
                                      }
                                    }}
                                  >
                                    <CheckCheck className="mr-1 h-3 w-3" /> Approve
                                  </Button>
                                )}
                                {sub.status === "approved" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={async () => {
                                      try {
                                        await supabase
                                          .from("submissions")
                                          .update({ status: "released" as const })
                                          .eq("id", sub.id);
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
                {assignment.rubric.map((r: any, i: number) => (
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
                        {flag.similarity_score}% similar
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
        <DialogContent className="sm:max-w-lg">
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
                  <p className="pt-1 text-xs font-medium text-muted-foreground">AI Feedback</p>
                  <p className="text-sm">{grades[reviewSubmission.id].ai_feedback || "N/A"}</p>
                  {grades[reviewSubmission.id].ai_breakdown && Array.isArray(grades[reviewSubmission.id].ai_breakdown) && (
                    <div className="space-y-1 pt-2">
                      <p className="text-xs font-medium text-muted-foreground">Breakdown</p>
                      {(grades[reviewSubmission.id].ai_breakdown as any[]).map((b, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>{b.criterion}</span>
                          <span className="font-medium">
                            {b.score}/{b.max_score}
                          </span>
                        </div>
                      ))}
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
                <Button onClick={saveReview} className="flex-1">Save Review</Button>
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
