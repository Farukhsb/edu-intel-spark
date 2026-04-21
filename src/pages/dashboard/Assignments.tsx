import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, FileText, Calendar, BookOpen, Loader2, Search, Clock3, CheckCircle2, Archive } from "lucide-react";
import { toast } from "sonner";
import { RubricBuilder, type RubricCriterion } from "@/components/RubricBuilder";
import { safeFormatDate } from "@/lib/date";
import {
  canReleaseStatus,
  isGradedWorkflowStatus,
  isReviewQueueStatus,
  isStudentGradeVisible,
} from "@/lib/assessmentWorkflow";

const DEPARTMENTS = ["Computer Science", "Mathematics", "Engineering", "Business", "Economics", "Political Science", "History", "Physics", "Biology"];
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
}

const statusVariant = (status: string) => {
  if (status === "published") return "default";
  if (status === "draft") return "outline";
  return "secondary";
};

const statusIcon = (status: Assignment["status"]) => {
  if (status === "published") return CheckCircle2;
  if (status === "closed") return Archive;
  return Clock3;
};

const Assignments = () => {
  const { role, user, isDemo } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissionStats, setSubmissionStats] = useState<Record<string, { total: number; graded: number; approved: number; released: number; needsReview: number }>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Assignment["status"]>("all");
  const [searchParams, setSearchParams] = useSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [moduleCode, setModuleCode] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [dueDate, setDueDate] = useState("");
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const fetchAssignments = async () => {
    if (isDemo) {
      setAssignments([
        { id: "demo-1", title: "Assignment 1 - Data Structures", description: "Implement a binary search tree", module_code: "CS301", max_score: 100, due_date: new Date(Date.now() + 7 * 86400000).toISOString(), status: "published", created_at: new Date().toISOString(), rubric: null },
        { id: "demo-2", title: "Algorithms Coursework", description: "Dynamic programming problems", module_code: "CS205", max_score: 80, due_date: new Date(Date.now() + 14 * 86400000).toISOString(), status: "published", created_at: new Date().toISOString(), rubric: null },
        { id: "demo-3", title: "Lab Report - Sorting", description: "Compare sorting algorithms", module_code: "CS301", max_score: 50, due_date: null, status: "draft", created_at: new Date().toISOString(), rubric: null },
      ]);
      setLoading(false);
      return;
    }
    if (!user) return;

    let query = supabase.from("assignments").select("*").order("created_at", { ascending: false });

    if (role === "student") {
      query = query.eq("status", "published");
    } else {
      query = query.eq("lecturer_id", user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Assignments query error:", error);
      toast.error("Failed to load assignments");
      setLoading(false);
      return;
    }

    const mapped: Assignment[] = (data || []).map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      module_code: a.module_code,
      max_score: a.max_score,
      due_date: a.due_date,
      status: a.status,
      created_at: a.created_at,
      rubric: a.rubric as unknown as RubricCriterion[] | null,
    }));

    setAssignments(mapped);

    if (role === "lecturer" && mapped.length > 0) {
      const { data: subs } = await supabase.from("submissions").select("id, assignment_id, status");
      if (subs) {
        const statsMap: Record<string, { total: number; graded: number; approved: number; released: number; needsReview: number }> = {};
        for (const assignment of mapped) {
          const relatedSubs = subs.filter(s => s.assignment_id === assignment.id);
          statsMap[assignment.id] = {
            total: relatedSubs.length,
            graded: relatedSubs.filter(s => isGradedWorkflowStatus(s.status)).length,
            approved: relatedSubs.filter(s => canReleaseStatus(s.status) || isStudentGradeVisible(s.status)).length,
            released: relatedSubs.filter(s => isStudentGradeVisible(s.status)).length,
            needsReview: relatedSubs.filter(s => isReviewQueueStatus(s.status)).length,
          };
        }
        setSubmissionStats(statsMap);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignments();
  }, [role, user, isDemo]);

  useEffect(() => {
    const nextStatus = searchParams.get("status");
    if (nextStatus === "draft" || nextStatus === "published" || nextStatus === "closed") {
      setStatusFilter(nextStatus);
      return;
    }
    setStatusFilter("all");
  }, [searchParams]);

  const toggleCohort = (val: string) => setSelectedCohorts(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  const toggleDepartment = (val: string) => setSelectedDepartments(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const handleCreate = async () => {
    if (!title.trim() || !user) { toast.error("Title is required"); return; }
    setCreating(true);
    try {
      const { error } = await supabase.from("assignments").insert([{
        title: title.trim(),
        description: description.trim() || null,
        module_code: moduleCode.trim() || null,
        max_score: Number(maxScore) || 100,
        due_date: dueDate || null,
        lecturer_id: user.id,
        status: "draft" as const,
        rubric: rubric.length > 0 ? rubric : null,
      }]);
      if (error) throw error;
      toast.success("Assignment created");
      setTitle("");
      setDescription("");
      setModuleCode("");
      setMaxScore("100");
      setDueDate("");
      setRubric([]);
      setSelectedCohorts([]);
      setSelectedDepartments([]);
      setDialogOpen(false);
      fetchAssignments();
    } catch {
      toast.error("Failed to create assignment");
    }
    setCreating(false);
  };

  const handlePublish = async (id: string) => {
    if (isDemo) { toast.info("Publishing disabled in demo mode"); return; }
    try {
      const { error } = await supabase.from("assignments").update({ status: "published" as const }).eq("id", id);
      if (error) throw error;
      toast.success("Assignment published - students can now submit");
      fetchAssignments();
    } catch {
      toast.error("Failed to publish");
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const view = searchParams.get("view");
  const isPendingReviewView = view === "needs-review";

  const filteredAssignments = assignments.filter((assignment) => {
    const matchesSearch = !searchQuery || [assignment.title, assignment.module_code, assignment.description]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
    const reviewCount = submissionStats[assignment.id]?.needsReview ?? 0;
    const matchesQueue = !isPendingReviewView || reviewCount > 0;
    return matchesSearch && matchesStatus && matchesQueue;
  });

  const sortedAssignments = [...filteredAssignments].sort((left, right) => {
    if (!isPendingReviewView) return 0;
    return (submissionStats[right.id]?.needsReview ?? 0) - (submissionStats[left.id]?.needsReview ?? 0);
  });

  const drafts = assignments.filter(a => a.status === "draft").length;
  const published = assignments.filter(a => a.status === "published").length;
  const closed = assignments.filter(a => a.status === "closed").length;
  const dueSoon = assignments.filter((assignment) => {
    if (!assignment.due_date) return false;
    const diff = new Date(assignment.due_date).getTime() - Date.now();
    return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

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

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold font-display">{role === "lecturer" ? "Manage Assignments" : "My Assignments"}</h2>
          <p className="text-sm text-muted-foreground">
            {role === "lecturer"
              ? "Create work, publish it when ready, and track grading progress from one place."
              : "Review deadlines, submission status, and the next action for each assignment."}
          </p>
        </div>
        {role === "lecturer" && !isDemo && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Assignment</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Assignment</DialogTitle>
                <DialogDescription>Set up the brief now, then publish when you are ready to accept submissions.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">What happens next</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>New assignments start as drafts.</li>
                    <li>Students only see assignments after you publish them.</li>
                    <li>Adding a rubric now gives cleaner AI grading later.</li>
                  </ul>
                </div>
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

                <div className="space-y-2">
                  <Label>Target Cohorts (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {COHORTS.map((cohort) => (
                      <label key={cohort.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox checked={selectedCohorts.includes(cohort.value)} onCheckedChange={() => toggleCohort(cohort.value)} />
                        {cohort.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Target Departments (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {DEPARTMENTS.map((department) => (
                      <label key={department} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox checked={selectedDepartments.includes(department)} onCheckedChange={() => toggleDepartment(department)} />
                        {department}
                      </label>
                    ))}
                  </div>
                </div>

                <RubricBuilder rubric={rubric} onChange={setRubric} maxScore={Number(maxScore) || 100} />
                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? "Creating..." : "Create Draft Assignment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold">{assignments.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Published</p>
          <p className="text-2xl font-semibold text-success">{published}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Drafts</p>
          <p className="text-2xl font-semibold">{drafts}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{role === "lecturer" ? "Due In 7 Days" : "Closing Soon"}</p>
          <p className="text-2xl font-semibold text-warning">{dueSoon}</p>
        </CardContent></Card>
      </div>

      {isPendingReviewView && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Pending review queue</p>
              <p className="text-xs text-muted-foreground">
                Showing assignments with submissions that still need grading, review, approval, or release.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("view");
                setSearchParams(next);
              }}
            >
              Show all assignments
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, module, or description"
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: "all" | Assignment["status"]) => {
              setStatusFilter(value);
              const next = new URLSearchParams(searchParams);
              if (value === "all") next.delete("status");
              else next.set("status", value);
              setSearchParams(next);
            }}
          >
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium">No assignments yet</p>
            <p className="text-sm text-muted-foreground">
              {role === "lecturer" ? "Create your first assignment to get started." : "No assignments have been published yet."}
            </p>
          </CardContent>
        </Card>
      ) : sortedAssignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium">No assignments match this view</p>
            <p className="text-sm text-muted-foreground">
              {isPendingReviewView
                ? "There are no assignments with pending lecturer work in this filtered view."
                : "Clear the search or status filter to see more assignments."}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setSearchParams(new URLSearchParams());
              }}
            >
              Reset Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedAssignments.map((assignment) => {
            const stats = submissionStats[assignment.id];
            const StatusIcon = statusIcon(assignment.status);

            return (
              <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 space-y-3 min-w-[260px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">{assignment.title}</h3>
                        <Badge variant={statusVariant(assignment.status)} className="capitalize">
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {assignment.status}
                        </Badge>
                        {assignment.rubric && Array.isArray(assignment.rubric) && assignment.rubric.length > 0 && (
                          <Badge variant="outline" className="text-xs">{assignment.rubric.length} criteria</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {assignment.module_code && <span>{assignment.module_code}</span>}
                        <span>Max {assignment.max_score} pts</span>
                        {assignment.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Due {safeFormatDate(assignment.due_date, "MMM d, yyyy HH:mm")}
                          </span>
                        )}
                      </div>

                      {assignment.description && <p className="text-sm text-muted-foreground line-clamp-2">{assignment.description}</p>}

                      {role === "lecturer" && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>{stats?.total ?? 0} submitted</span>
                            <span>{stats?.graded ?? 0} graded</span>
                            <span>{stats?.approved ?? 0} approved</span>
                            <span>{stats?.released ?? 0} released</span>
                            <span className={(stats?.needsReview ?? 0) > 0 ? "font-medium text-warning" : ""}>
                              {stats?.needsReview ?? 0} need review
                            </span>
                          </div>
                          <div className="mt-2 flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-muted">
                            {(stats?.released ?? 0) > 0 && <div className="bg-success h-full" style={{ width: `${(((stats?.released ?? 0) / (stats?.total || 1)) * 100)}%` }} />}
                            {((stats?.approved ?? 0) - (stats?.released ?? 0)) > 0 && <div className="bg-primary h-full" style={{ width: `${((((stats?.approved ?? 0) - (stats?.released ?? 0)) / (stats?.total || 1)) * 100)}%` }} />}
                            {((stats?.graded ?? 0) - (stats?.approved ?? 0)) > 0 && <div className="bg-warning h-full" style={{ width: `${((((stats?.graded ?? 0) - (stats?.approved ?? 0)) / (stats?.total || 1)) * 100)}%` }} />}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 self-start">
                      {role === "lecturer" && assignment.status === "draft" && !isDemo && (
                        <Button size="sm" onClick={() => handlePublish(assignment.id)}>Publish</Button>
                      )}
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/dashboard/assignments/${assignment.id}`}>
                          {role === "lecturer" ? "Open Workflow" : "Open Assignment"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Assignments;
