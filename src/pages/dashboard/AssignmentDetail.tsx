import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db, storage as firebaseStorage } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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
  ArrowLeft, Upload, FileText, CheckCircle, Clock, Brain, Eye,
  CheckCheck, Edit, Send, Shield, AlertTriangle, Loader2,
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
  const { role, user } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [grading, setGrading] = useState(false);
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
      const snap = await getDoc(doc(db, "assignments", id));
      if (snap.exists()) setAssignment({ id: snap.id, ...snap.data() } as Assignment);
      setLoading(false);
    };
    fetchAssignment();
  }, [id]);

  // Real-time submissions listener
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "submissions"),
      where("assignment_id", "==", id),
      orderBy("submitted_at", "desc")
    );
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const subs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Submission));
        setSubmissions(subs);

        // Fetch grades for these submissions
        if (subs.length > 0) {
          const gradeMap: Record<string, Grade> = {};
          for (const sub of subs) {
            const gSnap = await getDocs(
              query(collection(db, "grades"), where("submission_id", "==", sub.id))
            );
            gSnap.docs.forEach((gDoc) => {
              gradeMap[sub.id] = { id: gDoc.id, ...gDoc.data() } as Grade;
            });
          }
          setGrades(gradeMap);
        }
        setLoading(false);
      },
      (error) => {
        console.error("[Submissions] Snapshot error (index may be missing):", error.message);
        // Fallback: fetch without ordering if index is missing
        getDocs(query(collection(db, "submissions"), where("assignment_id", "==", id)))
          .then(async (snapshot) => {
            const subs = snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() } as Submission))
              .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
            setSubmissions(subs);

            if (subs.length > 0) {
              const gradeMap: Record<string, Grade> = {};
              for (const sub of subs) {
                const gSnap = await getDocs(
                  query(collection(db, "grades"), where("submission_id", "==", sub.id))
                );
                gSnap.docs.forEach((gDoc) => {
                  gradeMap[sub.id] = { id: gDoc.id, ...gDoc.data() } as Grade;
                });
              }
              setGrades(gradeMap);
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, [id]);

  const uploadFile = async (file: File) => {
    const filePath = `submissions/${user!.uid}/${id}/${Date.now()}_${file.name}`;
    const storageRef = ref(firebaseStorage, filePath);

    return new Promise<{ fileUrl: string; fileName: string; fileType: string }>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file);
      let settled = false;
      let sawProgress = false;

      const cleanup = () => {
        window.clearTimeout(fallbackTimer);
        window.clearTimeout(timeoutTimer);
      };

      const finish = async () => {
        const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
        settled = true;
        cleanup();
        resolve({ fileUrl, fileName: file.name, fileType: file.type });
      };

      const fallbackTimer = window.setTimeout(async () => {
        if (settled || sawProgress) return;

        try {
          uploadTask.cancel();
        } catch {
        }

        try {
          const snapshot = await uploadBytes(storageRef, file);
          const fileUrl = await getDownloadURL(snapshot.ref);
          settled = true;
          cleanup();
          setUploadProgress(100);
          resolve({ fileUrl, fileName: file.name, fileType: file.type });
        } catch (error) {
          settled = true;
          cleanup();
          reject(error);
        }
      }, 3000);

      const timeoutTimer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Upload timed out. Please check your network and try again."));
      }, 120000);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (settled) return;
          if (snapshot.bytesTransferred > 0) {
            sawProgress = true;
          }
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error: any) => {
          if (settled || error?.code === "storage/canceled") return;
          settled = true;
          cleanup();
          reject(error);
        },
        () => {
          void finish();
        }
      );
    });
  };

  const handleStudentSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const { fileUrl, fileName, fileType } = await uploadFile(file);
      await addDoc(collection(db, "submissions"), {
        assignment_id: id,
        student_id: user!.uid,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        uploaded_by: user!.uid,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        student_name: null,
        student_email: user!.email || null,
      });
      toast.success("Submission uploaded!");
    } catch (error: any) {
      console.error("[Upload] Failed:", error);
      toast.error(error?.message || "Upload failed");
    }
    setUploading(false);
    setUploadProgress(0);
    e.target.value = "";
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;
    setUploading(true);
    let success = 0;
    for (const file of Array.from(files)) {
      try {
        const { fileUrl, fileName, fileType } = await uploadFile(file);
        const studentName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        await addDoc(collection(db, "submissions"), {
          assignment_id: id,
          student_name: studentName,
          file_url: fileUrl,
          file_name: fileName,
          file_type: fileType,
          uploaded_by: user!.uid,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          student_id: null,
          student_email: null,
        });
        success++;
      } catch { toast.error(`Failed to upload ${file.name}`); }
    }
    toast.success(`${success} file(s) uploaded`);
    setUploading(false);
    e.target.value = "";
  };

  // AI Grade — send data to edge function, write results to Firestore
  const handleAIGrade = async () => {
    const toGrade = submissions.filter((s) => selected.has(s.id) && s.status === "submitted");
    if (toGrade.length === 0) { toast.error("Select submitted files to grade"); return; }
    if (!assignment) return;

    setGrading(true);
    toast.info(`Sending ${toGrade.length} submission(s) for AI grading...`);

    // Update status to ai_grading
    for (const sub of toGrade) {
      await updateDoc(doc(db, "submissions", sub.id), { status: "ai_grading" });
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
        if (r.success) {
          // Write grade to Firestore
          await addDoc(collection(db, "grades"), {
            submission_id: r.submissionId,
            ai_score: r.score,
            ai_feedback: r.feedback,
            ai_breakdown: r.breakdown || [],
            lecturer_score: null,
            lecturer_feedback: null,
            final_score: null,
            final_feedback: null,
            reviewed_by: null,
            reviewed_at: null,
            created_at: new Date().toISOString(),
          });
          await updateDoc(doc(db, "submissions", r.submissionId), { status: "ai_graded" });
          successCount++;
        } else {
          await updateDoc(doc(db, "submissions", r.submissionId), { status: "submitted" });
          failCount++;
        }
      }

      if (successCount > 0) toast.success(`${successCount} submission(s) graded successfully`);
      if (failCount > 0) toast.error(`${failCount} submission(s) failed to grade`);
    } catch (err: any) {
      toast.error(err?.message || "AI grading failed");
      for (const sub of toGrade) {
        await updateDoc(doc(db, "submissions", sub.id), { status: "submitted" });
      }
    }

    setGrading(false);
    setSelected(new Set());
  };

  const handleBulkApprove = async () => {
    const toApprove = submissions.filter((s) => selected.has(s.id) && (s.status === "ai_graded" || s.status === "under_review"));
    if (toApprove.length === 0) { toast.error("Select AI-graded submissions to approve"); return; }

    for (const sub of toApprove) {
      const grade = grades[sub.id];
      if (grade) {
        await updateDoc(doc(db, "grades", grade.id), {
          final_score: grade.lecturer_score ?? grade.ai_score,
          final_feedback: grade.lecturer_feedback ?? grade.ai_feedback,
          reviewed_by: user!.uid,
          reviewed_at: new Date().toISOString(),
        });
      }
      await updateDoc(doc(db, "submissions", sub.id), { status: "approved" });
    }
    toast.success(`${toApprove.length} submission(s) approved`);
    setSelected(new Set());
  };

  const handleReleaseGrades = async () => {
    const toRelease = submissions.filter((s) => selected.has(s.id) && s.status === "approved");
    if (toRelease.length === 0) { toast.error("Select approved submissions to release"); return; }

    for (const sub of toRelease) {
      await updateDoc(doc(db, "submissions", sub.id), { status: "released" });
      // Create notification for student
      if (sub.student_id) {
        try {
          await addDoc(collection(db, "notifications"), {
            user_id: sub.student_id,
            message: `Your grade for "${assignment?.title || "an assignment"}" has been released.`,
            read: false,
            created_at: new Date().toISOString(),
          });
        } catch { /* notifications collection may not exist yet */ }
      }
    }
    toast.success(`${toRelease.length} grade(s) released to students`);
    setSelected(new Set());
  };

  const handlePlagiarismCheck = async () => {
    if (!id) return;
    setCheckingPlagiarism(true);
    try {
      const submissionData = submissions.map((s) => ({
        id: s.id,
        student_name: s.student_name || s.student_email || "Anonymous",
        file_name: s.file_name,
        file_url: s.file_url,
      }));

      const { data, error } = await supabase.functions.invoke("check-plagiarism", {
        body: { submissions: submissionData },
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
    if (!grade) { toast.error("No AI grade found"); return; }

    await updateDoc(doc(db, "grades", grade.id), {
      lecturer_score: Number(editScore) || null,
      lecturer_feedback: editFeedback || null,
    });
    await updateDoc(doc(db, "submissions", reviewSubmission.id), { status: "under_review" });
    toast.success("Review saved");
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
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />{uploading ? `Uploading... ${uploadProgress}%` : "Submit My Work"}
            </Button>
          </>
        )}
        {isLecturer && (
          <>
            <input ref={bulkInputRef} type="file" multiple className="hidden" onChange={handleBulkUpload} />
            <Button onClick={() => bulkInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />{uploading ? "Uploading..." : "Bulk Upload"}
            </Button>
            <Button variant="outline" onClick={handlePlagiarismCheck} disabled={checkingPlagiarism || submissions.length < 2}>
              {checkingPlagiarism ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              {checkingPlagiarism ? "Checking..." : "Plagiarism Check"}
            </Button>
            {selected.size > 0 && (
              <>
                {hasSubmitted && (
                  <Button variant="secondary" onClick={handleAIGrade} disabled={grading}>
                    {grading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                    {grading ? "Grading..." : `AI Grade (${selected.size})`}
                  </Button>
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
