import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Upload, FileText, CheckCircle, Clock, Brain, Eye,
  CheckCheck, Edit, Send, Shield, AlertTriangle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type SubmissionStatus = "submitted" | "ai_grading" | "ai_graded" | "under_review" | "approved" | "released";

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

const statusConfig: Record<SubmissionStatus, { label: string; variant: string; icon: any }> = {
  submitted: { label: "Submitted", variant: "outline", icon: Clock },
  ai_grading: { label: "AI Grading...", variant: "secondary", icon: Brain },
  ai_graded: { label: "AI Graded", variant: "default", icon: CheckCircle },
  under_review: { label: "Under Review", variant: "secondary", icon: Eye },
  approved: { label: "Approved", variant: "default", icon: CheckCheck },
  released: { label: "Released", variant: "default", icon: Send },
};

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

  // Fetch assignment
  useEffect(() => {
    if (!id) return;
    const fetchAssignment = async () => {
      const { data } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", id)
        .maybeSingle();
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
      }
      setLoading(false);
    };
    fetchAssignment();
  }, [id]);

  const loadSubmissions = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", id)
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
    }
  };

  const loadGrades = async (subs: Submission[]) => {
    if (subs.length === 0) { setGrades({}); return; }
    const { data } = await supabase
      .from("grades")
      .select("*")
      .in("submission_id", subs.map(s => s.id));
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

  useEffect(() => {
    loadSubmissions();
  }, [id]);

  const uploadFile = async (file: File, userId: string) => {
    if (!id) throw new Error("Missing assignment");
    const safeFileName = file.name.replace(/[\\/]/g, "_");
    const filePath = `${userId}/${id}/${Date.now()}_${safeFileName}`;

    setUploadProgress(10);
    const { data, error } = await supabase.storage
      .from("submissions")
      .upload(filePath, file, { cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream" });
    if (error) throw error;
    setUploadProgress(100);

    // Store the storage path, not a public URL (bucket is private)
    return { fileUrl: data.path, fileName: safeFileName, fileType: file.type || "application/octet-stream", storagePath: data.path };
  };

  const handleStudentSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !assignment || !user?.id) { e.target.value = ""; return; }

    const hasExisting = submissions.some(s => s.student_id === user.id || (user.email && s.student_email === user.email));
    if (hasExisting) { toast.error("You have already submitted this assignment"); e.target.value = ""; return; }

    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadFile(file, user.id);
      const { error } = await supabase.from("submissions").insert({
        assignment_id: id,
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
    if (!files || !id || !user?.id) return;
    setUploading(true);
    let success = 0;

    for (const file of Array.from(files)) {
      try {
        const { fileUrl, fileName, fileType } = await uploadFile(file, user.id);
        const studentName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        const { error } = await supabase.from("submissions").insert({
          assignment_id: id,
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
    if (toGrade.length === 0) { toast.error("Select submitted files to grade"); return; }
    if (!assignment) return;

    setGrading(true);
    setGradingCount(toGrade.length);
    setGradingElapsed(0);
    gradingTimerRef.current = setInterval(() => setGradingElapsed((p) => p + 1), 1000);
    toast.info(`Sending ${toGrade.length} submission(s) for AI grading...`);

    for (const sub of toGrade) {
      try { await supabase.from("submissions").update({ status: "ai_grading" as const }).eq("id", sub.id); } catch {}
    }

    try {
      const { data, error } = await supabase.functions.invoke("grade-submission", {
        body: {
          assignment: {
            title: assignment.title,
            description: assignment.description,
            module_code: assignment.module_code,
            max_score: assignment.max_score,
            rubric: assignment.rubric,
          },
          submissions: toGrade.map((s) => ({
            id: s.id,
            student_name: s.student_name || s.student_email || "Anonymous",
            file_name: s.file_name,
            file_type: null,
            file_url: s.file_url,
          })),
        },
      });

      if (error) throw error;
      const results = data?.results || [];
      let successCount = 0;
      let failCount = 0;

      for (const r of results) {
        const sub = toGrade.find(s => s.id === r.submissionId);
        if (!sub) continue;

        if (r.success) {
          try {
            await supabase.from("grades").insert({
              submission_id: sub.id,
              ai_score: r.score,
              ai_feedback: r.feedback,
              ai_breakdown: r.breakdown || [],
            });
          } catch (gradeErr) { console.error("Failed to write grade:", gradeErr); }
          try { await supabase.from("submissions").update({ status: "ai_graded" as const }).eq("id", sub.id); } catch {}
          successCount++;
        } else {
          try { await supabase.from("submissions").update({ status: "submitted" as const }).eq("id", sub.id); } catch {}
          failCount++;
        }
      }

      if (successCount > 0) toast.success(`${successCount} submission(s) graded successfully`);
      if (failCount > 0) toast.error(`${failCount} submission(s) failed to grade`);
    } catch (err: any) {
      toast.error(err?.message || "AI grading failed");
      for (const sub of toGrade) {
        try { await supabase.from("submissions").update({ status: "submitted" as const }).eq("id", sub.id); } catch {}
      }
    }

    setGrading(false);
    setSelected(new Set());
    if (gradingTimerRef.current) { clearInterval(gradingTimerRef.current); gradingTimerRef.current = null; }
    await loadSubmissions();
  };

  const handleBulkApprove = async () => {
    const toApprove = submissions.filter((s) => selected.has(s.id) && (s.status === "ai_graded" || s.status === "under_review"));
    if (toApprove.length === 0) { toast.error("Select AI-graded submissions to approve"); return; }

    for (const sub of toApprove) {
      const grade = grades[sub.id];
      if (grade) {
        try {
          await supabase.from("grades").update({
            final_score: grade.lecturer_score ?? grade.ai_score,
            final_feedback: grade.lecturer_feedback ?? grade.ai_feedback,
            reviewed_by: user!.id,
            reviewed_at: new Date().toISOString(),
          }).eq("id", grade.id);
        } catch (e) { console.warn("Grade update failed:", e); }
      }
      try { await supabase.from("submissions").update({ status: "approved" as const }).eq("id", sub.id); } catch {}
    }
    toast.success(`${toApprove.length} submission(s) approved`);
    setSelected(new Set());
    await loadSubmissions();
  };

  const handleReleaseGrades = async () => {
    const toRelease = submissions.filter((s) => selected.has(s.id) && s.status === "approved");
    if (toRelease.length === 0) { toast.error("Select approved submissions to release"); return; }

    for (const sub of toRelease) {
      try { await supabase.from("submissions").update({ status: "released" as const }).eq("id", sub.id); } catch {}
    }
    toast.success(`${toRelease.length} grade(s) released to students`);
    setSelected(new Set());
    await loadSubmissions();
  };

  const handlePlagiarismCheck = async () => {
    if (!id) return;
    setCheckingPlagiarism(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-plagiarism", {
        body: { submissions: submissions.map((s) => ({ id: s.id, student_name: s.student_name || s.student_email || "Anonymous", file_name: s.file_name, file_url: s.file_url })) },
      });
      if (error) throw error;
      setPlagiarismFlags(data?.flags || []);
      setPlagiarismSummary(data?.summary || "Analysis complete");
      if (data?.flags?.length === 0) toast.success("No suspicious similarities found");
      else toast.warning(`${data.flags.length} potential issue(s) flagged`);
    } catch (err: any) { toast.error(err?.message || "Plagiarism check failed"); }
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
    if (!grade) { toast.error("No AI grade found"); return; }

    try {
      await supabase.from("grades").update({
        lecturer_score: Number(editScore) || null,
        lecturer_feedback: editFeedback || null,
      }).eq("id", grade.id);
      await supabase.from("submissions").update({ status: "under_review" as const }).eq("id", reviewSubmission.id);
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
      if (next.has(subId)) next.delete(subId); else next.add(subId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === submissions.length) setSelected(new Set());
    else setSelected(new Set(submissions.map((s) => s.id)));
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Loading...</p></div>;
  if (!assignment) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Assignment not found</p>
      <Button variant="link" onClick={() => navigate("/dashboard/assignments")}>Back to assignments</Button>
    </div>
  );

  const isLecturer = role === "lecturer";
  const currentUserId = user?.id ?? null;
  const currentUserEmail = user?.email ?? null;
  const hasExistingSubmission = !isLecturer && submissions.some(
    (s) => s.student_id === currentUserId || (currentUserEmail && s.student_email === currentUserEmail)
  );
  const selectedStatuses = submissions.filter((s) => selected.has(s.id)).map((s) => s.status);
  const hasSubmitted = selectedStatuses.some((s) => s === "submitted");
  const hasGraded = selectedStatuses.some((s) => s === "ai_graded" || s === "under_review");
  const hasApproved = selectedStatuses.some((s) => s === "approved");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/assignments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold font-display">{assignment.title}</h2>
          <p className="text-sm text-muted-foreground">
            {assignment.module_code && `${assignment.module_code} · `}
            Max {assignment.max_score} pts
            {assignment.due_date && ` · Due ${format(new Date(assignment.due_date), "MMM d, yyyy")}`}
          </p>
        </div>
      </div>

      {assignment.description && (
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{assignment.description}</p></CardContent></Card>
      )}

      {assignment.rubric && Array.isArray(assignment.rubric) && assignment.rubric.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rubric</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {assignment.rubric.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{r.criterion}</span>
                    {r.description && <span className="text-muted-foreground ml-2">— {r.description}</span>}
                  </div>
                  <Badge variant="outline">{r.weight} pts</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {!isLecturer && (
          <>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleStudentSubmit} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading || hasExistingSubmission || !currentUserId}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? `Uploading... ${uploadProgress}%` : hasExistingSubmission ? "Already Submitted" : "Submit My Work"}
            </Button>
          </>
        )}
        {isLecturer && (
          <>
            <input ref={bulkInputRef} type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.txt,.zip,.py,.java,.cpp,.c,.js,.ts,.html,.css" onChange={handleBulkUpload} />
            <Button onClick={() => bulkInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />{uploading ? "Uploading..." : "Upload Submissions"}
            </Button>
            <Button variant="outline" onClick={handlePlagiarismCheck} disabled={checkingPlagiarism || submissions.length < 1}>
              {checkingPlagiarism ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              {checkingPlagiarism ? "Checking..." : submissions.length === 1 ? "AI Content Check" : "Plagiarism Check"}
            </Button>
            {selected.size > 0 && (
              <>
                {hasSubmitted && (
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" onClick={handleAIGrade} disabled={grading}>
                      {grading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                      {grading ? "Grading..." : `AI Grade (${selected.size})`}
                    </Button>
                    {grading && (
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground animate-in fade-in">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span>
                          {gradingElapsed < 30
                            ? `Processing ${gradingCount} file(s)... ${gradingElapsed}s`
                            : gradingElapsed < 90
                              ? `AI is reading & grading... ${gradingElapsed}s`
                              : `Still working... ${gradingElapsed}s — large files take longer`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {hasGraded && (
                  <Button variant="default" onClick={handleBulkApprove}>
                    <CheckCheck className="mr-2 h-4 w-4" />Approve ({selected.size})
                  </Button>
                )}
                {hasApproved && (
                  <Button variant="default" onClick={handleReleaseGrades}>
                    <Send className="mr-2 h-4 w-4" />Release ({selected.size})
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {plagiarismFlags.length > 0 && (
        <Card className="border-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />Plagiarism Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{plagiarismSummary}</p>
            {plagiarismFlags.map((flag, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{flag.student_a} ↔ {flag.student_b}</p>
                  <p className="text-xs text-muted-foreground">{flag.reason}</p>
                </div>
                <Badge variant={flag.severity === "high" ? "destructive" : flag.severity === "medium" ? "secondary" : "outline"}>
                  {flag.similarity_score}% similar
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Submissions ({submissions.length})</CardTitle></CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No submissions yet</p>
          ) : (
            <div className="space-y-2">
              {isLecturer && (
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox checked={selected.size === submissions.length && submissions.length > 0} onCheckedChange={toggleAll} />
                  <span className="text-xs text-muted-foreground">Select all</span>
                </div>
              )}
              {submissions.map((sub) => {
                const grade = grades[sub.id];
                const sc = statusConfig[sub.status];
                const StatusIcon = sc.icon;
                return (
                  <div key={sub.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    {isLecturer && <Checkbox checked={selected.has(sub.id)} onCheckedChange={() => toggleSelect(sub.id)} />}
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sub.student_name || sub.student_email || "Student"}</p>
                      <p className="text-xs text-muted-foreground truncate">{sub.file_name} · {format(new Date(sub.submitted_at), "MMM d, HH:mm")}</p>
                      {grade?.ai_breakdown && Array.isArray(grade.ai_breakdown) && grade.ai_breakdown.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {grade.ai_breakdown.map((b: any, i: number) => (
                            <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                              {b.criterion}: {b.score}/{b.max_score}
                            </span>
                          ))}
                        </div>
                      )}
                      {!isLecturer && sub.status === "released" && grade?.final_feedback && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{grade.final_feedback}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {grade?.ai_score != null && (
                        <span className="text-sm font-bold font-display">
                          {grade.final_score ?? grade.lecturer_score ?? grade.ai_score}/{assignment.max_score}
                        </span>
                      )}
                      <Badge variant={sc.variant as any} className="text-xs">
                        <StatusIcon className="mr-1 h-3 w-3" />{sc.label}
                      </Badge>
                      {isLecturer && grade?.ai_score != null && sub.status !== "approved" && sub.status !== "released" && (
                        <Button size="sm" variant="ghost" onClick={() => openReview(sub)}>
                          <Edit className="h-3 w-3 mr-1" /><span className="text-xs">Review</span>
                        </Button>
                      )}
                      {isLecturer && grade?.ai_score != null && sub.status !== "approved" && sub.status !== "released" && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={async () => {
                          const g = grades[sub.id];
                          if (g) {
                            try {
                              await supabase.from("grades").update({
                                final_score: g.lecturer_score ?? g.ai_score,
                                final_feedback: g.lecturer_feedback ?? g.ai_feedback,
                                reviewed_by: user!.id,
                                reviewed_at: new Date().toISOString(),
                              }).eq("id", g.id);
                              await supabase.from("submissions").update({ status: "approved" as const }).eq("id", sub.id);
                              toast.success("Submission approved");
                              await loadSubmissions();
                            } catch (e) {
                              console.warn("Approve failed:", e);
                              toast.error("Could not approve");
                            }
                          }
                        }}>
                          <CheckCheck className="h-3 w-3 mr-1" />Approve
                        </Button>
                      )}
                      {isLecturer && sub.status === "approved" && (
                        <Button size="sm" variant="default" className="text-xs h-7" onClick={async () => {
                          try {
                            await supabase.from("submissions").update({ status: "released" as const }).eq("id", sub.id);
                            toast.success("Grade released to student");
                            await loadSubmissions();
                          } catch (e) {
                            toast.error("Failed to release grade");
                          }
                        }}>
                          <Send className="h-3 w-3 mr-1" />Release
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Submission</DialogTitle>
            <DialogDescription>{reviewSubmission?.student_name || "Student"} — {reviewSubmission?.file_name}</DialogDescription>
          </DialogHeader>
          {reviewSubmission && grades[reviewSubmission.id] && (
            <div className="space-y-4 pt-2">
              <Card className="bg-muted/50">
                <CardContent className="p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">AI Score</p>
                  <p className="text-lg font-bold font-display">{grades[reviewSubmission.id].ai_score}/{assignment.max_score}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-2">AI Feedback</p>
                  <p className="text-sm">{grades[reviewSubmission.id].ai_feedback || "N/A"}</p>
                  {grades[reviewSubmission.id].ai_breakdown && Array.isArray(grades[reviewSubmission.id].ai_breakdown) && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Breakdown</p>
                      {(grades[reviewSubmission.id].ai_breakdown as any[]).map((b, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>{b.criterion}</span>
                          <span className="font-medium">{b.score}/{b.max_score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Score (optional override)</label>
                <Input type="number" value={editScore} onChange={(e) => setEditScore(e.target.value)} placeholder={`Out of ${assignment.max_score}`} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Feedback (optional)</label>
                <Textarea value={editFeedback} onChange={(e) => setEditFeedback(e.target.value)} rows={4} placeholder="Add or edit feedback..." />
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
