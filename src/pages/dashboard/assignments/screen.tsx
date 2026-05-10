import { Link } from "react-router-dom";
import { Archive, Calendar, CheckCircle2, Clock3, FileText, Search } from "lucide-react";

import {
  DashboardDemoBanner,
  DashboardEmptyState,
  DashboardLoadingState,
  DashboardPageIntro,
} from "@/components/dashboard/PageStates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssignmentFormDialog } from "@/pages/dashboard/assignments/assignment-form-dialog";
import { getAssignmentWorkflowTargetFromStats } from "@/lib/assignmentWorkflowNavigation";
import type { useAssignmentsController } from "@/pages/dashboard/assignments/useAssignmentsController";

type AssignmentsScreenProps = ReturnType<typeof useAssignmentsController>;

const statusVariant = (status: string) => {
  if (status === "published") return "default";
  if (status === "draft") return "outline";
  return "secondary";
};

const statusIcon = (status: AssignmentsScreenProps["assignments"][number]["status"]) => {
  if (status === "published") return CheckCircle2;
  if (status === "closed") return Archive;
  return Clock3;
};

export const AssignmentsScreen = ({
  loading,
  role,
  isDemo,
  assignments,
  sortedAssignments,
  submissionStats,
  studentWorkflow,
  overviewStats,
  catalogReadiness,
  isPendingReviewView,
  searchQuery,
  statusFilter,
  formState,
  summarizeSelection,
  getStudentAssignmentJourney,
  isStudentGradeVisible,
  normalizeAssignment,
  safeFormatDate,
  openCreateDialog,
  openEditDialog,
  applyStarterTemplate,
  toggleCohort,
  toggleDepartment,
  updateFormField,
  handleSaveAssignment,
  handlePublish,
  handleSetAssignmentStatus,
  openAssignmentSearch,
  clearPendingReviewView,
  resetAssignmentForm,
  resetFilters,
  setSearchQuery,
  setFormDialogOpen,
  targetCohorts,
  departments,
}: AssignmentsScreenProps) => {
  if (loading) return <DashboardLoadingState />;

  return (
    <div className="space-y-6 animate-fade-in">
      {isDemo && <DashboardDemoBanner label="Demo Mode — synthetic sample data" />}

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
              creating={formState.creating}
              departments={departments}
              description={formState.description}
              dialogOpen={formState.dialogOpen}
              dueDate={formState.dueDate}
              editingAssignmentId={formState.editingAssignmentId}
              maxScore={formState.maxScore}
              moduleCode={formState.moduleCode}
              onDialogOpenChange={setFormDialogOpen}
              onOpenCreateDialog={openCreateDialog}
              onSave={handleSaveAssignment}
              resetAssignmentForm={resetAssignmentForm}
              rubric={formState.rubric}
              selectedCohorts={formState.selectedCohorts}
              selectedDepartments={formState.selectedDepartments}
              selectedTemplateId={formState.selectedTemplateId}
              setDescription={(value) => updateFormField("description", typeof value === "function" ? value(formState.description) : value)}
              setDueDate={(value) => updateFormField("dueDate", typeof value === "function" ? value(formState.dueDate) : value)}
              setMaxScore={(value) => updateFormField("maxScore", typeof value === "function" ? value(formState.maxScore) : value)}
              setModuleCode={(value) => updateFormField("moduleCode", typeof value === "function" ? value(formState.moduleCode) : value)}
              setRubric={(value) => updateFormField("rubric", typeof value === "function" ? value(formState.rubric) : value)}
              setTitle={(value) => updateFormField("title", typeof value === "function" ? value(formState.title) : value)}
              summarizeSelection={summarizeSelection}
              targetCohorts={[...targetCohorts]}
              title={formState.title}
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
          <p className="text-2xl font-semibold">{assignments.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Published</p>
          <p className="text-2xl font-semibold text-success">{overviewStats.published}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Drafts</p>
          <p className="text-2xl font-semibold">{overviewStats.drafts}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{role === "lecturer" ? "Due In 7 Days" : "Closing Soon"}</p>
          <p className="text-2xl font-semibold text-warning">{overviewStats.dueSoon}</p>
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
            <Button size="sm" variant="outline" onClick={clearPendingReviewView}>
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
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, module, or description"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={openAssignmentSearch}>
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

      {assignments.length === 0 ? (
        <DashboardEmptyState
          title="No assignments yet"
          description={role === "lecturer" ? "Create your first assignment to get started." : "No assignments have been published yet."}
        />
      ) : sortedAssignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">No assignments match this view</p>
            <p className="text-sm text-muted-foreground">
              {isPendingReviewView
                ? "There are no assignments with pending lecturer work in this filtered view."
                : "Clear the search or status filter to see more assignments."}
            </p>
            <Button variant="outline" className="mt-4" onClick={resetFilters}>
              Reset Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedAssignments.map((rawAssignment) => {
            const assignment = normalizeAssignment(rawAssignment);
            const stats = submissionStats[assignment.id];
            const lecturerWorkflowTarget =
              role === "lecturer"
                ? getAssignmentWorkflowTargetFromStats({
                    assignmentId: assignment.id,
                    stats,
                  })
                : null;
            const studentState = role === "student" ? studentWorkflow[assignment.id] : undefined;
            const studentJourney = role === "student" ? getStudentAssignmentJourney(studentState?.status) : null;
            const StatusIcon = statusIcon(assignment.status);
            const rubricCriteria = assignment.rubric ?? [];
            const assignmentTargetCohorts = assignment.target_cohorts ?? [];
            const assignmentTargetDepartments = assignment.target_departments ?? [];

            return (
              <Card key={assignment.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-[260px] flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">{assignment.title}</h3>
                        <Badge variant={statusVariant(assignment.status)} className="capitalize">
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {assignment.status}
                        </Badge>
                        {isDemo && (
                          <Badge variant="outline" className="text-xs">Assignment set</Badge>
                        )}
                        {rubricCriteria.length > 0 && (
                          <Badge variant="outline" className="text-xs">{rubricCriteria.length} criteria</Badge>
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

                      {assignment.description && <p className="line-clamp-2 text-sm text-muted-foreground">{assignment.description}</p>}

                      {assignmentTargetCohorts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {assignmentTargetCohorts.map((cohortId) => {
                            const cohortLabel =
                              targetCohorts.find((cohort) => cohort.value === cohortId)?.label ?? cohortId;
                            return (
                              <Badge key={`${assignment.id}-${cohortId}`} variant="outline" className="text-xs">
                                {cohortLabel}
                              </Badge>
                            );
                          })}
                        </div>
                      )}

                      {assignmentTargetDepartments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {assignmentTargetDepartments.map((departmentId) => (
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
                          <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted">
                            {(stats?.released ?? 0) > 0 && <div className="h-full bg-success" style={{ width: `${(((stats?.released ?? 0) / (stats?.total || 1)) * 100)}%` }} />}
                            {((stats?.approved ?? 0) - (stats?.released ?? 0)) > 0 && <div className="h-full bg-primary" style={{ width: `${((((stats?.approved ?? 0) - (stats?.released ?? 0)) / (stats?.total || 1)) * 100)}%` }} />}
                            {((stats?.graded ?? 0) - (stats?.approved ?? 0)) > 0 && <div className="h-full bg-warning" style={{ width: `${((((stats?.graded ?? 0) - (stats?.approved ?? 0)) / (stats?.total || 1)) * 100)}%` }} />}
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
                        <Link to={role === "lecturer" ? lecturerWorkflowTarget?.href ?? `/dashboard/assignments/${assignment.id}` : `/dashboard/assignments/${assignment.id}`}>
                          {role === "lecturer"
                            ? lecturerWorkflowTarget?.label ?? "Open Workflow"
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
