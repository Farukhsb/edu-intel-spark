import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

  const fetchAssignments = async () => {
    let query = supabase
      .from("assignments")
      .select("*")
      .order("created_at", { ascending: false });

    // Students only see published assignments that haven't passed the due date
    if (role === "student") {
      query = query.eq("status", "published");
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to load assignments");
    } else {
      let filtered = (data as unknown as Assignment[]) || [];
      // Auto-hide past-due assignments for students
      if (role === "student") {
        filtered = filtered.filter((a) => !a.due_date || new Date(a.due_date) > new Date());
      }
      setAssignments(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignments();

    // Real-time listener for assignment changes
    const channel = supabase
      .channel("assignments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => {
        fetchAssignments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [role]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("assignments").insert([{
      title: title.trim(),
      description: description.trim() || null,
      module_code: moduleCode.trim() || null,
      max_score: Number(maxScore) || 100,
      due_date: dueDate || null,
      lecturer_id: user!.id,
      status: "draft" as const,
      rubric: (rubric.length > 0 ? rubric : null) as any,
    }]);

    if (error) {
      toast.error("Failed to create assignment");
    } else {
      toast.success("Assignment created");
      setTitle("");
      setDescription("");
      setModuleCode("");
      setMaxScore("100");
      setDueDate("");
      setRubric([]);
      setDialogOpen(false);
      fetchAssignments();
    }
    setCreating(false);
  };

  const handlePublish = async (id: string) => {
    const { error } = await supabase
      .from("assignments")
      .update({ status: "published" as const })
      .eq("id", id);

    if (error) {
      toast.error("Failed to publish");
    } else {
      toast.success("Assignment published — students can now submit");
      fetchAssignments();
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
