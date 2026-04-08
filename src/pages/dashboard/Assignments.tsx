import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, getDocs,
} from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, FileText, Calendar, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { RubricBuilder, type RubricCriterion } from "@/components/RubricBuilder";

const DEPARTMENTS = ["Computer Science", "Mathematics", "Engineering", "Business", "Physics", "Biology"];
const COHORTS = [
  { value: "100", label: "Level 100" },
  { value: "200", label: "Level 200" },
  { value: "300", label: "Level 300" },
  { value: "400", label: "Level 400" },
];

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
  cohort_ids?: string[];
  department_ids?: string[];
}

const statusVariant = (status: string) => {
  if (status === "published") return "default";
  if (status === "draft") return "outline";
  return "secondary";
};

const Assignments = () => {
  const { role, user, profile, isDemo } = useAuth();
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
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  useEffect(() => {
    if (isDemo) {
      setAssignments([
        { id: "demo-1", title: "Assignment 1 - Data Structures", description: "Implement a binary search tree", module_code: "CS301", max_score: 100, due_date: new Date(Date.now() + 7 * 86400000).toISOString(), status: "published", created_at: new Date().toISOString(), rubric: null, cohort_ids: ["200", "300"], department_ids: ["Computer Science"] },
        { id: "demo-2", title: "Algorithms Coursework", description: "Dynamic programming problems", module_code: "CS205", max_score: 80, due_date: new Date(Date.now() + 14 * 86400000).toISOString(), status: "published", created_at: new Date().toISOString(), rubric: null, cohort_ids: ["200"], department_ids: ["Computer Science"] },
        { id: "demo-3", title: "Lab Report - Sorting", description: "Compare sorting algorithms", module_code: "CS301", max_score: 50, due_date: null, status: "draft", created_at: new Date().toISOString(), rubric: null },
      ]);
      setLoading(false);
      return;
    }
    if (!user) return;

    let q;
    if (role === "student") {
      q = query(collection(db, "assignments"), where("status", "==", "published"));
    } else {
      q = query(collection(db, "assignments"), where("lecturer_id", "==", user.uid));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      // Filter for student's cohort/department
      if (role === "student" && profile) {
        data = data.filter((a) => {
          const matchCohort = !a.cohort_ids || a.cohort_ids.length === 0 || (profile.cohort_id && a.cohort_ids.includes(profile.cohort_id));
          const matchDept = !a.department_ids || a.department_ids.length === 0 || (profile.department_id && a.department_ids.includes(profile.department_id));
          return matchCohort && matchDept;
        });
        data = data.filter((a) => !a.due_date || new Date(a.due_date) > new Date());
      }

      setAssignments(data);

      if (data.length > 0 && role === "lecturer") {
        const statsMap: Record<string, { total: number; graded: number; approved: number; released: number }> = {};
        for (const a of data) {
          const subsSnap = await getDocs(query(collection(db, "submissions"), where("assignment_id", "==", a.id)));
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
    }, (error) => {
      console.error("Assignments query error:", error);
      if (error.message?.includes("index")) {
        toast.error("Database index required. Check Firebase Console for the index creation link in the browser console.");
      } else {
        toast.error("Failed to load assignments. Check permissions.");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, user, profile, isDemo]);

  const toggleCohort = (val: string) => setSelectedCohorts(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  const toggleDepartment = (val: string) => setSelectedDepartments(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const handleCreate = async () => {
    if (!title.trim() || !user) { toast.error("Title is required"); return; }
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
        cohort_ids: selectedCohorts.length > 0 ? selectedCohorts : null,
        department_ids: selectedDepartments.length > 0 ? selectedDepartments : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Assignment created");
      setTitle(""); setDescription(""); setModuleCode(""); setMaxScore("100");
      setDueDate(""); setRubric([]); setSelectedCohorts([]); setSelectedDepartments([]);
      setDialogOpen(false);
    } catch {
      toast.error("Failed to create assignment");
    }
    setCreating(false);
  };

  const handlePublish = async (id: string) => {
    if (isDemo) { toast.info("Publishing disabled in demo mode"); return; }
    try {
      await updateDoc(doc(db, "assignments", id), { status: "published", updated_at: new Date().toISOString() });
      toast.success("Assignment published — students can now submit");
    } catch {
      toast.error("Failed to publish");
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex items-center gap-2 p-3">
            <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
            <span className="text-sm text-muted-foreground">Viewing demo assignment data</span>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display">{role === "lecturer" ? "Manage Assignments" : "My Assignments"}</h2>
          <p className="text-sm text-muted-foreground">{role === "lecturer" ? "Create assignments, upload briefs, and manage submissions" : "View and submit your assignments"}</p>
        </div>
        {role === "lecturer" && !isDemo && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Assignment</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Assignment</DialogTitle>
                <DialogDescription>Set up assignment details and rubric. Publish when ready.</DialogDescription>
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

                {/* Cohort & Department Selection */}
                <div className="space-y-2">
                  <Label>Target Cohorts (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {COHORTS.map((c) => (
                      <label key={c.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox checked={selectedCohorts.includes(c.value)} onCheckedChange={() => toggleCohort(c.value)} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Target Departments (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {DEPARTMENTS.map((d) => (
                      <label key={d} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox checked={selectedDepartments.includes(d)} onCheckedChange={() => toggleDepartment(d)} />
                        {d}
                      </label>
                    ))}
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
            <p className="text-sm text-muted-foreground">{role === "lecturer" ? "Create your first assignment to get started" : "No assignments have been published yet"}</p>
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
                      {a.cohort_ids && a.cohort_ids.length > 0 && (
                        <Badge variant="outline" className="text-xs">L{a.cohort_ids.join(",L")}</Badge>
                      )}
                    </div>
                    {a.module_code && <p className="text-xs text-muted-foreground">{a.module_code}</p>}
                    {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                    <div className="flex items-center gap-4 pt-1">
                      {a.due_date && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />Due {format(new Date(a.due_date), "MMM d, yyyy HH:mm")}
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
                          {submissionStats[a.id].released > 0 && <div className="bg-success h-full" style={{ width: `${(submissionStats[a.id].released / submissionStats[a.id].total) * 100}%` }} />}
                          {(submissionStats[a.id].approved - submissionStats[a.id].released) > 0 && <div className="bg-primary h-full" style={{ width: `${((submissionStats[a.id].approved - submissionStats[a.id].released) / submissionStats[a.id].total) * 100}%` }} />}
                          {(submissionStats[a.id].graded - submissionStats[a.id].approved) > 0 && <div className="bg-warning h-full" style={{ width: `${((submissionStats[a.id].graded - submissionStats[a.id].approved) / submissionStats[a.id].total) * 100}%` }} />}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {role === "lecturer" && a.status === "draft" && !isDemo && (
                      <Button size="sm" onClick={() => handlePublish(a.id)}>Publish</Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/dashboard/assignments/${a.id}`}>{role === "lecturer" ? "View Submissions" : "Submit"}</a>
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
