import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, Calendar, Search, Clock3, CheckCircle2, Archive } from "lucide-react";
import { toast } from "sonner";
import type { RubricCriterion } from "@/components/RubricBuilder";
import { safeFormatDate } from "@/lib/date";
import {
  dispatchWorkflowNotificationEmail,
} from "@/lib/communications";
import { isStudentGradeVisible } from "@/lib/assessmentWorkflow";
import {
  buildAssignmentPublishedNotificationRows,
  filterAssignments,
  getLecturerAssignmentCatalogReadiness,
  getAssignmentOverviewStats,
  getStudentAssignmentCatalogReadiness,
  normalizeAssignment,
  sortAssignmentsForView,
  type AssignmentCatalogItem,
  type AssignmentSubmissionStats,
  type StudentNotificationProfile,
} from "@/lib/assignmentCatalog";
import {
  summarizeAssignmentPublishWorkflow,
  type AssignmentPublishWorkflowSummary,
} from "@/lib/assignmentPublishWorkflow";
import { log } from "@/lib/logger";
import { isAssignmentVisibleToStudent } from "@/lib/assignmentVisibility";
import { STARTER_ASSIGNMENT_TEMPLATES } from "@/data/assignmentSets";
import { DEMO_ASSIGNMENTS, DEMO_STUDENT_ASSIGNMENTS } from "@/pages/dashboard/demoAssignments";
import {
  DashboardDemoBanner,
  DashboardEmptyState,
  DashboardLoadingState,
  DashboardPageIntro,
} from "@/components/dashboard/PageStates";
import { AssignmentFormDialog } from "@/pages/dashboard/assignments/assignment-form-dialog";
import { useAssignmentsData, type AssignmentDataItem } from "@/pages/dashboard/assignments/useAssignmentsData";

const DEPARTMENTS = ["Computer Science", "Mathematics", "Engineering", "Business", "Economics", "Political Science", "History", "Physics", "Biology"];
const COHORTS = [
  { value: "100", label: "Level 100" },
  { value: "200", label: "Level 200" },
  { value: "300", label: "Level 300" },
  { value: "400", label: "Level 400" },
];

type Assignment = AssignmentDataItem;

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

const summarizeSelection = (
  selected: string[] | null | undefined,
  labelForValue: (value: string) => string,
  emptyLabel: string,
) => {
  const values = selected ?? [];
  if (values.length === 0) return emptyLabel;
  if (values.length <= 2) return values.map(labelForValue).join(", ");
  return `${values.length} selected`;
};

const getStudentAssignmentJourney = (status: string | undefined) => {
  if (!status) {
    return {
      badge: "Not submitted",
      title: "Ready to submit",
      description: "This assignment is open to you, but no submission has been recorded yet.",
    };
  }

  if (status === "released") {
    return {
      badge: "Released",
      title: "Released result available",
      description: "Your released result and explanation are ready to review.",
    };
  }

  if (status === "approved") {
    return {
      badge: "Approved",
      title: "Awaiting release",
      description: "Your submission has been approved and is waiting for final release to students.",
    };
  }

  if (status === "moderation_pending" || status === "moderation_in_progress" || status === "escalated") {
    return {
      badge: "Moderation",
      title: "Under moderation",
      description: "Your submission is still in the moderation workflow before a final result can be released.",
    };
  }

  if (status === "ai_graded" || status === "first_review" || status === "under_review" || status === "moderated") {
    return {
      badge: "Review",
      title: "Awaiting final review",
      description: "Marking is in progress and the released result is not available yet.",
    };
  }

  return {
    badge: "Submitted",
    title: "Submission received",
    description: "Your submission is in the assessment workflow and has not been released yet.",
  };
};

const Assignments = () => {
  const { role, user, isDemo } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
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
  const [selectedTemplateId, setSelectedTemplateId] = useState("none");
  const {
    assignments,
    submissionStats,
    studentWorkflow,
    loading,
    refreshAssignments,
  } = useAssignmentsData({
    role,
    userId: user?.id,
    isDemo,
  });

  const resetAssignmentForm = () => {
    setEditingAssignmentId(null);
    setSelectedTemplateId("none");
    setTitle("");
    setDescription("");
    setModuleCode("");
    setMaxScore("100");
    setDueDate("");
    setRubric([]);
    setSelectedCohorts([]);
    setSelectedDepartments([]);
  };

  const openCreateDialog = () => {
    resetAssignmentForm();
    setDialogOpen(true);
  };

  const openEditDialog = (assignment: Assignment) => {
    setEditingAssignmentId(assignment.id);
    setSelectedTemplateId("none");
    setTitle(assignment.title);
    setDescription(assignment.description ?? "");
    setModuleCode(assignment.module_code ?? "");
    setMaxScore(String(assignment.max_score));
    setDueDate(
      assignment.due_date
        ? new Date(new Date(assignment.due_date).getTime() - new Date(assignment.due_date).getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "",
    );
    setRubric(assignment.rubric ?? []);
    setSelectedCohorts(assignment.target_cohorts ?? []);
    setSelectedDepartments(assignment.target_departments ?? []);
    setDialogOpen(true);
  };

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

  const applyStarterTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "none") {
      if (!editingAssignmentId) {
        setTitle("");
        setDescription("");
        setModuleCode("");
        setMaxScore("100");
        setDueDate("");
        setRubric([]);
        setSelectedCohorts([]);
        setSelectedDepartments([]);
      }
      return;
    }

    const template = STARTER_ASSIGNMENT_TEMPLATES.find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }

    setTitle(template.template.title);
    setDescription(template.template.description ?? "");
    setModuleCode(template.template.moduleCode ?? "");
    setMaxScore(String(template.template.maxScore));
    setDueDate(
      template.template.dueDate
        ? new Date(new Date(template.template.dueDate).getTime() - new Date(template.template.dueDate).getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "",
    );
    setRubric(template.template.rubric ?? []);
    setSelectedCohorts(template.template.targetCohorts ?? []);
    setSelectedDepartments(template.template.targetDepartments ?? []);
  };

  const upsertAssignmentCohorts = async (assignmentId: string, cohortIds: string[]) => {
    const { error: deleteError } = await supabase
      .from("assignment_cohorts")
      .delete()
      .eq("assignment_id", assignmentId);

    if (deleteError) throw deleteError;

    if (cohortIds.length === 0) {
      return;
    }

    const { error: insertError } = await supabase
      .from("assignment_cohorts")
      .insert(
        cohortIds.map((cohortId) => ({
          assignment_id: assignmentId,
          cohort_id: cohortId,
        })),
      );

    if (insertError) throw insertError;
  };

  const upsertAssignmentDepartments = async (assignmentId: string, departmentIds: string[]) => {
    const { error: deleteError } = await supabase
      .from("assignment_departments")
      .delete()
      .eq("assignment_id", assignmentId);

    if (deleteError) throw deleteError;

    if (departmentIds.length === 0) {
      return;
    }

    const { error: insertError } = await supabase
      .from("assignment_departments")
      .insert(
        departmentIds.map((departmentId) => ({
          assignment_id: assignmentId,
          department_id: departmentId,
        })),
      );

    if (insertError) throw insertError;
  };

  const handleSaveAssignment = async () => {
    if (!title.trim() || !user) { toast.error("Title is required"); return; }
    setCreating(true);
    try {
      if (editingAssignmentId) {
        const { error } = await supabase
          .from("assignments")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            module_code: moduleCode.trim() || null,
            max_score: Number(maxScore) || 100,
            due_date: dueDate || null,
            rubric: rubric.length > 0 ? rubric : null,
          })
          .eq("id", editingAssignmentId);

        if (error) throw error;

        await upsertAssignmentCohorts(editingAssignmentId, selectedCohorts);
        await upsertAssignmentDepartments(editingAssignmentId, selectedDepartments);
        toast.success("Assignment updated");
      } else {
        const { data: assignmentRow, error } = await supabase
          .from("assignments")
          .insert([{
            title: title.trim(),
            description: description.trim() || null,
            module_code: moduleCode.trim() || null,
            max_score: Number(maxScore) || 100,
            due_date: dueDate || null,
            lecturer_id: user.id,
            status: "draft" as const,
            rubric: rubric.length > 0 ? rubric : null,
          }])
          .select("id")
          .single();

        if (error || !assignmentRow) throw error ?? new Error("Assignment creation failed");

        await Promise.all([
          upsertAssignmentCohorts(assignmentRow.id, selectedCohorts),
          upsertAssignmentDepartments(assignmentRow.id, selectedDepartments),
        ]);
        toast.success("Assignment created");
      }

      resetAssignmentForm();
      setDialogOpen(false);
      refreshAssignments();
    } catch {
      toast.error(editingAssignmentId ? "Failed to update assignment" : "Failed to create assignment");
    }
    setCreating(false);
  };

  const handlePublish = async (id: string) => {
    if (isDemo) { toast.info("Publishing disabled in demo mode"); return; }
    const assignmentToPublish = assignments.find((assignment) => assignment.id === id);
    try {
      const { error } = await supabase.from("assignments").update({ status: "published" as const }).eq("id", id);
      if (error) throw error;

      const publishWorkflowSummary: AssignmentPublishWorkflowSummary = {
        targetingStatus: "ready",
        recipientStatus: "skipped",
        bellStatus: "skipped",
        emailStatus: "skipped",
      };

      if (user?.id && assignmentToPublish) {
        const { data: assignmentTargets, error: assignmentTargetsError } = await supabase
          .from("assignment_cohorts")
          .select("cohort_id")
          .eq("assignment_id", id);
        const { data: assignmentDepartmentTargets, error: assignmentDepartmentTargetsError } = await supabase
          .from("assignment_departments")
          .select("department_id")
          .eq("assignment_id", id);

        if (assignmentTargetsError) {
          publishWorkflowSummary.targetingStatus = "lookup_failed";
          log.warn("Assignment publish target cohort lookup failed", {
            assignmentId: id,
          });
        }
        if (assignmentDepartmentTargetsError) {
          publishWorkflowSummary.targetingStatus = "lookup_failed";
          log.warn("Assignment publish target department lookup failed", {
            assignmentId: id,
          });
        }

        const cohortIds = Array.from(
          new Set((assignmentTargets || []).map((target) => target.cohort_id).filter(Boolean)),
        );
        const departmentIds = Array.from(
          new Set((assignmentDepartmentTargets || []).map((target) => target.department_id).filter(Boolean)),
        );

        if (cohortIds.length === 0 && departmentIds.length === 0) {
          publishWorkflowSummary.targetingStatus = "missing";
          log.warn("Assignment publish notifications skipped because no targeting is stored", {
            assignmentId: id,
          });
        } else {
          try {
            let studentProfilesQuery = supabase
              .from("profiles")
              .select("id, full_name, email, role, cohort_id, department_id")
              .eq("role", "student");

            if (cohortIds.length > 0) {
              studentProfilesQuery = studentProfilesQuery.in("cohort_id", cohortIds);
            }
            if (departmentIds.length > 0) {
              studentProfilesQuery = studentProfilesQuery.in("department_id", departmentIds);
            }

            const { data: studentProfiles, error: studentProfilesError } = await studentProfilesQuery;

            if (studentProfilesError) {
              publishWorkflowSummary.recipientStatus = "failed";
              log.warn("Assignment publish bell notification load failed", {
                assignmentId: id,
              });
            } else {
              const rows = buildAssignmentPublishedNotificationRows({
                senderId: user.id,
                assignmentId: id,
                assignmentTitle: assignmentToPublish.title,
                students: (studentProfiles || []) as StudentNotificationProfile[],
              });

              if (rows.length > 0) {
                const { error: notificationError } = await supabase
                  .from("communication_messages")
                  .insert(rows);

                if (notificationError) {
                  publishWorkflowSummary.recipientStatus = "loaded";
                  publishWorkflowSummary.bellStatus = "failed";
                  log.warn("Assignment publish bell notifications did not persist", {
                    assignmentId: id,
                  });
                } else {
                  publishWorkflowSummary.recipientStatus = "loaded";
                  publishWorkflowSummary.bellStatus = "sent";

                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("gradeai:communications-updated"));
                  }
                }
              } else {
                publishWorkflowSummary.recipientStatus = "no_recipients";
              }
            }
          } catch {
            publishWorkflowSummary.recipientStatus = "failed";
            log.warn("Assignment publish bell notifications failed", {
              assignmentId: id,
            });
          }

          const emailResult = await dispatchWorkflowNotificationEmail({
            category: "assignment-published",
            assignmentId: id,
          }).catch(() => {
            log.warn("Assignment publish notification email failed", {
              assignmentId: id,
            });
            return { ok: false, status: "failed" as const, reason: "dispatch_rejected" };
          });

          publishWorkflowSummary.emailStatus = emailResult.status;

          if (!emailResult.ok) {
            log.warn("Assignment publish notification email failed", {
              assignmentId: id,
              status: emailResult.status,
            });
          }
        }

        const publishFeedback = summarizeAssignmentPublishWorkflow(publishWorkflowSummary);

        if (publishFeedback.warnings.length > 0) {
          toast.warning(`Assignment published. ${publishFeedback.warnings.join("; ")}.`);
        } else {
          toast.success("Assignment published - students can now submit");
        }
      } else {
        toast.success("Assignment published - students can now submit");
      }
      refreshAssignments();
    } catch {
      toast.error("Failed to publish");
    }
  };

  const handleSetAssignmentStatus = async (
    assignmentId: string,
    nextStatus: Assignment["status"],
    successMessage: string,
    failureMessage: string,
  ) => {
    if (isDemo) {
      toast.info("Assignment status changes are disabled in demo mode");
      return;
    }

    try {
      const { error } = await supabase
        .from("assignments")
        .update({ status: nextStatus })
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success(successMessage);
      refreshAssignments();
    } catch {
      toast.error(failureMessage);
    }
  };

  if (loading) return <DashboardLoadingState />;

  const view = searchParams.get("view");
  const isPendingReviewView = view === "needs-review";

  const filteredAssignments = filterAssignments({
    assignments: assignments as AssignmentCatalogItem[],
    searchQuery,
    statusFilter,
    role,
    isPendingReviewView,
    submissionStats,
  }) as Assignment[];

  const sortedAssignments = sortAssignmentsForView({
    assignments: filteredAssignments as AssignmentCatalogItem[],
    isPendingReviewView,
    submissionStats,
  }) as Assignment[];

  const { drafts, published, dueSoon } = getAssignmentOverviewStats(assignments as AssignmentCatalogItem[]);
  const catalogReadiness =
    role === "lecturer"
      ? getLecturerAssignmentCatalogReadiness({
          assignments: assignments as AssignmentCatalogItem[],
          submissionStats,
        })
      : getStudentAssignmentCatalogReadiness({
          assignments: assignments as AssignmentCatalogItem[],
          studentWorkflow,
        });

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && (
        <DashboardDemoBanner label="Demo Mode — synthetic sample data" />
      )}

      <DashboardPageIntro
        eyebrow={role === "lecturer" ? "Assignment workflow" : "Student assignment view"}
        title={role === "lecturer" ? "Manage Assignments" : "My Assignments"}
        description={
          role === "lecturer"
            ? "Create, publish, and monitor assignment workflow from one place, including review-ready queues and grading progress."
            : "Track live assignments, upcoming deadlines, and the next action needed for each submission window."
        }
        actions={
          role === "lecturer" && !isDemo ? (
            <AssignmentFormDialog
              applyStarterTemplate={applyStarterTemplate}
              creating={creating}
              departments={DEPARTMENTS}
              description={description}
              dialogOpen={dialogOpen}
              dueDate={dueDate}
              editingAssignmentId={editingAssignmentId}
              maxScore={maxScore}
              moduleCode={moduleCode}
              onDialogOpenChange={setDialogOpen}
              onOpenCreateDialog={openCreateDialog}
              onSave={handleSaveAssignment}
              resetAssignmentForm={resetAssignmentForm}
              rubric={rubric}
              selectedCohorts={selectedCohorts}
              selectedDepartments={selectedDepartments}
              selectedTemplateId={selectedTemplateId}
              setDescription={setDescription}
              setDueDate={setDueDate}
              setMaxScore={setMaxScore}
              setModuleCode={setModuleCode}
              setRubric={setRubric}
              setTitle={setTitle}
              summarizeSelection={summarizeSelection}
              targetCohorts={COHORTS}
              title={title}
              toggleCohort={toggleCohort}
              toggleDepartment={toggleDepartment}
            />
          ) : null
        }
      />

      {isDemo && role === "lecturer" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium">Create assignment</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The live lecturer flow starts with a draft brief, due date, cohort targeting, and optional department scoping.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Reusable assignment sets</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open the reviewer-ready set to inspect a complete brief, full rubric, AI-facing grading context, and synthetic workflow evidence.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Review marking and integrity</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open Workflow to see synthetic submissions, an integrity flag example, AI marking output, moderation-ready work, and released feedback.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reporting Readiness</p>
            <p className="mt-2 text-sm font-semibold">{catalogReadiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "lecturer"
                ? "Based on current draft, due-soon, and review-queue assignment state."
                : "Based on your published assignments and latest submission state."}
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
            <p className="mt-2 text-sm font-semibold">{catalogReadiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "lecturer"
                ? "This is the assignment line most likely to need attention next."
                : "This is the assignment checkpoint most likely to affect your next step."}
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
            <p className="mt-2 text-sm font-semibold">{catalogReadiness.bestNextAction}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "lecturer"
                ? "Use this to decide whether to publish, review, or monitor assignment progress."
                : "Use this to decide whether to submit now or open a released result."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold">{assignments?.length ?? 0}</p>
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
              <SelectItem value="all">{role === "lecturer" ? "Active statuses" : "All statuses"}</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="closed">{role === "lecturer" ? "Archived" : "Closed"}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {(assignments?.length ?? 0) === 0 ? (
        <DashboardEmptyState
          title="No assignments yet"
          description={role === "lecturer" ? "Create your first assignment to get started." : "No assignments have been published yet."}
        />
      ) : (sortedAssignments?.length ?? 0) === 0 ? (
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
          {(sortedAssignments ?? []).map((rawAssignment) => {
            const assignment = normalizeAssignment(rawAssignment);
            const stats = submissionStats[assignment.id];
            const studentState = role === "student" ? studentWorkflow[assignment.id] : undefined;
            const studentJourney = role === "student" ? getStudentAssignmentJourney(studentState?.status) : null;
            const StatusIcon = statusIcon(assignment.status);
            const rubricCriteria = assignment.rubric ?? [];
            const targetCohorts = assignment.target_cohorts ?? [];
            const targetDepartments = assignment.target_departments ?? [];

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
                        {isDemo && (
                          <Badge variant="outline" className="text-xs">Assignment set</Badge>
                        )}
                        {(rubricCriteria ?? []).length > 0 && (
                          <Badge variant="outline" className="text-xs">{(rubricCriteria ?? []).length} criteria</Badge>
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

                      {(targetCohorts ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(targetCohorts ?? []).map((cohortId) => {
                            const cohortLabel =
                              COHORTS.find((cohort) => cohort.value === cohortId)?.label ?? cohortId;
                            return (
                              <Badge key={`${assignment.id}-${cohortId}`} variant="outline" className="text-xs">
                                {cohortLabel}
                              </Badge>
                            );
                          })}
                        </div>
                      )}

                      {(targetDepartments ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(targetDepartments ?? []).map((departmentId) => (
                            <Badge key={`${assignment.id}-${departmentId}`} variant="outline" className="text-xs">
                              {departmentId}
                            </Badge>
                          ))}
                        </div>
                      )}

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

                      {role === "student" && studentJourney && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={isStudentGradeVisible(studentState?.status ?? "") ? "default" : "outline"} className="text-xs">
                              {studentJourney.badge}
                            </Badge>
                            <p className="text-sm font-medium">{studentJourney.title}</p>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{studentJourney.description}</p>
                          {studentState?.submittedAt && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Latest submission: {safeFormatDate(studentState.submittedAt, "MMM d, yyyy HH:mm")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 self-start">
                      {role === "lecturer" && !isDemo && (
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(assignment)}>
                          Edit
                        </Button>
                      )}
                      {role === "lecturer" && assignment.status === "draft" && !isDemo && (
                        <Button size="sm" onClick={() => handlePublish(assignment.id)}>Publish</Button>
                      )}
                      {role === "lecturer" && assignment.status !== "closed" && !isDemo && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetAssignmentStatus(
                            assignment.id,
                            "closed",
                            "Assignment archived",
                            "Failed to archive assignment",
                          )}
                        >
                          Archive
                        </Button>
                      )}
                      {role === "lecturer" && assignment.status === "closed" && !isDemo && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetAssignmentStatus(
                            assignment.id,
                            "draft",
                            "Assignment restored to draft",
                            "Failed to restore assignment",
                          )}
                        >
                          Restore
                        </Button>
                      )}
                      {role === "student" && studentState && isStudentGradeVisible(studentState.status) && (
                        <Button size="sm" asChild>
                          <Link
                            to={`/dashboard/explain-grade?assignment=${encodeURIComponent(assignment.id)}&submission=${encodeURIComponent(studentState.submissionId)}&source=assignments`}
                          >
                            Open Released Result
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/dashboard/assignments/${assignment.id}`}>
                          {role === "lecturer"
                            ? "Open Workflow"
                            : studentState
                              ? "Open Submission Window"
                              : "Open Assignment"}
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
