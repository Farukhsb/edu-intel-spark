import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { auth, db } from "@/lib/firebase";
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
  assignment_id: string;
  assignmentId?: string;
  student_name: string | null;
  student_email: string | null;
  file_name: string;
  file_type?: string | null;
  file_url: string;
  fileUrl?: string;
  status: SubmissionStatus;
  submitted_at: string;
  createdAt?: string;
  student_id: string | null;
  studentId?: string | null;
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

const normalizeSubmission = (id: string, data: Record<string, any>): Submission => ({
  id,
  assignment_id: data.assignment_id ?? data.assignmentId ?? "",
  assignmentId: data.assignmentId ?? data.assignment_id ?? "",
  student_name: data.student_name ?? null,
  student_email: data.student_email ?? null,
  file_name: data.file_name ?? data.fileName ?? "",
  file_type: data.file_type ?? data.fileType ?? null,
  file_url: data.file_url ?? data.fileUrl ?? "",
  fileUrl: data.fileUrl ?? data.file_url ?? "",
  status: data.status ?? "submitted",
  submitted_at: data.submitted_at ?? data.createdAt ?? new Date().toISOString(),
  createdAt: data.createdAt ?? data.submitted_at ?? new Date().toISOString(),
  student_id: data.student_id ?? data.studentId ?? null,
  studentId: data.studentId ?? data.student_id ?? null,
});

const getSubmissionErrorMessage = (error: any) => {
  const errorCode = error?.code ?? "";
  const errorMessage = (error?.message ?? "").toLowerCase();

  if (errorCode.includes("permission") || errorCode.includes("unauthorized") || errorMessage.includes("permission")) {
    return "Permission denied";
  }

  if (
    errorCode.includes("network") ||
    errorCode.includes("unavailable") ||
    errorCode.includes("retry") ||
    errorMessage.includes("network") ||
    errorMessage.includes("timeout")
  ) {
    return "Network error";
  }

  if (errorMessage.includes("missing assignment")) {
    return "Missing assignment";
  }

  return "Upload failed";
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
      const snap = await getDoc(doc(db, "assignments", id));
      if (snap.exists()) setAssignment({ id: snap.id, ...snap.data() } as Assignment);
      setLoading(false);
    };
    fetchAssignment();
  }, [id]);

  // Real-time submissions listener
  useEffect(() => {
    if (!id || !role || !user?.uid) return;

    const submissionsQuery = role === "lecturer"
      ? query(collection(db, "submissions"), where("assignment_id", "==", id))
      : query(collection(db, "submissions"), where("student_id", "==", user.uid));

    const normalizeSubmissions = (docs: any[]) => docs
      .map((d) => normalizeSubmission(d.id, d.data() as Record<string, any>))
      .filter((sub) => role === "lecturer" ? sub.assignment_id === id : sub.assignment_id === id && sub.student_id === user.uid)
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

    const loadGradesForSubmissions = async (subs: Submission[]) => {
      if (subs.length === 0) {
        setGrades({});
        return;
      }

      const gradeEntries = await Promise.all(
        subs.map(async (sub) => {
          try {
            const gSnap = await getDocs(
              query(collection(db, "grades"), where("submission_id", "==", sub.id))
            );

            // Use the most recent grade if multiple exist
            const sortedDocs = gSnap.docs.sort((a, b) =>
              (b.data().created_at || "").localeCompare(a.data().created_at || "")
            );
            const latestGrade = sortedDocs[0];
            return latestGrade
              ? [sub.id, { id: latestGrade.id, ...latestGrade.data() } as Grade]
              : null;
          } catch (error) {
            console.warn(`[Grades] Skipping inaccessible grade lookup for submission ${sub.id}:`, error);
            return null;
          }
        })
      );

      setGrades(
        Object.fromEntries(
          gradeEntries.filter((entry): entry is [string, Grade] => Boolean(entry))
        )
      );
    };

    const unsubscribe = onSnapshot(
      submissionsQuery,
      async (snapshot) => {
        const subs = normalizeSubmissions(snapshot.docs);
        setSubmissions(subs);
        await loadGradesForSubmissions(subs);
        setLoading(false);
      },
      (error) => {
        console.error("[Submissions] Snapshot error:", error.message);
        getDocs(submissionsQuery)
          .then(async (snapshot) => {
            const subs = normalizeSubmissions(snapshot.docs);
            setSubmissions(subs);
            await loadGradesForSubmissions(subs);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }
    );

    return () => unsubscribe();
  }, [id, role, user?.uid]);

  // Also load submissions from Supabase (where bulk uploads go)
  useEffect(() => {
    if (!id) return;
    const loadSupabase = async () => {
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("assignment_id", id)
        .order("submitted_at", { ascending: false });
      if (data && data.length > 0) {
        const supaSubs: Submission[] = data.map((d) => ({
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
        setSubmissions((prev) => {
          const existingUrls = new Set(prev.map((s) => s.file_url));
          const newSubs = supaSubs.filter((s) => !existingUrls.has(s.file_url));
          if (newSubs.length === 0) return prev;
          return [...prev, ...newSubs].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
        });
      }
    };
    loadSupabase();
  }, [id]);

  const uploadFile = async (file: File, currentUserId: string) => {
      throw new Error("Missing assignment");
    }

    const safeFileName = file.name.replace(/[\\/]/g, "_");
    const filePath = `${currentUserId}/${id}/${Date.now()}_${safeFileName}`;
    console.log("[Upload] Starting upload to:", filePath, "Size:", file.size, "Type:", file.type);

    try {
      setUploadProgress(0);
      setUploadProgress(10);
      console.log("[Upload] Uploading to Lovable Cloud storage...");

      const { data, error } = await supabase.storage
        .from("submissions")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (error) throw error;

      setUploadProgress(80);
      console.log("[Upload] Upload complete, getting public URL...");

      const { data: urlData } = supabase.storage
        .from("submissions")
        .getPublicUrl(data.path);

      const fileUrl = urlData.publicUrl;
      console.log("[Upload] URL obtained:", fileUrl.substring(0, 80) + "...");
      setUploadProgress(100);

      return {
        fileUrl,
        fileName: safeFileName,
        fileType: file.type || "application/octet-stream",
        storagePath: data.path,
      };
    } catch (error: any) {
      console.error("[Upload] Upload failed:", error?.code, error?.message, error);
      throw error;
    }
  };

  const handleStudentSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const currentUserId = auth.currentUser?.uid ?? user?.uid ?? null;
    const currentUserEmail = auth.currentUser?.email ?? user?.email ?? null;

    if (!file) return;
    if (!id || !assignment) {
      toast.error("Missing assignment");
      e.target.value = "";
      return;
    }
    if (!currentUserId) {
      toast.error("Permission denied");
      e.target.value = "";
      return;
    }

    const hasExistingSubmission = submissions.some(
      (submission) => submission.student_id === currentUserId || (currentUserEmail && submission.student_email === currentUserEmail)
    );

    if (hasExistingSubmission) {
      toast.error("You have already submitted this assignment");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    let uploadedFile:
      | { fileUrl: string; fileName: string; fileType: string; storagePath: string }
      | null = null;
    let submissionCreated = false;

    try {
      uploadedFile = await uploadFile(file, currentUserId);

      const createdAt = new Date().toISOString();
      await addDoc(collection(db, "submissions"), {
        assignment_id: id,
        assignmentId: id,
        student_id: currentUserId,
        studentId: currentUserId,
        file_url: uploadedFile.fileUrl,
        fileUrl: uploadedFile.fileUrl,
        file_name: uploadedFile.fileName,
        file_type: uploadedFile.fileType,
        uploaded_by: currentUserId,
        status: "submitted",
        submitted_at: createdAt,
        createdAt,
        student_name: profile?.full_name ?? auth.currentUser?.displayName ?? null,
        student_email: currentUserEmail,
      });

      submissionCreated = true;
      toast.success("Submission uploaded successfully");
    } catch (error: any) {
      console.error("[Submission] Failed:", error);

      if (uploadedFile && !submissionCreated) {
        try {
          await supabase.storage.from("submissions").remove([uploadedFile.storagePath]);
          console.warn("[Submission] Removed uploaded file after Firestore write failure");
        } catch (cleanupError) {
          console.error("[Submission] Failed to clean up uploaded file:", cleanupError);
        }
      }

      toast.error(getSubmissionErrorMessage(error));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const refreshSupabaseSubmissions = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("assignment_id", id)
      .order("submitted_at", { ascending: false });
    if (!error && data) {
      const supaSubs: Submission[] = data.map((d) => ({
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
      // Merge with existing Firestore submissions (avoid duplicates by file_url)
      setSubmissions((prev) => {
        const existingUrls = new Set(prev.map((s) => s.file_url));
        const newSubs = supaSubs.filter((s) => !existingUrls.has(s.file_url));
        return [...prev, ...newSubs].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      });
    }
  };


    const files = e.target.files;
    if (!files || !id || !user?.uid) return;
    setUploading(true);
    let success = 0;

    // Get the Supabase auth user ID for uploaded_by
    const { data: { user: supaUser } } = await supabase.auth.getUser();
    const supaUserId = supaUser?.id;

    for (const file of Array.from(files)) {
      try {
        const uploaderUid = supaUserId || user.uid;
        const { fileUrl, fileName, fileType } = await uploadFile(file, user.uid);
        const studentName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");

        if (supaUserId) {
          // Write to Supabase submissions table
          const { error: insertError } = await supabase.from("submissions").insert({
            assignment_id: id,
            student_name: studentName,
            file_url: fileUrl,
            file_name: fileName,
            file_type: fileType,
            uploaded_by: supaUserId,
            status: "submitted" as const,
            student_id: null,
            student_email: null,
          });
          if (insertError) throw insertError;
        } else {
          // Fallback to Firestore
          await addDoc(collection(db, "submissions"), {
            assignment_id: id,
            student_name: studentName,
            file_url: fileUrl,
            file_name: fileName,
            file_type: fileType,
            uploaded_by: uploaderUid,
            status: "submitted",
            submitted_at: new Date().toISOString(),
            student_id: null,
            student_email: null,
          });
        }
        success++;
      } catch (err: any) {
        console.error(`[BulkUpload] Failed for ${file.name}:`, err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    toast.success(`${success} file(s) uploaded`);
    setUploading(false);
    // Refresh submissions from Supabase
    if (supaUserId) await refreshSupabaseSubmissions();
    e.target.value = "";
  };

  // AI Grade — send data to edge function, write results to Firestore
  const handleAIGrade = async () => {
    const toGrade = submissions.filter((s) => selected.has(s.id) && s.status === "submitted");
    if (toGrade.length === 0) { toast.error("Select submitted files to grade"); return; }
    if (!assignment) return;

    setGrading(true);
    setGradingCount(toGrade.length);
    setGradingElapsed(0);
    gradingTimerRef.current = setInterval(() => setGradingElapsed((p) => p + 1), 1000);
    toast.info(`Sending ${toGrade.length} submission(s) for AI grading...`);

    // Update status to ai_grading
    for (const sub of toGrade) {
      try {
        await updateDoc(doc(db, "submissions", sub.id), { status: "ai_grading" });
      } catch (e) {
        console.warn("Could not update submission status to ai_grading (Firestore permissions):", e);
      }
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
          try {
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
          } catch (gradeErr) {
            console.error("Failed to write grade to Firestore:", gradeErr);
          }
          try {
            await updateDoc(doc(db, "submissions", r.submissionId), { status: "ai_graded" });
          } catch (statusErr) {
            console.warn("Could not update submission status to ai_graded:", statusErr);
          }
          successCount++;
        } else {
          try {
            await updateDoc(doc(db, "submissions", r.submissionId), { status: "submitted" });
          } catch (revertErr) {
            console.warn("Could not revert submission status:", revertErr);
          }
          failCount++;
        }
      }

      if (successCount > 0) toast.success(`${successCount} submission(s) graded successfully`);
      if (failCount > 0) toast.error(`${failCount} submission(s) failed to grade`);
    } catch (err: any) {
      toast.error(err?.message || "AI grading failed");
      for (const sub of toGrade) {
        try {
          await updateDoc(doc(db, "submissions", sub.id), { status: "submitted" });
        } catch (revertErr) {
          console.warn("Could not revert submission status:", revertErr);
        }
      }
    }

    setGrading(false);
    setSelected(new Set());
    if (gradingTimerRef.current) { clearInterval(gradingTimerRef.current); gradingTimerRef.current = null; }
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
  const currentUserId = auth.currentUser?.uid ?? user?.uid ?? null;
  const currentUserEmail = auth.currentUser?.email ?? user?.email ?? null;
  const hasExistingSubmission = !isLecturer && submissions.some(
    (submission) => submission.student_id === currentUserId || (currentUserEmail && submission.student_email === currentUserEmail)
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
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading || hasExistingSubmission || !currentUserId || !assignment}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? `Uploading... ${uploadProgress}%` : hasExistingSubmission ? "Already Submitted" : "Submit My Work"}
            </Button>
            {hasExistingSubmission && (
              <p className="text-sm text-muted-foreground">You have already submitted this assignment.</p>
            )}
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
                              ? `AI is reading & grading... ${gradingElapsed}s (est. ~${Math.max(30, gradingCount * 45 - gradingElapsed)}s left)`
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
                          <Edit className="h-3 w-3 mr-1" />
                          <span className="text-xs">Review</span>
                        </Button>
                      )}
                      {isLecturer && grade?.ai_score != null && sub.status !== "approved" && sub.status !== "released" && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={async () => {
                          const grade = grades[sub.id];
                          if (grade) {
                            try {
                              await updateDoc(doc(db, "grades", grade.id), {
                                final_score: grade.lecturer_score ?? grade.ai_score,
                                final_feedback: grade.lecturer_feedback ?? grade.ai_feedback,
                                reviewed_by: user!.uid,
                                reviewed_at: new Date().toISOString(),
                              });
                            } catch (e) { console.warn("Grade update failed:", e); }
                            try {
                              await updateDoc(doc(db, "submissions", sub.id), { status: "approved" });
                            } catch (e) {
                              console.warn("Status update failed:", e);
                              toast.error("Could not update status — check Firestore rules");
                            }
                            toast.success("Submission approved");
                          }
                        }}>
                          <CheckCheck className="h-3 w-3 mr-1" />Approve
                        </Button>
                      )}
                      {isLecturer && sub.status === "approved" && (
                        <Button size="sm" variant="default" className="text-xs h-7" onClick={async () => {
                          try {
                            await updateDoc(doc(db, "submissions", sub.id), { status: "released" });
                            toast.success("Grade released to student");
                          } catch (e) {
                            console.warn("Release failed:", e);
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
