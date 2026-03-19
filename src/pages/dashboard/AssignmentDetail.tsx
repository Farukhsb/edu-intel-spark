import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle,
  Clock,
  Brain,
  Eye,
  CheckCheck,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type SubmissionStatus = "submitted" | "ai_grading" | "ai_graded" | "under_review" | "approved" | "released";

interface Submission {
  id: string;
  student_name: string | null;
  student_email: string | null;
  file_name: string;
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
}

const statusConfig: Record<SubmissionStatus, { label: string; variant: string; icon: any }> = {
  submitted: { label: "Submitted", variant: "outline", icon: Clock },
  ai_grading: { label: "AI Grading...", variant: "secondary", icon: Brain },
  ai_graded: { label: "AI Graded", variant: "default", icon: CheckCircle },
  under_review: { label: "Under Review", variant: "secondary", icon: Eye },
  approved: { label: "Approved", variant: "default", icon: CheckCheck },
  released: { label: "Released", variant: "default", icon: CheckCircle },
};

const AssignmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { role, user } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState<Submission | null>(null);
  const [editScore, setEditScore] = useState("");
  const [editFeedback, setEditFeedback] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!id) return;

    const { data: aData } = await supabase
      .from("assignments")
      .select("*")
      .eq("id", id)
      .single();

    if (aData) setAssignment(aData as Assignment);

    const { data: sData } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", id)
      .order("submitted_at", { ascending: false });

    if (sData) {
      setSubmissions(sData as Submission[]);

      // Fetch grades for these submissions
      const subIds = (sData as Submission[]).map((s) => s.id);
      if (subIds.length > 0) {
        const { data: gData } = await supabase
          .from("grades")
          .select("*")
          .in("submission_id", subIds);

        if (gData) {
          const gradeMap: Record<string, Grade> = {};
          (gData as Grade[]).forEach((g) => {
            gradeMap[g.submission_id] = g;
          });
          setGrades(gradeMap);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const uploadFile = async (file: File, studentName?: string) => {
    const filePath = `${user!.id}/${id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("submissions")
      .getPublicUrl(filePath);

    return { fileUrl: urlData.publicUrl, fileName: file.name, fileType: file.type };
  };

  // Student: submit own work
  const handleStudentSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      const { fileUrl, fileName, fileType } = await uploadFile(file);
      const { error } = await supabase.from("submissions").insert({
        assignment_id: id,
        student_id: user!.id,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        uploaded_by: user!.id,
        status: "submitted" as const,
      });

      if (error) throw error;
      toast.success("Submission uploaded!");
      fetchData();
    } catch {
      toast.error("Upload failed");
    }
    setUploading(false);
    e.target.value = "";
  };

  // Lecturer: bulk upload
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;

    setUploading(true);
    let success = 0;
    for (const file of Array.from(files)) {
      try {
        const { fileUrl, fileName, fileType } = await uploadFile(file);
        // Extract student name from filename (e.g., "John_Doe_assignment.pdf")
        const studentName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        await supabase.from("submissions").insert({
          assignment_id: id,
          student_name: studentName,
          file_url: fileUrl,
          file_name: fileName,
          file_type: fileType,
          uploaded_by: user!.id,
          status: "submitted" as const,
        });
        success++;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    toast.success(`${success} file(s) uploaded`);
    fetchData();
    setUploading(false);
    e.target.value = "";
  };

  // Trigger AI grading for selected submissions
  const handleAIGrade = async () => {
    const toGrade = submissions.filter(
      (s) => selected.has(s.id) && s.status === "submitted"
    );
    if (toGrade.length === 0) {
      toast.error("Select submitted files to grade");
      return;
    }

    for (const sub of toGrade) {
      await supabase
        .from("submissions")
        .update({ status: "ai_grading" as const })
        .eq("id", sub.id);
    }

    toast.success(`${toGrade.length} submission(s) sent for AI grading`);
    setSelected(new Set());
    fetchData();

    // TODO: Trigger actual AI grading edge function here
  };

  // Bulk approve
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
        await supabase
          .from("grades")
          .update({
            final_score: grade.lecturer_score ?? grade.ai_score,
            final_feedback: grade.lecturer_feedback ?? grade.ai_feedback,
            reviewed_by: user!.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", grade.id);
      }
      await supabase
        .from("submissions")
        .update({ status: "approved" as const })
        .eq("id", sub.id);
    }

    toast.success(`${toApprove.length} submission(s) approved`);
    setSelected(new Set());
    fetchData();
  };

  // Open review dialog
  const openReview = (sub: Submission) => {
    setReviewSubmission(sub);
    const grade = grades[sub.id];
    setEditScore(grade?.lecturer_score?.toString() ?? grade?.ai_score?.toString() ?? "");
    setEditFeedback(grade?.lecturer_feedback ?? grade?.ai_feedback ?? "");
    setReviewOpen(true);
  };

  // Save lecturer edits
  const saveReview = async () => {
    if (!reviewSubmission) return;
    const grade = grades[reviewSubmission.id];
    if (!grade) {
      toast.error("No AI grade found for this submission");
      return;
    }

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
    setReviewOpen(false);
    fetchData();
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
    if (selected.size === submissions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(submissions.map((s) => s.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Assignment not found</p>
        <Button variant="link" onClick={() => navigate("/dashboard/assignments")}>
          Back to assignments
        </Button>
      </div>
    );
  }

  const isLecturer = role === "lecturer";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/assignments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold font-display">{assignment.title}</h2>
          <p className="text-sm text-muted-foreground">
            {assignment.module_code && `${assignment.module_code} · `}
            Max {assignment.max_score} pts
            {assignment.due_date &&
              ` · Due ${format(new Date(assignment.due_date), "MMM d, yyyy")}`}
          </p>
        </div>
      </div>

      {assignment.description && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{assignment.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Upload actions */}
      <div className="flex flex-wrap gap-3">
        {!isLecturer && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleStudentSubmit}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Submit My Work"}
            </Button>
          </>
        )}
        {isLecturer && (
          <>
            <input
              ref={bulkInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleBulkUpload}
            />
            <Button onClick={() => bulkInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Bulk Upload Submissions"}
            </Button>
            {selected.size > 0 && (
              <>
                <Button variant="secondary" onClick={handleAIGrade}>
                  <Brain className="mr-2 h-4 w-4" />
                  AI Grade ({selected.size})
                </Button>
                <Button variant="default" onClick={handleBulkApprove}>
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Approve ({selected.size})
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {/* Submissions table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Submissions ({submissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No submissions yet
            </p>
          ) : (
            <div className="space-y-2">
              {isLecturer && (
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={selected.size === submissions.length && submissions.length > 0}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-xs text-muted-foreground">Select all</span>
                </div>
              )}
              {submissions.map((sub) => {
                const grade = grades[sub.id];
                const sc = statusConfig[sub.status];
                const StatusIcon = sc.icon;
                return (
                  <div
                    key={sub.id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    {isLecturer && (
                      <Checkbox
                        checked={selected.has(sub.id)}
                        onCheckedChange={() => toggleSelect(sub.id)}
                      />
                    )}
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {sub.student_name || sub.student_email || "Student"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {sub.file_name} · {format(new Date(sub.submitted_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {grade?.ai_score != null && (
                        <span className="text-sm font-bold font-display">
                          {grade.final_score ?? grade.lecturer_score ?? grade.ai_score}/{assignment.max_score}
                        </span>
                      )}
                      <Badge variant={sc.variant as any} className="text-xs">
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {sc.label}
                      </Badge>
                      {isLecturer && (sub.status === "ai_graded" || sub.status === "under_review") && (
                        <Button size="sm" variant="ghost" onClick={() => openReview(sub)}>
                          <Edit className="h-3 w-3" />
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

      {/* Review Dialog */}
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
              <Card className="bg-muted/50">
                <CardContent className="p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">AI Score</p>
                  <p className="text-lg font-bold font-display">
                    {grades[reviewSubmission.id].ai_score}/{assignment.max_score}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground mt-2">AI Feedback</p>
                  <p className="text-sm">{grades[reviewSubmission.id].ai_feedback || "N/A"}</p>
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
                <Button onClick={saveReview} className="flex-1">
                  Save Review
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReviewOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssignmentDetail;
