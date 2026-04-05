import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, FileText, Calendar, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { RubricBuilder, type RubricCriterion } from "@/components/RubricBuilder";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  module_code: string | null;
  max_score: number;
  due_date: string | null;
  status: "draft" | "published" | "closed";
  created_at: string;
  rubric: RubricCriterion[] | null;
}

const statusVariant = (status: string) => {
  if (status === "published") return "default";
  if (status === "draft") return "outline";
  return "secondary";
};

const Assignments = () => {
  const { role, user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissionStats, setSubmissionStats] = useState<Record<string, { total: number; graded: number; approved: number; released: number }>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [moduleCode, setModuleCode] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [dueDate, setDueDate] = useState("");
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);

  useEffect(() => {
    if (!user) return;

    // Build query based on role
    let q;
    if (role === "student") {
      q = query(
        collection(db, "assignments"),
        where("status", "==", "published"),
        orderBy("created_at", "desc")
      );
    } else {
      q = query(
        collection(db, "assignments"),
        where("lecturer_id", "==", user.uid),
        orderBy("created_at", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));

      // Auto-hide past-due assignments for students
      if (role === "student") {
        data = data.filter((a) => !a.due_date || new Date(a.due_date) > new Date());
      }

      setAssignments(data);

      // Fetch submission stats
      if (data.length > 0) {
        const statsMap: Record<string, { total: number; graded: number; approved: number; released: number }> = {};
        for (const a of data) {
          const subsSnap = await getDocs(
            query(collection(db, "submissions"), where("assignment_id", "==", a.id))
          );
          const stats = { total: 0, graded: 0, approved: 0, released: 0 };
          subsSnap.docs.forEach((d) => {
            const s = d.data();
            stats.total++;
            if (["ai_graded", "under_review", "approved", "released"].includes(s.status)) stats.graded++;
            if (["approved", "released"].includes(s.status)) stats.approved++;
            if (s.status === "released") stats.released++;
          });
          statsMap[a.id] = stats;
        }
        setSubmissionStats(statsMap);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, user]);

  const handleCreate = async () => {
    if (!title.trim() || !user) {
      toast.error("Title is required");
      return;
    }
    setCreating(true);
    try {
      await addDoc(collection(db, "assignments"), {
        title: title.trim(),
        description: description.trim() || null,
        module_code: moduleCode.trim() || null,
        max_score: Number(maxScore) || 100,
        due_date: dueDate || null,
        lecturer_id: user.uid,
        status: "draft",
        rubric: rubric.length > 0 ? rubric : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Assignment created");
      setTitle("");
      setDescription("");
      setModuleCode("");
      setMaxScore("100");
      setDueDate("");
      setRubric([]);
      setDialogOpen(false);
    } catch {
      toast.error("Failed to create assignment");
    }
    setCreating(false);
  };

  const handlePublish = async (id: string) => {
    try {
      await updateDoc(doc(db, "assignments", id), { status: "published", updated_at: new Date().toISOString() });
      toast.success("Assignment published — students can now submit");
    } catch {
      toast.error("Failed to publish");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading assignments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display">
            {role === "lecturer" ? "Manage Assignments" : "My Assignments"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {role === "lecturer"
              ? "Create assignments, upload briefs, and manage submissions"
              : "View and submit your assignments"}
          </p>
        </div>
        {role === "lecturer" && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Assignment</DialogTitle>
                <DialogDescription>
                  Set up assignment details and rubric. Publish when ready.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Assignment 1 - Data Structures" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="module">Module Code</Label>
                  <Input id="module" value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} placeholder="e.g. CS301" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description / Instructions</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what students should submit..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxScore">Max Score</Label>
                    <Input id="maxScore" type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input id="dueDate" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                </div>
                <RubricBuilder rubric={rubric} onChange={setRubric} maxScore={Number(maxScore) || 100} />
                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? "Creating..." : "Create Assignment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium">No assignments yet</p>
            <p className="text-sm text-muted-foreground">
              {role === "lecturer" ? "Create your first assignment to get started" : "No assignments have been published yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{a.title}</h3>
                      <Badge variant={statusVariant(a.status)} className="capitalize">{a.status}</Badge>
                      {a.rubric && Array.isArray(a.rubric) && a.rubric.length > 0 && (
                        <Badge variant="outline" className="text-xs">{a.rubric.length} criteria</Badge>
                      )}
                    </div>
                    {a.module_code && <p className="text-xs text-muted-foreground">{a.module_code}</p>}
                    {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                    <div className="flex items-center gap-4 pt-1">
                      {a.due_date && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Due {format(new Date(a.due_date), "MMM d, yyyy HH:mm")}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">Max: {a.max_score} pts</span>
                    </div>
                    {submissionStats[a.id] && submissionStats[a.id].total > 0 && (
                      <div className="pt-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{submissionStats[a.id].total} submitted</span>
                          <span>{submissionStats[a.id].graded} graded</span>
                          <span>{submissionStats[a.id].released} released</span>
                        </div>
                        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-muted">
                          {submissionStats[a.id].released > 0 && (
                            <div className="bg-success h-full" style={{ width: `${(submissionStats[a.id].released / submissionStats[a.id].total) * 100}%` }} />
                          )}
                          {(submissionStats[a.id].approved - submissionStats[a.id].released) > 0 && (
                            <div className="bg-primary h-full" style={{ width: `${((submissionStats[a.id].approved - submissionStats[a.id].released) / submissionStats[a.id].total) * 100}%` }} />
                          )}
                          {(submissionStats[a.id].graded - submissionStats[a.id].approved) > 0 && (
                            <div className="bg-warning h-full" style={{ width: `${((submissionStats[a.id].graded - submissionStats[a.id].approved) / submissionStats[a.id].total) * 100}%` }} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {role === "lecturer" && a.status === "draft" && (
                      <Button size="sm" onClick={() => handlePublish(a.id)}>Publish</Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/dashboard/assignments/${a.id}`}>
                        {role === "lecturer" ? "View Submissions" : "Submit"}
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Assignments;
