import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  AlertTriangle,
  BookOpen,
  Clock,
  Lightbulb,
  Mail,
  Target,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { computeRisk, type StudentTrajectory } from "@/lib/studentRisk";
import { safeFormatDate } from "@/lib/date";
import { queueCommunicationMessage } from "@/lib/communications";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ASSIGNMENT_FIELDS = "id, title, module_code, due_date, max_score";
const SUBMISSION_FIELDS = "id, assignment_id, student_id, student_name, student_email, status, submitted_at";
const GRADE_FIELDS = "submission_id, ai_score, final_score";

type InterventionType = "email" | "meeting" | "feedback" | "referral";
type InterventionStatus = "ongoing" | "resolved";

interface InterventionEntry {
  id: string;
  createdAt: string;
  type: InterventionType;
  note: string;
  followUpDate: string | null;
  status: InterventionStatus;
}

interface StudentInterventionRow {
  id: string;
  lecturer_id: string;
  student_id: string;
  student_name?: string | null;
  student_email?: string | null;
  intervention_type: InterventionType;
  status: InterventionStatus;
  priority?: string | null;
  title?: string | null;
  notes?: string | null;
  follow_up_date?: string | null;
  assignment_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface StudentAssignment {
  id: string;
  title: string;
  module_code: string | null;
  due_date: string | null;
  max_score: number;
}

interface StudentSubmission {
  id: string;
  assignment_id: string;
  student_id: string | null;
  student_name: string | null;
  student_email: string | null;
  status: string;
  submitted_at: string;
}

interface StudentInsightData {
  name: string;
  email: string | null;
  studentId: string;
  studentRecordId: string | null;
  modules: string[];
  averageGrade: number | null;
  latestGrade: number | null;
  riskScore: number | null;
  riskLevel: "critical" | "high" | "moderate" | "watch";
  reasons: string[];
  recommendation: string;
  missedAssignments: StudentAssignment[];
  submissions: StudentSubmission[];
  chart: Array<{ assessment: string; grade: number }>;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user, isDemo } = useAuth();

  const decodedStudentId = decodeURIComponent(studentId || "");
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentInsightData | null>(null);
  const [interventions, setInterventions] = useState<InterventionEntry[]>([]);
  const [interventionType, setInterventionType] = useState<InterventionType>("email");
  const [interventionStatus, setInterventionStatus] = useState<InterventionStatus>("ongoing");
  const [interventionNote, setInterventionNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  useEffect(() => {
    if (!user || !decodedStudentId) return;

    const loadStudent = async () => {
      setLoading(true);

      if (isDemo) {
        setStudent({
          name: "David Lee",
          email: "david.lee@example.edu",
          studentId: decodedStudentId,
          studentRecordId: decodedStudentId,
          modules: ["CS301", "CS205"],
          averageGrade: 38,
          latestGrade: 32,
          riskScore: 78,
          riskLevel: "critical",
          reasons: ["Average below 40%", "Steep grade decline", "Predicted next: 29%"],
          recommendation: "Urgent: schedule a 1-on-1 meeting, review fundamentals, and refer to support services.",
          missedAssignments: [
            { id: "demo-missed", title: "Algorithms Lab Reflection", module_code: "CS205", due_date: new Date().toISOString(), max_score: 20 },
          ],
          submissions: [],
          chart: [
            { assessment: "Assignment 1", grade: 65 },
            { assessment: "Midterm", grade: 58 },
            { assessment: "Assignment 2", grade: 45 },
            { assessment: "Lab Report", grade: 38 },
            { assessment: "Assignment 3", grade: 32 },
          ],
        });
        setLoading(false);
        return;
      }

      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("assignments")
          .select(ASSIGNMENT_FIELDS)
          .eq("lecturer_id", user.id);

        if (assignmentsError) throw assignmentsError;

        const assignments = (assignmentsData || []) as StudentAssignment[];
        if (assignments.length === 0) {
          setStudent(null);
          setLoading(false);
          return;
        }

        const assignmentIds = assignments.map((assignment) => assignment.id);
        const { data: submissionsData, error: submissionsError } = await supabase
          .from("submissions")
          .select(SUBMISSION_FIELDS)
          .in("assignment_id", assignmentIds);

        if (submissionsError) throw submissionsError;

        const allSubmissions = (submissionsData || []) as StudentSubmission[];
        const matchingSubmissions = allSubmissions.filter((submission) => {
          const name = submission.student_name || "";
          return (
            submission.student_id === decodedStudentId ||
            submission.student_email === decodedStudentId ||
            name.toLowerCase() === decodedStudentId.toLowerCase() ||
            slugify(name) === slugify(decodedStudentId)
          );
        });

        if (matchingSubmissions.length === 0) {
          setStudent(null);
          setLoading(false);
          return;
        }

        const submissionIds = matchingSubmissions.map((submission) => submission.id);
        const { data: gradesData, error: gradesError } = await supabase
          .from("grades")
          .select(GRADE_FIELDS)
          .in("submission_id", submissionIds);

        if (gradesError) throw gradesError;

        const gradeMap = new Map(
          (gradesData || []).map((grade) => [
            grade.submission_id,
            Number(grade.final_score ?? grade.ai_score),
          ])
        );
        const assignmentMap = new Map(assignments.map((assignment) => [assignment.id, assignment]));

        const sortedSubmissions = [...matchingSubmissions].sort(
          (left, right) => new Date(left.submitted_at).getTime() - new Date(right.submitted_at).getTime()
        );

        const trajectory: StudentTrajectory = {
          name:
            sortedSubmissions.find((submission) => submission.student_name)?.student_name ||
            sortedSubmissions[0].student_email ||
            "Student",
          email: sortedSubmissions.find((submission) => submission.student_email)?.student_email || null,
          studentId:
            sortedSubmissions.find((submission) => submission.student_id)?.student_id ||
            sortedSubmissions.find((submission) => submission.student_email)?.student_email ||
            decodedStudentId,
          scores: sortedSubmissions
            .map((submission) => {
              const score = gradeMap.get(submission.id);
              const assignment = assignmentMap.get(submission.assignment_id);
              if (score == null || Number.isNaN(score) || !assignment) return null;
              return {
                score,
                date: submission.submitted_at,
                assignmentTitle: assignment.title,
              };
            })
            .filter((entry): entry is StudentTrajectory["scores"][number] => entry !== null),
        };

        const risk = computeRisk(trajectory);
        const scores = trajectory.scores.map((point) => point.score);
        const averageGrade =
          scores.length > 0
            ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
            : null;
        const latestGrade = scores.length > 0 ? scores[scores.length - 1] : null;
        const matchedAssignmentIds = new Set(matchingSubmissions.map((submission) => submission.assignment_id));
        const missedAssignments = assignments.filter((assignment) => !matchedAssignmentIds.has(assignment.id));
        const chart = trajectory.scores.map((point) => ({
          assessment: point.assignmentTitle.length > 18 ? `${point.assignmentTitle.slice(0, 16)}...` : point.assignmentTitle,
          grade: point.score,
        }));

        const reasons = [...(risk?.flags || [])];
        if (missedAssignments.length > 0) {
          reasons.push(`${missedAssignments.length} assignment${missedAssignments.length === 1 ? "" : "s"} missing`);
        }
        if (reasons.length === 0) {
          reasons.push("Student is being monitored due to recent performance volatility.");
        }

        setStudent({
          name: trajectory.name,
          email: trajectory.email,
          studentId: trajectory.studentId,
          studentRecordId:
            sortedSubmissions.find((submission) => submission.student_id)?.student_id || null,
          modules: Array.from(
            new Set(
              matchingSubmissions
                .map((submission) => assignmentMap.get(submission.assignment_id)?.module_code)
                .filter(Boolean) as string[]
            )
          ),
          averageGrade,
          latestGrade,
          riskScore: risk?.riskScore ?? null,
          riskLevel: risk?.riskLevel ?? (averageGrade != null && averageGrade < 50 ? "watch" : "moderate"),
          reasons,
          recommendation:
            risk?.recommendation ||
            (missedAssignments.length > 0
              ? "Review the missing work with the student and agree a catch-up plan."
              : "Continue monitoring performance and reinforce the next study priorities."),
          missedAssignments,
          submissions: matchingSubmissions,
          chart,
        });
      } catch (error) {
        console.error("Failed to load student profile:", error);
        setStudent(null);
      }

      setLoading(false);
    };

    void loadStudent();
  }, [decodedStudentId, isDemo, user]);

  const riskBadgeVariant = useMemo(() => {
    if (!student) return "outline";
    if (student.riskLevel === "critical") return "destructive";
    if (student.riskLevel === "high") return "secondary";
    return "outline";
  }, [student]);

  const trendDirection = useMemo(() => {
    if (!student || student.chart.length < 2) return "steady";
    const first = student.chart[0].grade;
    const last = student.chart[student.chart.length - 1].grade;
    if (last > first) return "up";
    if (last < first) return "down";
    return "steady";
  }, [student]);

  const mapInterventionRow = (row: StudentInterventionRow): InterventionEntry => ({
    id: row.id,
    createdAt: row.created_at || row.updated_at || new Date().toISOString(),
    type: row.intervention_type,
    note: row.notes || "",
    followUpDate: row.follow_up_date || null,
    status: row.status,
  });

  useEffect(() => {
    if (!user?.id || !student?.studentRecordId || isDemo) return;

    const loadInterventions = async () => {
      const supabaseClient = supabase as any;
      const { data, error } = await supabaseClient
        .from("student_interventions")
        .select("id, lecturer_id, student_id, student_name, student_email, intervention_type, status, priority, title, notes, follow_up_date, assignment_id, created_at, updated_at")
        .eq("lecturer_id", user.id)
        .eq("student_id", student.studentRecordId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load interventions:", error);
        toast.error("Could not load intervention history");
        return;
      }

      setInterventions(((data || []) as StudentInterventionRow[]).map(mapInterventionRow));
    };

    void loadInterventions();
  }, [isDemo, student?.studentRecordId, user?.id]);

  const handleAddIntervention = async () => {
    if (!interventionNote.trim()) return;

    if (!student || !user?.id) {
      toast.error("Student context is not ready yet");
      return;
    }

    if (!student.studentRecordId) {
      toast.error("This student record is missing a database ID, so the intervention cannot be saved yet");
      return;
    }

    if (isDemo) {
      const nextEntry: InterventionEntry = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        type: interventionType,
        note: interventionNote.trim(),
        followUpDate: followUpDate || null,
        status: interventionStatus,
      };

      setInterventions((current) => [nextEntry, ...current]);
      setInterventionNote("");
      setFollowUpDate("");
      setInterventionType("email");
      setInterventionStatus("ongoing");
      return;
    }

    const supabaseClient = supabase as any;
    const payload = {
      lecturer_id: user.id,
      student_id: student.studentRecordId,
      student_name: student.name,
      student_email: student.email,
      intervention_type: interventionType,
      title: `${interventionType.charAt(0).toUpperCase()}${interventionType.slice(1)} intervention`,
      notes: interventionNote.trim(),
      priority: student.riskLevel === "critical" || student.riskLevel === "high" ? "high" : "medium",
      follow_up_date: followUpDate || null,
      status: interventionStatus,
      assignment_id: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from("student_interventions")
      .insert(payload)
      .select("id, lecturer_id, student_id, student_name, student_email, intervention_type, status, priority, title, notes, follow_up_date, assignment_id, created_at, updated_at")
      .single();

    if (error) {
      console.error("Failed to save intervention:", error);
      toast.error("Could not save intervention");
      return;
    }

    setInterventions((current) => [mapInterventionRow(data as StudentInterventionRow), ...current]);
    setInterventionNote("");
    setFollowUpDate("");
    setInterventionType("email");
    setInterventionStatus("ongoing");
    toast.success("Intervention logged");
  };

  const queueAtRiskAlert = () => {
    if (!student) return;
    queueCommunicationMessage({
      category: "at-risk-alert",
      recipientName: student.name,
      recipientEmail: student.email,
      recipientId: student.studentId,
      subject: `Academic support check-in for ${student.name}`,
      body: `Dear ${student.name},

Your recent performance has triggered an academic support review.

Why you are being contacted:
- ${student.reasons.join("\n- ")}

Recommended next step:
${student.recommendation}

Please reply to arrange a short meeting so we can agree the most useful support before the next submission.`,
      relatedStudentId: student.studentId,
    });
    toast.success("At-risk alert added to the outbox");
  };

  const queueFollowUpReminder = () => {
    if (!student) return;
    const latestIntervention = interventions[0];
    queueCommunicationMessage({
      category: "intervention-follow-up",
      recipientName: student.name,
      recipientEmail: student.email,
      recipientId: student.studentId,
      subject: `Follow-up on your academic support plan`,
      body: `Dear ${student.name},

This is a follow-up on the support actions we discussed${latestIntervention ? ` on ${safeFormatDate(latestIntervention.createdAt, "MMM d, yyyy")}` : ""}.

Current focus:
${student.recommendation}

Please share a short update before ${latestIntervention?.followUpDate ? safeFormatDate(latestIntervention.followUpDate, "MMM d, yyyy") : "our next review"} so we can confirm what is working and what still needs attention.`,
      relatedStudentId: student.studentId,
    });
    toast.success("Follow-up reminder added to the outbox");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Student not found for this lecturer view.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold font-display">{student.name}</h2>
                <Badge variant={riskBadgeVariant as "outline" | "secondary" | "destructive"}>
                  {student.riskLevel === "watch" ? "Watchlist" : `${student.riskLevel} risk`}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {student.modules.length > 0 ? student.modules.join(", ") : "No modules recorded"}
              </p>
              <p className="max-w-2xl text-sm text-muted-foreground">{student.recommendation}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border bg-background/70 p-3 text-center">
              <p className="text-xs text-muted-foreground">Risk score</p>
              <p className="text-2xl font-bold font-display">{student.riskScore ?? "-"}</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-3 text-center">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-2xl font-bold font-display">{student.averageGrade ?? "-"}%</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-3 text-center">
              <p className="text-xs text-muted-foreground">Missed</p>
              <p className="text-2xl font-bold font-display">{student.missedAssignments.length}</p>
            </div>
            <Button variant="outline" onClick={queueAtRiskAlert}>
              Send at-risk alert
            </Button>
            <Button variant="outline" onClick={queueFollowUpReminder}>
              Send follow-up reminder
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Latest grade</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-2xl font-semibold">{student.latestGrade ?? "-"}</p>
              {trendDirection === "up" ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : trendDirection === "down" ? (
                <TrendingDown className="h-4 w-4 text-destructive" />
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Submissions tracked</p>
            <p className="mt-2 text-2xl font-semibold">{student.submissions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Open interventions</p>
            <p className="mt-2 text-2xl font-semibold">
              {interventions.filter((entry) => entry.status === "ongoing").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Contact</p>
            {student.email ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full justify-start"
                onClick={() => {
                  window.location.href = `mailto:${student.email}`;
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Email student
              </Button>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No student email on record.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Grades Trend</CardTitle>
            <CardDescription>Latest assessment performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            {student.chart.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">No graded work yet for this student.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={student.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="assessment" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="grade"
                    stroke={trendDirection === "down" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base">Why This Student Is At Risk</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {student.reasons.map((reason) => (
              <div key={reason} className="rounded-lg border p-3 text-sm">
                {reason}
              </div>
            ))}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Intervention suggestion</p>
                  <p className="mt-1 text-sm text-muted-foreground">{student.recommendation}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Missed Submissions</CardTitle>
            </div>
            <CardDescription>Assignments with no submission found for this student</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {student.missedAssignments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No missed assignments detected in this lecturer view.
              </div>
            ) : (
              student.missedAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{assignment.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {assignment.module_code || "No module"}{assignment.due_date ? ` • Due ${safeFormatDate(assignment.due_date, "MMM d, yyyy")}` : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Intervention Tracking</CardTitle>
            </div>
            <CardDescription>Log actions, follow-up dates, and resolution status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Intervention type</Label>
                <Select value={interventionType} onValueChange={(value: InterventionType) => setInterventionType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={interventionStatus} onValueChange={(value: InterventionStatus) => setInterventionStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lecturer note</Label>
              <Textarea
                rows={4}
                value={interventionNote}
                onChange={(event) => setInterventionNote(event.target.value)}
                placeholder="Record what happened, what support was offered, and what to review next."
              />
            </div>

            <div className="space-y-2">
              <Label>Follow-up date</Label>
              <Input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
            </div>

            <Button
              className="w-full"
              onClick={handleAddIntervention}
              disabled={!interventionNote.trim() || (!isDemo && !student?.studentRecordId)}
            >
              Log intervention
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intervention History</CardTitle>
          <CardDescription>Saved to your connected Supabase project for this student</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {interventions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No interventions logged yet.
            </div>
          ) : (
            interventions.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">{entry.type}</Badge>
                  <Badge variant={entry.status === "resolved" ? "default" : "secondary"} className="capitalize">
                    {entry.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Logged {safeFormatDate(entry.createdAt, "MMM d, yyyy HH:mm")}
                  </span>
                </div>
                <p className="mt-3 text-sm">{entry.note}</p>
                {entry.followUpDate && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Follow up on {safeFormatDate(entry.followUpDate, "MMM d, yyyy")}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfile;
